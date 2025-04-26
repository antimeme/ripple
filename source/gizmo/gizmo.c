/**
 * gizmo.c
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
 * work out of writing SDL2 applications. By default gizmo uses
 * accelerated rendering.  This can be disabled by setting the
 * environment variable GIZMO_SOFTWARE=1.
 **/
#include <stdlib.h>
#include <stdarg.h>
#include <math.h>
#include "gizmo.h"
#include "asteroids.h"

#include "SDL.h"
#include "SDL_mixer.h"
#include "SDL_ttf.h"
#include "SDL2_gfxPrimitives.h"
#include "SDL_image.h"

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
static int gizmo_mix_init = 0;

static int
gizmo_failmsg(const char *funcname, int status,
              const char *(errfn)(void))
{
  int result = EXIT_SUCCESS;
  if (status < 0) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "%s: %s\n", funcname, errfn());
    SDL_ShowSimpleMessageBox
      (SDL_MESSAGEBOX_ERROR, funcname, errfn(), 0);
    result = EXIT_FAILURE;
  }
  return result;
}
#define GIZMO_SDL_CHECK(fn, args) \
  gizmo_failmsg(#fn, fn args, SDL_GetError)
#define GIZMO_TTF_CHECK(fn, args) \
  gizmo_failmsg(#fn, fn args, TTF_GetError)
#define GIZMO_MIX_CHECK(fn, args) \
  gizmo_failmsg(#fn, fn args, Mix_GetError)

static int
gizmo_chknull(const char *funcname, void *ptr,
              const char *(errfn)(void))
{
  int result = EXIT_SUCCESS;
  if (!ptr) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "%s: %s\n", funcname, errfn());
    SDL_ShowSimpleMessageBox
      (SDL_MESSAGEBOX_ERROR, funcname, errfn(), 0);
    result = EXIT_FAILURE;
  }
  return result;
}
#define GIZMO_SDL_CHKNULL(fn, ptr, args) \
  gizmo_chknull(#fn, (ptr = fn args), SDL_GetError)
#define GIZMO_TTF_CHKNULL(fn, ptr, args) \
  gizmo_chknull(#fn, (ptr = fn args), TTF_GetError)
#define GIZMO_MIX_CHKNULL(fn, ptr, args) \
  gizmo_chknull(#fn, (ptr = fn args), Mix_GetError)

struct gizmo {
  SDL_Window *window;
  SDL_Renderer *renderer;
  SDL_Color foreground;

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
  if ((result = GIZMO_SDL_CHKNULL
       (SDL_RWFromConstMem, image, (data, length)))) {
  } else if ((result = GIZMO_SDL_CHKNULL
              (IMG_Load_RW, icon, (image, 0)))) {
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
  int render = SDL_RENDERER_PRESENTVSYNC;
  SDL_DisplayMode mode;
  const char *env_software = getenv("GIZMO_SOFTWARE");

  /* Platforms like Windows Services for Linux sometimes have
   * acceleration that doesn't actually work.  This environment
   * variable can be used to optionally fall back to software
   * rendering when necessary. */
  if (env_software && *env_software &&
      !(*env_software == '0') && !(*env_software == 'f') &&
      !(*env_software == 'n'))
    render = SDL_RENDERER_SOFTWARE;

  if ((result == EXIT_SUCCESS) && EXIT_SUCCESS ==
      (result = GIZMO_SDL_CHECK
       (SDL_Init, (SDL_INIT_VIDEO | SDL_INIT_AUDIO))))
    gizmo_sdl_init = 1;

  if ((result == EXIT_SUCCESS) && EXIT_SUCCESS ==
      (result = GIZMO_MIX_CHECK
       (Mix_OpenAudio, (96000, MIX_DEFAULT_FORMAT, 4, 2048))))
    gizmo_mix_init = 1;

  if ((result == EXIT_SUCCESS) && EXIT_SUCCESS ==
      (result = GIZMO_TTF_CHECK(TTF_Init, ())))
    gizmo_ttf_init = 1;

  if (result != EXIT_SUCCESS) {
  } else if ((result = GIZMO_SDL_CHECK
              (SDL_GetCurrentDisplayMode, (0, &mode)))) {
  } else if ((result = GIZMO_SDL_CHKNULL
              (SDL_CreateWindow, gizmo->window,
               (gizmo->app->title ? gizmo->app->title :"Gizmo",
                SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                gizmo->app->width, gizmo->app->height,
                SDL_WINDOW_RESIZABLE)))) {
  } else if (SDL_FALSE == SDL_SetHint
             (SDL_HINT_RENDER_SCALE_QUALITY, "linear")) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "SDL_SetHint: %s\n",
                 SDL_GetError());
    result = EXIT_FAILURE;
  } else if ((result = GIZMO_SDL_CHKNULL
              (SDL_CreateRenderer, gizmo->renderer,
               (gizmo->window, -1, render)))) {
  } else if ((result = GIZMO_SDL_CHECK
              (SDL_GetRendererOutputSize,
               (gizmo->renderer,
                &gizmo->app->width,
                &gizmo->app->height)))) {
  } else if (gizmo->app->icon && gizmo->app->icon_length &&
             (EXIT_SUCCESS != (result = gizmo_setup_icon
                               (gizmo->window, gizmo->app->icon,
                                gizmo->app->icon_length)))) {
  }

  return result;
}

void
gizmo_log(const char *message, ...)
{
  va_list args;
  va_start(args, message);
  SDL_LogMessageV(SDL_LOG_CATEGORY_APPLICATION,
                  SDL_LOG_PRIORITY_INFO, message, args);
  va_end(args);
}

struct gizmo_sound {
  Mix_Chunk *chunk;
  int channel;
};

int
gizmo_sound_create(struct gizmo_sound **sound, const char *name)
{
  int result = EXIT_SUCCESS;
  struct gizmo_sound *out = NULL;
  const char *format = "./apps/sounds/%s.ogg";
  char *filename = NULL;
  int needed = snprintf(filename, 0, format, name);

  if (!sound) {
  } else if (needed < 0) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to format "
                 "font filename\n");
    result = EXIT_FAILURE;
  } else if (!(filename = malloc(needed + 1))) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to allocate %u "
                 "bytes for filename\n", needed);
    result = EXIT_FAILURE;
  } else if (snprintf(filename, needed + 1, format, name) < 0) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to format "
                 "allocated filename\n");
    result = EXIT_FAILURE;
  } else if (!(out = malloc(sizeof(struct gizmo_sound)))) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to allocate %u "
                 "bytes for sound\n",
                 (unsigned)sizeof(struct gizmo_sound));
    result = EXIT_FAILURE;
  } else if ((result = GIZMO_MIX_CHKNULL
              (Mix_LoadWAV, out->chunk, (filename)))) {
  } else {
    out->channel = -1;
    *sound = out;
    out = NULL;
  }
  free(filename);
  free(out);
  return result;
}

int
gizmo_sound_play(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  if (sound)
    sound->channel = Mix_PlayChannel(-1, sound->chunk, 0);
  return result;
}

int
gizmo_sound_loop(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  if (sound && (sound->channel < 0))
    sound->channel = Mix_PlayChannel(-1, sound->chunk, -1);
  return result;
}

int
gizmo_sound_stop(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  if (sound && (sound->channel >= 0) && Mix_Playing(sound->channel)) {
    Mix_HaltChannel(sound->channel);
    sound->channel = -1;
  }
  return result;
}

void
gizmo_sound_destroy(struct gizmo_sound *sound)
{
  Mix_FreeChunk(sound->chunk);
  free(sound);
}

int
gizmo_font_create(struct gizmo_font **font, unsigned size,
                  const char *name)
{
  int result = EXIT_SUCCESS;
  const char *format = "./apps/fonts/%s.ttf";
  char *filename = NULL;
  int needed = snprintf(filename, 0, format, name);

  if (needed < 0) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to format "
                 "font filename\n");
    result = EXIT_FAILURE;
  } else if (!(filename = malloc(needed + 1))) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to allocate "
                 "%u bytes for filename\n", needed);
    result = EXIT_FAILURE;
  } else if (snprintf(filename, needed + 1, format, name) < 0) {
    SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to format "
                 "allocated filename\n");
    result = EXIT_FAILURE;
  } else {
    TTF_Font **inner_font = (TTF_Font**)font;

    TTF_CloseFont(*inner_font);
    if (inner_font)
      result = GIZMO_TTF_CHKNULL(TTF_OpenFont, *inner_font,
                                 (filename, size));
  }
  free(filename);
  return result;
}

void
gizmo_font_destroy(struct gizmo_font *font)
{
  TTF_CloseFont((TTF_Font *)font);
}

int
gizmo_app_actions
(struct gizmo *gizmo,
 struct app_key_action   *key_actions,   unsigned n_key_actions,
 struct app_mouse_action *mouse_actions, unsigned n_mouse_actions)
{
  int result = EXIT_SUCCESS;
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
 * position, velocity and radius collide within the elapsed time. */
int
gizmo_check_collide(float radiusA, struct gizmo_point *positionA,
                    struct gizmo_point *velocityA,
                    float radiusB, struct gizmo_point *positionB,
                    struct gizmo_point *velocityB, unsigned elapsed)
{
  int result = 0;
  const float gap = radiusA + radiusB;
  struct gizmo_point dp = {
    positionA->x - positionB->x,
    positionA->y - positionB->y };
  struct gizmo_point dm = {
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

struct gizmo_point
gizmo_rotate(struct gizmo_point *point, float dircos, float dirsin)
{
  struct gizmo_point result = {
    point->x * dircos - point->y * dirsin,
    point->x * dirsin + point->y * dircos };
  return result;
}

/* ------------------------------------------------------------------ */
/* Drawing primitives */

int
gizmo_draw_text(struct gizmo *gizmo, struct gizmo_font *font,
                struct gizmo_point *position, const char *message, ...)
{
  int result = EXIT_SUCCESS;
  SDL_Surface *surface = TTF_RenderUTF8_Solid
    ((TTF_Font *)font, message, gizmo->foreground);
  if (surface) {
    SDL_Texture *texture = SDL_CreateTextureFromSurface
      (gizmo->renderer, surface);
    if (texture) {
      SDL_Rect dsrect = { 0, 0, surface->w, surface->h };
      if (position) {
        dsrect.x = position->x;
        dsrect.y = position->y;
      } else {
        dsrect.x = (gizmo->app->width - surface->w) / 2;
        dsrect.y = (gizmo->app->height - surface->h) / 2;
      }
      SDL_RenderCopy(gizmo->renderer, texture, NULL, &dsrect);
      SDL_DestroyTexture(texture);
    }
    SDL_FreeSurface(surface);
  }
  return result;
}

int
gizmo_draw_pointloop(struct gizmo *gizmo, struct gizmo_point *position,
                     float size, float dircos, float dirsin,
                     unsigned n_points, struct gizmo_point *points)
{
  int result = EXIT_SUCCESS;
  struct gizmo_point previous = { 0, 0 };
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_points); ++ii) {
    struct gizmo_point start = ii ? previous :
      gizmo_rotate(&points[ii], dircos, dirsin);
    struct gizmo_point end = gizmo_rotate
      (&points[(ii + 1) % n_points], dircos, dirsin);
    previous = end;

    result = GIZMO_SDL_CHECK
      (SDL_RenderDrawLine,
       (gizmo->renderer,
        (int)(position->x + size * start.x),
        (int)(position->y + size * start.y),
        (int)(position->x + size * end.x),
        (int)(position->y + size * end.y)));
  }
  return result;
}

int
gizmo_draw_arc(struct gizmo *gizmo, struct gizmo_point *position,
               float radius, float start, float stop)
{
  int result = EXIT_SUCCESS;
  arcRGBA(gizmo->renderer,
          (short)position->x, (short)position->y, (short)radius,
          (short)(start * 180 / M_PI), (short)(stop * 180 / M_PI),
          gizmo->foreground.r, gizmo->foreground.g,
          gizmo->foreground.b, gizmo->foreground.a);
  return result;
}

int
gizmo_draw_circle(struct gizmo *gizmo, struct gizmo_point *position,
                  float radius)
{
  int result = EXIT_SUCCESS;
  circleRGBA(gizmo->renderer,
             (short)position->x, (short)position->y, (short)radius,
             gizmo->foreground.r, gizmo->foreground.g,
             gizmo->foreground.b, gizmo->foreground.a);
  return result;
}

/* ------------------------------------------------------------------ */

void
gizmo_color(struct gizmo_color *color, unsigned char r,
            unsigned char g, unsigned char b, unsigned char a)
{
  color->r = r;
  color->g = g;
  color->b = b;
  color->a = a;
}

void
gizmo_color_set(struct gizmo *gizmo, struct gizmo_color *color)
{
  gizmo->foreground.r = color->r;
  gizmo->foreground.g = color->g;
  gizmo->foreground.b = color->b;
  gizmo->foreground.a = color->a;
  SDL_SetRenderDrawColor
    (gizmo->renderer, color->r, color->g, color->b, color->a);
}

static enum gizmo_scancode
gizmo_scancode_convert(int scancode)
{
  enum gizmo_scancode result = gizmo_scancode_none;
  switch (scancode) {
  case SDL_SCANCODE_SPACE: result = gizmo_scancode_space; break;
  case SDL_SCANCODE_UP: result = gizmo_scancode_up; break;
  case SDL_SCANCODE_DOWN: result = gizmo_scancode_down; break;
  case SDL_SCANCODE_LEFT: result = gizmo_scancode_left; break;
  case SDL_SCANCODE_RIGHT: result = gizmo_scancode_right; break;
  case SDL_SCANCODE_W: result = gizmo_scancode_w; break;
  case SDL_SCANCODE_A: result = gizmo_scancode_a; break;
  case SDL_SCANCODE_S: result = gizmo_scancode_s; break;
  case SDL_SCANCODE_D: result = gizmo_scancode_d; break;
  }
  return result;
}

static void
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
        if ((action->scancode == gizmo_scancode_convert
             (event.key.keysym.scancode)) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_down;
          if (action->action_down)
            action->action_down(gizmo->app, action->scancode);
        }
      }
      break;
    case SDL_KEYUP:
      for (ii = 0; ii < gizmo->n_key_actions; ++ii) {
        struct app_key_action *action = &gizmo->key_actions[ii];
        if ((action->scancode == gizmo_scancode_convert
             (event.key.keysym.scancode)) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_up;
          if (action->action_up)
            action->action_up(gizmo->app, action->scancode);
        }
      }
      break;
    case SDL_MOUSEBUTTONDOWN:
      for (ii = 0; ii < gizmo->n_mouse_actions; ++ii) {
        struct app_mouse_action *action = &gizmo->mouse_actions[ii];
        if ((action->type == gizmo_mouse_down) && (action->action)) {
          struct gizmo_point clicked = {
            event.button.x, event.button.y };
          action->action(gizmo->app, &clicked);
        }
      }
      break;
    case SDL_MOUSEBUTTONUP:
      for (ii = 0; ii < gizmo->n_mouse_actions; ++ii) {
        struct app_mouse_action *action = &gizmo->mouse_actions[ii];
        if ((action->type == gizmo_mouse_up) && (action->action)) {
          struct gizmo_point clicked = {
            event.button.x, event.button.y };
          action->action(gizmo->app, &clicked);
        }
      }
      break;
    default:
      break;
    }
  }

  long long current = now();
  unsigned elapsed = current - gizmo->last;

  gizmo_color_set(gizmo, &gizmo->app->background);
  SDL_RenderClear(gizmo->renderer);
  gizmo_color_set(gizmo, &gizmo->app->foreground);

  if (gizmo->app->update &&
      (result = gizmo->app->update
       (gizmo->app, elapsed))) {
  } else if (gizmo->app->draw &&
             (result = gizmo->app->draw(gizmo->app, gizmo))) {
  }
  SDL_RenderPresent(gizmo->renderer);
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
  else SDL_LogError(SDL_LOG_CATEGORY_ERROR, "Failed to find app\n");

  if (EXIT_SUCCESS != (result = gizmo_setup_SDL(&gizmo))) {
  } else if (gizmo.app->init &&
             (EXIT_SUCCESS !=
              (result = gizmo.app->init(gizmo.app, &gizmo)))) {
  } else if (gizmo.app->resize &&
             (EXIT_SUCCESS !=
              (result = gizmo.app->resize
               (gizmo.app, gizmo.app->width, gizmo.app->height)))) {
  } else {
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
#endif
    SDL_Log("Finished app: %s\n", gizmo.app->title);
  }
  if (gizmo.app && gizmo.app->destroy)
    gizmo.app->destroy(gizmo.app);
  free(gizmo.key_actions);
  free(gizmo.mouse_actions);
  if (gizmo_mix_init)
    Mix_CloseAudio();
  if (gizmo_ttf_init)
    TTF_Quit();
  if (gizmo_sdl_init) {
    SDL_DestroyRenderer(gizmo.renderer);
    SDL_DestroyWindow(gizmo.window);
    SDL_Quit();
  }
  return result;
}
