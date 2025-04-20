/**
 * asteroids.c
 * Copyright (C) 2025 by Jeff Gold.
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
 * A simplistic Asteroids clone.  This program is intended to create a
 * single executable program that runs on 32-bit Windows using ANSI
 * strings, GDI and DirectSound.  When available this program will
 * link with libvorbis to decode OGG files embedded as resources.
 * This keeps everything together, but it does make a file almost
 * eight hundred kilobytes in size. */
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>
#include <limits.h>
#include <locale.h>

#include <windows.h>
#include <dsound.h>
#include <tchar.h>
#include "resource.h"

/* === Error Handling */

/**
 * Present a failure message to the user. */
static HRESULT
fail(const TCHAR *title, const TCHAR *message, ...)
{
  HRESULT result = E_FAIL;
  TCHAR *buffer = NULL;
  int size_needed;
  va_list args;
  va_start(args, message);
  size_needed = _vscprintf(message, args) + 1;
  va_end(args);

  if (size_needed <= 0) {
    MessageBox(NULL, _T("Failed to format message"), _T("FAIL"),
               MB_ICONERROR);
    result = E_INVALIDARG;
  } else if (!(buffer = malloc(size_needed))) {
    MessageBox(NULL, _T("Failed to allocate bytes"), _T("FAIL"),
               MB_ICONERROR);
    result = E_OUTOFMEMORY;
  } else {
    va_start(args, message);
    _vsntprintf(buffer, size_needed, message, args);
    va_end(args);
    MessageBox(NULL, buffer, title, MB_ICONERROR);
  }
  free(buffer);
  return result;
}

/**
 * Generate a random number with a uniform distribution between
 * zero (inclusive) and one (exclusive). */
float
random_uniform()
{ return (float)rand() / ((float)RAND_MAX + 1.0f); }

/* === OGG Vorbis Integration */

#ifdef HAVE_WIN32_VORBIS
#  include <vorbis/vorbisfile.h>

struct memory_file {
  const char *data;
  size_t size;
  size_t pos;
};

size_t
sound_callback_read(void* ptr, size_t size, size_t nmemb,
                    void* datasource)
{
  struct memory_file* mem = (struct memory_file*)datasource;
  size_t remain = mem->size - mem->pos;
  size_t bytes  = (size * nmemb > remain) ? remain : (size * nmemb);
  memcpy(ptr, mem->data + mem->pos, bytes);
  mem->pos += bytes;
  return bytes / size;
}

int
sound_callback_seek(void* datasource, ogg_int64_t offset, int whence) {
  int result = 0;
  struct memory_file* mem = (struct memory_file*) datasource;
  size_t new_pos = 0;

  switch (whence) {
  case SEEK_SET: new_pos = offset;             break;
  case SEEK_CUR: new_pos = mem->pos + offset;  break;
  case SEEK_END: new_pos = mem->size + offset; break;
  default: result = -1;
  }
  if (new_pos > mem->size)
    result = -1;
  else mem->pos = new_pos;
  return result;
}

long
sound_callback_tell(void* datasource) {
  return (long)((struct memory_file*)datasource)->pos;
}

ov_callbacks sound_callbacks = {
  sound_callback_read,
  sound_callback_seek,
  NULL,
  sound_callback_tell
};

HRESULT
sound_resource(LPDIRECTSOUND8 ds, int resID,
               LPDIRECTSOUNDBUFFER *oBuffer)
{
  HRESULT result = S_OK;
  HRSRC hRes = NULL;
  HGLOBAL hGlobal = NULL;
  void *resource = NULL;

  if (!(hRes = FindResource(NULL, MAKEINTRESOURCE(resID), "SOUND"))) {
    result = fail(_T("DecodeVorbis"),
                  _T("Failed to find resource (%d): %s"),
                  resID, MAKEINTRESOURCE(resID));
  } else if (!(hGlobal = LoadResource(NULL, hRes))) {
    result = fail(_T("DecodeVorbis"),
                  _T("Failed to load resource (%d): %s"),
                  resID, MAKEINTRESOURCE(resID));
  } else {
    struct memory_file mem_file = {
      (const char *)LockResource(hGlobal),
      SizeofResource(NULL, hRes), 0 };
    OggVorbis_File vf;

    if (ov_open_callbacks(&mem_file, &vf, NULL, 0,
                          sound_callbacks) < 0) {
      result = fail(_T("DecodeVorbis"),
                    _T("Failed to open OGG stream (%u): %s"),
                    resID, MAKEINTRESOURCE(resID));
    } else {
      vorbis_info* vi = ov_info(&vf, -1);
      WAVEFORMATEX wfx = {0};
      wfx.wFormatTag = WAVE_FORMAT_PCM;
      wfx.nChannels = vi->channels;
      wfx.nSamplesPerSec = vi->rate;
      wfx.wBitsPerSample = 16;
      wfx.nBlockAlign = wfx.nChannels * wfx.wBitsPerSample / 8;
      wfx.nAvgBytesPerSec = wfx.nSamplesPerSec * wfx.nBlockAlign;

      char* pcmData = NULL;
      size_t totalSize = 0;
      long bytes;
      char buffer[4096];

      do {
        bytes = ov_read(&vf, buffer, sizeof(buffer), 0, 2, 1, NULL);
        if (bytes <= 0)
          break;

        char* pcmDataNext = realloc(pcmData, totalSize + bytes);
        if (pcmDataNext) {
          pcmData = pcmDataNext;
          memcpy(pcmData + totalSize, buffer, bytes);
          totalSize += bytes;
        } else result = fail("DecodeVorbis", "Failed to allocate "
                             "%u bytes", totalSize + bytes);
      } while (SUCCEEDED(result) && (bytes > 0));
      ov_clear(&vf);

      DSBUFFERDESC desc = {0};
      desc.dwSize = sizeof(DSBUFFERDESC);
      desc.dwFlags = DSBCAPS_CTRLVOLUME;
      desc.dwBufferBytes = totalSize;
      desc.lpwfxFormat = &wfx;

      LPDIRECTSOUNDBUFFER pBuffer;
      if (FAILED(result = IDirectSound_CreateSoundBuffer
                 (ds, &desc, &pBuffer, NULL))) {
        fail("DecodeVorbis", "Failed to create sound buffer");
      } else {
        void* p1; DWORD s1;
        void* p2; DWORD s2;
        if (SUCCEEDED(IDirectSoundBuffer_Lock
                      (pBuffer, 0, totalSize, &p1, &s1, &p2, &s2, 0))) {
          memcpy(p1, pcmData, s1);
          if (p2 && s2 > 0)
            memcpy(p2, pcmData + s1, s2);
          IDirectSoundBuffer_Unlock(pBuffer, p1, s1, p2, s2);
          *oBuffer = pBuffer;
        }
      }
      free(pcmData);
    }
  }
  return result;
}
#else
HRESULT
sound_resource(int resnum, LPDIRECTSOUNDBUFFER *o_buffer)
{ return S_OK; }
#endif

void
sound_play(LPDIRECTSOUNDBUFFER sound)
{
  if (!sound)
    return;
  IDirectSoundBuffer_SetCurrentPosition(sound, 0);
  IDirectSoundBuffer_Play(sound, 0, 0, 0);
}

void
sound_loop(LPDIRECTSOUNDBUFFER sound)
{
  if (!sound)
    return;
  IDirectSoundBuffer_SetCurrentPosition(sound, 0);
  IDirectSoundBuffer_Play(sound, 0, 0, DSBPLAY_LOOPING);
}

BOOL
sound_is_playing(LPDIRECTSOUNDBUFFER sound)
{
  BOOL result = FALSE;
  DWORD status;

  if (sound && SUCCEEDED(IDirectSoundBuffer_GetStatus(sound, &status)))
    result = status & DSBSTATUS_PLAYING;
  return result;
}

void
sound_stop(LPDIRECTSOUNDBUFFER sound)
{
  if (sound)
    IDirectSoundBuffer_Stop(sound);
}

HRESULT
setup_direct_sound(HWND hwnd, LPDIRECTSOUND8 *ds)
{
  HRESULT result = S_OK;

  if (FAILED(result = DirectSoundCreate8(NULL, ds, NULL))) {
    fail("SetupDirectSound", "Failed to initalize DirectSound");
  } else if (FAILED(result = IDirectSound_SetCooperativeLevel
                    (*ds, hwnd, DSSCL_PRIORITY))) {
    fail("SetupDirectSound", "Failed to set cooperative level");
  }
  return result;
}

/* === True Type Font Support */

HRESULT
font_resource(HINSTANCE hInstance, int resnum, TCHAR *name,
              HANDLE *oFontResource, HFONT *oFont)
{
  HRESULT result = S_OK;
  HRSRC res = FindResource
    (hInstance, MAKEINTRESOURCE(resnum), _T("TTF"));
  HGLOBAL hRes = LoadResource(NULL, res);
  void* pFontData = LockResource(hRes);
  DWORD fontSize = SizeofResource(NULL, res);
  DWORD numFonts = 0;
  HFONT hFont = NULL;
  HANDLE hFontResource = NULL;

  if (!(hFontResource = AddFontMemResourceEx
        (pFontData, fontSize, NULL, &numFonts))) {
    result = fail(_T("font_resource"),
                  _T("Failed to find resource (%d): %s"),
                  resnum, MAKEINTRESOURCE(resnum));
  } else if (!(hFont = CreateFontA
               (-32, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, name))) {
    result = fail(_T("font_resource"),
                  _T("Failed to create font (%d): %s"),
                  resnum, MAKEINTRESOURCE(resnum));
  } else {
    if (oFontResource) {
      *oFontResource = hFontResource;
      hFontResource = NULL;
    }
    if (oFont) { *oFont = hFont; hFont = NULL; }
  }
  DeleteObject(hFont);
  RemoveFontMemResourceEx(hFontResource);
  return result;
}

/* === Asteroids Data Structures */

struct point {
  float x;
  float y;
};

#define WIDTH 800
#define HEIGHT 600
#define PI 3.14159265

struct debris {
  struct point position;
  struct point velocity;
  float radius;
  unsigned duration;

  struct point *points;
  unsigned n_points;
};

struct asteroid {
  struct point position;
  struct point velocity;
  float radius;
  float direction;
  unsigned dead;
  unsigned n_splits;

  struct point *points;
  unsigned n_points;
};

struct app_asteroids;

struct shot {
  struct point position;
  struct point velocity;
  float radius;
  unsigned duration;
};

struct ship {
  struct point position;
  struct point velocity;
  float radius;
  float direction;
  unsigned dead;
  int (*impact)(struct app_asteroids *, void *);

  struct point *points;
  unsigned n_points;

  struct shot *shots;
  unsigned n_shots;
  unsigned m_shots;
};

struct app_asteroids {
  int width;
  int height;
  float size;
  unsigned score;
  unsigned gameover;
  unsigned wavesize;
  unsigned nextwave;
  unsigned lives;

  struct ship player;
  int thrust;
  int warp;
  int turn_left;
  int turn_right;
  float target;
  unsigned thrust_elapsed;
  unsigned tapshot;
  unsigned holding;
  unsigned held;

  struct ship saucer;
  int      saucer_small;
  unsigned saucer_turn;
  unsigned saucer_shoot;

  struct asteroid *asteroids;
  unsigned n_asteroids;
  unsigned m_asteroids;

  struct debris *debris;
  unsigned n_debris;
  unsigned m_debris;

  HANDLE font_resource;
  HFONT  font;

  LPDIRECTSOUND8      ds;
  LPDIRECTSOUNDBUFFER sound_thruster;
  LPDIRECTSOUNDBUFFER sound_shoot_beam;
  LPDIRECTSOUNDBUFFER sound_saucer_siren;
  LPDIRECTSOUNDBUFFER sound_smash_rock;
  LPDIRECTSOUNDBUFFER sound_smash_ship;
};

static struct app_asteroids app;

/* === Asteroids Game Logic */

static void
move_wrap(float size, unsigned elapsed, int width, int height,
          struct point *position, struct point *velocity)
{
  float right = size + width / 2;
  float left  = -right;
  position->x += velocity->x * elapsed;
  if (position->x > right)
    position->x = left;
  if (position->x < left)
    position->x = right;

  float bottom = size + height / 2;
  float top    = -bottom;
  position->y += velocity->y * elapsed;
  if (position->y > bottom)
    position->y = top;
  if (position->y < top)
    position->y = bottom;
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
      fail("debris_create", "Failed to allocate %lu bytes for debris",
           (self->n_debris + count) * sizeof(*self->debris));
      result = EXIT_FAILURE;
    }
  }

  for (ii = 0; (result == EXIT_SUCCESS) && (ii < count); ++ii) {
    struct debris *piece = &self->debris[self->n_debris];
    float direction = 2 * M_PI * random_uniform();
    float speed = self->size * (random_uniform() + 1) / 2500;

    memset(piece, 0, sizeof(*piece));
    piece->duration = 900;
    piece->radius = self->size / 100;
    piece->position = *position;
    piece->velocity = *velocity;
    piece->velocity.x += cosf(direction) * speed;
    piece->velocity.y += sinf(direction) * speed;

    piece->n_points = 3 * random_uniform() + 3;
    if ((piece->points = malloc
         (sizeof(struct point) * piece->n_points))) {
      unsigned jj;

      for (jj = 0; jj < piece->n_points; ++jj) {
        float spar = (random_uniform() + 1) / 2;
        piece->points[jj].x =
          spar * cosf(M_PI * 2 * jj / piece->n_points);
        piece->points[jj].y =
          spar * sinf(M_PI * 2 * jj / piece->n_points);
      }
      self->n_debris++;
    } else {
      fail("debris_create", "Failed to allocate %lu bytes for debris",
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
        (piece->position.x < (self->width + piece->radius) / 2) &&
        (piece->position.x > -(self->width + piece->radius) / 2) &&
        (piece->position.y < (self->height + piece->radius) / 2) &&
        (piece->position.y > -(self->height + piece->radius) / 2)) {
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
      fail("asteroids_create", "Failed to allocate %lu bytes for "
           "asteroid", (self->n_asteroids + n_asteroids) *
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
    asteroid->radius = (1 << asteroid->n_splits) * self->size / 40;
    if (!source) {
      float place = 2 * random_uniform();
      if (place >= 1) {
        asteroid->position.x = (place - 1.5) * self->width;
        asteroid->position.y = asteroid->radius + self->height / 2;
      } else {
        asteroid->position.x = asteroid->radius + self->width / 2;
        asteroid->position.y = (place - 0.5) * self->height;
      }
    } else asteroid->position = position;
    asteroid->direction = 2 * M_PI * random_uniform();
    asteroid->velocity.x = speed * cosf(asteroid->direction);
    asteroid->velocity.y = speed * sinf(asteroid->direction);

    asteroid->n_points = 2 * n_splits + 10;
    if ((asteroid->points = malloc
         (sizeof(struct point) * asteroid->n_points))) {
      unsigned jj;

      for (jj = 0; jj < asteroid->n_points; ++jj) {
        float spar = (random_uniform() * 5 + 7) / 12;
        asteroid->points[jj].x =
          spar * cosf(M_PI * 2 * jj / asteroid->n_points);
        asteroid->points[jj].y =
          spar * sinf(M_PI * 2 * jj / asteroid->n_points);
      }
      ++self->n_asteroids;
    } else {
      fail("asteroids_create", "Failed to allocate %lu bytes for "
           "asteroids", sizeof(struct point) * asteroid->n_points * 2);
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

static int
asteroids__asteroid_impact(struct app_asteroids *self, void *target)
{
  struct asteroid *asteroid = target;
  int result = !asteroid->n_splits ? 100 :
    (asteroid->n_splits < 2) ? 50 : 20;
  asteroids__debris_create
    (self, &asteroid->position, &asteroid->velocity,
     1 + asteroid->n_splits * 2 + (int)(4 * random_uniform()));
  asteroid->dead = 1;
  if (asteroid->n_splits > 0)
    asteroids__asteroids_create(self, asteroid, 2);
  sound_play(self->sound_smash_rock);
  return result;
}

static void
asteroids__asteroids_update(struct app_asteroids *self,
                            unsigned elapsed)
{
  int survivors = 0;
  int ii;

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    if (!asteroid->dead) {
      move_wrap(asteroid->radius, elapsed, self->width, self->height,
                &asteroid->position, &asteroid->velocity);
      if (ii > survivors)
        self->asteroids[survivors] = *asteroid;
      survivors++;
    } else asteroids__asteroid_destroy(asteroid);
    self->asteroids[ii].direction += elapsed * M_PI /
      (self->asteroids[ii].radius * 30);
  }
  self->n_asteroids = survivors;
}

static int
asteroids__player_impact(struct app_asteroids *self, void *target)
{
  struct ship *ship = (struct ship *)target;
  asteroids__debris_create
    (self, &ship->position, &ship->velocity,
     4 + (unsigned)(4 * random_uniform()));
  ship->position.x = ship->position.y = 0;
  ship->velocity.x = ship->velocity.y = 0;
  ship->direction = -M_PI/2;
  self->target = nan("1");
  ship->dead = 3000;
  if (!self->lives)
    self->gameover = 2000;
  sound_stop(self->sound_thruster);
  sound_play(self->sound_smash_ship);
  return 0;
}

static void
asteroids__saucer_reset(struct app_asteroids *self, struct ship *ship)
{
  ship->dead = (unsigned)(8000 * (1 + random_uniform()));
  ship->position.x = ship->position.y = 0;
  ship->velocity.x = ship->velocity.y = 0;

  self->saucer_turn = 0;
  self->saucer_shoot = 0;

  sound_stop(self->sound_saucer_siren);
}

static struct point
rotate_point(struct point *point, float dircos, float dirsin)
{
  struct point result = {
    point->x * dircos - point->y * dirsin,
    point->x * dirsin + point->y * dircos };
  return result;
}

static void
draw_point_loop(HDC hdc, float radius, struct point *position,
                float dircos, float dirsin,
                unsigned count, struct point *points)
{
  if (count >= 2) {
    struct point current = rotate_point
      (&points[count - 1], dircos, dirsin);
    unsigned ii;

    MoveToEx(hdc, position->x + radius * current.x,
             position->y + radius * current.y, NULL);
    for (ii = 0; ii < count; ++ii) {
      current = rotate_point(&points[ii], dircos, dirsin);
      LineTo(hdc, position->x + radius * current.x,
             position->y + radius * current.y);
    }
  }
}

static int
asteroids__saucer_draw(HDC hdc, struct ship *ship,
                       int width, int height, int small)
{
  int result = EXIT_SUCCESS;
  struct point position;
  float dome_size = ship->radius * 2 / 3;
  float dircos = -1;
  float dirsin =  0;

  position.x = ship->position.x + width / 2;
  position.y = ship->position.y + height / 2;
  draw_point_loop(hdc, ship->radius, &position, dircos, dirsin,
                  ship->n_points, ship->points);
  MoveToEx(hdc, position.x - dome_size, position.y, NULL);
  Arc(hdc, position.x - dome_size, position.y - dome_size,
      position.x + dome_size, position.y + dome_size,
      position.x + dome_size, position.y,
      position.x - dome_size, position.y);
  return result;
}

static int
asteroids__saucer_impact(struct app_asteroids *self, void *target)
{
  struct ship *ship = (struct ship *)target;
  asteroids__debris_create
    (self, &ship->position, &ship->velocity,
     4 + (unsigned)(4 * random_uniform()));
  asteroids__saucer_reset(self, ship);
  sound_play(self->sound_smash_ship);
  return self->saucer_small ? 1000 : 200;
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
      move_wrap(shot->radius, elapsed, width, height,
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
      fail("ship_shoot", "Failed to allocate %lu bytes for shot",
           (ship->n_shots + 1) * sizeof(*ship->shots));
      result = EXIT_FAILURE;
    }
  }

  if ((result == EXIT_SUCCESS) && (ship->n_shots < 9)) {
    struct shot *shot = &ship->shots[ship->n_shots++];
    shot->radius = ship->radius;
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
  self->player.n_shots = 0;

  self->saucer_small = 0;
  self->saucer.n_shots = 0;
  asteroids__saucer_reset(self, &self->saucer);

  for (ii = 0; ii < self->n_asteroids; ++ii)
    asteroids__asteroid_destroy(&self->asteroids[ii]);
  self->n_asteroids = 0;

  for (ii = 0; ii < self->n_debris; ++ii)
    asteroids__debris_destroy(&self->debris[ii]);
  self->n_debris = 0;
}

static void
asteroids__award(struct app_asteroids *self, unsigned npoints)
{
  const unsigned newlife = 10000;
  if (((self->score + npoints) / newlife) > (self->score / newlife))
    self->lives += 1;
  self->score += npoints;
}

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
 * position, velocity and radius collide within the elapsed time. */
int
check_collide(float radiusA, struct point *positionA,
              struct point *velocityA,
              float radiusB, struct point *positionB,
              struct point *velocityB, unsigned elapsed)
{
  int result = 0;
  const float gap = radiusA + radiusB;
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

    quadratic_real_roots
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

static int
asteroids__shots_check(struct app_asteroids *self, struct ship *ship,
                       unsigned elapsed, void *other, float radius,
                       struct point *position, struct point *velocity,
                       int (*impact)(struct app_asteroids *, void *))
{
  unsigned award = 0;
  unsigned ii;
  for (ii = 0; ii < ship->n_shots; ++ii) {
    if (check_collide
        (radius, position, velocity,
         ship->shots[ii].radius, &ship->shots[ii].position,
         &ship->shots[ii].velocity, elapsed)) {
      ship->shots[ii].duration = 0;
      if (impact)
        award = impact(self, other);
      break;
    }
  }
  return award;
}

static void
asteroids__ship_asteroid(struct app_asteroids *self, unsigned aid,
                         struct ship *ship, unsigned elapsed)
{
  struct asteroid *asteroid;
  unsigned award = 0;

  asteroid = &self->asteroids[aid];
  if (!asteroid->dead)
    award = asteroids__shots_check
      (self, ship, elapsed, asteroid, asteroid->radius,
       &asteroid->position, &asteroid->velocity,
       asteroids__asteroid_impact);

  /* Previous block may have reallocated the asteroids array to
   * create new fragments so we have to reaquire the pointer */
  asteroid = &self->asteroids[aid];
  if (!ship->dead && !asteroid->dead &&
      check_collide(asteroid->radius, &asteroid->position,
                    &asteroid->velocity, ship->radius, &ship->position,
                    &ship->velocity, elapsed)) {
    if (ship->impact)
      ship->impact(self, ship);
    award = asteroids__asteroid_impact(self, asteroid);
  }

  if (award && (ship == &self->player))
    asteroids__award(self, award);
}

static void
asteroids__ship_destroy(struct ship *ship)
{
  free(ship->shots);
}

static void
asteroids_destroy(struct app_asteroids *self)
{
  unsigned ii;

  for (ii = 0; ii < self->n_debris; ++ii)
    asteroids__debris_destroy(&self->debris[ii]);
  free(self->debris);

  for (ii = 0; ii < self->n_asteroids; ++ii)
    asteroids__asteroid_destroy(&self->asteroids[ii]);
  free(self->asteroids);

  asteroids__ship_destroy(&self->player);
  asteroids__ship_destroy(&self->saucer);
  free(self);
}

static int
asteroids_update(struct app_asteroids *self, unsigned elapsed)
{
  int result = EXIT_SUCCESS;
  int ii;
  int current;

  self->tapshot -= (elapsed > self->tapshot) ? self->tapshot : elapsed;

  if (self->gameover > 0) {
    if (elapsed >= self->gameover)
      self->gameover = 1;
    else self->gameover -= elapsed;
  } else if (self->player.dead > 0) {
    if (elapsed >= self->player.dead) {
      self->player.dead = 0;

      for (ii = 0; ii < self->n_asteroids; ++ii)
        if (check_collide(self->asteroids[ii].radius,
                          &self->asteroids[ii].position,
                          &self->asteroids[ii].velocity,
                          self->player.radius, &self->player.position,
                          &self->player.velocity, 1500))
          self->player.dead = 500;
      if (!self->player.dead) {
        self->lives -= 1;
        self->player.position.x = 0;
        self->player.position.y = 0;
        self->player.velocity.x = 0;
        self->player.velocity.y = 0;
        self->player.direction = -M_PI/2;
        self->target = nan("1");
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
      float factor = self->thrust_elapsed *
        self->player.radius / 20000;
      self->player.velocity.x += cosf(self->player.direction) * factor;
      self->player.velocity.y += sinf(self->player.direction) * factor;

      if (!sound_is_playing(self->sound_thruster))
        sound_loop(self->sound_thruster);
    } else sound_stop(self->sound_thruster);
  }

  if (self->saucer.dead) {
    if (self->gameover && (elapsed >= self->saucer.dead)) {
      asteroids__saucer_reset(self, &self->saucer);
    } else if (elapsed >= self->saucer.dead) { /* Respawn */
      self->saucer.dead = 0;

      self->saucer_small = (10000 > self->score) ? 0 :
        (random_uniform() * 40000 < self->score);
      self->saucer.radius = self->size /
        (self->saucer_small ? 50 : 25);

      self->saucer.position.x = (self->size + self->width) / 2;
      self->saucer.position.y = (self->size + self->height) / 2;
      self->saucer.velocity.x =
        (((random_uniform() * 2 > 1) ? 1 : -1) *
         self->saucer.radius / (self->saucer_small ? 400 : 800));
      self->saucer.velocity.y = 0;
      self->saucer_turn = 1000;
      self->saucer_shoot = 2000;
      if (!sound_is_playing(self->sound_saucer_siren))
        sound_loop(self->sound_saucer_siren);
    } else self->saucer.dead -= elapsed;
  }

  for (ii = 0; ii < self->n_asteroids; ++ii)
    if (!self->player.dead && !self->asteroids[ii].dead)
      asteroids__ship_asteroid
        (self, ii, &self->player, elapsed);

  for (ii = 0; ii < self->n_asteroids; ++ii)
    if (!self->saucer.dead && !self->asteroids[ii].dead)
      asteroids__ship_asteroid
        (self, ii, &self->saucer, elapsed);

  if (!self->player.dead && !self->saucer.dead &&
      check_collide(self->player.radius, &self->player.position,
                    &self->player.velocity, self->saucer.radius,
                    &self->saucer.position, &self->saucer.velocity,
                    elapsed)) {
    self->player.impact(self, &self->player);
    self->score += self->saucer.impact(self, &self->saucer);
  }

  if (!self->player.dead)
    asteroids__shots_check
      (self, &self->saucer, elapsed, &self->player,
       self->player.radius, &self->player.position,
       &self->player.velocity, asteroids__player_impact);
  if (!self->saucer.dead)
    self->score += asteroids__shots_check
      (self, &self->player, elapsed, &self->saucer,
       self->saucer.radius, &self->saucer.position,
       &self->saucer.velocity, asteroids__saucer_impact);

  if (!self->saucer.dead) {
    move_wrap(self->saucer.radius, elapsed,
              self->width, self->height,
              &self->saucer.position, &self->saucer.velocity);
    if (self->saucer_turn <= elapsed) {
      int which = (((self->saucer.position.y < 0) ? -1 : 1) *
                   ((random_uniform() > 0.125) ? -1 : 1));
      self->saucer.velocity.y =
        ((self->saucer.velocity.x > 0) ? 1 : -1) *
        self->saucer.velocity.x * (random_uniform() + 1) * which;
      self->saucer_turn = 500 + 2500 * random_uniform();
    } else self->saucer_turn -= elapsed;

    if (self->saucer_shoot <= elapsed) {
      if (!self->player.dead) {
        float direction = 0;

        if (self->saucer_small) {
          struct point vector = self->player.position;
          vector.x -= self->saucer.position.x;
          vector.y -= self->saucer.position.y;
          direction = atan2f(vector.y, vector.x);
        } else direction = M_PI * 2 * random_uniform();

        asteroids__ship_shoot(&self->saucer, direction, self->size);
        sound_play(self->sound_shoot_beam);
      }
      self->saucer_shoot =
        ((self->saucer_small ? 800 : 1600) * (1 + random_uniform()));
    } else self->saucer_shoot -= elapsed;
  }

  if (!self->player.dead)
    move_wrap(self->player.radius, elapsed,
              self->width, self->height,
              &self->player.position, &self->player.velocity);

  asteroids__shots_update(&self->player, elapsed,
                          self->width, self->height);
  asteroids__shots_update(&self->saucer, elapsed,
                          self->width, self->height);

  asteroids__debris_update
    (self, self->width, self->height, elapsed);
  asteroids__asteroids_update(self, elapsed);

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
asteroids__player_draw(HDC hdc, struct ship *ship,
                       int width, int height, unsigned thrust)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  struct point position;
  float dircos = cos(ship->direction);
  float dirsin = sin(ship->direction);

  position.x = ship->position.x + width / 2;
  position.y = ship->position.y + height / 2;
  draw_point_loop(hdc, ship->radius, &position, dircos, dirsin,
                  ship->n_points, ship->points);

  if ((result == EXIT_SUCCESS) && thrust) {
    struct point points[] = { { -1, 1./3}, { -3./2, 0}, { -1, -1./3} };
    unsigned n_points = sizeof(points) / sizeof(*points);

    for (ii = 0; ii < ship->n_points; ++ii) {
      points[ii].x += (random_uniform() - 0.5) * 0.33;
      points[ii].y += (random_uniform() - 0.5) * 0.33;
    }
    draw_point_loop(hdc, ship->radius, &position, dircos, dirsin,
                    n_points, points);
  }

  return result;
}

static void
asteroids__tap(struct app_asteroids *self, int x, int y)
{
  if (self->gameover == 1)
    asteroids_reset(self);
  else {
    struct point vector = {
      (x - self->width / 2) - self->player.position.x,
      (y - self->height / 2) - self->player.position.y };
    float quadrance = vector.x * vector.x + vector.y * vector.y;

    if (quadrance > self->player.radius * self->player.radius) {
      float sx = cos(self->player.direction);
      float sy = sin(self->player.direction);
      float cosangle = (vector.x * sx + vector.y * sy) /
        sqrt(quadrance);
      float angle = ((sx * vector.y - sy * vector.x > 0) ? 1 : -1) *
        acosf((cosangle > 1) ? 1 : (cosangle < -1) ? -1 : cosangle);
      self->target = self->player.direction + angle;
    }

    if (!self->player.dead && (self->tapshot > 0)) {
      asteroids__ship_shoot(&self->player, self->player.direction,
                            self->size);
      sound_play(self->sound_shoot_beam);
    }
    self->tapshot = 350;
    self->holding = 1;
    self->held = 0;
  }
}

static void
asteroids__untap(struct app_asteroids *self)
{
  self->holding = 0;
  self->held = 0;
}

static void
asteroids__keyreset(struct app_asteroids *self)
{
  if (self->gameover == 1)
    asteroids_reset(self);
}

static void
asteroids__shoot(struct app_asteroids *self)
{
  if (self->gameover == 1)
    asteroids_reset(self);
  else if (!self->player.dead) {
    asteroids__ship_shoot(&self->player, self->player.direction,
                          self->size);
    sound_play(self->sound_shoot_beam);
  }
}

static int
asteroids_resize(struct app_asteroids *self, int width, int height)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  self->width  = width;
  self->height = height;
  self->size = (width < height) ? width : height;
  self->player.radius = self->size * 3 / 100;
  self->saucer.radius = self->size / (self->saucer_small ? 50 : 25);
  for (ii = 0; ii < self->n_asteroids; ++ii)
    self->asteroids[ii].radius =
      (1 << self->asteroids[ii].n_splits) * self->size / 40;
  return result;
}

static int
asteroids__copy_points(struct point **dest, struct point *points,
                       unsigned n_points)
{
  int result = EXIT_SUCCESS;
  if ((*dest = malloc(sizeof(struct point) * n_points))) {
    unsigned ii;
    for (ii = 0; ii < n_points; ++ii)
      (*dest)[ii] = points[ii];
  } else result = EXIT_FAILURE;
  return result;
}

static int
asteroids_init(struct app_asteroids *self)
{
  int result = EXIT_SUCCESS;
  unsigned ii = 0;
  struct point player_points[] = {
    {1, 0}, {-1, 2./3}, {-2./3, 0}, {-1, -2./3} };
  struct point saucer_points[] = {
    {2./3, 0}, {1, -1./3}, {2./3, -2./3},
    {-2./3, -2./3}, {-1, -1./3}, {-2./3, 0} };

  if (!self) {
    fail(_T("asteroids_init"), _T("Error: missing app structure"));
    result = EXIT_FAILURE;
  } else if (EXIT_SUCCESS != asteroids__copy_points
             (&self->player.points, player_points,
              sizeof(player_points) / sizeof(*player_points))) {
    fail(_T("asteroids_init"), _T("Failed to copy player points"));
    result = EXIT_FAILURE;
  } else if (EXIT_SUCCESS != asteroids__copy_points
             (&self->saucer.points, saucer_points,
              sizeof(saucer_points) / sizeof(*saucer_points))) {
    fail(_T("asteroids_init"), _T("Failed to copy saucer points"));
    result = EXIT_FAILURE;
  } else {
    self->player.impact = asteroids__player_impact;
    self->player.n_points =
      sizeof(player_points) / sizeof(*player_points);

    self->saucer.impact = asteroids__saucer_impact;
    self->saucer.n_points =
      sizeof(saucer_points) / sizeof(*saucer_points);

    self->n_debris = self->m_debris = 0;
    self->debris = NULL;
    self->n_asteroids = self->m_asteroids = 0;
    self->asteroids = NULL;

    asteroids_resize(self, self->width, self->height);
    asteroids_reset(self);
  }
  return result;
}

static void
asteroids__draw_text(struct app_asteroids *self, HDC hdc,
                     struct point *start, struct point *center,
                     const TCHAR *message)
{
  if (start)
    TextOut(hdc, start->x, start->y, message, _tcslen(message));
  else if (center) {
    SIZE text_size;
    GetTextExtentPoint32(hdc, message, _tcslen(message), &text_size);
    TextOut(hdc, (self->width - text_size.cx) / 2,
            (self->height - text_size.cy) / 2,
            message, _tcslen(message));
  }
}

static int
asteroids_draw(struct app_asteroids *self, HDC hdc)
{
  int result = EXIT_SUCCESS;
  unsigned ii;
  RECT rect = { 0, 0, self->width, self->height };
  HBRUSH hBrush = CreateSolidBrush(RGB(16, 16, 16));
  HPEN   hPen   = CreatePen(PS_SOLID, 2, RGB(224, 224, 224));

  FillRect(hdc, &rect, hBrush);
  SelectObject(hdc, hPen);

  SetBkMode(hdc, TRANSPARENT);
  SetTextColor(hdc, RGB(224, 224, 224));
  SelectObject(hdc, self->font);

  if (self->font) {
    struct point start = { self->player.radius, self->player.radius };
    TCHAR str_score[256];
    _sntprintf(str_score, _countof(str_score), _T("%'u"), self->score);
    asteroids__draw_text(self, hdc, &start, NULL, str_score);
  }

  if (self->font && (self->gameover > 0)) {
    struct point dimensions = { self->width, self->height };
    asteroids__draw_text(self, hdc, NULL, &dimensions, _T("GAME OVER"));
  }

  for (ii = 0; ii < self->lives; ++ii) { /* Draw extra lives */
    struct point position;
    position.x = 15 * self->player.radius * (ii + 1) / 8;
    position.y = self->player.radius + self->size / 8;
    draw_point_loop(hdc, self->player.radius, &position, 0, -1,
                    self->player.n_points, self->player.points);
  }

  if (!self->player.dead)
    asteroids__player_draw
      (hdc, &self->player, self->width, self->height,
       self->thrust_elapsed);

  for (ii = 0; ii < self->player.n_shots; ++ii) {
    struct point position = {
      self->player.shots[ii].position.x + self->width / 2,
      self->player.shots[ii].position.y + self->height / 2 };
    float radius = self->size / 100;
    Arc(hdc, position.x - radius, position.y - radius,
        position.x + radius, position.y + radius,
        position.x + radius, position.y,
        position.x + radius, position.y);
  }

  if (!self->saucer.dead)
    asteroids__saucer_draw(hdc, &self->saucer,
                           self->width, self->height,
                           self->saucer_small);

  for (ii = 0; ii < self->saucer.n_shots; ++ii) {
    struct point position = {
      self->saucer.shots[ii].position.x + self->width / 2,
      self->saucer.shots[ii].position.y + self->height / 2 };
    float radius = self->size / 100;
    Arc(hdc, position.x - radius, position.y - radius,
        position.x + radius, position.y + radius,
        position.x + radius, position.y,
        position.x + radius, position.y);
  }

  for (ii = 0; ii < self->n_asteroids; ++ii) {
    struct asteroid *asteroid = &self->asteroids[ii];
    struct point position = asteroid->position;
    position.x += self->width / 2;
    position.y += self->height / 2;
    if (!asteroid->dead)
      draw_point_loop(hdc, asteroid->radius, &position,
                      cosf(asteroid->direction),
                      sinf(asteroid->direction),
                      asteroid->n_points, asteroid->points);
  }

  for (ii = 0; ii < self->n_debris; ++ii) {
    struct debris *piece = &self->debris[ii];
    struct point position = piece->position;
    position.x += self->width / 2;
    position.y += self->height / 2;
    draw_point_loop(hdc, piece->radius, &position, 1, 0,
                    piece->n_points, piece->points);
  }

  DeleteObject(hPen);
  DeleteObject(hBrush);
  return result;
}

LRESULT CALLBACK
WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  LRESULT result = 0;
  static HDC     s_hdc = NULL;
  static HBITMAP s_hbm = NULL;

  switch (msg) {
  case WM_CREATE: {
    HDC hdc = GetDC(hwnd);
    s_hdc = CreateCompatibleDC(hdc);
    s_hbm = CreateCompatibleBitmap(hdc, app.width, app.height);
    SelectObject(s_hdc, s_hbm);
    ReleaseDC(hwnd, hdc);
  } break;
  case WM_DESTROY: {
    DeleteDC(s_hdc);
    DeleteObject(s_hbm);
    PostQuitMessage(0);
  } break;
  case WM_SIZE: {
    switch (wParam) {
    case SIZE_MAXIMIZED:
    case SIZE_RESTORED:
      DeleteDC(s_hdc);
      DeleteObject(s_hbm);

      HDC hdc = GetDC(hwnd);
      s_hdc = CreateCompatibleDC(hdc);
      s_hbm = CreateCompatibleBitmap
        (hdc, LOWORD(lParam), HIWORD(lParam));
      SelectObject(s_hdc, s_hbm);
      ReleaseDC(hwnd, hdc);

      asteroids_resize(&app, LOWORD(lParam), HIWORD(lParam));
      break;
    default: /* nothing */
    }
  } break;
  case WM_ERASEBKGND: {
    result = 1; /* Tell windows we handled it */
  } break;
  case WM_PAINT: {
    asteroids_draw(&app, s_hdc);

    HDC hdc = GetDC(hwnd);
    BitBlt(hdc, 0, 0, app.width, app.height, s_hdc, 0, 0, SRCCOPY);
    ReleaseDC(hwnd, hdc);
  } break;
  case WM_LBUTTONDOWN: {
    POINT point;
    GetCursorPos(&point);
    ScreenToClient(hwnd, &point);
    asteroids__tap(&app, point.x, point.y);
  } break;
  case WM_LBUTTONUP: { asteroids__untap(&app); } break;
  case WM_KEYDOWN: {
    switch (wParam) {
    case VK_SPACE: asteroids__shoot(&app); break;
    case VK_UP:
    case 'W':
      app.thrust = 1; break;
    case VK_LEFT:
    case 'A':
      app.turn_left = 1; break;
    case VK_RIGHT:
    case 'D':
      app.turn_right = 1; break;
    case VK_DOWN:
    case 'S':
      app.warp = 1; break;
    default: /* nothing */
    }
    asteroids__keyreset(&app);
  } break;
  case WM_KEYUP: {
    switch (wParam) {
    case VK_UP:
    case 'W':
      app.thrust = 0; break;
    case VK_LEFT:
    case 'A':
      app.turn_left = 0; break;
    case VK_RIGHT:
    case 'D':
      app.turn_right = 0; break;
    case VK_DOWN:
    case 'S':
      app.warp = 0; break;
    default: /* nothing */
    }
  } break;
  default:
    result = DefWindowProc(hwnd, msg, wParam, lParam);
  }
  return result;
}

int WINAPI
_tWinMain(HINSTANCE hInstance, HINSTANCE, TCHAR*, int nCmdShow) {
  HRESULT result = S_OK;
  if (!setlocale(LC_NUMERIC, ""))
    setlocale(LC_NUMERIC, "C");

  WNDCLASSEX wc = {0};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_ICON_ASTEROIDS));
  wc.hIconSm = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_ICON_ASTEROIDS));
  wc.hCursor = LoadCursor(NULL, IDC_ARROW);
  wc.lpszClassName = _T("Asteroids");
  RegisterClassEx(&wc);

  memset(&app, 0, sizeof(app));
  app.width  = WIDTH;
  app.height = HEIGHT;

  HWND hwnd = CreateWindowEx
    (0, _T("Asteroids"), _T("Asteroids"),
     WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT,
     WIDTH, HEIGHT, NULL, NULL, hInstance, NULL);

  if (EXIT_SUCCESS != asteroids_init(&app)) {
    result = E_FAIL;
  } else if (FAILED(font_resource
                    (hInstance, IDR_BRASS_MONO, _T("Brass Mono"),
                     &app.font_resource, &app.font))) {
  } else if (FAILED(result = setup_direct_sound(hwnd, &app.ds))) {
  } else if (FAILED(result = sound_resource
                    (app.ds, IDR_SOUND_THRUSTER,
                     &app.sound_thruster))) {
  } else if (FAILED(result = sound_resource
                    (app.ds, IDR_SOUND_SHOOT_BEAM,
                     &app.sound_shoot_beam))) {
  } else if (FAILED(result = sound_resource
                    (app.ds, IDR_SOUND_SAUCER_SIREN,
                     &app.sound_saucer_siren))) {
  } else if (FAILED(result = sound_resource
                    (app.ds, IDR_SOUND_SMASH_ROCK,
                     &app.sound_smash_rock))) {
  } else if (FAILED(result = sound_resource
                    (app.ds, IDR_SOUND_SMASH_SHIP,
                     &app.sound_smash_ship))) {
  } else {
    ShowWindow(hwnd, nCmdShow);

    DWORD lastTick = GetTickCount();
    MSG msg = {};

    while (msg.message != WM_QUIT) {
      DWORD currentTick = GetTickCount();

      if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
      }

      asteroids_update(&app, currentTick - lastTick);
      InvalidateRect(hwnd, NULL, TRUE);
      lastTick = currentTick;
    }
  }
  IDirectSoundBuffer_Release(app.sound_thruster);
  IDirectSoundBuffer_Release(app.sound_shoot_beam);
  IDirectSoundBuffer_Release(app.sound_saucer_siren);
  IDirectSoundBuffer_Release(app.sound_smash_rock);
  IDirectSoundBuffer_Release(app.sound_smash_ship);
  IDirectSound_Release(app.ds);
  DeleteObject(app.font);
  RemoveFontMemResourceEx(app.font_resource);
  return SUCCEEDED(result) ? 0 : 1;
}
