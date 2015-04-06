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
  PSTATE_CONTENT, /* text inside a tag */
  PSTATE_TAGOPEN, /* inside a start tag */
  PSTATE_ENTITY,  /* something with "<!" */
  PSTATE_COMMENT, /* inside a <!-- comment --> */
  PSTATE_CONTROL, /* <?xml version="1.0" encoding="utf-8"?> */
  PSTATE_TAGNAME, /* after a '<' character */
  PSTATE_TAGSTOP, /* after "<.../" */
  PSTATE_TAGTERM, /* after "</" */
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
  PIXIE_EROOT,
  PIXIE_EINCOMPLETE,
  PIXIE_EBADENTITY,
  PIXIE_EBADATTR,
  PIXIE_EBADESC,
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
  case PIXIE_EROOT:         return "content outside root";
  case PIXIE_EINCOMPLETE:   return "incomplete tag";
  case PIXIE_EBADENTITY:    return "bad entity";
  case PIXIE_EBADATTR:      return "bad attribute definition";
  case PIXIE_EBADESC:       return "unknown escape sequence";
  case PIXIE_ENEGDEPTH:     return "negative depth detected";
  case PIXIE_EUNTERMINATED: return "unterminated tags";
  default: return "unknown error";
  }
}

const char *pixie_logstr = "pixie";
#define logstr pixie_logstr

/**
 * Configure a buffer for use.  This is intended for use on an
 * unintialized buffer and may result in memory leaks if called
 * on a buffer that has already been set up.
 *
 * @param self buffer to configure
 * @param rctx context to use for memory allocation
 * @return 0 on success or an error code */
static int
pixie_buffer_setup(struct pixie_buffer *self,
                   struct ripple_context *rctx);

/**
 * Reclaim resources used by a buffer.  After this the result of
 * any further calls except pixie_buffer_setup is undefined.
 *
 * @param self buffer to reclaim */
static void
pixie_buffer_cleanup(struct pixie_buffer *self);

/**
 * Return a null-terminated string with buffer contents.
 *
 * @param self buffer to use
 * @return null-terminated string */
static const char *
pixie_buffer_str(struct pixie_buffer *self);

/**
 * Return a null-terminated string with buffer contents
 * and clear the buffer.  The value returned is allocated
 * and will NOT be reclaimed when the buffer is reclaimed.
 * The caller is responsible for cleaning up after it.
 *
 * @param self buffer to use
 * @return non-empty null-terminated string or NULL */
static char *
pixie_buffer_steal(struct pixie_buffer *self);

/**
 * Return the number of bytes in this buffer.
 *
 * @param self buffer to use
 * @return number of bytes in buffer */
static unsigned
pixie_buffer_len(struct pixie_buffer *self);

/**
 * Discard the contents of a buffer.
 *
 * @param self buffer to clear
 * @return self */
static struct pixie_buffer *
pixie_buffer_clear(struct pixie_buffer *self);

/**
 * Add a single character to a buffer.
 *
 * @param c character to add
 * @param self buffer to add to
 * @return 0 on success or negative on error */
static int
pixie_buffer_putc(struct pixie_buffer *self, int c);

/**
 * Add a null-terminated string to a buffer.
 *
 * @param s string to add
 * @param self buffer to add to
 * @return 0 on success or negative on error */
static int
pixie_buffer_puts(const char *s, struct pixie_buffer *self);

/**
 * Copy the contents of one buffer into another.  Anything in
 * the destination buffer is retained with the source data added
 * to the end.
 *
 * @param dst destination buffer to copy into
 * @param src source buffer to copy from
 * @return self */
static int
pixie_buffer_concat(struct pixie_buffer *dst,
                    struct pixie_buffer *src);

/**
 * Configure an attribute structure for use.
 *
 * @param attrs structure to initialize
 * @return 0 on success or a negative error code */
static int
pixie_attrs_setup(struct pixie_attrs *attrs,
                  struct ripple_context *rctx);

/**
 * Reclaim any resoures associated with an attribute structure.
 * After calling this subsequent pixie_attrs_* methods have
 * undefined results until pixie_buffer_setup is called again.
 *
 * @param attrs structure to reclaim */
static void
pixie_attrs_cleanup(struct pixie_attrs *attrs);

/**
 * Erase any existing attribute information.
 *
 * @param attrs structure to clear
 * @return the attrs structure for cascading calls */
static struct pixie_attrs *
pixie_attrs_clear(struct pixie_attrs *attrs);

/**
 * Absorb the current working key and value into the collection.
 * This requires allocation which may fail.
 *
 * @param attrs
 * @return 0 on success or a negative error code */
static int
pixie_attrs_push(struct pixie_attrs *attrs);

/**
 * Return a key buffer
 *
 * @param attrs
 * @return buffer to hold key data */
static struct pixie_buffer *
pixie_attrs_key(struct pixie_attrs *attrs);

/**
 * Return a value buffer
 *
 * @param attrs
 * @return buffer to hold value data */
static struct pixie_buffer *
pixie_attrs_value(struct pixie_attrs *attrs);

/* === Implementation */

static int
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

char *
pixie_buffer_steal(struct pixie_buffer *self)
{
  char *result = self->data;
  if (result)
    /* This should be safe because pixie_buffer__avail and
     * pixie_buffer__alloc reserve space for a terminator. */
    result[self->n_data] = 0;
  self->data = NULL;
  self->n_data = self->m_data = 0;
  return result;
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
  int result = PIXIE_SUCCESS;
  pixie_buffer__alloc(self, 1);
  if (pixie_buffer__avail(self, 1))
    self->data[self->n_data++] = c;
  else result = -PIXIE_EALLOC;
  return result;
}

int
pixie_buffer_puts(const char *s, struct pixie_buffer *self)
{
  int result = PIXIE_SUCCESS;
  unsigned len = strlen(s);
  pixie_buffer__alloc(self, len);
  if (pixie_buffer__avail(self, len)) {
    memcpy(self->data + self->n_data, s, len);
    self->n_data += len;
  } else result = -PIXIE_EALLOC;
  return result;
}

int
pixie_buffer_concat(struct pixie_buffer *self,
                    struct pixie_buffer *other)
{
  int result = PIXIE_SUCCESS;
  pixie_buffer__alloc(self, other->n_data);
  if (pixie_buffer__avail(self, other->n_data)) {
    memcpy(self->data + self->n_data, other->data, other->n_data);
    self->n_data += other->n_data;
  } else result = -PIXIE_EALLOC;
  return result;
}

static int
pixie_attrs_setup(struct pixie_attrs *attrs,
                  struct ripple_context *rctx)
{
  int result = PIXIE_SUCCESS;
  attrs->rctx = rctx;
  attrs->n_attrs = attrs->m_attrs = 0;
  attrs->keys = attrs->values = NULL;
  pixie_buffer_setup(&attrs->key, rctx);
  pixie_buffer_setup(&attrs->value, rctx);
  return result;
}

static void
pixie_attrs_cleanup(struct pixie_attrs *attrs)
{
  pixie_buffer_clear(&attrs->key);
  pixie_buffer_clear(&attrs->value);
  pixie_attrs_clear(attrs);
  ripple_context_free(attrs->rctx, attrs->keys);
  ripple_context_free(attrs->rctx, attrs->values);
}

static struct pixie_attrs *
pixie_attrs_clear(struct pixie_attrs *attrs)
{
  unsigned index;
  for (index = 0; index < attrs->n_attrs; index++) {
    ripple_context_free(attrs->rctx, attrs->keys[index]);
    ripple_context_free(attrs->rctx, attrs->values[index]);
  }
  attrs->n_attrs = 0;
  pixie_buffer_clear(&attrs->key);
  pixie_buffer_clear(&attrs->value);
  return attrs;
}

static int
pixie_attrs_push(struct pixie_attrs *attrs)
{
  int result = PIXIE_SUCCESS;

  /* Attempt to make space for one more attribute plus an
   * additional NULL terminator */
  if (attrs->n_attrs + 2 > attrs->m_attrs) {
    unsigned m_attrs = attrs->n_attrs + 2;
    char **keys = ripple_context_realloc
      (attrs->rctx, attrs->keys, sizeof(char *) * m_attrs);
    if (keys) {
      char **values = ripple_context_realloc
        (attrs->rctx, attrs->values, sizeof(char *) * m_attrs);
      if (values) {
        attrs->m_attrs = m_attrs;
        attrs->values = values;
      }
      attrs->keys = keys;
    }
  }

  if (attrs->n_attrs + 2 <= attrs->m_attrs) {
    attrs->keys[attrs->n_attrs]   = pixie_buffer_steal(&attrs->key);
    attrs->values[attrs->n_attrs] = pixie_buffer_steal(&attrs->value);

    attrs->n_attrs++;
    attrs->keys[attrs->n_attrs] = NULL;
    attrs->values[attrs->n_attrs] = NULL;
  } else result = -PIXIE_EALLOC;
  return result;
}

static struct pixie_buffer *
pixie_attrs_key(struct pixie_attrs *attrs)
{ return &attrs->key; }

static struct pixie_buffer *
pixie_attrs_value(struct pixie_attrs *attrs)
{ return &attrs->value; }

int
pixie_setup(struct pixie_parser *parser,
            struct ripple_context *rctx, unsigned flags,
            pixie_contents_t content, pixie_contents_t comment,
            pixie_tag_begin_t tag_begin, pixie_tag_end_t tag_end)
{
  int result = PIXIE_SUCCESS;
  memset(parser, 0, sizeof(*parser));
  parser->rctx      = rctx;
  parser->flags     = flags;
  parser->content   = content;
  parser->comment   = comment;
  parser->tag_begin = tag_begin;
  parser->tag_end   = tag_end;

  if (!(result = pixie_buffer_setup(&parser->current, rctx)) &&
      !(result = pixie_buffer_setup(&parser->ns, rctx)) &&
      !(result = pixie_attrs_setup(&parser->attrs, rctx)))
    pixie_clear(parser);
  else pixie_cleanup(parser);
  return result;
}

void
pixie_cleanup(struct pixie_parser *parser)
{
  pixie_buffer_cleanup(&parser->current);
  pixie_buffer_cleanup(&parser->ns);
  pixie_attrs_cleanup(&parser->attrs);
}

struct pixie_parser *
pixie_clear(struct pixie_parser *parser)
{
  parser->state = PSTATE_CONTENT;
  parser->line = 1;
  parser->column = 0;

  pixie_buffer_clear(&parser->current);
  pixie_buffer_clear(&parser->ns);
  pixie_attrs_clear(&parser->attrs);
}

int
pixie_parse(struct pixie_parser *parser,
            const char *data, unsigned n_data)
{
  int result = PIXIE_SUCCESS;
  int index = 0;
  
  if (!n_data || !data) { /* indicates termination of stream */
    switch (parser->state) {
    case PSTATE_CONTENT: {
      if (parser->depth > 0)
        result = -PIXIE_EUNTERMINATED;
      else if (pixie_buffer_len(&parser->current) && parser->content)
        result = parser->content
          (parser, pixie_buffer_str(&parser->current));
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
  }

  while ((result >= PIXIE_SUCCESS) && (index < n_data)) {
    int c = data[index++];

    switch (parser->state) {
    case PSTATE_CONTENT: { /* collect text outside of tags */
      RIPPLE_DEBUG(parser->rctx, logstr, "CONTENT: %d %c\n", c, c);
      if (c == '<') {
        if (parser->content)
          result = parser->content
            (parser, pixie_buffer_str(&parser->current));
        parser->state = PSTATE_TAGOPEN;
        pixie_buffer_clear(&parser->current);
      } else if ((parser->depth == 0) && !isspace(c) &&
                 (parser->flags & PIXIE_FLAG_STRICT)) {
        printf("ZING '%c' %u %d\n", c, c, isspace(c));
        result = -PIXIE_EROOT;
      } else result = pixie_buffer_putc(&parser->current, c);
    } break;

    case PSTATE_TAGOPEN: { /* determine the type of tag */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGOPEN: %d %c\n", c, c);
      if (c == '/') {
        parser->state = PSTATE_TAGTERM;
      } else if (c == '!') {
        parser->state = PSTATE_ENTITY;
      } else if (c == '?') {
        parser->state = PSTATE_CONTROL;
      } else if (isspace(c)) {
        /* skip leading whitespace */
      } else {
        result = pixie_buffer_putc(&parser->current, c);
        parser->state = PSTATE_TAGNAME;
      }
    } break;

    case PSTATE_ENTITY: { /* ignore entities but notice comments */
      RIPPLE_DEBUG(parser->rctx, logstr, "ENTITY: %d %c", c, c);
      if ((c == '-') && !pixie_buffer_len(&parser->current)) {
        parser->state = PSTATE_COMMENT;
        result = pixie_buffer_putc(&parser->current, c);
      } if (c == '>') {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(&parser->current);
      } else result = pixie_buffer_putc(&parser->current, c);
    } break;

    case PSTATE_COMMENT: { /* ignore comments until close marker */
      RIPPLE_DEBUG(parser->rctx, logstr, "COMMENT: %d %c", c, c);
      if ((c == '>') && (pixie_buffer_len(&parser->current) >= 2)) {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(&parser->current);
      } else if (c == '-') {
        result = pixie_buffer_putc(&parser->current, c);
      } else pixie_buffer_clear(&parser->current);
    } break;

    case PSTATE_CONTROL: { /* ignore contents of control tags */
      RIPPLE_DEBUG(parser->rctx, logstr, "CONTROL: %d %c", c, c);
      if (c == '>') {
        parser->state = PSTATE_CONTENT;
        pixie_buffer_clear(&parser->current);
      }
    } break;

    case PSTATE_TAGNAME: { /* parse tag name and namespace */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGNAME: %d %c", c, c);
      if (isspace(c)) {
        pixie_attrs_clear(&parser->attrs);
        parser->state = PSTATE_ATTRIB;
      } else if (c == ':') {
        if (pixie_buffer_len(&parser->ns))
          result = pixie_buffer_putc(&parser->ns, ':');
        if (result >= 0)
          result = pixie_buffer_concat(&parser->ns, &parser->current);
        pixie_buffer_clear(&parser->current);
      } else if (c == '/') {
        parser->state = PSTATE_TAGSTOP;
      } else if (c == '>') {
        if (parser->tag_begin)
          result = parser->tag_begin
            (parser, pixie_buffer_str(&parser->ns),
             pixie_buffer_str(&parser->current), 0, NULL, NULL);
        pixie_buffer_clear(&parser->current);
        pixie_buffer_clear(&parser->ns);
        parser->depth++;

        parser->state = PSTATE_CONTENT;
      } else result = pixie_buffer_putc(&parser->current, c);
    } break;

    case PSTATE_TAGTERM: { /* slashes in tags must be followed by '>' */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGTERM: %d %c", c, c);
      if (c == ':') {
        if (pixie_buffer_len(&parser->ns))
          result = pixie_buffer_putc(&parser->ns, ':');
        if (!result)
          result = pixie_buffer_concat(&parser->ns, &parser->current);
        pixie_buffer_clear(&parser->current);
      } else if (c == '>') {
        if (parser->depth > 0) {
          parser->depth--;
          if (parser->tag_end)
            result = parser->tag_end(parser,
                                     pixie_buffer_str(&parser->ns),
                                     pixie_buffer_str(&parser->current));
          pixie_buffer_clear(&parser->current);
          pixie_buffer_clear(&parser->ns);

          parser->state = PSTATE_CONTENT;
        } else result = -PIXIE_ENEGDEPTH;
      } else result = pixie_buffer_putc(&parser->current, c);
    } break;

    case PSTATE_TAGSTOP: { /* slashes in tags must be followed by '>' */
      RIPPLE_DEBUG(parser->rctx, logstr, "TAGSTOP: %d %c", c, c);
      if (c == '>') {
        if (parser->tag_begin)
          result = parser->tag_begin
            (parser, pixie_buffer_str(&parser->ns),
             pixie_buffer_str(&parser->current), parser->attrs.n_attrs,
             (const char *const *)parser->attrs.keys,
             (const char *const *)parser->attrs.values);
        if (!result && parser->tag_end)
          result = parser->tag_end
            (parser, pixie_buffer_str(&parser->ns),
             pixie_buffer_str(&parser->current));
        pixie_buffer_clear(&parser->current);
        pixie_buffer_clear(&parser->ns);
        pixie_attrs_clear(&parser->attrs);

        parser->state = PSTATE_CONTENT;
      } else result = -PIXIE_EINCOMPLETE;
    } break;

    case PSTATE_ATTRIB: { /* search for the start of an attribute */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRIB: %d %c", c, c);
      if (c == '/') {
        parser->state = PSTATE_TAGSTOP;
      } else if (c == '>') {
        if (parser->tag_begin)
          result = parser->tag_begin
            (parser, pixie_buffer_str(&parser->ns),
             pixie_buffer_str(&parser->current), parser->attrs.n_attrs,
             (const char * const*)parser->attrs.keys,
             (const char * const*)parser->attrs.values);
        pixie_buffer_clear(&parser->current);
        pixie_buffer_clear(&parser->ns);
        pixie_attrs_clear(&parser->attrs);
        parser->depth++;

        parser->state = PSTATE_CONTENT;
      } else if (!isspace(c)) {
        result = pixie_buffer_putc(pixie_attrs_key(&parser->attrs), c);

        parser->state = PSTATE_ATTRKEY;
      }
    } break;

    case PSTATE_ATTRKEY: { /* get an attribute name */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRKEY: %d %c", c, c);
      if (c == '=') {
        parser->state = PSTATE_ATTRQUO;
      } else if (c == '>') {
        result = -PIXIE_EBADATTR;
      } else if (isspace(c)) {
        parser->state = PSTATE_ATTREQ;
      } else result = pixie_buffer_putc
               (pixie_attrs_key(&parser->attrs), c);
    } break;

    case PSTATE_ATTREQ: { /* search for an equal sign */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTREQ: %d %c", c, c);
      if (c == '=')
        parser->state = PSTATE_ATTRQUO;
      else if (!isspace(c)) {
        if (parser->flags & PIXIE_FLAG_ATTRNOVAL) {
          result = pixie_attrs_push(&parser->attrs);
          parser->state = PSTATE_ATTRIB;
        } else result = -PIXIE_EBADATTR;
      }
    } break;

    case PSTATE_ATTRQUO: { /* search for an end quote */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRQUO: %d %c", c, c);
      if ((c == '\'') || (c == '"')) {
        parser->quote = c;
        parser->state = PSTATE_ATTRVAL;
      } else if (!isspace(c))
        result = -PIXIE_EBADATTR;
    } break;

    case PSTATE_ATTRVAL: { /* get the attribute value */
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRVAL: %d %c", c, c);
      if (c == '\\')
        parser->state = PSTATE_ATTRESC;
      else if (c == parser->quote) {
        result = pixie_attrs_push(&parser->attrs);
        parser->state = PSTATE_ATTRIB;
      } else result = pixie_buffer_putc(pixie_attrs_value
                                        (&parser->attrs), c);
    } break;

    case PSTATE_ATTRESC: { /* process backslash escape in attributes */
      int esc;
      RIPPLE_DEBUG(parser->rctx, logstr, "ATTRESC: %d %c", c, c);
      switch (c) {
      case 'n': esc = '\n'; break;
      case 'r': esc = '\r'; break;
      case 't': esc = '\t'; break;
      case 'f': esc = '\f'; break;
      case '\\': esc = '\\'; break;
      case '\'': esc = '\''; break;
      case '"': esc = '"'; break;
      default:
        result = -PIXIE_EBADESC;
      }
      if (!result)
        result = pixie_buffer_putc(pixie_attrs_value
                                   (&parser->attrs), esc);

      parser->state = PSTATE_ATTRVAL;
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
