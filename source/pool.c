/* pool.c
 * Copyright (C) 2006-2015 by Jeff Gold.
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
 * Resource management pools.  A call to ripple_pool_cleanup will
 * free all allocated memory not otherwise reclaimed and call the
 * specified reclaim callback for each resource given.
 */

#include <config.h>
#include "ripple/pool.h"

void
ripple_pool_setup(struct ripple_pool* rpool,
                  struct ripple_context* rctx)
{
  rpool->rctx = rctx;
  rpool->blocks = NULL;
  rpool->nblocks = rpool->mblocks = 0;
  rpool->resources = NULL;
  rpool->nresources = rpool->mresources = 0;
}

void
ripple_pool_cleanup(struct ripple_pool* rpool)
{
  struct ripple_context* rctx = rpool->rctx;
  unsigned index;
  for (index = 0; index < rpool->nblocks; index++)
    ripple_context_free(rctx, rpool->blocks[index]);
  ripple_context_free(rctx, rpool->blocks);
  for (index = 0; index < rpool->nblocks; index++)
    rpool->resources[index].reclaim
      (rctx, rpool->resources[index].resource);
  ripple_context_free(rctx, rpool->resources);
  ripple_pool_setup(rpool, rctx);
}

void*
ripple_pool_realloc(struct ripple_pool* rpool,
                    void* block, size_t size)
{
  struct ripple_context* rctx = rpool->rctx;
  void* result = ripple_context_realloc(rctx, block, size);

  if (block) {
    unsigned index;
    for (index = 0; index < rpool->nblocks; index++) {
      if (block == rpool->blocks[index]) {
        if (size) {
          if (result)
            rpool->blocks[index] = result;
        } else {
          rpool->blocks[index] = rpool->blocks[--rpool->nblocks];
        }
        break;
      }
    }
  } else if (size && result) {
    if (rpool->nblocks >= rpool->mblocks) { // need more block space?
      unsigned mblocks = rpool->mblocks ? (rpool->mblocks * 2) : 16;
      void** blocks = ripple_context_realloc
        (rctx, rpool->blocks, mblocks * sizeof(void*));
      if (blocks) {
        rpool->blocks = blocks;
        rpool->mblocks = mblocks;
      }
    }
    if (rpool->nblocks < rpool->mblocks) {
      rpool->blocks[rpool->nblocks++] = block;
    } else { // no room to store allocation -- give up
      ripple_context_free(rctx, result);
      result = NULL;
    }
  }
  return result;
}

inline void*
ripple_pool_malloc(struct ripple_pool* rpool, size_t size)
{
  return ripple_pool_realloc(rpool, NULL, size);
}

inline void
ripple_pool_free(struct ripple_pool* rpool, void* block)
{
  ripple_pool_realloc(rpool, block, 0);
}

int
ripple_pool_add(struct ripple_pool* rpool, void* resource,
                ripple_pool_reclaim_t reclaim)
{
  struct ripple_context* rctx = rpool->rctx;
  int result = 0;
  if (rpool->nresources >= rpool->mresources) {
    unsigned mresources = rpool->mresources ?
      (rpool->mresources * 2) : 16;
    struct ripple_pool_resource* resources =
      ripple_context_realloc(rctx, rpool->resources, mresources *
                             sizeof(struct ripple_pool_resource));
    if (resources) {
      rpool->resources  = resources;
      rpool->mresources = mresources;
    }
  }
  if (rpool->nresources < rpool->mresources) {
    rpool->resources[rpool->nresources++].resource = resource;
    rpool->resources[rpool->nresources++].reclaim  = reclaim;
    result = 1;
  }
  return result;
}

void
ripple_pool_del(struct ripple_pool* rpool, void* resource)
{
  unsigned index;
  for (index = 0; index < rpool->nresources; index++) {
    if (resource == rpool->resources[index].resource) {
      rpool->resources[index] = rpool->resources[--rpool->nresources];
      break;
    }
  }
}
