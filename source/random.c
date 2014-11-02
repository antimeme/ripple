/* ripple/random.c
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
 * Mersenne Twister implementation.  For algorithm details:
 *     http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html */
#include <limits.h>
#include "ripple/random.h"

enum {
  RRAND_N = 624,
  RRAND_M = 397,
  RRAND_MATRIX_A = 0x9908B0DFUL,
  RRAND_UPPER_MASK = 0x80000000UL,
  RRAND_LOWER_MASK = 0x7FFFFFFFUL,
  RRAND_MAXIMUM    = 0xFFFFFFFFUL,
  RRAND_TAOCP2P106 = 1812433253UL,
  RRAND_TEMPER_B   = 0x9D2C5680UL,
  RRAND_TEMPER_C   = 0xEFC60000UL,
};
static const unsigned long mag01[2] = { 0, RRAND_MATRIX_A };

void
ripple_random_seed(struct ripple_random *rrand, unsigned seed)
{
  unsigned mti = 0;
  rrand->mt[mti] = seed & RRAND_MAXIMUM;
  for (mti = 1; mti < RRAND_N; mti++)
    rrand->mt[mti] = (RRAND_TAOCP2P106 *
                      (rrand->mt[mti - 1] ^
                       (rrand->mt[mti - 1] >> 30)) + mti) &
      RRAND_MAXIMUM;
  rrand->mti = mti;
}

unsigned long
ripple_random_uint32(struct ripple_random *rrand)
{
  unsigned long current;
  if (rrand->mti >= RRAND_N) {
    int ii;
    for (ii = 0; ii < RRAND_N - RRAND_M; ii++) {
      current = (rrand->mt[ii] & RRAND_UPPER_MASK) |
        (rrand->mt[ii + 1] & RRAND_LOWER_MASK);
      rrand->mt[ii] = rrand->mt[ii + RRAND_M] ^
        (current >> 1) ^ mag01[current & 1];
    }
    for (; ii < RRAND_N - 1; ii++) {
      current = (rrand->mt[ii] & RRAND_UPPER_MASK) |
        (rrand->mt[ii + 1] & RRAND_LOWER_MASK);
      rrand->mt[ii] = rrand->mt[ii + RRAND_M - RRAND_N] ^
        (current >> 1) ^ mag01[current & 1];
    }
    current = (rrand->mt[RRAND_N - 1] & RRAND_UPPER_MASK) |
      (rrand->mt[0] & RRAND_LOWER_MASK);
    rrand->mt[RRAND_N - 1] = rrand->mt[RRAND_M - 1] ^
      (current >> 1) ^ mag01[current & 1];
    rrand->mti = 0;
  }

  current = rrand->mt[rrand->mti++];
  current ^= current >> 11;
  current ^= (current << 7)  & RRAND_TEMPER_B;
  current ^= (current << 15) & RRAND_TEMPER_C;
  current ^= current >> 18;
  return current;
}

double
ripple_random_double(struct ripple_random *rrand)
{ return ripple_random_uint32(rrand) / (double)UINT_MAX; }
