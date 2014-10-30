/* check-random.c
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
 * Check program for Mersenne-Twister implementation.  Although this
 * is a common algorithm it's helpful to have a well defined
 * implementation that can't change externally to support
 * pseudo-random content generation. */
#include <stdio.h>
#include <stdlib.h>
#include "ripple/random.h"

static unsigned check_seed = 5489;
static unsigned check_state[] = {
  0x00001571, 0x4d98ee96, 0xaf25f095, 0xafd9ba96, 0x6fcbd068,
  0x2cd06a72, 0x384f0100, 0x85b46507, 0x295e8801, 0x0d1b316e,
};
static unsigned check_uint32[] = {
  0xd091bb5c, 0x22ae9ef6, 0xe7e1faee, 0xd5c31f79, 0x2082352c,
  0xf807b7df, 0xe9d30005, 0x3895afe1, 0xa1e24bba, 0x4ee4092b,
};

int
check_random(void)
{
  int result = EXIT_SUCCESS;
  int i;
  rrand_t r;

  rrand_seed(&r, check_seed);
  for (i = 0; i < sizeof(check_state)/sizeof(*check_state); ++i) {
    printf("mt[%d] = 0x%08lx", i, r.mt[i]);
    if (r.mt[i] != check_state[i]) {
      printf(" (expected 0x%08x)", check_state[i]);
      result = EXIT_FAILURE;
    }
    printf("\n");
  }

  for (i = 0; i < sizeof(check_uint32)/sizeof(*check_uint32); ++i) {
    unsigned sample = rrand_uint32(&r);
    printf("uint32: 0x%08x", sample);
    if (sample != check_uint32[i]) {
      printf(" (expected 0x%08x)", check_uint32[i]);
      result = EXIT_FAILURE;
    }
    printf("\n");
  }

  for (i = 0; i < 10; ++i) {
    double sample = rrand_double(&r);
    printf("double: %lf", sample);
    printf("\n");
  }
  return result;
}
