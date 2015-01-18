/* check-pixie.c
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
 * Check program for pixie XML parser library. */
#include <stdio.h>
#include <stdlib.h>
#include "ripple/pixie.h"

const char xml[] =
  "<space:Root>\n"
  "  <TaxRate>7.25</TaxRate>\n"
  "  <Data color=\"blue\" size='small'>\n"
  "    <Category>A</Category>\n"
  "    <Quantity>3</Quantity>\n"
  "    <Price>24.50</Price>\n"
  "  </Data>\n"
  "  <Data color='red' size='medium'>\n"
  "    <Category>B</Category>\n"
  "    <Quantity>1</Quantity>\n"
  "    <Price>89.99</Price>\n"
  "  </Data>\n"
  "</space:Root>\n";

int
begin(struct pixie_parser *parser,
      const char *ns, const char *tag, unsigned n_attrs,
      const char * const *keys, const char * const *values)
{
  unsigned index;
  printf("TAG-BEGIN: %s%s%s (depth %d)\n",
         ns, (ns && *ns) ? ": " : "", tag, parser->depth);
  for (index = 0; index < n_attrs; ++index)
    printf("    ATTR: %s -> \"%s\"\n", keys[index], values[index]);
  return 0;
}

int
end(struct pixie_parser *parser, const char *ns, const char *tag)
{
  printf("TAG-END:   %s%s%s (depth %d)\n",
         ns, (ns && *ns) ? ": " : "", tag, parser->depth);
  return 0;
}

int
check_pixie(void)
{
  int result = EXIT_SUCCESS;
  int rc;
  struct pixie_parser parser;
  if (!(rc = pixie_setup(&parser, NULL, 0, NULL, begin, end))) {
    if (!(rc = pixie_parse(&parser, xml, sizeof(xml))))
      rc = pixie_parse(&parser, NULL, 0);
    pixie_cleanup(&parser);
  }

  if (rc) {
    printf("FAILED (%u,%u): %s\n", parser.line, parser.column,
           pixie_strerror(rc));
    result = EXIT_FAILURE;
  }
  return result;
}
