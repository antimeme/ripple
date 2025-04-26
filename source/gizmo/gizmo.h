/**
 * gizmo.h
 * Copyright (C) 2024-2025 by Jeff Gold.
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
 * work out of writing simple games. */
#ifndef GIZMO_H
#define GIZMO_H

struct gizmo;

struct gizmo_point { float x; float y; };

struct gizmo_color {
  unsigned char r;
  unsigned char g;
  unsigned char b;
  unsigned char a;
};

/**
 * Represents a complete graphical application.
 * Callbacks may be NULL if not needed.
 * Gizmo promises the following:
 * - init will be called once before any other calls
 * - once destroy is called nothing else will be
 * - draw will be called to render each frame
 * - update will be called for each frame before draw
 * - width and height will adjusted before init and resize calls */
struct app {
  const char *title;
  const unsigned char *icon;
  unsigned icon_length;
  struct gizmo_color background;
  struct gizmo_color foreground;
  int width;
  int height;

  /* Called by Gizmo if not NULL */
  int  (*init)(struct app *app, struct gizmo *gizmo);
  int  (*update)(struct app *app, unsigned elapsed);
  int  (*draw)(struct app *app, struct gizmo *gizmo);
  int  (*resize)(struct app *app, int width, int height);
  void (*destroy)(struct app *app);
};

void
gizmo_log(const char *message, ...);

/**
 * When the norepeat flag is set, key events that have repeat
 * set to any non-zero value are ignored. */
enum app_key_flags {
  app_key_flag_norepeat = (1 << 0),
};

enum gizmo_scancode {
  gizmo_scancode_none = 0,
  gizmo_scancode_space,
  gizmo_scancode_up,
  gizmo_scancode_down,
  gizmo_scancode_left,
  gizmo_scancode_right,
  gizmo_scancode_w,
  gizmo_scancode_a,
  gizmo_scancode_s,
  gizmo_scancode_d,
};

/**
 * Registers steps to be taken in response to keyboard events.
 * When a key is pressed, the action_down callback is called
 * unless it is NULL and value_down is copied into setting if
 * setting is not NULL.  Likewise for action_up and value_up.
 * Using setting is simpler in cases where the application only
 * wants to respond to a key being held down. */
struct app_key_action {
  enum gizmo_scancode scancode;
  unsigned flags;
  int *setting;
  int value_down;
  int value_up;
  void (*action_down)(struct app *app, int scancode);
  void (*action_up)(struct app *app, int scancode);
};

enum gizmo_mouse_action {
  gizmo_mouse_none = 0,
  gizmo_mouse_down,
  gizmo_mouse_up,
};

struct app_mouse_action {
  enum gizmo_mouse_action type;
  void (*action)(struct app *app, struct gizmo_point *clicked);
};

/**
 * Copies the supplied structures into the app for use in the Gizmo
 * frame loop.  This is a utility routine intended for use by the init
 * callback of an application.
 *
 * @param app Application into which to copy strucutures. */
int
gizmo_app_actions
(struct gizmo *gizmo,
 struct app_key_action   *key_actions,   unsigned n_key_actions,
 struct app_mouse_action *mouse_actions, unsigned n_mouse_actions);

struct gizmo_sound;

/**
 * Fetches a sound clip from the file system.
 * @param sound destination to store sound
 * @param name specifies sound to load
 * @return EXIT_SUCCESS unless something went wrong */
int
gizmo_sound_create(struct gizmo_sound **sound, const char *name);

int
gizmo_sound_play(struct gizmo_sound *sound);

int
gizmo_sound_loop(struct gizmo_sound *sound);

int
gizmo_sound_stop(struct gizmo_sound *sound);

void
gizmo_sound_destroy(struct gizmo_sound *sound);

/* ------------------------------------------------------------------ */
/* Fonts for drawing text */
struct gizmo_font;

/**
 * Fetches a true-type font from the file system.
 * @param font destination into which font gets loaded
 * @param size point size of font
 * @param name specifies which font to use
 * @return EXIT_SUCCESS unless something went wrong */
int
gizmo_font_create(struct gizmo_font **font, unsigned size,
                  const char *name);

/**
 * Reclaim resources associated with a font.
 *
 * @param font */
void
gizmo_font_destroy(struct gizmo_font *font);

/* ------------------------------------------------------------------ */
/* A rudimentary math library */

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
gizmo_check_collide(float sizeA, struct gizmo_point *positionA,
                    struct gizmo_point *velocityA,
                    float sizeB, struct gizmo_point *positionB,
                    struct gizmo_point *velocityB, unsigned elapsed);

struct gizmo_point
gizmo_rotate(struct gizmo_point *point, float dircos, float dirsin);

/* ------------------------------------------------------------------ */
/* Gizmo drawing library */

void
gizmo_color(struct gizmo_color *color, unsigned char r,
            unsigned char g, unsigned char b, unsigned char a);

void
gizmo_color_set(struct gizmo *gizmo, struct gizmo_color *color);

/**
 * Draw text at a specified position.
 *
 * @param render
 * @param font
 * @param position
 * @param message
 * @returns */
int
gizmo_draw_text(struct gizmo *gizmo, struct gizmo_font *font,
                struct gizmo_point *position, const char *message, ...);

/**
 * Renders a closed loop of lines.  The lines are positioned according
 * to the array of points given as the final parameter.  These points
 * will first be rotated according to the cosine and sine values
 * provided.  When in doubt, set dircos to 1.0 and dirsin to 0.0 to
 * leave the points unchanged.  Contents of the points array will NOT
 * be modified.
 *
 * @param gizmo
 * @param position
 * @param size
 * @param dircos
 * @param dirsin
 * @param n_points
 * @param points
 * @returns EXIT_SUCCESS unless something went wrong */
int
gizmo_draw_pointloop(struct gizmo *gizmo, struct gizmo_point *position,
                     float size, float dircos, float dirsin,
                     unsigned n_points, struct gizmo_point *points);

/**
 * Renders an arc centered around a specified position.
 *
 * @param render
 * @param color
 * @param position
 * @param radius
 * @param start
 * @param stop
 * @returns EXIT_SUCCESS unless something went wrong */
int
gizmo_draw_arc(struct gizmo *gizmo, struct gizmo_point *position,
               float radius, float start, float stop);

/**
 * Renders a circle centered around a specified position.
 *
 * @param render
 * @param color
 * @param position
 * @param radius
 * @param start
 * @param stop
 * @returns EXIT_SUCCESS unless something went wrong */
int
gizmo_draw_circle(struct gizmo *gizmo, struct gizmo_point *position,
                  float radius);

#endif /* GIZMO_H */
