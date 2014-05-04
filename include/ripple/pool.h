/* ripple/pool.h
 * Copyright (C) 2006-2010 by Jeff Gold.
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
 * Resource pools are intended to simplify management of memory and
 * other resources.  When a pool is destroyed, it cleans up anything
 * allocated through it.  As an example, a network connection might
 * have an associated pool though which resources are acquired.  When
 * the connection terminates the pool gets cleaned up, eliminating
 * the need to reclaim resources individually. */
#ifndef RIPPLE_POOL_H
#define RIPPLE_POOL_H
#include <ripple/context.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void *(*ripple_pool_reclaim_t)(struct ripple_context *rctx,
                                       void *resource);
struct ripple_pool_resource {
  void *resource;
  ripple_pool_reclaim_t reclaim;
};

struct ripple_pool {
  struct ripple_context  outctx; /* used by clients */
  struct ripple_context *rctx; /* requests get forwarded to this */

  /* memory management data */
  void **blocks;
  unsigned nblocks;
  unsigned mblocks;

  /* generic resource data */
  struct ripple_pool_resource *resources;
  unsigned nresources;
  unsigned mresources;
};

/** Create an empty resource pool. */
void
ripple_pool_setup(struct ripple_pool *rpool,
                  struct ripple_context *rctx);

/** Reclaim a resource pool and all allocated resources. */
void
ripple_pool_cleanup(struct ripple_pool *rpool);

/** Retrieve a context object which automatically allocates 
 *  memory within the resource pool. */
static inline struct ripple_context *
ripple_pool_context(struct ripple_pool *rpool)
{ return &rpool->outctx; }

/** Add a resource to the pool. */
int
ripple_pool_add(struct ripple_pool *rpool, void *resource,
                ripple_pool_reclaim_t reclaim);

/** Remove a resource from the pool without reclaiming it. */
void
ripple_pool_del(struct ripple_pool *rpool, void *resource);

/** Add a socket to a resource pool. */
void
ripple_pool_socket(struct ripple_pool *rpool, int sock);

/** Add a standard I/O file to a resource pool. */
void
ripple_pool_stdio(struct ripple_pool *rpool, FILE *f);

#ifndef RIPPLE_NO_ABBR
typedef struct ripple_pool rpool_t;
# define rpool_setup   ripple_pool_setup
# define rpool_cleanup ripple_pool_cleanup
# define rpool_context ripple_pool_context
# define rpool_add     ripple_pool_add
# define rpool_del     ripple_pool_del
# define rpool_socket  ripple_pool_socket
# define rpool_stdio   ripple_pool_stdio
#endif /* !RIPPLE_NO_ABBR */

#ifdef __cplusplus
}
#endif
/* ------------------------------------------------------------------ */
/* local variables:                                                   */
/* compile-command: "make -k -C ../.. check CFLAGS=\"-g -Wall\""      */
/* indent-tabs-mode: nil                                              */
/* tab-width: 2                                                       */
/* c-indent-level: 2                                                  */
/* c-basic-offset: 2                                                  */
/* end:                                                               */
#endif /* RIPPLE_POOL_H */
