/* ripple/random.h
 * Copyright (C) 2011-2013 by Jeff Gold.
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
 * An implementation of the Mersenne Twister.  For details see:
 *     http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html */
#ifndef RIPPLE_RANDOM_H
#define RIPPLE_RANDOM_H
#ifdef __cplusplus
extern "C" {
#endif

struct ripple_random {
  unsigned mti;
  unsigned long mt[624];
};

/* Configures a random object based on an unsigned integer seed. */
void
ripple_random_seed(struct ripple_random *rrand, unsigned seed);

/* Returns a pseudo-randomly generated unsigned integer. */
unsigned long
ripple_random_uint32(struct ripple_random *rrand);

#ifndef RIPPLE_NO_ABBR
typedef struct ripple_random rrand_t;
#define rrand_seed    ripple_random_seed
#define rrand_uint32  ripple_random_uint32
#endif /* !RIPPLE_NO_ABBR */

#ifdef __cplusplus
}
#endif
/* ------------------------------------------------------------------ */
/* local variables:                                                   */
/* indent-tabs-mode: nil                                              */
/* tab-width: 2; c-indent-level: 2; c-basic-offset: 2                 */
/* end:                                                               */
#endif /* RIPPLE_RANDOM_H */
