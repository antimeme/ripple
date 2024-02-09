/**
 * Gizmo
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
 * This is an experiment in game developed using SDL2. */
#include <stdlib.h>
#include <math.h>
#include <SDL2/SDL.h>

/* This program can be executed in a web browser using
 * emscripten and WebAssembly:
 *   emcc -o gizmo.html -s USE_SDL=2 source/gizmo.c
 * This will generate gizmo.html which is an entry point. */
#ifdef __EMSCRIPTEN__
#  include <emscripten.h>
#  include <emscripten/html5.h>
#endif

int setupSDL(SDL_Renderer **renderer, SDL_Window **window)
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
                SDL_WINDOWPOS_UNDEFINED, mode.w * 19 / 20,
                mode.h * 9 / 10, 0))) {
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
  }
  return result;
}

struct app {
  unsigned done;
  int  (*init)(struct app *app);
  void (*destroy)(struct app *app);
  int  (*update)(struct app *app, int width, int height);
  int  (*draw)(struct app *app, int width, int height,
               SDL_Renderer *rndr);
};

struct keymap {
  int scancode;
  unsigned *state;
};

/* ------------------------------------------------------------------ */
/* A simplistic Asteroids clone.  This is a sample to demonstrate
 * basic features of SDL2 with an easy to understand context. */

struct point { float x; float y; };

struct ship {
  float size;
  float direction;
  float xspeed;
  float yspeed;
  float xpos;
  float ypos;
  unsigned thrust;

  struct point *points;
  struct point *tpoints;
  unsigned n_points;
};

struct app_asteroids {
  struct app app;
  
  struct point *points;
  struct point *tpoints;
  unsigned n_points;

  struct ship player;
  struct ship enemy;

  unsigned move_up;
  unsigned move_down;
  unsigned move_left;
  unsigned move_right;

  struct keymap *keymaps;
  unsigned n_keymaps;
};

static int
asteroids_init(struct app_asteroids *self)
{
  int result = EXIT_SUCCESS;
  unsigned index = 0;

  struct point *newpoints = NULL;
  struct point *transpoints = NULL;
  struct point points[] = {
    { 1, 0 }, { -1, 2./3 }, { -2./3, 0 }, { -1, -2./3 },

    { 1, 0 }, { -1, 2./3 }, { -2./3, 0 }, { -1, -2./3 }
  };
  const unsigned n_points = sizeof(points) / sizeof(*points);
  const unsigned n_points_player = 4;
  const unsigned n_points_enemy = 4;
  unsigned n_points_used = 0;

  if (!self) {
    fprintf(stderr, "Error: missing app structure\n");
    result = EXIT_FAILURE;
  } else if (!(newpoints = malloc(sizeof(struct point) * n_points))) {
    fprintf(stderr, "Failed to allocate %lu bytes for points\n",
            sizeof(struct point) * n_points);
    result = EXIT_FAILURE;
  } else if (!(transpoints = malloc(sizeof(struct point) * n_points))) {
    fprintf(stderr, "Failed to allocate %lu bytes for "
            "transformed points\n", sizeof(struct point) * n_points);
    result = EXIT_FAILURE;
  } else {
    struct keymap keymaps[] = {
      { SDL_SCANCODE_UP, &self->move_up },
      { SDL_SCANCODE_DOWN, &self->move_down },
      { SDL_SCANCODE_LEFT, &self->move_left },
      { SDL_SCANCODE_RIGHT, &self->move_right },
      { SDL_SCANCODE_W, &self->move_up },
      { SDL_SCANCODE_A, &self->move_left },
      { SDL_SCANCODE_S, &self->move_down },
      { SDL_SCANCODE_D, &self->move_right },
    };

    self->n_keymaps = sizeof(keymaps) / sizeof(*keymaps);
    if (!(self->keymaps = malloc(self->n_keymaps * sizeof(*keymaps)))) {
      fprintf(stderr, "Error: missing app structure\n");
      result = EXIT_FAILURE;
    } else {
      while (index < self->n_keymaps) {
        self->keymaps[index].scancode = keymaps[index].scancode;
        self->keymaps[index].state    = keymaps[index].state;
        ++index;
      }

      for (index = 0; index < n_points; ++index) {
        newpoints[index].x = points[index].x;
        newpoints[index].y = points[index].y;
      }

      self->points = newpoints;
      self->tpoints = transpoints;
      self->n_points = n_points;
      transpoints = newpoints = NULL;

      self->player.size = 3;
      self->player.direction = -M_PI / 2;
      self->player.xspeed = 0;
      self->player.yspeed = 0;
      self->player.xpos = 0;
      self->player.ypos = 0;
      self->player.tpoints  = self->tpoints + n_points_used;
      self->player.points   = self->points + n_points_used;
      self->player.n_points = n_points_player;
      n_points_used += n_points_player;

      self->enemy.tpoints  = self->tpoints + n_points_used;
      self->enemy.points   = self->points + n_points_used;
      self->enemy.n_points = n_points_enemy;
      n_points_used += n_points_enemy;
    }
  }
  free(newpoints);
  free(transpoints);
  return result;
}

static void
asteroids_destroy(struct app_asteroids *self)
{
  free(self->keymaps);
  free(self->points);
  free(self->tpoints);
}

static int
asteroids_update(struct app_asteroids *self, int width, int height)
{
  SDL_Event event;
  unsigned ii;

  while (self && !self->app.done && SDL_PollEvent(&event)) {
    switch (event.type) {
    case SDL_QUIT:
      self->app.done = 1;
      break;
    case SDL_KEYDOWN:
      for (ii = 0; ii < self->n_keymaps; ++ii)
        if (event.key.keysym.scancode == self->keymaps[ii].scancode)
          *self->keymaps[ii].state = 1;
      break;
    case SDL_KEYUP:
      for (ii = 0; ii < self->n_keymaps; ++ii)
        if (event.key.keysym.scancode == self->keymaps[ii].scancode)
          *self->keymaps[ii].state = 0;
      break;
    case SDL_MOUSEBUTTONDOWN: {
      float ex = (event.button.x - width / 2) - self->player.xpos;
      float ey = (event.button.y - height / 2) - self->player.ypos;
      if (ex * ex + ey * ey > 25) {
        float sx = cos(self->player.direction);
        float sy = sin(self->player.direction);
        float wedge = sx * ey - sy * ex;
        float angle = ((wedge > 0) ? 1 : -1) *
          acos((ex * sx + ey * sy) / sqrt((sx * sx + sy * sy) *
                                          (ex * ex + ey * ey)));
        self->player.direction += angle;
      }
    } break;      
    default:
      break;
    }
  }

  if (self) {
    if (self->move_left)
      self->player.direction -= 0.1;
    if (self->move_right)
      self->player.direction += 0.1;
    if (self->move_up) {
      self->player.xspeed += cosf(self->player.direction) * 0.5;
      self->player.yspeed += sinf(self->player.direction) * 0.5;
      self->player.thrust = 1;
    } else self->player.thrust = 0;

    self->player.xpos += self->player.xspeed;
    if (self->player.xpos > width * ((self->player.size + 50) / 100))
      self->player.xpos = -width * ((self->player.size + 50) / 100);
    if (self->player.xpos < -width * ((self->player.size + 50) / 100))
      self->player.xpos = width * ((self->player.size + 50) / 100);

    self->player.ypos += self->player.yspeed;
    if (self->player.ypos > height * ((self->player.size + 50) / 100))
      self->player.ypos = -height * ((self->player.size + 50) / 100);
    if (self->player.ypos < -height * ((self->player.size + 50) / 100))
      self->player.ypos = height * ((self->player.size + 50) / 100);
  }
  return EXIT_SUCCESS;
}

static int
draw_polygon(SDL_Renderer *renderer, float size,
             float xpos, float ypos,
             float dircos, float dirsin,
             unsigned n_points, struct point *points)
{
  int result = EXIT_SUCCESS;
  unsigned index;

  for (index = 0; index < n_points; ++index) { // Rotate
    float x = points[index].x * dircos - points[index].y * dirsin;
    float y = points[index].x * dirsin + points[index].y * dircos;
    points[index].x = x;
    points[index].y = y;
  }

  for (index = 0; (result == EXIT_SUCCESS) &&
         (index < n_points); ++index) {
    struct point *start = &points[index];
    struct point *end = &points[(index + 1) % n_points];

    if (SDL_RenderDrawLine(renderer,
                           (int)(xpos + size * start->x),
                           (int)(ypos + size * start->y),
                           (int)(xpos + size * end->x),
                           (int)(ypos + size * end->y)) < 0) {
      fprintf(stderr, "Failed to draw line with SDL: %s\n",
              SDL_GetError());
      result = EXIT_FAILURE;
    }
  }
  return result;
}

int
asteroids__draw_ship(SDL_Renderer *renderer, int width, int height,
                     struct ship *ship)
{
  int result = EXIT_SUCCESS;
  unsigned index;
  float size = ship->size * ((width > height) ? height : width) / 100;
  float xpos = ship->xpos + width / 2;
  float ypos = ship->ypos + height / 2;
  float dircos = cos(ship->direction);
  float dirsin = sin(ship->direction);

  for (index = 0; index < ship->n_points; ++index) {
    ship->tpoints[index].x = ship->points[index].x;
    ship->tpoints[index].y = ship->points[index].y;
  }

  result = draw_polygon(renderer, size, xpos, ypos,
                        dircos, dirsin, ship->n_points,
                        ship->tpoints);

  if ((result == EXIT_SUCCESS) && ship->thrust) {
    struct point points[] = { { -1, 1./3}, { -3./2, 0}, { -1, -1./3} };
    unsigned n_points = sizeof(points) / sizeof(*points);

    for (index = 0; index < ship->n_points; ++index) {
      points[index].x +=
        (((float)rand() / (float)RAND_MAX) - 0.5) * 0.33;
      points[index].y +=
        (((float)rand() / (float)RAND_MAX) - 0.5) * 0.33;
    }

    result = draw_polygon(renderer, size, xpos, ypos,
                          dircos, dirsin, n_points, points);
  }
  return result;
}

int
asteroids_draw(struct app_asteroids *self, int width, int height,
               SDL_Renderer *renderer)
{
  int result = EXIT_SUCCESS;

  SDL_SetRenderDrawColor(renderer, 32, 32, 32, 255);
  SDL_RenderClear(renderer);
  SDL_SetRenderDrawColor(renderer, 224, 224, 224, 255);
  asteroids__draw_ship(renderer, width, height, &self->player);
  SDL_RenderPresent(renderer);
  return result;
}

static struct app_asteroids app_asteroids;

struct app *
asteroids_get_app(void) {
  app_asteroids.app.init = (int (*)(struct app *))asteroids_init;
  app_asteroids.app.destroy =
    (void (*)(struct app *))asteroids_destroy;
  app_asteroids.app.update =
    (int (*)(struct app *, int, int))asteroids_update;
  app_asteroids.app.draw =
    (int (*)(struct app *, int, int, SDL_Renderer *))asteroids_draw;
  return &app_asteroids.app;
}

/* ------------------------------------------------------------------ */

struct gizmo {
  SDL_Renderer *renderer;
  SDL_Window *window;
  struct app *app;
};

void
gizmo_frame(struct gizmo *gizmo)
{
  int result = EXIT_SUCCESS;
  int width;
  int height;

  if (SDL_GetRendererOutputSize
      (gizmo->renderer, &width, &height) < 0) {
    fprintf(stderr, "Failed to get output size with SDL: %s\n",
            SDL_GetError());
    result = EXIT_FAILURE;
  } else if (gizmo->app->update &&
             (result = gizmo->app->update
              (gizmo->app, width, height))) {
  } else if (gizmo->app->draw &&
             (result = gizmo->app->draw
              (gizmo->app, width, height, gizmo->renderer))) {
  }
}

int
main(int argc, char **argv)
{
  int result = EXIT_SUCCESS;
  struct gizmo gizmo;

  gizmo.app = asteroids_get_app();
  printf("Gizmo: activating Asteroids\n");

  result = setupSDL(&gizmo.renderer, &gizmo.window);
  if (gizmo.app->init)
    result = gizmo.app->init(gizmo.app);

#ifdef __EMSCRIPTEN__
  emscripten_set_main_loop_arg((void (*)(void *))gizmo_frame,
                               &gizmo, 0, 1);
#else
  gizmo.app->done = 0;
  while ((result == EXIT_SUCCESS) && !gizmo.app->done) {
    gizmo_frame(&gizmo);
    SDL_Delay(16);
  }
  SDL_DestroyRenderer(gizmo.renderer);
  gizmo.app->destroy(gizmo.app);
#endif
  return result;
}
