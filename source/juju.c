/* source/juju.c
 * Copyright (C) 2014 by Jeff Gold.
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
 * A simple JSON parsing library. */
#include <string.h>
#include <time.h>
#ifdef _WIN32
# define snprintf _snprintf
# define getpid   _getpid
typedef int pid_t;
#else
# include <unistd.h>
#endif /* !_WIN32 */

#include <config.h>
#include <ripple/context.h>
#include <ripple/juju.h>

/* :TODO: */
