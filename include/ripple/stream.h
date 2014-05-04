/* ripple/stream.h
 * Copyright (C) 2010-2014 by Jeff Gold.
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
 *
 * Streams are an abstraction representing a continuous sequence of
 * bytes.  This resembles the stdio FILE structure but has a well
 * defined extension mechanism which makes it easy to create
 * additional stream types with custom behavior, such as capitalizing
 * every other word or wrapping with Transport Layer Security (TLS). */
#ifndef RIPPLE_STREAM_H
#define RIPPLE_STREAM_H
#include <stdio.h>
#include <ripple/context.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef int (*ripple_stream_close_t)(void *context);
typedef int (*ripple_stream_read_t)
(void *context, void *buffer, size_t count);
typedef int (*ripple_stream_write_t)
(void *context, const void *buffer, size_t count);

struct ripple_stream {
  struct ripple_context *rctx;
  void *context;
  ripple_stream_close_t close;
  ripple_stream_read_t  read;
  ripple_stream_write_t write;
};

/** Reclaim resources associated with a stream. */
void
ripple_stream_cleanup(struct ripple_stream *rstream);

/** Read a single byte from the specified stream. */
int
ripple_stream_getc(struct ripple_stream *rstream);

/** Read up to count bytes from the specified stream into buffer. */
int
ripple_stream_read(struct ripple_stream *rstream, void *buffer,
                   size_t count);

/** Write up to count bytes from the specified stream from buffer. */
int
ripple_stream_write(struct ripple_stream *rstream, const void *buffer,
                    size_t count);

/** Write formatted data to the specified stream. */
int
ripple_stream_printf(struct ripple_stream *rstream,
                     const char *format, ...) RIPPLE_PRINTF(2);

/** Write formatted data to the specified stream, using already
 *  packages arguments.  This would be necessary to use a stream as a
 *  backing for some other function taking formatted arguments. */
int
ripple_stream_vprintf(struct ripple_stream *rstream,
                      const char *format, va_list args);

/** Return a handle checking readiness of stream using mechanisms such
 *  as select, poll, epoll or kqueue.  Streams for which such
 *  monitoring doesn't make sense will return a value less than zero. */
int
ripple_stream_descriptor(struct ripple_stream *rstream);

/* === Stream Implementations */

/** Create a stream that uses a dynamically allocated memory.  Data
 *  written to the stream can be read back out.
 *
 *  @param rstream stream structure to populate
 *  @param rctx context to use for allocation and logging
 *  @param limit maximum number of bytes to allocate */
void
ripple_stream_setup_memory(struct ripple_stream *rstream,
                           struct ripple_context *rctx,
                           size_t limit, void **buffer);

/** Create a stream using a fixed size block of bytes for both input
 *  and output.  A number of bytes equal to written are considered to
 *  be available for reading when the stream is initialized.
 *  Additional data written to the stream can be read back out.
 *  Writing too many bytes will cause the earliest data to be
 *  overwritten and lost. */
void
ripple_stream_setup_ring(struct ripple_stream *rstream,
                         struct ripple_context *rctx,
                         char *ring, size_t count, size_t written);

/** Creates a stream based on standard I/O library file. */
void
ripple_stream_setup_stdio(struct ripple_stream *rstream,
                          struct ripple_context *rctx, FILE *f);

/** Creates a stream based on opening a file. */
void
ripple_stream_setup_filename(struct ripple_stream *rstream,
                             struct ripple_context *rctx,
                             const char *path, const char *mode);


/** Creates a stream based on a blocking socket.  This can also be
 *  used on Unix file descriptors. */
void
ripple_stream_setup_socket(struct ripple_stream *rstream,
                           struct ripple_context *rctx, int sock);

/** Creates a custom stream with specialized callbacks.  Using NULL
 *  for some of these is acceptable.  A stream with a NULL write is
 *  read only.  A stream with a NULL read is write only. */
void
ripple_stream_setup_custom(struct ripple_stream *rstream,
                           struct ripple_context *rctx, void *context,
                           ripple_stream_close_t close,
                           ripple_stream_read_t  read,
                           ripple_stream_write_t write);

#ifndef   RIPPLE_NO_ABBR
typedef struct ripple_stream rstream_t;
# define rstream_s_memory   ripple_stream_setup_memory
# define rstream_s_ring     ripple_stream_setup_ring
# define rstream_s_socket   ripple_stream_setup_socket
# define rstream_s_stdio    ripple_stream_setup_stdio
# define rstream_s_filename ripple_stream_setup_filename
# define rstream_s_custom   ripple_stream_setup_custom
# define rstream_cleanup    ripple_stream_cleanup
# define rstream_getc       ripple_stream_getc
# define rstream_read       ripple_stream_read
# define rstream_write      ripple_stream_write
# define rstream_printf     ripple_stream_printf
# define rstream_vprintf    ripple_stream_vprintf
#endif /* !RIPPLE_NO_ABBR */

#ifdef __cplusplus
}
#endif
#endif /* RIPPLE_STREAM_H */
