/* check-option.c
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
 * Check program for command line option parsing. */
#include <ripple/option.h>

int
check_option(void)
{
  int o_add = 0;
  ropt_t options[] = {
    RIPPLE_OPTION_INTEGER('a', "add", "NUMBER", 0, &o_add,
                          NULL),
  };
  (void)options;
  return 0; /* :TODO: */
}
