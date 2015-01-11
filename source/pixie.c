/* source/pixie.c
 * Copyright (C) 2015 by Jeff Gold.
 * 
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * ---------------------------------------------------------------------
 * An event driven XML parsing library. */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>

#include "ripple/context.h"
#include "ripple/pixie.h"

/* GraphViz description of state machine:
   
   tbegin=`echo '--- BEGIN XML' | sed 's,-,=,g'`
   tend=`echo '--- END XML' | sed 's,-,=,g'`
   sed -n "/$tbegin/,/$tend/ {/$tbegin/n;/$tend/ "'!p}' \
       source/pixie.c | dot -Tsvg -o pixie-xml.svg
   === BEGIN XML
   digraph PixieXML
   {
       CONTENT [peripheries=2];
       CONTENT -> TAGOPEN [label="<"];
       CONTENT -> CONTENT [label="*"];
       TAGOPEN -> ENTITY  [label="!"];
       TAGOPEN -> CONTROL [label="?"];
       TAGOPEN -> TAGNAME [label="*"];
       ENTITY  -> COMMENT [label="-"];
       ENTITY  -> ENTITY  [label="*"];
       ENTITY  -> CONTENT [label=">"];
       CONTROL -> CONTROL [label="*"];
       CONTROL -> CONTENT [label=">"];
       COMMENT -> CONTENT [label=">"];
       COMMENT -> COMMENT [label="-"];
       COMMENT -> COMMENT [label="*"];
       TAGNAME -> TAGNAME [label="*"];
       TAGNAME -> TAGSTOP [label="/"];
       TAGNAME -> CONTENT [label=">"];
       TAGSTOP -> CONTENT [label=">"];
       TAGTERM -> TAGTERM [label="*"];
       TAGTERM -> CONTENT [label=">"];
       TAGOPEN -> TAGTERM [label="/"];
       TAGNAME -> ATTRIB  [label="space"];
       ATTRIB  -> ATTRIB  [label="space"];
       ATTRIB  -> ATTRKEY [label="*"];
       ATTRKEY -> ATTREQ  [label="space"];
       ATTREQ  -> ATTREQ  [label="*"];
       ATTREQ  -> ATTRQUO [label="="];
       ATTRKEY -> ATTRQUO [label="="];
       ATTRKEY -> ATTRKEY [label="*"];
       ATTRQUO -> ATTRVAL [label="\""];
       ATTRQUO -> ATTRQUO [label="space"];
       ATTRVAL -> ATTRVAL [label="*"];
       ATTRVAL -> ATTRIB  [label="\""];
       ATTRIB  -> TAGSTOP [label="/"];
       ATTRIB  -> CONTENT [label=">"];
       ATTRVAL -> ATTRESC [label="\\ "];
       ATTRESC -> ATTRVAL [label="*"];
   }
   === END XML */
enum pixie_state {
  PSTATE_CONTENT, // text inside a tag
  PSTATE_TAGOPEN, // inside a start tag
  PSTATE_ENTITY,  // something with "<!"
  PSTATE_COMMENT, // <!-- comment -->
  PSTATE_CONTROL,
  PSTATE_TAGNAME,
  PSTATE_TAGSTOP,
  PSTATE_TAGTERM,
  PSTATE_ATTRIB,
  PSTATE_ATTRKEY,
  PSTATE_ATTREQ,
  PSTATE_ATTRQUO,
  PSTATE_ATTRVAL,
  PSTATE_ATTRESC,
};

enum pixie_status {
  PIXIE_SUCCESS = 0,
  PIXIE_EINTERNAL,
  PIXIE_EALLOC,
  PIXIE_EINCOMPLETE,
  PIXIE_EBADATTR,
  PIXIE_ENEGDEPTH,
  PIXIE_EUNTERMINATED,
};

const char *
pixie_strerror(int e)
{
  switch (-e) {
  case PIXIE_SUCCESS:       return "success";
  case PIXIE_EINTERNAL:     return "internal error";
  case PIXIE_EALLOC:        return "failed to allocate memory";
  case PIXIE_EINCOMPLETE:   return "incomplete tag";
  case PIXIE_EBADATTR:      return "bad attribute definition";
  case PIXIE_ENEGDEPTH:     return "negative depth detected";
  case PIXIE_EUNTERMINATED: return "unterminated tags";
  default: return "unknown error";
  }
}

const char *pixie_logstr = "pixie";
#define logstr pixie_logstr

struct pixie_buffer {
  struct ripple_context *rctx;
  unsigned m_data; /* number of bytes available */
  unsigned n_data; /* number of bytes in use */
  char *data;
};

/**
 * Configure a buffer for use.  This is intended for use on an
 * unintialized buffer and may result in memory leaks if called
 * on a buffer that has already been set up.
 *
 * @param self buffer to configure
 * @param rctx context to use for memory allocation
 * @return self or NULL if memory allcoation fails */
int
pixie_buffer_setup(struct pixie_buffer *self,
                   struct ripple_context *rctx);

/**
 * Reclaim resources used by a buffer.  After this the result of
 * any further calls except pixie_buffer_setup is undefined.
 *
 * @param self buffer to reclaim */
void
pixie_buffer_cleanup(struct pixie_buffer *self);

/**
 * Return a null-terminated string with buffer contents.
 *
 * @param self buffer to use
 * @return null-terminated string */
const char *
pixie_buffer_str(struct pixie_buffer *self);

/**
 * Return the number of bytes in this buffer.
 *
 * @param self buffer to use
 * @return number of bytes in buffer */
unsigned
pixie_buffer_len(struct pixie_buffer *self);

/**
 * Discard the contents of a buffer.
 *
 * @param self buffer to clear
 * @return self */
struct pixie_buffer *
pixie_buffer_clear(struct pixie_buffer *self);

/**
 * Add a single character to a buffer.
 *
 * @param c character to add
 * @param self buffer to add to
 * @return 0 on success and negative on error */
int
pixie_buffer_putc(struct pixie_buffer *self, int c);

/**
 * Add a null-terminated string to a buffer.
 *
 * @param s string to add
 * @param self buffer to add to
 * @return 0 on success and negative on error */
int
pixie_buffer_puts(const char *s, struct pixie_buffer *self);

/**
 * Copy the contents of other into self
 * @param self buffer to append into
 * @param other buffer to copy from 
 * @return self */
int
pixie_buffer_merge(struct pixie_buffer *self,
                   struct pixie_buffer *other);


int
pixie_buffer_setup(struct pixie_buffer *self,
                   struct ripple_context *rctx)
{
  self->rctx = rctx;
  self->data = NULL;
  self->m_data = self->n_data = 0;
  return 0;
}

void
pixie_buffer_cleanup(struct pixie_buffer *self)
{ ripple_context_free(self->rctx, self->data); }

const char *
pixie_buffer_str(struct pixie_buffer *self)
{
  if (self->data) {
    /* This should be safe because pixie_buffer__avail and
     * pixie_buffer__alloc reserve space for a terminator. */
    self->data[self->n_data] = 0;
  }
  return self->data ? self->data : "";
}

unsigned
pixie_buffer_len(struct pixie_buffer *self)
{ return self->n_data; }

struct pixie_buffer *
pixie_buffer_clear(struct pixie_buffer *self)
{
  self->n_data = 0;
  return self;
}

struct pixie_buffer *
pixie_buffer__avail(struct pixie_buffer *self, unsigned size)
{
  return (self->n_data + size + 1 <= self->m_data) ? self : NULL;
}

struct pixie_buffer *
pixie_buffer__alloc(struct pixie_buffer *self, unsigned size)
{
  if (!pixie_buffer__avail(self, size)) {
    unsigned request = self->n_data + size + 1;
    char *data = ripple_context_realloc
      (self->rctx, self->data, request);
    if (data) {
      self->data = data;
      self->m_data = request;
    }
  }
  return self;
}

int
pixie_buffer_putc(struct pixie_buffer *self, int c)
{
  pixie_buffer__alloc(self, 1);
  if (pixie_buffer__avail(self, 1))
    self->data[self->n_data++] = c;
  else return -PIXIE_EALLOC;
  return PIXIE_SUCCESS;
}

int
pixie_buffer_puts(const char *s, struct pixie_buffer *self)
{
  unsigned len = strlen(s);
  pixie_buffer__alloc(self, len);
  if (pixie_buffer__avail(self, len)) {
    memcpy(self->data + self->n_data, s, len);
    self->n_data += len;
  } else return PIXIE_EALLOC;
  return PIXIE_SUCCESS;
}

int
pixie_buffer_merge(struct pixie_buffer *self,
                   struct pixie_buffer *other)
{
  pixie_buffer__alloc(self, other->n_data);
  if (pixie_buffer__avail(self, other->n_data)) {
    memcpy(self->data + self->n_data, other->data, other->n_data);
    self->n_data += other->n_data;
  } else return PIXIE_EALLOC;
  return PIXIE_SUCCESS;
}

struct pixie_attr {
  struct pixie_buffer key;
  struct pixie_buffer value;
  struct pixie_attr   *next;
};

static struct pixie_attr *
pixie__free_attr(struct ripple_context *rctx, struct pixie_attr *attr)
{
  while (attr) {
    struct pixie_attr *next = attr->next;
    pixie_buffer_cleanup(&attr->key);
    pixie_buffer_cleanup(&attr->value);
    ripple_context_free(rctx, attr);
    attr = next;
  }
  return NULL;
}

int
pixie_setup(struct pixie_parser *parser,
            struct ripple_context *rctx, unsigned flags,
            pixie_contents_t contents,
            pixie_tag_begin_t tag_begin,
            pixie_tag_end_t tag_end)
{
  int result = PIXIE_SUCCESS;
  memset(parser, 0, sizeof(*parser));
  parser->rctx = rctx;
  parser->contents  = contents;
  parser->tag_begin = tag_begin;
  parser->tag_end   = tag_end;

  parser->current = ripple_context_malloc
    (rctx, sizeof(*parser->current));
  if (parser->current)
    result = pixie_buffer_setup(parser->current, rctx);
  else result = PIXIE_EALLOC;

  parser->ns = ripple_context_malloc(rctx, sizeof(*parser->ns));
  if (parser->ns)
    result = pixie_buffer_setup(parser->ns, rctx);
  else result = PIXIE_EALLOC;

  /* :TODO: attrs */

  if (result)
    pixie_cleanup(parser);
  else pixie_clear(parser);
  return result;
}

void
pixie_cleanup(struct pixie_parser *parser)
{
  pixie_buffer_cleanup(parser->current);
  ripple_context_free(parser->rctx, parser->current);
  pixie_buffer_cleanup(parser->ns);
  ripple_context_free(parser->rctx, parser->ns);
  /* :TODO: attrs */
}

struct pixie_parser *
pixie_clear(struct pixie_parser *parser)
{
  parser->state = PSTATE_CONTENT;
  parser->line = 1;
  parser->column = 0;

  pixie_buffer_clear(parser->current);
  pixie_buffer_clear(parser->ns);
  /* :TODO: clear attrs */
}

int
pixie_parse(struct pixie_parser *parser,
            const char *data, unsigned n_data)
{
  int result = PIXIE_SUCCESS;
  int index = 0;
  
  while ((result >= PIXIE_SUCCESS) && (index < n_data)) {
    int c = data[index++];

    switch (parser->state) {
    case PSTATE_CONTENT: { /* collect text outside of tags */
      RIPPLE_DEBUG(parser->rctx, logstr, "CONTENT: %d %c\n", c, c);
      if (c == '<') {
        if (parser->contents)
          result = parser->contents
            (parser, pixie_buffer_str(parser->current));
        parser->state = PSTATE_TAGOPEN;
        pixie_buffer_clear(parser->current);
      } else if (pixie_buffer_putc(parser->current, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_TAGOPEN: { /* determine the type of tag */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGOPEN: %d %c\n", c, c);
      if (c == '/') {
        parser->state = PSTATE_TAGTERM;
      } else if (c == '!') {
        parser->state = PSTATE_ENTITY;
      } else if (c == '?') {
        parser->state = PSTATE_CONTROL;
      } else if (isspace(c)) { /* skip leading whitespace */
      } else {
        result = pixie_buffer_putc(parser->current, c);
        parser->state = PSTATE_TAGNAME;
      }
    } break;

    case PSTATE_ENTITY: { /* ignore entities but notice comments */
      RIPPLE_DEBUG(parser->rctx, logstr, "ENTITY: %d %d", c, c);
      if ((c == '-') && !pixie_buffer_len(parser->current)) {
        parser->state = PSTATE_COMMENT;
        if (pixie_buffer_putc(parser->current, c))
          result = -PIXIE_EALLOC;
      } if (c == '>') {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(parser->current);
      } else if (!pixie_buffer_len(parser->current) &&
                 pixie_buffer_putc(parser->current, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_COMMENT: { /* ignore comments until close marker */
      RIPPLE_DEBUG(parser->rctx, logstr, "COMMENT: %d %d", c, c);
      if ((c == '>') && (pixie_buffer_len(parser->current) >= 2)) {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(parser->current);
      } else if (c == '-') {
        if (pixie_buffer_putc(parser->current, c))
          result = -PIXIE_EALLOC;
      } else pixie_buffer_clear(parser->current);
    } break;

    case PSTATE_CONTROL: { /* ignore contents of control tags */
      RIPPLE_DEBUG(parser->rctx, logstr, "CONTROL: %d %d", c, c);
      if (c == '>') {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(parser->current);
      }
    } break;

    case PSTATE_TAGNAME: { /* parse tag name and namespace */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGNAME: %d %d", c, c);
      if (isspace(c)) {
        parser->state = PSTATE_ATTRIB;
      } else if (c == ':') {
        if (pixie_buffer_len(parser->ns))
          if (pixie_buffer_putc(parser->ns, ':'))
            result = -PIXIE_EALLOC;
        if ((result >= 0) && pixie_buffer_merge
            (parser->ns, parser->current))
          result = -PIXIE_EALLOC;
        pixie_buffer_clear(parser->current);
      } else if (c == '/') {
        if (parser->tag_begin)
          result = parser->tag_begin(parser,
                                     pixie_buffer_str(parser->ns),
                                     pixie_buffer_str(parser->current),
                                     NULL, NULL); // FIXME attr null
        if ((result >= 0) && parser->tag_end)
          result = parser->tag_end(parser,
                                   pixie_buffer_str(parser->ns),
                                   pixie_buffer_str(parser->current));
        pixie_buffer_clear(parser->current);
        pixie_buffer_clear(parser->ns);
        parser->state = PSTATE_TAGSTOP;
      } else if (c == '>') {
        if (parser->tag_begin)
          result = parser->tag_begin(parser,
                                     pixie_buffer_str(parser->ns),
                                     pixie_buffer_str(parser->current),
                                     NULL, NULL); // FIXME attr null
        pixie_buffer_clear(parser->current);
        pixie_buffer_clear(parser->ns);
        parser->depth++;
        parser->state = PSTATE_CONTENT;
      } else if (pixie_buffer_putc(parser->current, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_TAGTERM: { /* slashes in tags must be followed by '>' */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGTERM: %d %d", c, c);
      if (c == ':') {
        if (pixie_buffer_len(parser->ns))
          if (pixie_buffer_putc(parser->ns, ':'))
            result = -PIXIE_EALLOC;
        if ((result >= 0) && pixie_buffer_merge
            (parser->ns, parser->current))
          result = -PIXIE_EALLOC;
        pixie_buffer_clear(parser->current);
      } else if (c == '>') {
        if (parser->depth > 0) {
          parser->depth--;
          if (parser->tag_end)
            result = parser->tag_end(parser,
                                     pixie_buffer_str(parser->ns),
                                     pixie_buffer_str(parser->current));
          parser->state = PSTATE_CONTENT;
          pixie_buffer_clear(parser->current);
          pixie_buffer_clear(parser->ns);
        } else result = -PIXIE_ENEGDEPTH;
      } else if (pixie_buffer_putc(parser->current, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_TAGSTOP: { /* slashes in tags must be followed by '>' */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGSTOP: %d %d", c, c);
      if (c == '>') {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(parser->current);
      } else result = -PIXIE_EINCOMPLETE;
    } break;

    case PSTATE_ATTRIB: { /* search for the start of an attribute */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRIB: %d %d", c, c);
      if (c == '/') {
        if (parser->tag_begin)
          result = parser->tag_begin(parser,
                                     pixie_buffer_str(parser->ns),
                                     pixie_buffer_str(parser->current),
                                     NULL, NULL); // FIXME attr
        parser->attrs = pixie__free_attr(parser->rctx, parser->attrs);
        if ((result >= 0) && parser->tag_end)
          result = parser->tag_end(parser,
                                   pixie_buffer_str(parser->ns),
                                   pixie_buffer_str(parser->current));
        pixie_buffer_clear(parser->current);
        pixie_buffer_clear(parser->ns);

        parser->state = PSTATE_TAGSTOP;
      } else if (c == '>') {
        if (parser->tag_begin)
          result = parser->tag_begin
            (parser, pixie_buffer_str(parser->ns),
             pixie_buffer_str(parser->current), NULL, NULL); // FIXME attr
        pixie_buffer_clear(parser->current);
        pixie_buffer_clear(parser->ns);
        parser->attrs = pixie__free_attr(parser->rctx, parser->attrs);
        parser->depth++;

        parser->state = PSTATE_CONTENT;
      } else if (!isspace(c)) {
        struct pixie_attr *newattr =
          ripple_context_malloc(parser->rctx, sizeof(*newattr));
        if (newattr) {
          if ((result = pixie_buffer_setup(&newattr->key, parser->rctx)) >= 0)
            result = pixie_buffer_setup(&newattr->value, parser->rctx);
          else pixie_buffer_cleanup(&newattr->key);

          if (result >= 0) {
            newattr->next = parser->attrs;
            parser->attrs = newattr;
            parser->state = PSTATE_ATTRKEY;
            if (pixie_buffer_putc(&newattr->key, c))
              result = -PIXIE_EALLOC;
          } else ripple_context_free(parser->rctx, newattr);
        } else result = -PIXIE_EALLOC;
      }
    } break;

    case PSTATE_ATTRKEY: { /* get an attribute name */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRKEY: %d %d", c, c);
      if (c == '=') {
        parser->state = PSTATE_ATTRQUO;
      } else if (c == '>') {
        result = -PIXIE_EBADATTR;
      } else if (isspace(c)) {
        parser->state = PSTATE_ATTREQ;
      } else if (pixie_buffer_putc(&parser->attrs->key, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_ATTREQ: { /* search for an equal sign */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTREQ: %d %d", c, c);
      if (c == '=')
        parser->state = PSTATE_ATTRQUO;
      else if (!isspace(c))
        result = -PIXIE_EBADATTR;
    } break;

    case PSTATE_ATTRQUO: { /* search for a quote */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRQUO: %d %d", c, c);
      if ((c == '\'') || (c == '"')) {
        parser->quote = c;
        parser->state = PSTATE_ATTRVAL;
      } else if (!isspace(c))
        result = -PIXIE_EBADATTR;
    } break;

    case PSTATE_ATTRVAL: { /* get the attribute value */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRVAL: %d %d", c, c);
      if (c == '\\')
        parser->state = PSTATE_ATTRESC;
      else if (c == parser->quote)
        parser->state = PSTATE_ATTRIB;
      else if (pixie_buffer_putc(&parser->attrs->value, c))
        result = -PIXIE_EALLOC;
    } break;

    case PSTATE_ATTRESC: { /* process backslash escape sequences */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRESC: %d %d", c, c);
      parser->state = PSTATE_ATTRVAL;
      if (pixie_buffer_putc(&parser->attrs->value, c))
        result = -PIXIE_EALLOC;
    } break;

    default: result = -PIXIE_EINTERNAL;
    }

    /* Update line and column for use in understanding parsing
     * error conditions.  To keep this up to date it's important
     * that the code above never skips this section, for example
     * by using continue instead of break. */
    /* This is intended to detect line endings regardless of Unix
     * (\n), DOS (\r\n) or MacOS (\r) style */
    if (!result) {
      ++parser->column;
      if ((c == '\n') || (c == '\r')) {
        parser->column = 0;
        if ((c != '\n') || (parser->last != '\r'))
          ++parser->line;
      }
      parser->last = c;
    }
  }
  return result;
}

int
pixie_finish(struct pixie_parser *parser) {
  int result = PIXIE_SUCCESS;

  switch (parser->state) {
    case PSTATE_CONTENT: {
      if (parser->contents && pixie_buffer_len(parser->current))
        result = parser->contents
          (parser, pixie_buffer_str(parser->current));
      /* Arguably we should really be whinging about having
       * data past the final tag.  Maybe some kind of strict
       * mode will be introduced in the future. */
    } break;
    case PSTATE_TAGOPEN:
    case PSTATE_TAGSTOP:
    case PSTATE_TAGTERM:
    case PSTATE_COMMENT:
    case PSTATE_CONTROL:
    case PSTATE_ENTITY:
    case PSTATE_ATTRIB:
    case PSTATE_ATTRKEY:
    case PSTATE_ATTREQ:
    case PSTATE_ATTRQUO:
    case PSTATE_ATTRVAL:
    case PSTATE_ATTRESC:
      result = -PIXIE_EINCOMPLETE;
    default: result = -PIXIE_EINTERNAL;
  }
  return result;
}
