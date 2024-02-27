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
unsigned long long now() { return SDL_GetTicks64(); }
#endif

static int gizmo_sdl_init = 0;
static int gizmo_ttf_init = 0;

static int
gizmo_failmsg(const char *funcname, int status)
{
  if (status < 0) {
    SDL_Log("%s: %s\n", funcname, SDL_GetError());
    SDL_ShowSimpleMessageBox
      (SDL_MESSAGEBOX_ERROR, funcname, SDL_GetError(), 0);
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
#define GIZMO_CHECK(fn, args) gizmo_failmsg(#fn, fn args)

static int
gizmo_chknull(const char *funcname, void *ptr)
{
  if (!ptr) {
    SDL_Log("%s: %s\n", funcname, SDL_GetError());
    SDL_ShowSimpleMessageBox
      (SDL_MESSAGEBOX_ERROR, funcname, SDL_GetError(), 0);
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
#define GIZMO_CHKNULL(fn, ptr, args) \
  gizmo_chknull(#fn, (ptr = fn args))

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

static int
gizmo_setup_icon(SDL_Window *window, const unsigned char *data,
                 unsigned length)
{
  int result = EXIT_SUCCESS;
  SDL_Surface *icon = NULL;
  SDL_RWops *image = NULL;

#ifndef __EMSCRIPTEN__
  if ((result = GIZMO_CHKNULL
       (SDL_RWFromConstMem, image, (data, length)))) {
  } else if ((result = GIZMO_CHKNULL(IMG_Load_RW, icon, (image, 0)))) {
  } else SDL_SetWindowIcon(window, icon);
#endif

  if (image != NULL)
    SDL_RWclose(image);
  SDL_FreeSurface(icon);
  return result;
}

static int
gizmo_setup_SDL(struct gizmo *gizmo)
{
  int result = EXIT_SUCCESS;
  SDL_DisplayMode mode;

  /* Only call SDL_Quit() when SDL_Init() has succeded */
  if (EXIT_SUCCESS == (result = GIZMO_CHECK
                       (SDL_Init, (SDL_INIT_VIDEO))))
    gizmo_sdl_init = 1;

  if (result != EXIT_SUCCESS) {
  } else if ((result = GIZMO_CHECK(SDL_GetCurrentDisplayMode,
                                   (0, &mode)))) {
  } else if ((result = GIZMO_CHKNULL
              (SDL_CreateWindow, gizmo->window,
               (gizmo->app->title ? gizmo->app->title :"Gizmo",
                SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                gizmo->app->width, gizmo->app->height,
                SDL_WINDOW_RESIZABLE)))) {
  } else if (SDL_FALSE == SDL_SetHint
             (SDL_HINT_RENDER_SCALE_QUALITY, "linear")) {
    SDL_Log("SDL_SetHint: %s\n", SDL_GetError());
    result = EXIT_FAILURE;
  } else if ((result = GIZMO_CHKNULL
              (SDL_CreateRenderer, gizmo->renderer,
               (gizmo->window, -1, SDL_RENDERER_PRESENTVSYNC)))) {
  } else if ((result = GIZMO_CHECK
              (SDL_GetRendererOutputSize,
               (gizmo->renderer, &gizmo->app->width,
                &gizmo->app->height)))) {
  } else if (gizmo->app->icon && gizmo->app->icon_length &&
             (EXIT_SUCCESS != (result = gizmo_setup_icon
                               (gizmo->window, gizmo->app->icon,
                                gizmo->app->icon_length)))) {
  } else if ((result = GIZMO_CHECK(TTF_Init, ()))) {
  } else gizmo_ttf_init = 1;

  return result;
}

int
gizmo_app_font(TTF_Font **mono, unsigned size)
{
  int result = EXIT_SUCCESS;

  TTF_CloseFont(*mono);

  /* https://www.fontspace.com/brass-mono-font-f29885 */
  if (mono &&
      ((result = GIZMO_CHKNULL
        (TTF_OpenFont, *mono,
         ("./apps/fonts/brass-mono.ttf", size))))) {
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
    SDL_Log("Failed to allocate %lu bytes for key actions\n",
            n_key_actions * sizeof(*key_actions));
    result = EXIT_FAILURE;
  } else if (!(new_mouse_actions = malloc
               (n_mouse_actions * sizeof(*mouse_actions)))) {
    SDL_Log("Failed to allocate %lu bytes for event actions\n",
            n_mouse_actions * sizeof(*mouse_actions));
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
gizmo_check_collide(float sizeA, SDL_FPoint *positionA,
                    SDL_FPoint *velocityA,
                    float sizeB, SDL_FPoint *positionB,
                    SDL_FPoint *velocityB, unsigned elapsed)
{
  int result = 0;
  const float gap = sizeA + sizeB;
  SDL_FPoint dp = {
    positionA->x - positionB->x,
    positionA->y - positionB->y };
  SDL_FPoint dm = {
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

SDL_FPoint
gizmo_rotate_origin(SDL_FPoint *point, float dircos, float dirsin)
{
  SDL_FPoint result = {
    point->x * dircos - point->y * dirsin,
    point->x * dirsin + point->y * dircos };
  return result;
}

int
gizmo_draw_point_loop(SDL_Renderer *renderer, float size,
                      SDL_FPoint *position,
                      float dircos, float dirsin,
                      unsigned n_points, SDL_FPoint *points)
{
  int result = EXIT_SUCCESS;
  SDL_FPoint previous = { 0, 0 };
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_points); ++ii) {
    SDL_FPoint start = ii ? previous :
      gizmo_rotate_origin(&points[ii], dircos, dirsin);
    SDL_FPoint end = gizmo_rotate_origin
      (&points[(ii + 1) % n_points], dircos, dirsin);
    previous = end;

    result = GIZMO_CHECK
      (SDL_RenderDrawLine,
       (renderer, (int)(position->x + size * start.x),
        (int)(position->y + size * start.y),
        (int)(position->x + size * end.x),
        (int)(position->y + size * end.y)));
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

  gizmo.app = asteroids_get_app();
  if (gizmo.app)
    SDL_Log("Starting app: %s\n", gizmo.app->title);
  else SDL_Log("Failed to find app\n");

  if (EXIT_SUCCESS != (result = gizmo_setup_SDL(&gizmo))) {
  } else if (gizmo.app->init &&
             (EXIT_SUCCESS !=
              (result = gizmo.app->init(gizmo.app, &gizmo)))) {
  } else if (gizmo.app->resize &&
             (EXIT_SUCCESS !=
              (result = gizmo.app->resize
               (gizmo.app, gizmo.app->width, gizmo.app->height)))) {
  }

  if (result != EXIT_SUCCESS)
    return result;

#ifdef __EMSCRIPTEN__
  emscripten_set_main_loop_arg(gizmo_frame, &gizmo, 0, 1);
#else

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
  if (gizmo_ttf_init)
    TTF_Quit();
  if (gizmo_sdl_init)
    SDL_Quit();
#endif
  return result;
}
