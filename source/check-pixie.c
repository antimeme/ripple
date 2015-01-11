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
 * Check program for pixie parser. */
#include <stdio.h>
#include <stdlib.h>
#include "ripple/pixie.h"

const char xml[] =
  "<Root>"
  "  <TaxRate>7.25</TaxRate>"
  "  <Data>"
  "    <Category>A</Category>"
  "    <Quantity>3</Quantity>"
  "    <Price>24.50</Price>"
  "  </Data>"
  "  <Data>"
  "    <Category>B</Category>"
  "    <Quantity>1</Quantity>"
  "    <Price>89.99</Price>"
  "  </Data>"
  "</Root>";

int
begin(struct pixie_xml_parser *parser, const char *ns, const char *tag,
      const char * const *keys, const char * const *values)
{
  printf("TAG: %s (depth %d)\n", tag, parser->depth);
  return 0;
}

int
check_pixie(void)
{
  int result = EXIT_SUCCESS;
  int rc;
  struct pixie_xml_parser parser;
  if (!(rc = pixie_xml_setup(&parser, NULL, 0, NULL, begin, NULL)))
    rc = pixie_xml_parse(&parser, xml, sizeof(xml));

  if (rc) {
    printf("FAILED (%u,%u): %s\n", parser.line, parser.column,
           pixie_strerror(rc));
    result = EXIT_FAILURE;
  }
  return result;
}
