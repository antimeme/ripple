/* check-ripple.c
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
 * C test harness for Ripple components. */
#include <time.h>
#ifdef _WIN32
# define snprintf _snprintf
# define getpid   _getpid
typedef int pid_t;
#else
# include <unistd.h>
#endif /* !_WIN32 */
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <ripple/context.h>

extern int check_random(void);
extern int check_tree(void);
extern int check_context(void);
extern int check_stream(void);
extern int check_pixie(void);
extern int check_juju(void);

#define DECLARE_TEST(flags, testfn) \
  { #testfn, flags, (int (*)(void))testfn }
enum test_flags {
  test_flag_skip = (1 << 0),
};
struct test {
  const char *name;
  unsigned flags;
  int (*fn)(void);
} tests[] = {
  DECLARE_TEST(0, check_random),
  DECLARE_TEST(0, check_tree),
  DECLARE_TEST(0, check_context),
  DECLARE_TEST(0, check_stream),
  DECLARE_TEST(0, check_pixie),
  DECLARE_TEST(0, check_juju),
};

struct results {
  unsigned total;
  unsigned skipped;
  unsigned errors;
  unsigned m_failures;
  unsigned n_failures;
  struct failure {
    int result;
    const char *name;
  } *failures;
};

void
perform(struct test *test, struct results *results)
{
  int result;
  printf("\n>>> BEGIN %s\n", test->name);
  if (test->flags & test_flag_skip) {
    printf(">>> SKIPPED %s\n", test->name);
    ++results->skipped;
  } else if ((result = test->fn())) {
    ++results->errors;

    if (results->n_failures >= results->m_failures) {
      unsigned new_m_failures = results->m_failures ?
        2 * results->m_failures : 16;
      void *new_failures = realloc
        (results->failures, sizeof(*results->failures) *
         new_m_failures);
      if (new_failures) {
        results->failures   = new_failures;
        results->m_failures = new_m_failures;
      }
    }
    if (results->n_failures < results->m_failures) {
      results->failures[results->n_failures].name = test->name;
      results->failures[results->n_failures].result = result;
      ++results->n_failures;
    }
    printf(">>> FAIL %s\n", test->name);
  } else printf(">>> PASS %s\n", test->name);
  ++results->total;
}

int
main(int argc, char **argv)
{
  struct results results;
  const char *prefix = "check_";
  int index;

  memset(&results, 0, sizeof(results));
  if (argc > 1) {
    int argi;
    for (argi = 1; argi < argc; ++argi)
      for (index = 0; index < sizeof(tests) / sizeof(*tests); ++index)
        if (!strcmp(argv[argi], tests[index].name) ||
            (!strncmp(tests[index].name, prefix, strlen(prefix)) &&
             !strcmp(argv[argi], tests[index].name + strlen(prefix))))
          perform(&tests[index], &results);
  } else {
    for (index = 0; index < sizeof(tests) / sizeof(*tests); ++index)
      perform(&tests[index], &results);
  }

  printf("\nRESULTS: %u total %u errors %u skipped\n",
         results.total, results.errors, results.skipped);
  if (results.n_failures)
    for (index = 0; index < results.n_failures; ++index)
      printf("  FAILED %s: %d\n",
             results.failures[index].name,
             results.failures[index].result);
  return results.errors ? EXIT_FAILURE : EXIT_SUCCESS;
}
