/* ripple/tree.h
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
 * A template based balanced binary tree implementation.  Using this
 * requires declaring the RIPPLE_TREE_DEFINE macro with the following
 * arguments:
 *
 *   - name: unique tree identifier ([A-Za-z][A-Za-z0-9]*)
 *   - node_t: type of tree node
 *   - cmpfn(a, b): returns a == b ? 0 : ((a > b) ? 1 : -1)
 *   - nodefn(a): returns tree data associated with node
 *
 * This generates non-recursive functions for inserting, deleting and
 * finding nodes with names of the form ripple_tree_operation_##name##.
 * An additional recursive function named ripple_tree_map_##name## is
 * generated for applying arbitrary operations to all nodes.
 *
 * The cmpfn and nodefn can be macros or inline functions for improved
 * efficiency.  The advantage of this implementation is that no
 * allocation is necessary, which avoids memory fragmentation.
 *
 * All generated functions are static and not intended to leave the
 * translation unit.  The intention is that more appropriate functions
 * intended for external use can be defined with more context.
 * Functions with two contiguous underscore characters are part of the
 * internal implementation and should not be called in source code
 * outside of this file.  They are subject to change without notice.
 *
 * This implementation is adapted from: http://neil.brown.name/blog/AVL
 * Balance is maintained as an Adelson-Velskii and Landis' tree.  More
 * detail: http://en.wikipedia.org/wiki/AVL_tree */
#ifndef RIPPLE_TREE_H
#define RIPPLE_TREE_H

#ifdef __cplusplus
extern "C" {
#endif

/* Control structure for tree membership.  This is defined universally
 * even though that reduces type safety so that node structures can
 * be completely defined before RIPPLE_TREE_DEFINE is invoked. */
struct ripple_tree_data {
  void *children[2];
  int balance:2;
};

/* Creates functions and data types necessary to manage a
 * self-balancing binary tree. */
#define RIPPLE_TREE_DEFINE(name, node_t, nodefn, cmpfn)                \
                                                                       \
static inline int                                                      \
ripple_tree__balanced_##name(node_t *node)                             \
{ return (nodefn(node)->balance < 0); }                                \
                                                                       \
static inline node_t *                                                 \
ripple_tree__child_##name(node_t *node, int direction)                 \
{ return (node_t*)(nodefn(node)->children[direction]); }               \
                                                                       \
static inline node_t **                                                \
ripple_tree__childp_##name(node_t *node, int direction)                \
{ return (node_t**)(&nodefn(node)->children[direction]); }             \
                                                                       \
/** Find a matching node.                                              \
 *  @returns a node that matches or NULL if none exists */             \
node_t *                                                               \
ripple_tree_find_##name(node_t *tree, node_t *target)                  \
{                                                                      \
  while (tree && cmpfn(target, tree))                                  \
    tree = ripple_tree__child_##name(tree, cmpfn(target, tree) > 0);   \
  return tree;                                                         \
}                                                                      \
                                                                       \
/** Recursively applies a function to all tree nodes in order. */      \
typedef void (*ripple_tree_mapfn_##name##_t)(void *, node_t*);         \
void                                                                   \
ripple_tree_map_##name(node_t *tree, void *data,                       \
                        ripple_tree_mapfn_##name##_t mapfn)            \
{                                                                      \
  if (tree) {                                                          \
    ripple_tree_map_##name                                             \
      (ripple_tree__child_##name(tree, 0), data, mapfn);               \
    mapfn(data, tree);                                                 \
    ripple_tree_map_##name                                             \
      (ripple_tree__child_##name(tree, 1), data, mapfn);               \
  }                                                                    \
}                                                                      \
                                                                       \
/** Perform a two step rotation and return the new top. */             \
static node_t *                                                        \
ripple_tree__rotate_2_##name(node_t **top, int dir)                    \
{                                                                      \
  node_t *B, *C, *D, *E;                                               \
  B = *top;                                                            \
  D = ripple_tree__child_##name(B, dir);                               \
  C = ripple_tree__child_##name(D, 1 - dir);                           \
  E = ripple_tree__child_##name(D, dir);                               \
                                                                       \
  *top = D;                                                            \
  nodefn(D)->children[1 - dir] = B;                                    \
  nodefn(B)->children[dir] = C;                                        \
  nodefn(B)->balance = -1;                                             \
  nodefn(D)->balance = -1;                                             \
  return E;                                                            \
}                                                                      \
                                                                       \
/** Perform a three step rotation and return the new top. */           \
static node_t *                                                        \
ripple_tree__rotate_3_##name(node_t **top, int dir, int third)         \
{                                                                      \
  node_t *result = NULL;                                               \
  node_t *B, *F, *D, *C, *E;                                           \
  B = *top;                                                            \
  F = ripple_tree__child_##name(B, dir);                               \
  D = ripple_tree__child_##name(F, 1 - dir);                           \
  C = ripple_tree__child_##name(D, 1 - dir);                           \
  E = ripple_tree__child_##name(D, dir);                               \
                                                                       \
  *top = D;                                                            \
  nodefn(D)->children[1-dir] = B;                                      \
  nodefn(D)->children[dir] = F;                                        \
  nodefn(B)->children[dir] = C;                                        \
  nodefn(F)->children[1-dir] = E;                                      \
  nodefn(D)->balance = -1;                                             \
                                                                       \
  /* assume both trees are balanced */                                 \
  nodefn(B)->balance = nodefn(F)->balance = -1;                        \
                                                                       \
  if (third == -1)                                                     \
    result = NULL;                                                     \
  else if (third == dir) { /* insertion at E unbalanced B */           \
    nodefn(B)->balance = 1 - dir;                                      \
    result = E;                                                        \
  } else { /* insertion at C unbalanced F */                           \
    nodefn(F)->balance = dir;                                          \
    result = C;                                                        \
  }                                                                    \
  return result;                                                       \
}                                                                      \
                                                                       \
static void                                                            \
ripple_tree__rebalance_insert_##name(node_t **top, node_t *target)     \
{                                                                      \
  node_t *path = *top;                                                 \
  if (!ripple_tree__balanced_##name(path)) {                           \
    int first = (cmpfn(path, target) < 0);                             \
    if (nodefn(path)->balance != first) {                              \
      nodefn(path)->balance = -1;                                      \
      path = ripple_tree__child_##name(path, first);                   \
    } else {                                                           \
      int second = (cmpfn(target, ripple_tree__child_##name            \
                          (path, first)) > 0);                         \
      if (first == second)                                             \
        path = ripple_tree__rotate_2_##name(top, first);               \
      else {                                                           \
        int third;                                                     \
        /* Details of the 3 point rotate depend on the third step.     \
         * However there may not be a third step, if the third point   \
         * of the rotation is the newly inserted point.  In that       \
         * case record the third step as neither */                    \
        path = ripple_tree__child_##name                               \
          (ripple_tree__child_##name(path, first), second);            \
        if (cmpfn(target, path))                                       \
          third = -1;                                                  \
        else third = (cmpfn(path, target) < 0);                        \
        path = ripple_tree__rotate_3_##name(top, first, third);        \
      }                                                                \
    }                                                                  \
  }                                                                    \
                                                                       \
  /* Each node in path is currently balanced.                          \
   * Until we find target, mark each node as balance                   \
   * in the direction of target because we know we have                \
   * inserted target there */                                          \
  while (path && cmpfn(target, path)) {                                \
    int next = (cmpfn(target, path) > 0);                              \
    nodefn(path)->balance = next;                                      \
    path = ripple_tree__child_##name(path, next);                      \
  }                                                                    \
}                                                                      \
                                                                       \
/** Inset target node into the tree.                                   \
 *  @returns 1 on success or 0 if matching target already existed */   \
int                                                                    \
ripple_tree_insert_##name(node_t **treep, node_t *target)              \
{                                                                      \
  int result = 0;                                                      \
  node_t *tree = *treep;                                               \
  node_t **top = treep;                                                \
  while (tree && cmpfn(target, tree)) {                                \
    int next = (cmpfn(target, tree) > 0);                              \
    if (!ripple_tree__balanced_##name(tree))                           \
      top = treep;                                                     \
    treep = ripple_tree__childp_##name(tree, next);                    \
    tree = *treep;                                                     \
  }                                                                    \
  if (!tree) {                                                         \
    nodefn(target)->children[0] = NULL;                                \
    nodefn(target)->children[1] = NULL;                                \
    nodefn(target)->balance = -1;                                      \
    *treep = target;                                                   \
    ripple_tree__rebalance_insert_##name(top, target);                 \
      result = 1;                                                      \
  }                                                                    \
  return result;                                                       \
}                                                                      \
                                                                       \
static node_t *                                                        \
ripple_tree__swap_del_##name(node_t **targetp,                         \
                              node_t **treep, int dir)                 \
{                                                                      \
  node_t *targetn = *targetp;                                          \
  node_t *tree = *treep;                                               \
                                                                       \
  *targetp = tree;                                                     \
  *treep = ripple_tree__child_##name(tree, 1 - dir);                   \
  nodefn(tree)->children[0] = ripple_tree__child_##name(targetn, 0);   \
  nodefn(tree)->children[1] = ripple_tree__child_##name(targetn, 1);   \
  nodefn(tree)->balance = nodefn(targetn)->balance;                    \
  return targetn;                                                      \
}                                                                      \
                                                                       \
static node_t **                                                       \
ripple_tree__rebalance_del_##name(node_t **treep, node_t *target,      \
                                   node_t **targetp)                   \
{                                                                      \
  /* each node from treep down towards target, but excluding the       \
   * last, will have a subtree grow and need rebalancing */            \
  node_t *targetn = *targetp;                                          \
                                                                       \
  for (;;) {                                                           \
    node_t * tree = *treep;                                            \
    int dir = (cmpfn(target, tree) > 0);                               \
                                                                       \
    if (ripple_tree__child_##name(tree, dir) == NULL)                  \
      break;                                                           \
                                                                       \
    if (ripple_tree__balanced_##name(tree))                            \
      nodefn(tree)->balance = 1 - dir;                                 \
    else if (nodefn(tree)->balance == dir)                             \
      nodefn(tree)->balance = -1;                                      \
    else {                                                             \
      int second = nodefn(ripple_tree__child_##name                    \
                          (tree, 1 - dir))->balance;                   \
      if (second == dir)                                               \
        ripple_tree__rotate_3_##name                                   \
          (treep, 1 - dir,                                             \
           nodefn(ripple_tree__child_##name                            \
                  (ripple_tree__child_##name(tree, 1 - dir),           \
                   dir))->balance);                                    \
        else if (second == -1) {                                       \
          ripple_tree__rotate_2_##name(treep, 1 - dir);                \
            nodefn(tree)->balance = 1 - dir;                           \
            nodefn(*treep)->balance = dir;                             \
        } else                                                         \
          ripple_tree__rotate_2_##name(treep, 1 - dir);                \
            if (tree == targetn)                                       \
              targetp = ripple_tree__childp_##name(*treep, dir);       \
    }                                                                  \
    treep = ripple_tree__childp_##name(tree, dir);                     \
  }                                                                    \
  return targetp;                                                      \
}                                                                      \
                                                                       \
/** Remove a node matching the target if present.                      \
 *  @returns matching node or NULL if none present */                  \
node_t *                                                               \
ripple_tree_delete_##name(node_t **treep, node_t *target)              \
{                                                                      \
  node_t *tree = *treep;                                               \
  node_t **top = treep;                                                \
  node_t **targetp = NULL;                                             \
  int dir;                                                             \
                                                                       \
  while (tree) {                                                       \
    dir = (cmpfn(target, tree) > 0);                                   \
    if (!cmpfn(target, tree))                                          \
      targetp = treep;                                                 \
    if (ripple_tree__child_##name(tree, dir) == NULL)                  \
      break;                                                           \
    if (ripple_tree__balanced_##name(tree) ||                          \
        (nodefn(tree)->balance == (1 - dir) &&                         \
         ripple_tree__balanced_##name                                  \
         (ripple_tree__child_##name(tree, 1 - dir))))                  \
      top = treep;                                                     \
    treep = ripple_tree__childp_##name(tree, dir);                     \
    tree = *treep;                                                     \
  }                                                                    \
                                                                       \
  if (targetp) {                                                       \
    /* adjust balance, but don't lose 'targetp' */                     \
    targetp = ripple_tree__rebalance_del_##name                        \
      (top, target, targetp);                                          \
                                                                       \
    /* We have re-balanced everything, it remains only to              \
     * swap the end of the path (*treep) with the deleted item         \
     * (*targetp) */                                                   \
    return ripple_tree__swap_del_##name(targetp, treep, dir);          \
  } else return NULL;                                                  \
}

#ifdef __cplusplus
}
#endif
#endif /* RIPPLE_TREE_H */
