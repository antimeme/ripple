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
 * Gizmo is a simplistic framework intended to take some of the chore
 * work out of writing SDL2 applications. */
#include <stdlib.h>
#include <math.h>
#include <SDL2/SDL.h>
#include <SDL2/SDL_image.h>
#include <SDL2/SDL2_gfxPrimitives.h>

/* Find an appropriate implementation for a millisecond clock */
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

struct point { float x; float y; };

/**
 * Return a random number between 0 and 1 selected using a
 * uniform distribution. */
float
uniform() { return ((float)rand() / (float)RAND_MAX); }

/**
 * Return non-zero iff value is close enough to zero */
int
zeroish(float value)
{
  const float epsilon = 0.00000000001;
  return (value <= epsilon) && (value >= -epsilon);
}

/**
 * Use the quadradic equation to find polynomial roots. */
void
quadratic_real_roots(unsigned *n_roots, float *roots,
                     float c, float b, float a)
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

/**
 * Return non-zero iff the spherical objects represented by given
 * position, velocity and size collide within the elapsed time. */
int
check_collide(float sizeA, struct point *positionA,
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

    quadratic_real_roots(&n_roots, roots,
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
rotate_origin(struct point *point, float dircos, float dirsin)
{
  struct point result = {
    point->x * dircos - point->y * dirsin,
    point->x * dirsin + point->y * dircos };
  return result;
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

struct app_asteroids;

struct debris {
  float size;
  struct point position;
  struct point velocity;
  unsigned duration;

  struct point *points;
  unsigned n_points;
};

struct asteroid {
  float size;
  struct point position;
  struct point velocity;
  float direction;
  unsigned dead;
  unsigned n_splits;

  struct point *points;
  unsigned n_points;
};

struct shot {
  float size;
  struct point position;
  struct point velocity;
  unsigned duration;
};

struct ship {
  float size;
  struct point position;
  struct point velocity;
  float direction;
  unsigned dead;

  struct point *points;
  unsigned n_points;

  struct shot *shots;
  unsigned n_shots;
  unsigned m_shots;
  void (*impact)(struct app_asteroids *, struct ship *);
};

struct app_asteroids {
  struct app app;
  float size;

  struct ship player;
  unsigned lives;
  unsigned nextwave;
  struct ship saucer;
  struct asteroid *asteroids;
  unsigned n_asteroids;
  unsigned m_asteroids;
  struct debris *debris;
  unsigned n_debris;
  unsigned m_debris;

  int thrust;
  int warp;
  int turn_left;
  int turn_right;
  float target;
  unsigned tapshot;
  unsigned thrust_elapsed;
  unsigned holding;
  unsigned held;
  unsigned report;

  struct point *points;
  unsigned n_points;
};

static void
move_wrap(float size, unsigned elapsed, int width, int height,
          struct point *position, struct point *velocity)
{
  position->x += velocity->x * elapsed;
  if (position->x > size + width / 2)
    position->x = -(size + width / 2);
  if (position->x < -(size + width / 2))
    position->x = size + width / 2;

  position->y += velocity->y * elapsed;
  if (position->y > size + height / 2)
    position->y = -(size + height / 2);
  if (position->y < -(size + height / 2))
    position->y = size + height / 2;
}

static int
asteroids__debris_create(struct app_asteroids *self,
                         struct point *position,
                         struct point *velocity, unsigned count)
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
    float direction = 2 * M_PI * uniform();
    float speed = self->size * (uniform() + 1) / 2500;

    memset(piece, 0, sizeof(*piece));
    piece->duration = 900;
    piece->size = self->size / 100;
    piece->position = *position;
    piece->velocity = *velocity;
    piece->velocity.x += cosf(direction) * speed;
    piece->velocity.y += sinf(direction) * speed;

    piece->n_points = 3 * uniform() + 3;
    if ((piece->points = malloc
         (sizeof(struct point) * piece->n_points))) {
      unsigned jj;

      for (jj = 0; jj < piece->n_points; ++jj) {
        float spar = (uniform() + 1) / 2;
        piece->points[jj].x =
          spar * cosf(M_PI * 2 * jj / piece->n_points);
        piece->points[jj].y =
          spar * sinf(M_PI * 2 * jj / piece->n_points);
      }
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
asteroids__debris_destroy(struct debris *piece)
{
  free(piece->points);
}

static void
asteroids__debris_update(struct app_asteroids *self,
                         int width, int height, unsigned elapsed)
{
  int survivors = 0;
  int ii;

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    if ((piece->duration > elapsed) &&
        (piece->position.x < (self->app.width + piece->size) / 2) &&
        (piece->position.x > -(self->app.width + piece->size) / 2) &&
        (piece->position.y < (self->app.height + piece->size) / 2) &&
        (piece->position.y > -(self->app.height + piece->size) / 2)) {
      piece->duration -= elapsed;
      piece->position.x += piece->velocity.x * elapsed;
      piece->position.y += piece->velocity.y * elapsed;
      if (ii > survivors)
        self->debris[survivors] = *piece;
      survivors++;
    } else asteroids__debris_destroy(piece);
  }
  self->n_debris = survivors;
}

static int
asteroids__asteroids_create(struct app_asteroids *self,
                            struct asteroid *source,
                            unsigned n_asteroids)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  struct point empty = {0, 0};
  struct point position = source ? source->position : empty;
  unsigned n_splits = source ? (source->n_splits - 1) : 2;

  if (self->m_asteroids < self->n_asteroids + n_asteroids) {
    struct asteroid *newasteroids = realloc
      (self->asteroids, sizeof(struct asteroid) *
       (self->n_asteroids + n_asteroids));
    if (newasteroids) {
      self->asteroids = newasteroids;
      self->m_asteroids = self->n_asteroids + n_asteroids;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for asteroid\n",
              (self->n_asteroids + n_asteroids) *
              sizeof(*self->asteroids));
      result = EXIT_FAILURE;
    }
  }

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_asteroids); ++ii) {
    struct asteroid *asteroid = &self->asteroids[self->n_asteroids];
    float speed = self->size / 2000 / (1 << n_splits);

    memset(asteroid, 0, sizeof(*asteroid));
    asteroid->dead = 0;
    asteroid->n_splits = n_splits;
    asteroid->size = (1 << asteroid->n_splits) * self->size / 40;
    if (!source) {
      float place = 2 * uniform();
      if (place > 1) {
        asteroid->position.x = (place - 0.5) * self->app.width;
        asteroid->position.y = (asteroid->size + self->app.height) / 2;
      } else {
        asteroid->position.x = (asteroid->size + self->app.width) / 2;
        asteroid->position.y = (place - 0.5) * self->app.height;
      }
    } else asteroid->position = position;
    asteroid->direction = 2 * M_PI * uniform();
    asteroid->velocity.x = speed * cosf(asteroid->direction);
    asteroid->velocity.y = speed * sinf(asteroid->direction);

    asteroid->n_points = 2 * n_splits + 10;
    if ((asteroid->points = malloc
         (sizeof(struct point) * asteroid->n_points))) {
      unsigned jj;

      for (jj = 0; jj < asteroid->n_points; ++jj) {
        float spar = (uniform() * 5 + 7) / 12;
        asteroid->points[jj].x =
          spar * cosf(M_PI * 2 * jj / asteroid->n_points);
        asteroid->points[jj].y =
          spar * sinf(M_PI * 2 * jj / asteroid->n_points);
      }
      ++self->n_asteroids;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for asteroids\n",
              sizeof(struct point) * asteroid->n_points * 2);
      result = EXIT_FAILURE;
    }
  }
  return result;
}

static void
asteroids__asteroid_destroy(struct asteroid *asteroid)
{
  free(asteroid->points);
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
                &asteroid->position, &asteroid->velocity);
      if (ii > survivors)
        self->asteroids[survivors] = *asteroid;
      survivors++;
    } else asteroids__asteroid_destroy(asteroid);
    self->asteroids[ii].direction += elapsed * M_PI /
      (self->asteroids[ii].size * 30);
  }
  self->n_asteroids = survivors;
}

static void
asteroids__player_impact(struct app_asteroids *self, struct ship *ship)
{
  asteroids__debris_create
    (self, &ship->position, &ship->velocity,
     4 + (unsigned)(4 * uniform()));
  ship->dead = 3000;
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
                &shot->position, &shot->velocity);
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

  if (ship->m_shots < ship->n_shots + 1) {
    struct shot *newshots = realloc
      (ship->shots, (ship->n_shots + 1) * sizeof(*ship->shots));
    if (newshots) {
      ship->shots = newshots;
      ship->m_shots = ship->n_shots + 1;
    } else {
      fprintf(stderr, "Failed to allocate %lu bytes for shot\n",
              (ship->n_shots + 1) * sizeof(*ship->shots));
      result = EXIT_FAILURE;
    }
  }

  if ((result == EXIT_SUCCESS) && (ship->n_shots < 9)) {
    struct shot *shot = &ship->shots[ship->n_shots++];
    shot->size = ship->size;
    shot->duration = 350;
    shot->position = ship->position;
    shot->velocity = ship->velocity;
    shot->velocity.x += cosf(direction) * size / 700;
    shot->velocity.y += sinf(direction) * size / 700;
  }
  return result;
}

static void
asteroids__tap(struct app_asteroids *self, SDL_Event *event)
{
  struct point vector = {
    (event->button.x - self->app.width / 2) - self->player.position.x,
    (event->button.y - self->app.height / 2) - self->player.position.y
  };
  float quadrance = vector.x * vector.x + vector.y * vector.y;

  if (quadrance > self->player.size * self->player.size) {
    float sx = cos(self->player.direction);
    float sy = sin(self->player.direction);
    float cosangle = (vector.x * sx + vector.y * sy) / sqrt(quadrance);
    float angle = ((sx * vector.y - sy * vector.x > 0) ? 1 : -1) *
      acosf((cosangle > 1) ? 1 : (cosangle < -1) ? -1 : cosangle);
    self->target = self->player.direction + angle;
  }

  if (self->tapshot > 0)
    asteroids__ship_shoot(&self->player, self->player.direction,
                          self->size);
  self->tapshot = 350;
  self->holding = 1;
  self->held = 0;
}

static void
asteroids__untap(struct app_asteroids *self, SDL_Event *event)
{
  self->holding = 0;
  self->held = 0;
}

static void
asteroids__shoot(struct app_asteroids *self, SDL_Event *event)
{
  asteroids__ship_shoot(&self->player, self->player.direction,
                        self->size);
}

static void
asteroids__ship_asteroid(struct app_asteroids *self, unsigned aid,
                         struct ship *ship, unsigned elapsed)
{
  unsigned ii;
  for (ii = 0; ii < ship->n_shots; ++ii) {
    struct asteroid *asteroid = &self->asteroids[aid];
    if (check_collide
      (asteroid->size, &asteroid->position, &asteroid->velocity,
         ship->shots[ii].size, &ship->shots[ii].position,
         &ship->shots[ii].velocity, elapsed)) {
      ship->shots[ii].duration = 0;
      asteroids__debris_create
        (self, &asteroid->position, &asteroid->velocity,
         1 + asteroid->n_splits * 2 + (int)(4 * uniform()));
      asteroid->dead = 1;
      if (asteroid->n_splits > 0)
        asteroids__asteroids_create(self, asteroid, 2);
      break;
    }
  }

  /* Previous block may have reallocated the asteroids array to
   * create new fragments so we have to reaquire the pointer */
  struct asteroid *asteroid = &self->asteroids[aid];
  if (!ship->dead && check_collide
      (asteroid->size, &asteroid->position, &asteroid->velocity,
       ship->size, &ship->position, &ship->velocity, elapsed)) {
    if (ship->impact)
      ship->impact(self, ship);

    asteroids__debris_create
      (self, &asteroid->position, &asteroid->velocity,
       1 + asteroid->n_splits * 2 + (unsigned)(4 * uniform()));
    asteroid->dead = 1;
    if (asteroid->n_splits > 0)
      asteroids__asteroids_create(self, asteroid, 2);
  }
}

static void
asteroids__ship_destroy(struct ship *ship)
{
  free(ship->shots);
}

static void
asteroids_resize(struct app *app, int width, int height)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  self->size = (width < height) ? width : height;
  self->player.size = self->size * 3 / 100;
}

static void
asteroids_reset(struct app_asteroids *self)
{
  unsigned ii;

  self->lives = 3;
  self->nextwave = 1000;

  self->player.direction = -M_PI / 2;
  self->player.velocity.x = 0;
  self->player.velocity.y = 0;
  self->player.position.x = 0;
  self->player.position.y = 0;
  self->target = nan("1");

  for (ii = 0; ii < self->n_asteroids; ++ii)
    asteroids__asteroid_destroy(&self->asteroids[ii]);
  self->n_asteroids = 0;

  for (ii = 0; ii < self->n_debris; ++ii)
    asteroids__debris_destroy(&self->debris[ii]);
  self->n_debris = 0;
}

static int
asteroids_init(struct app *app, void *context)
{
  int result = EXIT_SUCCESS;
  struct app_asteroids *self = (struct app_asteroids *)app;
  unsigned ii = 0;
  struct app_mouse_action mouse_actions[] = {
    { SDL_MOUSEBUTTONDOWN,
      (void (*)(struct app*, SDL_Event *))asteroids__tap },
    { SDL_MOUSEBUTTONUP,
      (void (*)(struct app*, SDL_Event *))asteroids__untap },
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
  struct point points[] = {
    { 1, 0 }, { -1, 2./3 }, { -2./3, 0 }, { -1, -2./3 },

    { 1, 0 }, { -1, 2./3 }, { -2./3, 0 }, { -1, -2./3 }
  };
  const unsigned n_points = sizeof(points) / sizeof(*points);
  const unsigned n_points_player = 4;
  const unsigned n_points_saucer = 4;
  unsigned n_points_used = 0;

  if (!self) {
    fprintf(stderr, "Error: missing app structure\n");
    result = EXIT_FAILURE;
  } else if ((result = gizmo_app_actions
              (context, key_actions, sizeof(key_actions) /
               sizeof(*key_actions), mouse_actions,
               sizeof(mouse_actions) / sizeof(*mouse_actions)))) {
    /* Already reported */
  } else if (!(newpoints = malloc(sizeof(struct point) * n_points))) {
    fprintf(stderr, "Failed to allocate %lu bytes for points\n",
            sizeof(struct point) * n_points);
    result = EXIT_FAILURE;
  } else {
    asteroids_resize(&self->app, self->app.width, self->app.height);

    self->n_points = n_points;
    self->points = newpoints;
    for (ii = 0; ii < n_points; ++ii)
      self->points[ii] = points[ii];
    newpoints = NULL;

    self->player.impact = asteroids__player_impact;
    self->player.points   = self->points + n_points_used;
    self->player.n_points = n_points_player;
    n_points_used += n_points_player;

    self->saucer.points   = self->points + n_points_used;
    self->saucer.n_points = n_points_saucer;
    n_points_used += n_points_saucer;

    self->n_debris = self->m_debris = 0;
    self->debris = NULL;
    self->n_asteroids = self->m_asteroids = 0;
    self->asteroids = NULL;

    asteroids_reset(self);
  }
  free(newpoints);
  return result;
}

static void
asteroids_destroy(struct app *app)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  unsigned ii;

  for (ii = 0; ii < self->n_debris; ++ii)
    asteroids__debris_destroy(&self->debris[ii]);
  free(self->debris);

  for (ii = 0; ii < self->n_asteroids; ++ii)
    asteroids__asteroid_destroy(&self->asteroids[ii]);
  free(self->asteroids);

  asteroids__ship_destroy(&self->player);
  asteroids__ship_destroy(&self->saucer);
  free(self->points);
}

static int
asteroids_update(struct app *app, unsigned elapsed)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  int result = EXIT_SUCCESS;
  int ii;
  int current;

  self->report -= (elapsed > self->report) ? self->report : elapsed;
  if (!self->report) {
    self->report = 900;
    if (0) {
      printf("REPORT ship=[%.2fpx,d=%u,dir=%.2f]\n",
             self->player.size, self->player.dead,
             self->player.direction);
    }
  }
  self->tapshot -= (elapsed > self->tapshot) ? self->tapshot : elapsed;

  if (self->player.dead) {
    if (elapsed > self->player.dead) {
      struct point zero = {0, 0};
      self->player.dead = 0;

      if (self->lives) {
        for (ii = 0; ii < self->n_asteroids; ++ii)
          if (check_collide
              (self->asteroids[ii].size,
               &self->asteroids[ii].position,
               &self->asteroids[ii].velocity,
               self->player.size, &zero, &zero, 1500))
            self->player.dead = 500;
        if (!self->player.dead) {
          self->lives -= 1;
          self->player.position = zero;
          self->player.velocity = zero;
          self->player.direction = -M_PI / 2;
          self->target = nan("1");
        }
      } else asteroids_reset(self);
    } else self->player.dead -= elapsed;
  } else {
    if (self->turn_left && self->turn_right) {
      self->target = nan("1");
    } else if (self->turn_left) {
      self->target = nan("1");
      self->player.direction -= (float)elapsed / 200;
    } else if (self->turn_right) {
      self->target = nan("1");
      self->player.direction += (float)elapsed / 200;
    } else if (!isnan(self->target) &&
               (self->player.direction != self->target)) {
      float difference = self->target - self->player.direction;

      if (difference > M_PI)
        difference -= M_PI;
      else if (difference < -M_PI)
        difference += M_PI;

      if (fabs(difference) < (float)elapsed / 200) {
        self->player.direction = self->target;
        self->target = nan("1");
      } else if (difference > 0)
        self->player.direction += (float)elapsed / 200;
      else self->player.direction -= (float)elapsed / 200;
    }

    self->thrust_elapsed = (self->thrust) ?
      elapsed : (self->held > 300) ? elapsed :
      (self->held + elapsed > 300) ? self->held + elapsed - 300 : 0;
    if (self->holding)
      self->held += elapsed;

    if (self->thrust || (self->holding && (self->held > 300))) {
      self->player.velocity.x += cosf(self->player.direction) *
        self->thrust_elapsed / self->size;
      self->player.velocity.y += sinf(self->player.direction) *
        self->thrust_elapsed / self->size;
    }
  }

  for (ii = 0; ii < self->n_asteroids; ++ii)
    if (!self->asteroids[ii].dead)
      asteroids__ship_asteroid
        (self, ii, &self->player, elapsed);

  if (!self->player.dead)
    move_wrap(self->player.size, elapsed,
              self->app.width, self->app.height,
              &self->player.position,
              &self->player.velocity);
  asteroids__shots_update(&self->player, self->app.width,
                          self->app.height, elapsed);

  asteroids__debris_update
    (self, self->app.width, self->app.height, elapsed);
  asteroids__asteroids_update
    (self, self->app.width, self->app.height, elapsed);
  if (self->nextwave > 0) {
    if (elapsed > self->nextwave) {
      self->nextwave = 0;
      asteroids__asteroids_create(self, NULL, 8);
    } else self->nextwave -= elapsed;
  } else if (self->n_asteroids == 0)
    self->nextwave = 5000;
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
  struct point previous = { 0, 0 };
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < n_points); ++ii) {
    struct point start = ii ? previous :
      rotate_origin(&points[ii], dircos, dirsin);
    struct point end = rotate_origin
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

static int
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
  result = draw_polygon(renderer, ship->size, &position,
                        dircos, dirsin, ship->n_points, ship->points);

  if ((result == EXIT_SUCCESS) && thrust) {
    struct point points[] = { { -1, 1./3}, { -3./2, 0}, { -1, -1./3} };
    unsigned n_points = sizeof(points) / sizeof(*points);

    for (ii = 0; ii < ship->n_points; ++ii) {
      points[ii].x += (uniform() - 0.5) * 0.33;
      points[ii].y += (uniform() - 0.5) * 0.33;
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

static int
asteroids_draw(struct app *app, SDL_Renderer *renderer)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  int result = EXIT_SUCCESS;
  unsigned ii;

  SDL_SetRenderDrawColor(renderer, 16, 16, 16, 255);
  SDL_RenderClear(renderer);
  SDL_SetRenderDrawColor(renderer, 224, 224, 224, 255);

  for (ii = 0; ii < self->lives; ++ii) {
    struct point position;
    position.x = 15 * self->player.size * (ii + 1) / 8;
    position.y = self->player.size + self->size / 8;
    draw_polygon(renderer, self->player.size, &position, 0, -1,
                 self->player.n_points, self->player.points);
  }

  if (!self->player.dead)
    asteroids__draw_ship(&self->player, renderer,
                         self->app.width, self->app.height,
                         self->thrust_elapsed);

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    struct point position = asteroid->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    if (!asteroid->dead)
      draw_polygon(renderer, asteroid->size, &position,
                   cosf(asteroid->direction),
                   sinf(asteroid->direction),
                   asteroid->n_points, asteroid->points);
  }

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    struct point position = piece->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    draw_polygon(renderer, piece->size, &position, 1, 0,
                 piece->n_points, piece->points);
  }

  SDL_RenderPresent(renderer);
  return result;
}

static struct app_asteroids app_asteroids;

struct app *
asteroids_get_app(void) {
  app_asteroids.app.init    = asteroids_init;
  app_asteroids.app.destroy = asteroids_destroy;
  app_asteroids.app.resize  = asteroids_resize;
  app_asteroids.app.update  = asteroids_update;
  app_asteroids.app.draw    = asteroids_draw;
  return &app_asteroids.app;
}

/* ------------------------------------------------------------------ */

int
gizmo_frame(struct gizmo *gizmo)
{
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
             (EXIT_SUCCESS != (result = gizmo.app->init
                               (gizmo.app, &gizmo)))) {
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

  gizmo.done = 0;
  while ((result == EXIT_SUCCESS) && !gizmo.done) {
    gizmo_frame(&gizmo);
    SDL_Delay(16);
  }
  SDL_DestroyRenderer(gizmo.renderer);
  SDL_DestroyWindow(gizmo.window);
  SDL_Quit();
  if (gizmo.app->destroy)
    gizmo.app->destroy(gizmo.app);
  free(gizmo.key_actions);
  free(gizmo.mouse_actions);
#endif
  return result;
}
