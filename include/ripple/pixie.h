/* source/pixie.h
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
#ifndef RIPPLE_PIXIE_H
#define RIPPLE_PIXIE_H
#ifdef __cplusplus
extern "C" {
#endif

#include <ripple/context.h>

/* Parsing callbacks for XML.  Each should return zero if successful.
 * A non-zero return should always be a positive integer (negative
 * values are reserved for pixie itself and can be resolved to
 * readable strings using pixie_strerror).  Any error will halt
 * parsing immediately.
 *
 * Note that strings passed as parameters here are exist only for the
 * duration of the callback.  Afterward they may be overwritten with
 * other data.  Any strings which are needed after parsing must be
 * copied by the callback into memory managed outside the parser. */
struct pixie_parser;
typedef int (*pixie_contents_t)(struct pixie_parser *parser,
                                const char *text);
typedef int (*pixie_tag_begin_t)(struct pixie_parser *parser,
                                 const char *ns, const char *tag,
                                 unsigned n_attrs,
                                 const char * const *keys,
                                 const char * const *values);
typedef int (*pixie_tag_end_t)(struct pixie_parser *parser,
                               const char *ns, const char *tag);

enum pixie_flags {
  PIXIE_FLAG_NONE = 0,
  PIXIE_FLAG_ATTRNOVAL = (1 << 0), /* allow attributes without value */
};

/**
 * Configure a parser for use.
 *
 * @param parser
 * @param rctx
 * @param contents
 * @param tag_begin
 * @param tag_end
 * @return zero on success or an error code suitable for use
 *              with pixie_strerror otherwise */
int
pixie_setup(struct pixie_parser *parser,
            struct ripple_context *rctx, unsigned flags,
            pixie_contents_t contents,
            pixie_tag_begin_t tag_begin,
            pixie_tag_end_t tag_end);

/**
 * Reclaim resources used by a parser.
 *
 * @param parser parser to clear
 * @return the parser for cascading calls */
void
pixie_cleanup(struct pixie_parser *parser);

/**
 * Return a parser to a clean state.
 *
 * @param parser parser to clear
 * @return the parser for cascading calls */
struct pixie_parser *
pixie_clear(struct pixie_parser *parser);

/**
 * Process an XML stream using event callbacks.  Call this for each
 * chunk of available data.  Once data is exhausted call
 * pixie_finish to collect any cached content and to check
 * that the stream ended in a valid way.
 *
 * @param parser state for parser
 * @param data chunk of bytes to process (NULL indicates that hte
 *             stream has no more data)
 * @param n_data number of bytes in chunk (zero indicates that the
 *               stream has no more data)
 * @return zero on success, negative on parser errors and positive on
 *         callback errors */
int
pixie_parse(struct pixie_parser *parser,
            const char *data, unsigned n_data);

/**
 * Return a readable string describing a pixie error code.
 *
 * @param e error code
 * @return readable text string describing an error */
const char *
pixie_strerror(int e);

/**
 * Source for ripple context log messages. */
const char *pixie_logstr;

/* === Internal implementation details */

struct pixie_buffer {
  struct ripple_context *rctx;
  unsigned m_data; /* number of bytes available */
  unsigned n_data; /* number of bytes in use */
  char *data;
};

struct pixie_attrs {
  struct ripple_context *rctx;
  struct pixie_buffer key;
  struct pixie_buffer value;

  unsigned n_attrs;
  unsigned m_attrs;
  char **keys;
  char **values;
};

struct pixie_parser {
  /* Callbacks may read these values directly */
  unsigned depth;
  unsigned line;
  unsigned column;

  /* Everything else should be considered opaque */
  struct ripple_context *rctx;
  enum pixie_flags flags;
  unsigned state;
  int quote;
  int last;
  pixie_contents_t  contents;
  pixie_tag_begin_t tag_begin;
  pixie_tag_end_t   tag_end;
  struct pixie_buffer current;
  struct pixie_buffer ns;
  struct pixie_attrs attrs;
  void *chunk;
};

#ifdef __cplusplus
}
#endif
#endif /* RIPPLE_PIXIE_H */
