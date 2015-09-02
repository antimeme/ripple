/* check-context.c
 * Copyright (C) 2006-2011 by Jeff Gold.
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
 * Check program for generic memory management and logging. */
#include <time.h>
#ifdef _WIN32
# define snprintf _snprintf
# define getpid   _getpid
# define localtime_r(timep, result) localtime(timep)
typedef int pid_t;
#else
# include <unistd.h>
#endif /* !_WIN32 */
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <ripple/context.h>

static char buffer[1024] = {0};
static unsigned count;
static void
check_logfn(void *context, const char *message)
{
  strncat(buffer, message, sizeof(buffer) - 1 - count);
  strncat(buffer, "\n", sizeof(buffer) - 1 - count);
  count = strlen(buffer);
}

int
check_context(void)
{
  int result = EXIT_SUCCESS;
  static const char* timefmt = "[%Y-%m-%d %H:%M]";
  static char expected[1024] = {0};
  const char* apple  = "apple";
  const char* banana = "banana";
  const char* grape  = "grape";
  const char* tomato = "tomato";
  rctx_t rctx;

  rctx_setup(&rctx, RCTX_LOG_NOTICE, NULL, NULL, NULL, check_logfn);
  rctx_timefmt(&rctx, timefmt);
  rctx_srcflags(&rctx, apple, RCTX_LOG_DEBUG |
                RCTX_FLAG_SOURCE | RCTX_FLAG_STAMP |
                RCTX_FLAG_LEVEL  | RCTX_FLAG_CODE  |
                RCTX_FLAG_FUNC   | RCTX_FLAG_PID);
  rctx_srcflags(&rctx, banana, RCTX_LOG_NOTICE | RCTX_FLAG_SOURCE);
  rctx_srcflags(&rctx, grape, RCTX_LOG_NOTICE |
                RCTX_FLAG_CODE);

  RCTX_NOTICE(&rctx, NULL,   "fruit flavored tests");
  RCTX_NOTICE(&rctx, apple,  "fruit - %s", apple);
  RCTX_NOTICE(&rctx, banana, "fruit - %s", banana);
  RCTX_NOTICE(&rctx, grape,  "fruit - %s", grape);
  RCTX_NOTICE(&rctx, tomato, "fruit - %s", tomato);
  RCTX_DEBUG(&rctx, banana, "this message SHOULD NOT appear");
  RCTX_WARNING(&rctx, apple, "extra long message - "
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789.."
               "012345678901234567890123456789..");
  RCTX_WARNING(&rctx, apple,
               "invalid message - \n ABC\01\02\03\nDEF");
  RCTX_ASSERT(&rctx, banana, apple == banana);
  RCTX_ASSERT(&rctx, apple,  apple != banana);
  rctx_cleanup(&rctx);

  { /* Expected results are dynamically generated. */
    static char *expected_template =
      "fruit flavored tests\n"
      "%s %d apple NOTICE %s:%d: check_context: fruit - apple\n"
      "banana fruit - banana\n"
      "%s:%d: fruit - grape\n"
      "fruit - tomato\n"
      "%s %d apple WARNING %s:%d: check_context: extra long message - "
      "012345678901234567890123456789..012345678901234567890123456789.."
      "012345678901234567890123456789..012345678901234567890123456789.."
      "012345678901234567890123456789..012345678901234567890123456789.."
      "012345678901234567890123456789..012345678901234567890123456789.."
      "\n%s %d apple WARNING %s:%d: check_context: invalid message -"
      "   ABC### DEF\n";
    struct tm tmval;
    char timestr[64];
    time_t now = time(NULL);
    pid_t pid = getpid();
    tmval = *localtime_r(&now, &tmval);
    strftime(timestr, sizeof timestr, timefmt, &tmval);
    snprintf(expected, sizeof(expected), expected_template,
             timestr, pid, __FILE__, __LINE__ - 41,
             __FILE__, __LINE__ - 40,
             timestr, pid, __FILE__, __LINE__ - 30,
             timestr, pid, __FILE__, __LINE__ - 29);
  }

  if (strcmp(expected, buffer)) {
    unsigned i;
    for (i = 0; expected[i] && expected[i] == buffer[i]; i++);

    fprintf(stderr, "FAILED: unexpected string contents "
            "(%u/%u: '%c'(%x) - '%c'(%x))\n", i,
            (unsigned)strlen(expected),
            (char)expected[i], (int)expected[i],
            (char)buffer[i], (int)buffer[i]);
    printf("=== Expected:\n%s\n", expected + i);
    printf("=== Observed:\n%*s\n", count - i, buffer + i);
    result = EXIT_FAILURE;
  }
  return result;
}
