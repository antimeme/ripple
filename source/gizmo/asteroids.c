/**
 * asteroids.c
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
 * A simplistic Asteroids clone.  This is a sample to demonstrate
 * basic features of SDL2 with an easy to understand context. */
#include <math.h>
#include <locale.h>
#include "gizmo.h"
#include "asteroids.h"

/* ------------------------------------------------------------------ */

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

  unsigned score;
  struct ship player;
  unsigned lives;
  unsigned wavesize;
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
  unsigned gameover;
  unsigned report;

  struct point *points;
  unsigned n_points;

  TTF_Font *font_score;
  TTF_Font *font_gameover;
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
    float direction = 2 * M_PI * gizmo_uniform();
    float speed = self->size * (gizmo_uniform() + 1) / 2500;

    memset(piece, 0, sizeof(*piece));
    piece->duration = 900;
    piece->size = self->size / 100;
    piece->position = *position;
    piece->velocity = *velocity;
    piece->velocity.x += cosf(direction) * speed;
    piece->velocity.y += sinf(direction) * speed;

    piece->n_points = 3 * gizmo_uniform() + 3;
    if ((piece->points = malloc
         (sizeof(struct point) * piece->n_points))) {
      unsigned jj;

      for (jj = 0; jj < piece->n_points; ++jj) {
        float spar = (gizmo_uniform() + 1) / 2;
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
      float place = 2 * gizmo_uniform();
      if (place >= 1) {
        asteroid->position.x = (place - 1.5) * self->app.width;
        asteroid->position.y = asteroid->size + self->app.height / 2;
      } else {
        asteroid->position.x = asteroid->size + self->app.width / 2;
        asteroid->position.y = (place - 0.5) * self->app.height;
      }
    } else asteroid->position = position;
    asteroid->direction = 2 * M_PI * gizmo_uniform();
    asteroid->velocity.x = speed * cosf(asteroid->direction);
    asteroid->velocity.y = speed * sinf(asteroid->direction);

    asteroid->n_points = 2 * n_splits + 10;
    if ((asteroid->points = malloc
         (sizeof(struct point) * asteroid->n_points))) {
      unsigned jj;

      for (jj = 0; jj < asteroid->n_points; ++jj) {
        float spar = (gizmo_uniform() * 5 + 7) / 12;
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

static unsigned
asteroids__asteroid_impact(struct app_asteroids *self,
                           struct asteroid *asteroid)
{
  unsigned result = !asteroid->n_splits ? 100 :
    (asteroid->n_splits < 2) ? 50 : 20;
  asteroids__debris_create
    (self, &asteroid->position, &asteroid->velocity,
     1 + asteroid->n_splits * 2 + (int)(4 * gizmo_uniform()));
  asteroid->dead = 1;
  if (asteroid->n_splits > 0)
    asteroids__asteroids_create(self, asteroid, 2);
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
     4 + (unsigned)(4 * gizmo_uniform()));
  ship->position.x = ship->position.y = 0;
  ship->velocity.x = ship->velocity.y = 0;
  ship->direction = -M_PI/2;
  self->target = nan("1");
  ship->dead = 3000;
  if (!self->lives)
    self->gameover = 2000;
}

static void
asteroids__shots_update(struct ship *ship, unsigned elapsed,
                        int width, int height)
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
asteroids_reset(struct app_asteroids *self)
{
  unsigned ii;

  self->gameover = 0;
  self->score = 0;
  self->lives = 3;
  self->wavesize = 4;
  self->nextwave = 1000;

  self->tapshot = 0;
  self->target = nan("1");
  self->thrust = 0;
  self->thrust_elapsed = 0;
  self->holding = 0;
  self->held = 0;
  self->warp = 0;
  self->turn_left = 0;
  self->turn_right = 0;

  self->player.dead = 0;
  self->player.direction = -M_PI / 2;
  self->player.velocity.x = 0;
  self->player.velocity.y = 0;
  self->player.position.x = 0;
  self->player.position.y = 0;

  for (ii = 0; ii < self->n_asteroids; ++ii)
    asteroids__asteroid_destroy(&self->asteroids[ii]);
  self->n_asteroids = 0;

  for (ii = 0; ii < self->n_debris; ++ii)
    asteroids__debris_destroy(&self->debris[ii]);
  self->n_debris = 0;
}

static void
asteroids__tap(struct app *app, SDL_Event *event)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  if (self->gameover == 1)
    asteroids_reset(self);
  else {
    struct point vector = {
      (event->button.x - self->app.width / 2) - self->player.position.x,
      (event->button.y - self->app.height / 2) - self->player.position.y
    };
    float quadrance = vector.x * vector.x + vector.y * vector.y;

    if (quadrance > self->player.size * self->player.size) {
      float sx = cos(self->player.direction);
      float sy = sin(self->player.direction);
      float cosangle = (vector.x * sx + vector.y * sy) /
        sqrt(quadrance);
      float angle = ((sx * vector.y - sy * vector.x > 0) ? 1 : -1) *
        acosf((cosangle > 1) ? 1 : (cosangle < -1) ? -1 : cosangle);
      self->target = self->player.direction + angle;
    }

    if (!self->player.dead && (self->tapshot > 0))
      asteroids__ship_shoot(&self->player, self->player.direction,
                            self->size);
    self->tapshot = 350;
    self->holding = 1;
    self->held = 0;
  }
}

static void
asteroids__untap(struct app *app, SDL_Event *event)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  self->holding = 0;
  self->held = 0;
}

static void
asteroids__keyreset(struct app *app, SDL_Event *event)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  if (self->gameover == 1)
    asteroids_reset(self);
}

static void
asteroids__shoot(struct app *app, SDL_Event *event)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  if (self->gameover == 1)
    asteroids_reset(self);
  else if (!self->player.dead)
    asteroids__ship_shoot(&self->player, self->player.direction,
                          self->size);
}

static void
asteroids__ship_asteroid(struct app_asteroids *self, unsigned aid,
                         struct ship *ship, unsigned elapsed)
{
  struct asteroid *asteroid = &self->asteroids[aid];
  unsigned award = 0;
  unsigned ii;
  for (ii = 0; ii < ship->n_shots; ++ii) {
    if (gizmo_check_collide
      (asteroid->size, &asteroid->position, &asteroid->velocity,
         ship->shots[ii].size, &ship->shots[ii].position,
         &ship->shots[ii].velocity, elapsed)) {
      ship->shots[ii].duration = 0;
      award = asteroids__asteroid_impact(self, asteroid);
      break;
    }
  }

  /* Previous block may have reallocated the asteroids array to
   * create new fragments so we have to reaquire the pointer */
  asteroid = &self->asteroids[aid];

  if (!ship->dead && gizmo_check_collide
      (asteroid->size, &asteroid->position, &asteroid->velocity,
       ship->size, &ship->position, &ship->velocity, elapsed)) {
    if (ship->impact)
      ship->impact(self, ship);
    award = asteroids__asteroid_impact(self, asteroid);
  }

  if (ship == &self->player)
    self->score += award;
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
  unsigned ii;

  self->size = (width < height) ? width : height;
  self->player.size = self->size * 3 / 100;
  for (ii = 0; ii < self->n_asteroids; ++ii)
    self->asteroids[ii].size =
      (1 << self->asteroids[ii].n_splits) * self->size / 40;

  gizmo_app_font(&self->font_score, (unsigned)(self->size / 17));
  gizmo_app_font(&self->font_gameover,
                 (unsigned)(2 * self->size / 17));
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
    { SDL_SCANCODE_UP,    0, &self->thrust,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_DOWN,  0, &self->warp,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_LEFT,  0, &self->turn_left,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_RIGHT, 0, &self->turn_right,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_W,     0, &self->thrust,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_A,     0, &self->turn_left,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_S,     0, &self->warp,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_D,     0, &self->turn_right,
      1, 0, asteroids__keyreset },
    { SDL_SCANCODE_SPACE, app_key_flag_norepeat, NULL,
      0, 0, asteroids__shoot },
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
    self->n_points = n_points;
    self->points = newpoints;
    for (ii = 0; ii < n_points; ++ii)
      self->points[ii] = points[ii];
    newpoints = NULL;

    memset(&self->player, 0, sizeof(self->saucer));
    self->player.impact = asteroids__player_impact;
    self->player.points   = self->points + n_points_used;
    self->player.n_points = n_points_player;
    n_points_used += n_points_player;

    memset(&self->saucer, 0, sizeof(self->saucer));
    self->saucer.points   = self->points + n_points_used;
    self->saucer.n_points = n_points_saucer;
    n_points_used += n_points_saucer;

    self->n_debris = self->m_debris = 0;
    self->debris = NULL;
    self->n_asteroids = self->m_asteroids = 0;
    self->asteroids = NULL;

    self->font_score = NULL;
    self->font_gameover = NULL;
    asteroids_resize(&self->app, self->app.width, self->app.height);
    asteroids_reset(self);
  }

  free(newpoints);
  setlocale(LC_NUMERIC, ""); /* This puts commas in score */
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

  TTF_CloseFont(self->font_score);
  TTF_CloseFont(self->font_gameover);

  free(self);
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

  if (self->gameover > 0) {
    if (elapsed >= self->gameover)
      self->gameover = 1;
    else self->gameover -= elapsed;
  } else if (self->player.dead > 0) {
    if (elapsed > self->player.dead) {
      self->player.dead = 0;

      if (self->lives) {
        for (ii = 0; ii < self->n_asteroids; ++ii)
          if (gizmo_check_collide
              (self->asteroids[ii].size,
               &self->asteroids[ii].position,
               &self->asteroids[ii].velocity,
               self->player.size, &self->player.position,
               &self->player.velocity, 1500))
            self->player.dead = 500;
        if (!self->player.dead) {
          self->lives -= 1;
          self->target = nan("1");
        }
      }
    } else self->player.dead -= elapsed;
  } else {
    if (self->turn_left && self->turn_right)
      self->target = nan("1");

    if (self->turn_left) {
      self->player.direction -= (float)elapsed / 200;
    } else if (self->turn_right) {
      self->player.direction += (float)elapsed / 200;
    } else if (!isnan(self->target)) {
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

    if ((self->thrust_elapsed > 0) && (self->size > 0)) {
      float factor = self->thrust_elapsed * self->size / 200000;
      self->player.velocity.x += cosf(self->player.direction) * factor;
      self->player.velocity.y += sinf(self->player.direction) * factor;
    }
  }

  for (ii = 0; ii < self->n_asteroids; ++ii)
    if (!self->player.dead && !self->asteroids[ii].dead)
      asteroids__ship_asteroid
        (self, ii, &self->player, elapsed);

  if (!self->player.dead)
    move_wrap(self->player.size, elapsed,
              self->app.width, self->app.height,
              &self->player.position,
              &self->player.velocity);
  asteroids__shots_update(&self->player, elapsed,
                          self->app.width, self->app.height);

  asteroids__debris_update
    (self, self->app.width, self->app.height, elapsed);
  asteroids__asteroids_update
    (self, self->app.width, self->app.height, elapsed);

  if (self->nextwave > 0) {
    if (elapsed > self->nextwave) {
      self->nextwave = 0;
      asteroids__asteroids_create(self, NULL, self->wavesize);
      self->wavesize += 2;
      if (self->wavesize > 11)
        self->wavesize = 11;
    } else self->nextwave -= elapsed;
  } else if (self->n_asteroids == 0)
    self->nextwave = 5000;

  return EXIT_SUCCESS;
}

static int
asteroids__draw_player(struct ship *ship, SDL_Renderer *renderer,
                       int width, int height, unsigned thrust)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  struct point position;
  float dircos = cos(ship->direction);
  float dirsin = sin(ship->direction);

  position.x = ship->position.x + width / 2;
  position.y = ship->position.y + height / 2;
  result = gizmo_draw_polygon
    (renderer, ship->size, &position,
     dircos, dirsin, ship->n_points, ship->points);

  if ((result == EXIT_SUCCESS) && thrust) {
    struct point points[] = { { -1, 1./3}, { -3./2, 0}, { -1, -1./3} };
    unsigned n_points = sizeof(points) / sizeof(*points);

    for (ii = 0; ii < ship->n_points; ++ii) {
      points[ii].x += (gizmo_uniform() - 0.5) * 0.33;
      points[ii].y += (gizmo_uniform() - 0.5) * 0.33;
    }
    result = gizmo_draw_polygon(renderer, ship->size, &position,
                                dircos, dirsin, n_points, points);
  }

  return result;
}

static void
asteroids__draw_text(SDL_Renderer *renderer, TTF_Font *font,
                     SDL_Color *color, const char *message,
                     struct point *start, struct point *center)
{
  SDL_Surface *surface = TTF_RenderUTF8_Solid(font, message, *color);
  if (surface) {
    SDL_Texture *texture = SDL_CreateTextureFromSurface
      (renderer, surface);
    if (texture) {
      SDL_Rect dsrect = { 0, 0, surface->w, surface->h };
      if (start) {
        dsrect.x = start->x;
        dsrect.y = start->y;
      } else if (center) {
        dsrect.x = (center->x - surface->w) / 2;
        dsrect.y = (center->y - surface->h) / 2;
      }
      SDL_RenderCopy(renderer, texture, NULL, &dsrect);
      SDL_DestroyTexture(texture);
    }
    SDL_FreeSurface(surface);
  }
}

static int
asteroids_draw(struct app *app, SDL_Renderer *renderer)
{
  struct app_asteroids *self = (struct app_asteroids *)app;
  int result = EXIT_SUCCESS;
  SDL_Color color = { 224, 224, 224 };
  unsigned ii;

  SDL_SetRenderDrawColor(renderer, 16, 16, 16, 255);
  SDL_RenderClear(renderer);
  SDL_SetRenderDrawColor(renderer, 224, 224, 224, 255);

  if (self->font_score) {
    struct point start = { self->player.size, self->player.size };
    char str_score[256];
    snprintf(str_score, sizeof(str_score), "%'u", self->score);
    asteroids__draw_text
      (renderer, self->font_score, &color, str_score, &start, NULL);
  }

  if (self->font_gameover && (self->gameover > 0)) {
    struct point dimensions = { self->app.width, self->app.height };
    asteroids__draw_text
      (renderer, self->font_gameover, &color,
       "GAME OVER", NULL, &dimensions);
  }

  for (ii = 0; ii < self->lives; ++ii) { /* Draw extra lives */
    struct point position;
    position.x = 15 * self->player.size * (ii + 1) / 8;
    position.y = self->player.size + self->size / 8;
    gizmo_draw_polygon(renderer, self->player.size, &position, 0, -1,
                       self->player.n_points, self->player.points);
  }

  if (!self->player.dead)
    asteroids__draw_player(&self->player, renderer,
                           self->app.width, self->app.height,
                           self->thrust_elapsed);

  for (ii = 0; ii < self->player.n_shots; ++ii)
    circleColor(renderer,
                (int)(self->player.shots[ii].position.x +
                      self->app.width / 2),
                (int)(self->player.shots[ii].position.y +
                      self->app.height / 2),
                self->player.size / 3, 0xffe0e0e0);

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    struct point position = asteroid->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    if (!asteroid->dead)
      gizmo_draw_polygon(renderer, asteroid->size, &position,
                         cosf(asteroid->direction),
                         sinf(asteroid->direction),
                         asteroid->n_points, asteroid->points);
  }

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    struct point position = piece->position;
    position.x += self->app.width / 2;
    position.y += self->app.height / 2;
    gizmo_draw_polygon(renderer, piece->size, &position, 1, 0,
                       piece->n_points, piece->points);
  }

  SDL_RenderPresent(renderer);
  return result;
}

static struct app_asteroids app_asteroids;

struct app *
asteroids_get_app(void) {
  struct app_asteroids *result = NULL;

  if ((result = malloc(sizeof(*result)))) {
    result->app.icon        = (unsigned char *)asteroids_icon_svg;
    result->app.icon_length = sizeof(asteroids_icon_svg);
    result->app.init    = asteroids_init;
    result->app.destroy = asteroids_destroy;
    result->app.resize  = asteroids_resize;
    result->app.update  = asteroids_update;
    result->app.draw    = asteroids_draw;
  }
  return &result->app;
}
