/**
 * gizmo.c
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
#include <stdlib.h>
#include "gizmo.h"
#include "asteroids.h"

/* Find an appropriate implementation for a millisecond clock */
#ifdef __EMSCRIPTEN__
#  include <emscripten.h>
#  include <emscripten/html5.h>
unsigned long long now() {
  return (unsigned long long)emscripten_get_now();
}
#else
unsigned long long now() { return SDL_GetTicks(); }
#endif

static int
gizmo_setupSDL(SDL_Renderer **renderer, SDL_Window **window)
{
  int result = EXIT_SUCCESS;
  SDL_DisplayMode mode;

  if (SDL_Init(SDL_INIT_VIDEO) < 0) {
    fprintf(stderr, "Failed to initialize SDL: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else if (SDL_GetCurrentDisplayMode(0, &mode) < 0) {
    fprintf(stderr, "Failed to initialize SDL: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else if (!(*window = SDL_CreateWindow
               ("Gizmo", SDL_WINDOWPOS_UNDEFINED,
                SDL_WINDOWPOS_UNDEFINED,
                mode.w * 9 / 10, mode.h * 4 / 5, 0))) {
    fprintf(stderr, "Failed to create window with SDL: %s\n",
            SDL_GetError());
    result = EXIT_FAILURE;
  } else if (SDL_FALSE == SDL_SetHint
             (SDL_HINT_RENDER_SCALE_QUALITY, "linear")) {
    fprintf(stderr, "Failed to set hint SDL: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else if (!(*renderer = SDL_CreateRenderer
               (*window, -1, SDL_RENDERER_ACCELERATED))) {
    fprintf(stderr, "Failed to create renderer with SDL: %s\n",
            SDL_GetError());
    result = EXIT_FAILURE;
  } else if (TTF_Init() < 0) {
    fprintf(stderr, "Failed to initialize TTF: %s\n",
            SDL_GetError());
    result = EXIT_FAILURE;
  }

  return result;
}

static int
gizmo_setup_icon(SDL_Window *window, const char *data, unsigned length)
{
  int result = EXIT_SUCCESS;
  SDL_Surface *icon = NULL;
  SDL_RWops *image = NULL;

  if ((image = SDL_RWFromConstMem(data, length)) == NULL) {
    fprintf(stderr, "Failed to create SDL_RWops: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else if ((icon = IMG_Load_RW(image, 0)) == NULL) {
    fprintf(stderr, "Failed to load image: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else SDL_SetWindowIcon(window, icon);

  if (image != NULL)
    SDL_RWclose(image);
  return result;
}

struct gizmo {
  SDL_Renderer *renderer;
  SDL_Window *window;
  unsigned long long last;
  struct app *app;
  unsigned done;

  struct app_key_action *key_actions;
  unsigned n_key_actions;
  struct app_mouse_action *mouse_actions;
  unsigned n_mouse_actions;
};

int
gizmo_app_font(TTF_Font **mono, unsigned size)
{
  int result = EXIT_SUCCESS;

  TTF_CloseFont(*mono);

  /* https://www.fontspace.com/brass-mono-font-f29885 */
  if (mono && !(*mono = TTF_OpenFont
                ("./apps/fonts/brass-mono.ttf", size))) {
    result = EXIT_FAILURE;
    fprintf(stderr, "Failed to open mono font: %s\n", TTF_GetError());
  }

  /* :TODO: TTF_CloseFont */
  return result;
}

int
gizmo_app_actions
(void *context,
 struct app_key_action   *key_actions,   unsigned n_key_actions,
 struct app_mouse_action *mouse_actions, unsigned n_mouse_actions)
{
  int result = EXIT_SUCCESS;
  struct gizmo *gizmo = (struct gizmo*)context;
  struct app_key_action   *new_key_actions = NULL;
  struct app_mouse_action *new_mouse_actions = NULL;

  if (!(new_key_actions = malloc
        (n_key_actions * sizeof(*key_actions)))) {
    fprintf(stderr, "Failed to allocate %lu bytes for "
            "key actions\n", n_key_actions * sizeof(*key_actions));
    result = EXIT_FAILURE;
  } else if (!(new_mouse_actions = malloc
               (n_mouse_actions * sizeof(*mouse_actions)))) {
    fprintf(stderr, "Failed to allocate %lu bytes for "
            "event actions\n", n_mouse_actions *
            sizeof(*mouse_actions));
    result = EXIT_FAILURE;
  } else {
    unsigned ii;

    gizmo->n_key_actions = n_key_actions;
    gizmo->key_actions = new_key_actions;
    for (ii = 0; ii < n_key_actions; ++ii)
      gizmo->key_actions[ii] = key_actions[ii];
    new_key_actions = NULL;

    gizmo->n_mouse_actions = n_mouse_actions;
    gizmo->mouse_actions = new_mouse_actions;
    for (ii = 0; ii < n_mouse_actions; ++ii)
      gizmo->mouse_actions[ii] = mouse_actions[ii];
    new_mouse_actions = NULL;
  }

  free(new_key_actions);
  free(new_mouse_actions);
  return result;
}

/* ------------------------------------------------------------------ */
/* A rudimentary math library */

/**
 * Return a random number between 0 and 1 selected using a
 * uniform distribution. */
float
gizmo_uniform() { return ((float)rand() / (float)RAND_MAX); }

/**
 * Return non-zero iff value is close enough to zero */
int
gizmo_zeroish(float value)
{
  const float epsilon = 0.00000000001;
  return (value <= epsilon) && (value >= -epsilon);
}

/**
 * Use the quadradic equation to find polynomial roots. */
void
gizmo_quadratic_real_roots(unsigned *n_roots, float *roots,
                           float c, float b, float a)
{
  if (!gizmo_zeroish(a)) {
    const float discriminant = b * b - 4 * a * c;

    if (gizmo_zeroish(discriminant)) {
      roots[(*n_roots)++] = -b / (2 * a);
    } else if (discriminant > 0) {
      const float sqrtdisc = sqrtf(discriminant);
      roots[(*n_roots)++] = (-b + sqrtdisc) / (2 * a);
      roots[(*n_roots)++] = (-b - sqrtdisc) / (2 * a);
    }
  } else roots[(*n_roots)++] = -c / b;
}

/**
 * Return non-zero iff the spherical objects represented by given
 * position, velocity and size collide within the elapsed time. */
int
gizmo_check_collide(float sizeA, struct point *positionA,
                    struct point *velocityA,
                    float sizeB, struct point *positionB,
                    struct point *velocityB, unsigned elapsed)
{
  int result = 0;
  const float gap = sizeA + sizeB;
  struct point dp = {
    positionA->x - positionB->x,
    positionA->y - positionB->y };
  struct point dm = {
    velocityA->x - velocityB->x,
    velocityA->y - velocityB->y};

  if (dp.x * dp.x + dp.y * dp.y > gap * gap) {
    float roots[2];
    unsigned n_roots = 0;
    unsigned ii;

    gizmo_quadratic_real_roots
      (&n_roots, roots,
       dp.x * dp.x + dp.y * dp.y - gap * gap,
       2 * (dp.x * dm.x + dp.y * dm.y),
       dm.x * dm.x + dm.y * dm.y);
    for (ii = 0; ii < n_roots; ++ii)
      if ((roots[ii] >= 0) && (roots[ii] < elapsed))
        result = 1;
  } else result = 1;
  return result;
}

struct point
gizmo_rotate_origin(struct point *point, float dircos, float dirsin)
{
  struct point result = {
    point->x * dircos - point->y * dirsin,
    point->x * dirsin + point->y * dircos };
  return result;
}

int
gizmo_draw_polygon(SDL_Renderer *renderer, float size,
                   struct point *position,
                   float dircos, float dirsin,
                   unsigned n_points, struct point *points)
{
  int result = EXIT_SUCCESS;
  struct point previous = { 0, 0 };
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_points); ++ii) {
    struct point start = ii ? previous :
      gizmo_rotate_origin(&points[ii], dircos, dirsin);
    struct point end = gizmo_rotate_origin
      (&points[(ii + 1) % n_points], dircos, dirsin);
    previous = end;

    if (SDL_RenderDrawLine(renderer,
                           (int)(position->x + size * start.x),
                           (int)(position->y + size * start.y),
                           (int)(position->x + size * end.x),
                           (int)(position->y + size * end.y)) < 0) {
      fprintf(stderr, "Failed to draw line with SDL: %s\n",
              SDL_GetError());
      result = EXIT_FAILURE;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */

void
gizmo_frame(void *context)
{
  struct gizmo *gizmo = (struct gizmo *)context;
  int result = EXIT_SUCCESS;
  SDL_Event event;
  unsigned ii;

  while (gizmo->app && !gizmo->done && SDL_PollEvent(&event)) {
    switch (event.type) {
    case SDL_QUIT:
    case SDL_WINDOWEVENT_CLOSE:
      gizmo->done = 1;
      break;
    case SDL_WINDOWEVENT:
      switch (event.window.event) {
      case SDL_WINDOWEVENT_RESIZED:
      case SDL_WINDOWEVENT_SIZE_CHANGED:
        gizmo->app->width  = event.window.data1;
        gizmo->app->height = event.window.data2;
        if (gizmo->app->resize)
          gizmo->app->resize
            (gizmo->app, gizmo->app->width, gizmo->app->height);
        break;
      }
      break;
    case SDL_KEYDOWN:
      for (ii = 0; ii < gizmo->n_key_actions; ++ii) {
        struct app_key_action *action = &gizmo->key_actions[ii];
        if ((action->scancode == event.key.keysym.scancode) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_down;
          if (action->action_down)
            action->action_down(gizmo->app, &event);
        }
      }
      break;
    case SDL_KEYUP:
      for (ii = 0; ii < gizmo->n_key_actions; ++ii) {
        struct app_key_action *action = &gizmo->key_actions[ii];
        if ((action->scancode == event.key.keysym.scancode) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_up;
          if (action->action_up)
            action->action_up(gizmo->app, &event);
        }
      }
      break;
    case SDL_MOUSEBUTTONDOWN:
      for (ii = 0; ii < gizmo->n_mouse_actions; ++ii) {
        struct app_mouse_action *action = &gizmo->mouse_actions[ii];
        if ((action->type == SDL_MOUSEBUTTONDOWN) && (action->action))
          action->action(gizmo->app, &event);
      }
      break;
    case SDL_MOUSEBUTTONUP:
      for (ii = 0; ii < gizmo->n_mouse_actions; ++ii) {
        struct app_mouse_action *action = &gizmo->mouse_actions[ii];
        if ((action->type == SDL_MOUSEBUTTONUP) && (action->action))
          action->action(gizmo->app, &event);
      }
      break;
    default:
      break;
    }
  }

  long long current = now();
  unsigned elapsed = current - gizmo->last;

  if (gizmo->app->update &&
      (result = gizmo->app->update
       (gizmo->app, elapsed))) {
  } else if (gizmo->app->draw &&
             (result = gizmo->app->draw
              (gizmo->app, gizmo->renderer))) {
  }
  gizmo->last = current;
}

int
main(int argc, char **argv)
{
  int result = EXIT_SUCCESS;
  struct gizmo gizmo;

  memset(&gizmo, 0, sizeof(gizmo));
  gizmo.last = now();

  printf("Gizmo: activating Asteroids\n");
  gizmo.app = asteroids_get_app();

  if (EXIT_SUCCESS != (result = gizmo_setupSDL
                       (&gizmo.renderer, &gizmo.window))) {
  } else if (SDL_GetRendererOutputSize
             (gizmo.renderer, &gizmo.app->width,
              &gizmo.app->height) < 0) {
    fprintf(stderr, "Failed to get output size with SDL: %s\n",
            SDL_GetError());
    result = EXIT_FAILURE;
  } else if (gizmo.app->init &&
             (EXIT_SUCCESS !=
              (result = gizmo.app->init(gizmo.app, &gizmo)))) {
    fprintf(stderr, "Failed to initialize app\n");
  } else {
    if (gizmo.app->resize)
      gizmo.app->resize(gizmo.app, gizmo.app->width, gizmo.app->height);
  }

  if (result != EXIT_SUCCESS)
    return result;

#ifdef __EMSCRIPTEN__
  emscripten_set_main_loop_arg(gizmo_frame, &gizmo, 0, 1);
#else
  if (gizmo.app->icon && gizmo.app->icon_length &&
      (EXIT_SUCCESS != (result = gizmo_setup_icon
                        (gizmo.window, gizmo.app->icon,
                         gizmo.app->icon_length))))
    return result;

  unsigned long long frame = now();
  gizmo.done = 0;
  while ((result == EXIT_SUCCESS) && !gizmo.done) {
    gizmo_frame(&gizmo);

    unsigned long long current = now();
    if (current - frame < 16)
      SDL_Delay(16 - (current - frame));
    frame = current;
  }
  if (gizmo.app->destroy)
    gizmo.app->destroy(gizmo.app);
  free(gizmo.key_actions);
  free(gizmo.mouse_actions);
  SDL_DestroyRenderer(gizmo.renderer);
  SDL_DestroyWindow(gizmo.window);
  TTF_Quit();
  SDL_Quit();
#endif
  return result;
}
