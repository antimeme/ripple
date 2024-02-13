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
 * This is an experiment in game development using SDL2. */
#include <stdlib.h>
#include <math.h>
#include <SDL2/SDL.h>
#include <SDL2/SDL_image.h>
#include <SDL2/SDL2_gfxPrimitives.h>

/* This program can be executed in a web browser using
 * emscripten and WebAssembly:
 *   emcc -o gizmo.wasm -s USE_SDL=2 USE_SDL_IMAGE=2 source/gizmo.c
 * This will generate gizmo.html which is an entry point. */
#ifdef __EMSCRIPTEN__
#  include <emscripten.h>
#  include <emscripten/html5.h>
unsigned long long now() {
  return (long long)emscripten_get_now();
}
#elif defined _WIN32
#  include <windows.h>
unsigned long long now() { return GetTickCount64(); }
#else
#  include <sys/time.h>
unsigned long long now() {
  struct timeval tv;
  gettimeofday(&tv,NULL);
  return (long long)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}
#endif

int
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
                SDL_WINDOWPOS_UNDEFINED, mode.w * 9 / 10,
                mode.h * 4 / 5, 0))) {
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

int
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

struct app {
  unsigned done;
  int width;
  int height;
  struct app_key_action *key_actions;
  unsigned n_key_actions;
  struct app_event_action *mouse_actions;
  unsigned n_mouse_actions;

  int  (*init)(struct app *app);
  void (*destroy)(struct app *app);
  void (*resize)(struct app *app, int width, int height);
  int  (*update)(struct app *app, unsigned elapsed);
  int  (*draw)(struct app *app, SDL_Renderer *rndr);
};

enum app_key_flags {
  app_key_flag_norepeat = (1 << 0),
};

struct app_key_action {
  int scancode;
  unsigned flags;
  int *setting;
  int value_down;
  int value_up;
  void (*action_down)(struct app *, SDL_Event *);
  void (*action_up)(struct app *, SDL_Event *);
};

struct app_event_action {
  int type;
  void (*action)(struct app *, SDL_Event *);
};

int
gizmo_app_actions
(struct app *app,
 struct app_key_action   *key_actions,   unsigned n_key_actions,
 struct app_event_action *mouse_actions, unsigned n_mouse_actions)
{
  int result = EXIT_SUCCESS;
  struct app_key_action   *new_key_actions = NULL;
  struct app_event_action *new_mouse_actions = NULL;

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

    app->n_key_actions = n_key_actions;
    app->key_actions = new_key_actions;
    for (ii = 0; ii < n_key_actions; ++ii)
      app->key_actions[ii] = key_actions[ii];
    new_key_actions = NULL;

    app->n_mouse_actions = n_mouse_actions;
    app->mouse_actions = new_mouse_actions;
    for (ii = 0; ii < n_mouse_actions; ++ii)
      app->mouse_actions[ii] = mouse_actions[ii];
    new_mouse_actions = NULL;
  }

  free(new_key_actions);
  free(new_mouse_actions);
  return result;
}

void
gizmo_process_events(struct app *app, unsigned elapsed)
{
  SDL_Event event;
  unsigned ii;

  while (app && !app->done && SDL_PollEvent(&event)) {
    switch (event.type) {
    case SDL_QUIT:
    case SDL_WINDOWEVENT_CLOSE:
      app->done = 1;
      break;
    case SDL_WINDOWEVENT:
      switch (event.window.event) {
      case SDL_WINDOWEVENT_RESIZED:
      case SDL_WINDOWEVENT_SIZE_CHANGED:
        app->width  = event.window.data1;
        app->height = event.window.data2;
        if (app->resize)
          app->resize(app, app->width, app->height);
        break;
      }
      break;
    case SDL_KEYDOWN:
      for (ii = 0; ii < app->n_key_actions; ++ii) {
        struct app_key_action *action = &app->key_actions[ii];
        if ((action->scancode == event.key.keysym.scancode) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_down;
          if (action->action_down)
            action->action_down(app, &event);
        }
      }
      break;
    case SDL_KEYUP:
      for (ii = 0; ii < app->n_key_actions; ++ii) {
        struct app_key_action *action = &app->key_actions[ii];
        if ((action->scancode == event.key.keysym.scancode) &&
            (!(action->flags & app_key_flag_norepeat) ||
             !event.key.repeat)) {
          if (action->setting)
            *action->setting = action->value_up;
          if (action->action_up)
            action->action_up(app, &event);
        }
      }
      break;
    case SDL_MOUSEBUTTONDOWN:
      for (ii = 0; ii < app->n_mouse_actions; ++ii) {
        struct app_event_action *action = &app->mouse_actions[ii];
        if (action->action)
          action->action(app, &event);
      }
      break;
    default:
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* A simplistic Asteroids clone.  This is a sample to demonstrate
 * basic features of SDL2 with an easy to understand context. */

const char asteroids_icon_svg[] =
  "<svg xmlns='http://www.w3.org/2000/svg' "
  "     width='128' height='128'> "
  "  <polygon points='64,8 107,120 64,98 21,120' "
  "           stroke-width='12' stroke='#222' fill='none' /> "
  "  <polygon points='64,8 107,120 64,98 21,120' "
  "           stroke-width='4' stroke='#eee' fill='none' /></svg>";

struct point { float x; float y; };

struct debris {
  float size;
  struct point position;
  struct point momentum;
  unsigned duration;

  struct point *points;
  struct point *tpoints;
  unsigned n_points;
};

struct asteroid {
  float size;
  struct point position;
  struct point momentum;
  float direction;
  unsigned n_splits;
  unsigned dead;

  struct point *points;
  struct point *tpoints;
  unsigned n_points;
};

struct shot {
  float size;
  struct point position;
  struct point momentum;
  unsigned duration;
};

struct ship {
  float size;
  struct point position;
  struct point momentum;
  float direction;

  struct point *points;
  struct point *tpoints;
  unsigned n_points;

  struct shot *shots;
  unsigned n_shots;
  unsigned m_shots;
};

struct app_asteroids {
  struct app app;
  float size;

  struct asteroid *asteroids;
  unsigned n_asteroids;
  unsigned m_asteroids;
  struct debris *debris;
  unsigned n_debris;
  unsigned m_debris;
  struct ship player;
  struct ship saucer;

  int thrust;
  int warp;
  int turn_left;
  int turn_right;
  unsigned tapshot;
  unsigned report;

  struct point *points;
  struct point *tpoints;
  unsigned n_points;
};

int
zeroish(float value)
{
  const float epsilon = 0.00000000001;
  return (value <= epsilon) && (value >= -epsilon);
}

void
quadratic_real_roots(float c, float b, float a,
                     unsigned *n_roots, float *roots)
{
  if (!zeroish(a)) {
    const float discriminant = b * b - 4 * a * c;

    if (zeroish(discriminant)) {
      roots[(*n_roots)++] = -b / (2 * a);
    } else if (discriminant > 0) {
      const float sqrtdisc = sqrtf(discriminant);
      roots[(*n_roots)++] = (-b + sqrtdisc) / (2 * a);
      roots[(*n_roots)++] = (-b - sqrtdisc) / (2 * a);
    }
  } else roots[(*n_roots)++] = -c / b;
}

static int
check_collide(float sizeA, struct point *positionA,
              struct point *momentumA,
              float sizeB, struct point *positionB,
              struct point *momentumB, unsigned elapsed)
{
  int result = 0;
  const float gap = sizeA + sizeB;
  struct point dp = {
    positionA->x - positionB->x,
    positionA->y - positionB->y };
  struct point dm = {
    momentumA->x - momentumB->x,
    momentumA->y - momentumB->y};
  
  if (dp.x * dp.x + dp.y * dp.y > gap * gap) {
    float roots[2];
    unsigned n_roots = 0;
    unsigned ii;

    quadratic_real_roots(dp.x * dp.x + dp.y * dp.y - gap * gap,
                         2 * (dp.x * dm.x + dp.y * dm.y),
                         dm.x * dm.x + dm.y * dm.y, &n_roots, roots);
    for (ii = 0; ii < n_roots; ++ii)
      if ((roots[ii] >= 0) && (roots[ii] < elapsed))
        result = 1;
  } else result = 1;
  return result;
}

static void
move_wrap(float size, unsigned elapsed, int width, int height,
          struct point *position, struct point *momentum)
{
  position->x += momentum->x * elapsed;
  if (position->x > size + width / 2)
    position->x = -(size + width / 2);
  if (position->x < -(size + width / 2))
    position->x = size + width / 2;

  position->y += momentum->y * elapsed;
  if (position->y > size + height / 2)
    position->y = -(size + height / 2);
  if (position->y < -(size + height / 2))
    position->y = size + height / 2;
}

static int
asteroids__debris_create(struct app_asteroids *self,
                         struct point *position,
                         struct point *momentum, unsigned count)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  if (self->m_debris < self->n_debris + count) {
    struct debris *newdebris = realloc
      (self->debris, sizeof(struct debris) * (self->n_debris + count));
    if (newdebris) {
      self->debris = newdebris;
      self->m_debris++;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for debris\n",
              (self->n_debris + count) * sizeof(*self->debris));
      result = EXIT_FAILURE;
    }
  }

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < count); ++ii) {
    struct debris *piece = &self->debris[self->n_debris];
    float direction = 2 * M_PI * ((float)rand() / (float)RAND_MAX);
    float speed = self->size * (((float)rand() /
                                 (float)RAND_MAX) + 1) / 2500;

    memset(piece, 0, sizeof(*piece));
    piece->duration = 900;
    piece->size = self->size / 100;
    piece->position = *position;
    piece->momentum = *momentum;
    piece->momentum.x += cosf(direction) * speed;
    piece->momentum.y += sinf(direction) * speed;

    piece->n_points = 3 * ((float)rand() / (float)RAND_MAX) + 3;
    if ((piece->points = malloc
         (sizeof(struct point) * piece->n_points * 2))) {
      unsigned jj;

      for (jj = 0; jj < piece->n_points; ++jj) {
        float spar = (((float)rand() / (float)RAND_MAX)) / 2;
        piece->points[jj].x =
          spar * cosf(M_PI * 2 * jj / piece->n_points);
        piece->points[jj].y =
          spar * sinf(M_PI * 2 * jj / piece->n_points);
      }
      piece->tpoints = &piece->points[piece->n_points];
      self->n_debris++;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for debris\n",
              sizeof(struct point) * piece->n_points * 2);
      result = EXIT_FAILURE;
    }
  }
  return result;
}

static void
asteroids__debris_update(struct app_asteroids *self,
                         int width, int height, unsigned elapsed)
{
  int survivors = 0;
  int ii;

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    if (piece->duration > elapsed) {
      piece->duration -= elapsed;
      piece->position.x += piece->momentum.x * elapsed;
      piece->position.y += piece->momentum.y * elapsed;
      if (ii > survivors)
        self->debris[survivors] = *piece;
      survivors++;
    } else free(piece->points);
  }
  self->n_debris = survivors;
}

static int
asteroids__asteroids_create(struct app_asteroids *self,
                            struct asteroid *source)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  unsigned n_asteroids = source ? 2 : 1;
  unsigned n_splits = source ? (source->n_splits - 1) : 2;

  if (self->m_asteroids < self->n_asteroids + n_asteroids) {
    struct asteroid *newasteroids = realloc
      (self->asteroids, sizeof(struct asteroid) *
       (self->n_asteroids + n_asteroids));
    if (newasteroids) {
      self->asteroids = newasteroids;
      self->m_asteroids++;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for asteroid\n",
              (self->n_asteroids + n_asteroids) *
              sizeof(*self->asteroids));
      result = EXIT_FAILURE;
    }
  }

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_asteroids); ++ii) {
    struct asteroid *asteroid = &self->asteroids[self->n_asteroids];
    float speed = self->size / 500 / (1 << n_splits);

    memset(asteroid, 0, sizeof(*asteroid));
    asteroid->dead = 0;
    asteroid->n_splits = n_splits;
    asteroid->size = (1 << asteroid->n_splits) * self->size / 20;
    if (!source) {
      asteroid->position.x = 0; /* TODO */
      asteroid->position.y = 0; /* TODO */
      asteroid->position.x = 500; /* TODO */
      asteroid->position.y = 500; /* TODO */
    } else asteroid->position = source->position;
    asteroid->direction =
      2 * M_PI * ((float)rand() / (float)RAND_MAX);
    asteroid->momentum.x = speed * cosf(asteroid->direction);
    asteroid->momentum.y = speed * sinf(asteroid->direction);

    asteroid->n_points = 2 * n_splits + 10;
    if ((asteroid->points = malloc
         (sizeof(struct point) * asteroid->n_points * 2))) {
      unsigned jj;

      for (jj = 0; jj < asteroid->n_points; ++jj) {
        float spar = ((((float)rand() / (float)RAND_MAX)) * 5 + 7) / 12;
        asteroid->points[jj].x =
          spar * cosf(M_PI * 2 * jj / asteroid->n_points);
        asteroid->points[jj].y =
          spar * sinf(M_PI * 2 * jj / asteroid->n_points);
      }
      asteroid->tpoints = &asteroid->points[asteroid->n_points];
      self->n_asteroids++;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for asteroids\n",
              sizeof(struct point) * asteroid->n_points * 2);
      result = EXIT_FAILURE;
    }
  }
  return result;
}

static void
asteroids__asteroids_update(struct app_asteroids *self,
                            int width, int height, unsigned elapsed)
{
  int survivors = 0;
  int ii;

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    if (!asteroid->dead) {
      move_wrap(asteroid->size, elapsed, width, height,
                &asteroid->position, &asteroid->momentum);
      if (ii > survivors)
        self->asteroids[survivors] = *asteroid;
      survivors++;
    } else free(asteroid->points);
    self->asteroids[ii].direction += elapsed * M_PI /
      (self->asteroids[ii].size * 30);
  }
  self->n_asteroids = survivors;
}

static void
asteroids__ship_destroy(struct ship *ship)
{
  free(ship->shots);
}

static void
asteroids__shots_update(struct ship *ship, int width, int height,
                        unsigned elapsed)
{
  int survivors = 0;
  int ii;

  for (ii = 0; ii < ship->n_shots; ++ii) {
    struct shot *shot = &ship->shots[ii];
    if (shot->duration > elapsed) {
      shot->duration -= elapsed;
      move_wrap(shot->size, elapsed, width, height,
                &shot->position, &shot->momentum);
      if (ii > survivors)
        ship->shots[survivors] = *shot;
      survivors++;
    }
  }
  ship->n_shots = survivors;
}

static int
asteroids__ship_shoot(struct ship *ship, float direction, float size) {
  int result = EXIT_SUCCESS;

  if (ship->n_shots + 1 > ship->m_shots) {
    struct shot *newshots = realloc
      (ship->shots, (ship->m_shots + 1) * sizeof(*ship->shots));
    if (newshots) {
      ship->shots = newshots;
      ship->m_shots++;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for shot\n",
              (ship->m_shots + 1) * sizeof(*ship->shots));
      result = EXIT_FAILURE;
    }
  }

  if ((result == EXIT_SUCCESS) && (ship->n_shots < 9)) {
    struct shot *shot = &ship->shots[ship->n_shots++];
    shot->size = ship->size;
    shot->duration = 350;
    shot->position = ship->position;
    shot->momentum = ship->momentum;
    shot->momentum.x += cosf(direction) * size / 700;
    shot->momentum.y += sinf(direction) * size / 700;
  }
  return result;
}

static void
asteroids__tap(struct app_asteroids *self, SDL_Event *event)
{
  float ex = (event->button.x - self->app.width / 2) -
    self->player.position.x;
  float ey = (event->button.y - self->app.height / 2) -
    self->player.position.y;
  if (ex * ex + ey * ey > 25) {
    float sx = cos(self->player.direction);
    float sy = sin(self->player.direction);
    float wedge = sx * ey - sy * ex;
    float angle = ((wedge > 0) ? 1 : -1) *
      acos((ex * sx + ey * sy) / sqrt((sx * sx + sy * sy) *
                                      (ex * ex + ey * ey)));
    self->player.direction += angle;
  }

  if (self->tapshot > 0)
    asteroids__ship_shoot(&self->player, self->player.direction,
                          self->size);
  self->tapshot = 350;
}

static void
asteroids__shoot(struct app_asteroids *self, SDL_Event *event)
{
  asteroids__ship_shoot(&self->player, self->player.direction,
                        self->size);
}

static void
asteroids__ship_asteroid(struct app_asteroids *self,
                         struct ship *ship, struct asteroid *asteroid,
                         unsigned elapsed)
{
  unsigned ii;
  for (ii = 0; ii < ship->n_shots; ++ii)
    if (check_collide
        (asteroid->size, &asteroid->position, &asteroid->momentum,
         ship->shots[ii].size, &ship->shots[ii].position,
         &ship->shots[ii].momentum, elapsed)) {
      /* TODO: ship->shots[ii].duration = 0; */

      asteroid->dead = 1; /* TODO: spawn two smaller asteroids */
      asteroids__debris_create
        (self, &asteroid->position, &asteroid->momentum,
         1 + asteroid->n_splits * 2 +
         (int)(4 * ((float)rand() / (float)RAND_MAX)));
    }
  if (check_collide
      (asteroid->size, &asteroid->position, &asteroid->momentum,
       ship->size, &ship->position, &ship->momentum, elapsed)) {
    /* :TODO: damage player */

    asteroid->dead = 1; /* TODO: spawn two smaller asteroids */
    asteroids__debris_create
      (self, &asteroid->position, &asteroid->momentum,
       1 + asteroid->n_splits * 2 +
       (int)(4 * ((float)rand() / (float)RAND_MAX)));
  }
}

static int
asteroids_init(struct app_asteroids *self)
{
  int result = EXIT_SUCCESS;
  unsigned ii = 0;
  struct app_event_action mouse_actions[] = {
    { SDL_MOUSEBUTTONDOWN,
      (void (*)(struct app*, SDL_Event *))asteroids__tap },
  };
  struct app_key_action key_actions[] = {
    { SDL_SCANCODE_UP,    0, &self->thrust, 1 },
    { SDL_SCANCODE_DOWN,  0, &self->warp, 1 },
    { SDL_SCANCODE_LEFT,  0, &self->turn_left, 1 },
    { SDL_SCANCODE_RIGHT, 0, &self->turn_right, 1 },
    { SDL_SCANCODE_W,     0, &self->thrust, 1 },
    { SDL_SCANCODE_A,     0, &self->turn_left, 1 },
    { SDL_SCANCODE_S,     0, &self->warp, 1 },
    { SDL_SCANCODE_D,     0, &self->turn_right, 1 },
    { SDL_SCANCODE_SPACE, app_key_flag_norepeat, NULL, 0, 0,
      (void (*)(struct app *, SDL_Event *))asteroids__shoot },
  };
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
  } else if ((result = gizmo_app_actions
              (&self->app, key_actions, sizeof(key_actions) /
               sizeof(*key_actions), mouse_actions,
               sizeof(mouse_actions) / sizeof(*mouse_actions)))) {
    /* Already reported */
  } else if (!(newpoints = malloc(sizeof(struct point) * n_points))) {
    fprintf(stderr, "Failed to allocate %lu bytes for points\n",
            sizeof(struct point) * n_points);
    result = EXIT_FAILURE;
  } else if (!(transpoints = malloc(sizeof(struct point) * n_points))) {
    fprintf(stderr, "Failed to allocate %lu bytes for "
            "transformed points\n", sizeof(struct point) * n_points);
    result = EXIT_FAILURE;
  } else {
    self->size = (self->app.width < self->app.height) ?
      self->app.width : self->app.height;
    self->n_points = n_points;
    self->points = newpoints;
    for (ii = 0; ii < n_points; ++ii)
      self->points[ii] = points[ii];

    self->tpoints = transpoints;
    transpoints = newpoints = NULL;

    self->player.size = 50;
    self->player.direction = -M_PI / 2;
    self->player.momentum.x = 0;
    self->player.momentum.y = 0;
    self->player.position.x = 0;
    self->player.position.y = 0;
    self->player.tpoints  = self->tpoints + n_points_used;
    self->player.points   = self->points + n_points_used;
    self->player.n_points = n_points_player;
    n_points_used += n_points_player;

    self->saucer.tpoints  = self->tpoints + n_points_used;
    self->saucer.points   = self->points + n_points_used;
    self->saucer.n_points = n_points_enemy;
    n_points_used += n_points_enemy;

    for (ii = 0; ii < 8; ++ii)
      asteroids__asteroids_create(self, NULL);
  }
  free(newpoints);
  free(transpoints);
  return result;
}

static void
asteroids_destroy(struct app_asteroids *self)
{
  asteroids__ship_destroy(&self->player);
  asteroids__ship_destroy(&self->saucer);
  free(self->debris);
  free(self->asteroids);
  free(self->points);
  free(self->tpoints);
}

static void
asteroids_resize(struct app_asteroids *self, int width, int height)
{
  self->size = (width < height) ? width : height;
  self->player.size = self->size * 3 / 100;
}

static int
asteroids_update(struct app_asteroids *self, unsigned elapsed)
{
  int result = EXIT_SUCCESS;
  int ii;
  int current;

  self->report -= (elapsed > self->report) ? self->report : elapsed;
  if (!self->report) {
    self->report = 900;
    if (0) {
      printf("REPORT (%d, %d) ship=(%f, %f) shots=%u\n",
             self->app.width, self->app.height,
             self->player.position.x,
             self->player.position.y, self->player.n_shots);
      for (ii = 0; ii < self->n_asteroids; ++ii) {
        printf("       (%f, %f)\n",
               self->asteroids[ii].position.x,
               self->asteroids[ii].position.y);
      }
    }
  }
  self->tapshot -= (elapsed > self->tapshot) ? self->tapshot : elapsed;
  gizmo_process_events(&self->app, elapsed);

  if (self->turn_left)
    self->player.direction -= (float)elapsed / 200;
  if (self->turn_right)
    self->player.direction += (float)elapsed / 200;
  if (self->thrust) {
    self->player.momentum.x += cosf(self->player.direction) *
      elapsed / self->size;
    self->player.momentum.y += sinf(self->player.direction) *
      elapsed / self->size;
  }

  for (ii = 0; ii < self->n_asteroids; ++ii)
    if (!self->asteroids[ii].dead)
      asteroids__ship_asteroid
        (self, &self->player, &self->asteroids[ii], elapsed);

  asteroids__debris_update
    (self, self->app.width, self->app.height, elapsed);
  asteroids__asteroids_update
    (self, self->app.width, self->app.height, elapsed);
  move_wrap(self->player.size, elapsed,
            self->app.width, self->app.height,
            &self->player.position,
            &self->player.momentum);
  asteroids__shots_update(&self->player, self->app.width,
                          self->app.height, elapsed);
  return EXIT_SUCCESS;
}

/**
 * Renders a polygon as a closed loop of lines.  The lines are
 * positioned according to the array of points given as the final
 * parameter.  These points will first be rotated, so the caller must
 * be okay with them changing. */
static int
draw_polygon(SDL_Renderer *renderer, float size,
             struct point *position,
             float dircos, float dirsin,
             unsigned n_points, struct point *points)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; ii < n_points; ++ii) { // Rotate
    struct point changed;
    changed.x = points[ii].x * dircos - points[ii].y * dirsin;
    changed.y = points[ii].x * dirsin + points[ii].y * dircos;
    points[ii].x = changed.x;
    points[ii].y = changed.y;
  }

  for (ii = 0; (result == EXIT_SUCCESS) &&
         (ii < n_points); ++ii) {
    struct point *start = &points[ii];
    struct point *end = &points[(ii + 1) % n_points];

    if (SDL_RenderDrawLine(renderer,
                           (int)(position->x + size * start->x),
                           (int)(position->y + size * start->y),
                           (int)(position->x + size * end->x),
                           (int)(position->y + size * end->y)) < 0) {
      fprintf(stderr, "Failed to draw line with SDL: %s\n",
              SDL_GetError());
      result = EXIT_FAILURE;
    }
  }
  return result;
}

int
asteroids__draw_ship(struct ship *ship, SDL_Renderer *renderer,
                     int width, int height, unsigned thrust)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  struct point position;
  float dircos = cos(ship->direction);
  float dirsin = sin(ship->direction);

  position.x = ship->position.x + width / 2;
  position.y = ship->position.y + height / 2;
  for (ii = 0; ii < ship->n_points; ++ii) {
    ship->tpoints[ii].x = ship->points[ii].x;
    ship->tpoints[ii].y = ship->points[ii].y;
  }
  result = draw_polygon(renderer, ship->size, &position,
                        dircos, dirsin, ship->n_points,
                        ship->tpoints);

  if ((result == EXIT_SUCCESS) && thrust) {
    struct point points[] = { { -1, 1./3}, { -3./2, 0}, { -1, -1./3} };
    unsigned n_points = sizeof(points) / sizeof(*points);

    for (ii = 0; ii < ship->n_points; ++ii) {
      points[ii].x +=
        (((float)rand() / (float)RAND_MAX) - 0.5) * 0.33;
      points[ii].y +=
        (((float)rand() / (float)RAND_MAX) - 0.5) * 0.33;
    }
    result = draw_polygon(renderer, ship->size, &position,
                          dircos, dirsin, n_points, points);
  }

  for (ii = 0; ii < ship->n_shots; ++ii)
    circleColor(renderer,
                (int)(ship->shots[ii].position.x + width/2),
                (int)(ship->shots[ii].position.y + height/2),
                ship->size / 3, 0xffe0e0e0);
  return result;
}

int
asteroids_draw(struct app_asteroids *self, SDL_Renderer *renderer)
{
  int result = EXIT_SUCCESS;
  unsigned ii, jj;

  SDL_SetRenderDrawColor(renderer, 32, 32, 32, 255);
  SDL_RenderClear(renderer);
  SDL_SetRenderDrawColor(renderer, 224, 224, 224, 255);

  asteroids__draw_ship(&self->player, renderer,
                       self->app.width, self->app.height, self->thrust);

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    struct point position = asteroid->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    for (jj = 0; jj < asteroid->n_points; ++jj)
      asteroid->tpoints[jj] = asteroid->points[jj];
    if (!asteroid->dead)
      draw_polygon(renderer, asteroid->size, &position,
                   cosf(asteroid->direction),
                   sinf(asteroid->direction),
                   asteroid->n_points, asteroid->tpoints);
  }

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    struct point position = piece->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    for (jj = 0; jj < piece->n_points; ++jj)
      piece->tpoints[jj] = piece->points[jj];
    draw_polygon(renderer, piece->size, &position, 1, 0,
                 piece->n_points, piece->tpoints);
  }

  SDL_RenderPresent(renderer);
  return result;
}

static struct app_asteroids app_asteroids;

struct app *
asteroids_get_app(void) {
  app_asteroids.app.init = (int (*)(struct app *))asteroids_init;
  app_asteroids.app.destroy =
    (void (*)(struct app *))asteroids_destroy;
  app_asteroids.app.resize =
    (void (*)(struct app*, int, int))asteroids_resize;
  app_asteroids.app.update =
    (int (*)(struct app *, unsigned))asteroids_update;
  app_asteroids.app.draw =
    (int (*)(struct app *, SDL_Renderer *))asteroids_draw;
  return &app_asteroids.app;
}

/* ------------------------------------------------------------------ */

struct gizmo {
  SDL_Renderer *renderer;
  SDL_Window *window;
  unsigned long long last;
  struct app *app;
};

int
gizmo_frame(struct gizmo *gizmo)
{
  int result = EXIT_SUCCESS;
  long long current = now();

  if (gizmo->app->update &&
      (result = gizmo->app->update
       (gizmo->app, current - gizmo->last))) {
  } else if (gizmo->app->draw &&
             (result = gizmo->app->draw(gizmo->app, gizmo->renderer))) {
  }
  gizmo->last = current;
  return result;
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
             (EXIT_SUCCESS != (result = gizmo.app->init(gizmo.app)))) {
  } else {
    if (gizmo.app->resize)
      gizmo.app->resize(gizmo.app, gizmo.app->width, gizmo.app->height);
  }

  if (result != EXIT_SUCCESS)
    return result;

#ifdef __EMSCRIPTEN__
  emscripten_set_main_loop_arg((void (*)(void *))gizmo_frame,
                               &gizmo, 0, 1);
#else
  if (EXIT_SUCCESS != (result = gizmo_setup_icon
                       (gizmo.window, asteroids_icon_svg,
                        sizeof(asteroids_icon_svg))))
    return result;

  gizmo.app->done = 0;
  while ((result == EXIT_SUCCESS) && !gizmo.app->done) {
    gizmo_frame(&gizmo);
    SDL_Delay(16);
  }
  SDL_DestroyRenderer(gizmo.renderer);
  SDL_DestroyWindow(gizmo.window);
  SDL_Quit();
  if (gizmo.app->destroy)
    gizmo.app->destroy(gizmo.app);
  free(gizmo.app->key_actions);
  free(gizmo.app->mouse_actions);
#endif
  return result;
}
