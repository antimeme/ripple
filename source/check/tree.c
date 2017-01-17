/* check-tree.c
 * Copyright (C) 2013 by Jeff Gold.
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
 *
 * Check program for balanced binary trees. */
#include <stdlib.h>
#include <stdarg.h>
#include <stdio.h>
#include <ripple/tree.h>

static int result = EXIT_SUCCESS;
static void
fail(char *message, ...)
{
  va_list args;
  va_start(args, message);
  fprintf(stderr, "FAILED: ");
  vfprintf(stderr, message, args);
  fprintf(stderr, "\n");
  va_end(args);
  result = EXIT_FAILURE;
}

struct node {
  struct ripple_tree_data treedata;
  int value;
};

static inline int
cmpfn(struct node *a, struct node *b)
{ return a->value == b->value ? 0 : (a->value > b->value ? 1 : -1); }

static inline struct ripple_tree_data *
nodefn(struct node *a) { return &a->treedata; }

RIPPLE_TREE_DEFINE(check, struct node, nodefn, cmpfn);


static void
tree_sum(unsigned *mapsum, struct node *node)
{ *mapsum += node->value; }

static void
tree_is_sorted(void *unused, struct node *node)
{
  static int last = 0;
  if (node->value > last)
    last = node->value;
  else fail("tree not sorted: %d - %d\n", last, node->value);
}

int
check_tree(void)
{
  int current;
  int values[] = {9, 1, 8, 2, 7, 3, 6, 4, 5};
  unsigned sum = 0, mapsum = 0;
  struct node nodes[sizeof(values) / sizeof(*values)];
  struct node *tree = NULL;
  for (current = 0; current < sizeof(nodes) / sizeof(*nodes);
       current++) {
    nodes[current].value = values[current];
    ripple_tree_insert_check(&tree, &nodes[current]);
  }

  /* Ensure that all inseted nodes can be found */
  for (current = 0; current < sizeof(nodes) / sizeof(*nodes);
       current++) {
    struct node *found;
    if (!(found = ripple_tree_find_check(tree, &nodes[current])))
      fail("find failed for inserted node: %d",
           &nodes[current].value);
    if (found->value != nodes[current].value)
      fail("find value mismatch: %d != %d",
           found->value, nodes[current].value);
  }

  /* Check that map function does the right thing. */
  for (current = 0; current < sizeof(nodes) / sizeof(*nodes);
       current++)
    sum += nodes[current].value;
  ripple_tree_map_check
    (tree, &mapsum, (ripple_tree_mapfn_check_t)tree_sum);
  if (sum != mapsum)
    fail("mismatched sums: %d - %d", sum, mapsum);
  ripple_tree_map_check
    (tree, &result, (ripple_tree_mapfn_check_t)tree_is_sorted);

  /* Remove nodes with odd numbered values */
  for (current = 0; current < sizeof(nodes) / sizeof(*nodes);
       current++) {
    if (nodes[current].value % 2)
      if (!ripple_tree_delete_check(&tree, &nodes[current]))
        fail("delete failed for node: %d",
             nodes[current].value);
  }

  /* Check that only even numbered nodes are found. */
  for (current = 0; current < sizeof(nodes) / sizeof(*nodes);
       current++) {
    struct node *found = ripple_tree_find_check(tree, &nodes[current]);
    if ((found == NULL) != (nodes[current].value % 2))
      fail("find returned unexpected results: %p - %d",
           found, nodes[current].value);
  }

  return result;
}
