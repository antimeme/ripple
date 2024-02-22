/**
 * gizmo.h
 * Copyright (C) 2024 by Jeff Gold.
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
 * Gizmo is a simplistic framework intended to take some of the chore
 * work out of writing SDL2 applications. */
#ifndef GIZMO_H
#define GIZMO_H

#include <SDL2/SDL.h>
#include <SDL2/SDL2_gfxPrimitives.h>
#include <SDL2/SDL_ttf.h>
#include <SDL2/SDL_image.h>

/**
 * Represents a complete graphical application.
 * Callbacks may be NULL if not needed.
 * Gizmo promises the following:
 * - init will be called before any other calls
 * - once destroy is called nothing else will be (until another init)
 * - draw will be called to render each frame
 * - width and height will be before init and resize calls
 * - key_actions and mouse_actions will be called at appropriate times
 * - update will be called for each frame before draw
 *  */
struct app {
  int width;
  int height;
  const unsigned char *icon;
  unsigned icon_length;

  /* Called by Gizmo if not NULL */
  int  (*init)(struct app *app, void *);
  void (*destroy)(struct app *app);
  void (*resize)(struct app *app, int width, int height);
  int  (*update)(struct app *app, unsigned elapsed);
  int  (*draw)(struct app *app, SDL_Renderer *rndr);
};

/**
 * When the norepeat flag is set, key events that have repeat
 * set to any non-zero value are ignored. */
enum app_key_flags {
  app_key_flag_norepeat = (1 << 0),
};

/**
 * Registers steps to be taken in response to keyboard events.
 * When a key is pressed, the action_down callback is called
 * unless it is NULL and value_down is copied into setting if
 * setting is not NULL.  Likewise for action_up and value_up.
 * Using setting is simpler in cases where the application only
 * wants to respond to a key being held down. */
struct app_key_action {
  int scancode;
  unsigned flags;
  int *setting;
  int value_down;
  int value_up;
  void (*action_down)(struct app *, SDL_Event *);
  void (*action_up)(struct app *, SDL_Event *);
};

struct app_mouse_action {
  int type;
  void (*action)(struct app *, SDL_Event *);
};

/**
 * Copies the supplied structures into the app for use in the Gizmo
 * frame loop.  This is a utility routine intended for use by the init
 * callback of an application.
 *
 * @param app Application into which to copy strucutures. */
int
gizmo_app_actions
(void *context,
 struct app_key_action   *key_actions,   unsigned n_key_actions,
 struct app_mouse_action *mouse_actions, unsigned n_mouse_actions);

int
gizmo_app_font(TTF_Font **mono, unsigned size);

/* ------------------------------------------------------------------ */
/* A rudimentary math library */

/**
 * Represents a point in two dimensional space.
 * Note that SDL_Point exists, but uses integer types which are
 * less convenient for trigonometry operations. */
struct point { float x; float y; };

/**
 * Return a random number between 0 and 1 selected using a
 * uniform distribution. */
float
gizmo_uniform();

/**
 * Return non-zero iff value is close enough to zero */
int
gizmo_zeroish(float value);

/**
 * Use the quadradic equation to find polynomial roots. */
void
gizmo_quadratic_real_roots(unsigned *n_roots, float *roots,
                           float c, float b, float a);

/**
 * Return non-zero iff the spherical objects represented by given
 * position, velocity and size collide within the elapsed time. */
int
gizmo_check_collide(float sizeA, struct point *positionA,
              struct point *velocityA,
              float sizeB, struct point *positionB,
              struct point *velocityB, unsigned elapsed);
struct point
gizmo_rotate_origin(struct point *point, float dircos, float dirsin);

/**
 * Renders a polygon as a closed loop of lines.  The lines are
 * positioned according to the array of points given as the final
 * parameter.  These points will first be rotated according to
 * the cosine and sine values provided.  When in doubt, set
 * dircos to 1.0 and dirsin to 0.0 to leave the points unchanged.
 * Note that the contents of the points array will NOT be modified. */
int
gizmo_draw_polygon(SDL_Renderer *renderer, float size,
                   struct point *position,
                   float dircos, float dirsin,
                   unsigned n_points, struct point *points);

#endif /* GIZMO_H */
