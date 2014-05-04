/* ripple/stream.c
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
 * A composeable stream abstraction. */
#include <ripple/stream.h>

void
ripple_stream_cleanup(struct ripple_stream *rstream)
{
  if (rstream && rstream->close)
    rstream->close(rstream->context);
}

int
ripple_stream_getc(struct ripple_stream *rstream)
{
  return 0; /* :TODO: */
}

int
ripple_stream_read(struct ripple_stream *rstream, void *buffer,
                   size_t count)
{
  return 0; /* :TODO: */
}

int
ripple_stream_write(struct ripple_stream *rstream, const void *buffer,
                    size_t count)
{
  return 0; /* :TODO: */
}

int
ripple_stream_printf(struct ripple_stream *rstream,
                     const char *format, ...)
{
  return 0; /* :TODO: */
}

int
ripple_stream_vprintf(struct ripple_stream *rstream,
                      const char *format, va_list args)
{
  return 0; /* :TODO: */
}
