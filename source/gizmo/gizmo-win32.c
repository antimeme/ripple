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
 * work out of writing simple Win32 games. */
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>
#include <limits.h>
#include <locale.h>

#include <windows.h>
#include <dsound.h>
#include <tchar.h>

#include "gizmo.h"
#include "asteroids.h"

struct gizmo {
  struct app *app;
  unsigned done;
  long long last;

  struct app_key_action *key_actions;
  unsigned n_key_actions;
  struct app_mouse_action *mouse_actions;
  unsigned n_mouse_actions;

  HINSTANCE hinst;
  HDC hdc;
  HBRUSH hBrush;
  HPEN hPen;

  LPDIRECTSOUND8 ds;
};

TCHAR *
create_tchar(const char *value)
{
  TCHAR *result = NULL;
  unsigned needed = 0;
#ifdef UNICODE
  if ((needed = MultiByteToWideChar
       (CP_ACP, 0, value, -1, NULL, 0)) <= 0) {
  } else if (!(result = malloc(needed))) {
  } else if ((needed = MultiByteToWideChar
              (CP_ACP, 0, value, -1, result, 0)) <= 0) {
    free(result);
    result = NULL;
  }
#else
  if (!(result = malloc(needed = strlen(value) + 1))) {
  } else strncpy(result, value, needed);
#endif
  return result;
}

char *
create_vformatted(const char *message, int needed, va_list args)
{
  char *result = NULL;

  if (!(result = malloc(needed + 1))) {
  } else if (vsnprintf(result, needed + 1, message, args) <= 0) {
    free(result);
    result = NULL;
  }
  return result;
}

char *
create_formatted(const char *message, ...)
{
  char *result = NULL;
  int needed = 0;
  va_list args;
  va_start(args, message);
  needed = vsnprintf(result, needed, message, args);
  va_end(args);
  if (needed > 0) {
    va_start(args, message);
    result = create_vformatted(message, needed, args);
    va_end(args);
  }
  return result;
}

void
gizmo_log(const char *message, ...)
{
  TCHAR *msgout = NULL;
  char *buffer = NULL;
  int needed = 0;
  va_list args;
  va_start(args, message);
  needed = vsnprintf(buffer, needed, message, args);
  va_end(args);
  va_start(args, message);

  if (needed <= 0) {
    MessageBox(NULL, _T("Failed to format message"), _T("ERROR"),
               MB_ICONERROR);
  } else if (!(buffer = create_vformatted(message, needed, args))) {
    MessageBox(NULL, _T("Failed to allocate bytes"), _T("ERROR"),
               MB_ICONERROR);
  } else if (!(msgout = create_tchar(buffer))) {
    MessageBox(NULL, _T("Failed to allocate TCHAR"), _T("ERROR"),
               MB_ICONERROR);
  } else {
    MessageBox(NULL, msgout, _T("INFO"), MB_ICONINFORMATION);
  }
  va_end(args);
  free(msgout);
  free(buffer);
}

void
gizmo_error(const char *message, ...)
{
  TCHAR *msgout = NULL;
  char *buffer = NULL;
  int needed = 0;
  va_list args;
  va_start(args, message);
  needed = vsnprintf(buffer, needed, message, args);
  va_end(args);
  va_start(args, message);

  if (needed <= 0) {
    MessageBox(NULL, _T("Failed to format message"), _T("ERROR"),
               MB_ICONERROR);
  } else if (!(buffer = create_vformatted(message, needed, args))) {
    MessageBox(NULL, _T("Failed to allocate bytes"), _T("ERROR"),
               MB_ICONERROR);
  } else if (!(msgout = create_tchar(buffer))) {
    MessageBox(NULL, _T("Failed to allocate TCHAR"), _T("ERROR"),
               MB_ICONERROR);
  } else {
    MessageBox(NULL, msgout, _T("ERROR"), MB_ICONERROR);
  }
  va_end(args);
  free(msgout);
  free(buffer);
}

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

static HRESULT
setup_directsound(HWND hwnd, LPDIRECTSOUND8 *ds)
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

#ifdef HAVE_WIN32_VORBIS
#  include <vorbis/vorbisfile.h>

struct memory_file {
  const char *data;
  size_t size;
  size_t pos;
};

static size_t
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

static int
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

static long
sound_callback_tell(void* datasource) {
  return (long)((struct memory_file*)datasource)->pos;
}

ov_callbacks sound_callbacks = {
  sound_callback_read,
  sound_callback_seek,
  NULL,
  sound_callback_tell
};

static HRESULT
sound_resource(LPDIRECTSOUND8 ds, TCHAR *resname,
               LPDIRECTSOUNDBUFFER *oBuffer)
{
  HRESULT result = S_OK;
  HRSRC hRes = NULL;
  HGLOBAL hGlobal = NULL;
  void *resource = NULL;
  unsigned ii;

  for (ii = 0; resname && resname[ii] != _T('\0'); ++ii)
    if (resname[ii] == _T('-'))
      resname[ii] = _T('_');    

  if (!(hRes = FindResource(NULL, resname, "SOUND"))) {
    result = fail(_T("DecodeVorbis"),
                  _T("Failed to find resource: %s"), resname);
  } else if (!(hGlobal = LoadResource(NULL, hRes))) {
    result = fail(_T("DecodeVorbis"),
                  _T("Failed to load resource: %s"), resname);
  } else {
    struct memory_file mem_file = {
      (const char *)LockResource(hGlobal),
      SizeofResource(NULL, hRes), 0 };
    OggVorbis_File vf;

    if (ov_open_callbacks(&mem_file, &vf, NULL, 0,
                          sound_callbacks) < 0) {
      result = fail(_T("DecodeVorbis"),
                    _T("Failed to open OGG stream: %s"), resname);
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
        fail(_T("DecodeVorbis"), _T("Failed to create sound buffer"));
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
static HRESULT
sound_resource(LPDIRECTSOUND8 ds, TCHAR *resname,
               LPDIRECTSOUNDBUFFER *oBuffer)
{ return S_OK; }
#endif

int
gizmo_sound_create(struct gizmo *gizmo, const char *name,
                   struct gizmo_sound **sound)
{
  int result = EXIT_SUCCESS;
  TCHAR *tpath = NULL;
  char *path = NULL;
  if (!(path = create_formatted("SOUND_%s", name))) {
    fail(_T("ERROR"), _T("Failed to format sound path"));
    result = EXIT_FAILURE;
  } else if (!(tpath = create_tchar(path))) {
    fail(_T("ERROR"), _T("Failed to create TCHAR"));
    result = EXIT_FAILURE;
  } else if (FAILED(sound_resource(gizmo->ds, tpath,
                                   (LPDIRECTSOUNDBUFFER*)sound))) {
    result = EXIT_FAILURE;
  }
  free(path);
  free(tpath);
  return result;
}

int
gizmo_sound_play(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  if (sound) {
    LPDIRECTSOUNDBUFFER buffer = (LPDIRECTSOUNDBUFFER)sound;
    IDirectSoundBuffer_SetCurrentPosition(buffer, 0);
    IDirectSoundBuffer_Play(buffer, 0, 0, 0);
  }
  return result;
}

int
gizmo_sound_loop(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  //DWORD status;
  //if (sound && SUCCEEDED(IDirectSoundBuffer_GetStatus(sound, &status)))
  //  result = status & DSBSTATUS_PLAYING;
  if (sound) {
    LPDIRECTSOUNDBUFFER buffer = (LPDIRECTSOUNDBUFFER)sound;
    IDirectSoundBuffer_SetCurrentPosition(buffer, 0);
    IDirectSoundBuffer_Play(buffer, 0, 0, DSBPLAY_LOOPING);
  }
  return result;
}

int
gizmo_sound_stop(struct gizmo_sound *sound)
{
  int result = EXIT_SUCCESS;
  if (sound)
    IDirectSoundBuffer_Stop((LPDIRECTSOUNDBUFFER)sound);
  return result;
}

void
gizmo_sound_destroy(struct gizmo_sound *sound)
{
  IDirectSoundBuffer_Release((LPDIRECTSOUNDBUFFER)sound);
}

struct gizmo_font {
  HANDLE resource;
  HFONT font;
};

static HRESULT
font_resource(HINSTANCE hInstance, TCHAR *resname, TCHAR *fontname,
              unsigned size, struct gizmo_font *o_font)
{
  HRESULT result = S_OK;
  HFONT hFont = NULL;
  HANDLE hFontResource = NULL;
  unsigned ii;

  for (ii = 0; resname && resname[ii] != _T('\0'); ++ii)
    if (resname[ii] == _T('-'))
      resname[ii] = _T('_');
    else resname[ii] = _totupper(resname[ii]);
  for (ii = 0; fontname && fontname[ii] != _T('\0'); ++ii)
    if (fontname[ii] == _T('-'))
      fontname[ii] = _T(' ');    

  HRSRC res = FindResource(hInstance, resname, _T("TTF"));
  HGLOBAL hRes = LoadResource(NULL, res);
  void* pFontData = LockResource(hRes);
  DWORD resSize = SizeofResource(NULL, res);
  DWORD numFonts = 0;

  if (!(hFontResource = AddFontMemResourceEx
        (pFontData, resSize, NULL, &numFonts))) {
    result = fail(_T("ERROR"), _T("Failed to find font resource: %s"),
                  resname);
  } else if (!(hFont = CreateFont
               (-32, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
                fontname))) {
    result = fail(_T("ERROR"), _T("Failed to create font: %s"),
                  resname);
  } else if (o_font) {
    o_font->resource = hFontResource;
    hFontResource = NULL;
    o_font->font = hFont;
    hFont = NULL;
  }
  DeleteObject(hFont);
  RemoveFontMemResourceEx(hFontResource);
  return result;
}

int
gizmo_font_create(struct gizmo *gizmo, const char *fontname,
                  unsigned size, struct gizmo_font **font)
{
  int result = EXIT_SUCCESS;
  struct gizmo_font *fwork = NULL;
  char *resbuf = NULL;
  TCHAR *resname = NULL;
  TCHAR *fname = NULL;

  if (!(resbuf = create_formatted("FONT_%s", fontname))) {
    fail(_T("ERROR"), _T("Failed to format resname"));
    result = EXIT_FAILURE;
  } else if (!(resname = create_tchar(resbuf))) {
    fail(_T("ERROR"), _T("Failed to create resname"));
    result = EXIT_FAILURE;
  } else if (!(fname = create_tchar(fontname))) {
    fail(_T("ERROR"), _T("Failed to create fontname"));
    result = EXIT_FAILURE;
  } else if (!(fwork = malloc(sizeof(*fwork)))) {
    fail(_T("ERROR"), _T("Failed to allocate %u bytes"),
         sizeof(*fwork));
    result = EXIT_FAILURE;
  } else if (FAILED(font_resource
                    (gizmo->hinst, resname, fname, size, fwork))) {
    result = EXIT_FAILURE;
  } else if (font) {
    *font = fwork;
    fwork = NULL;
  }
  free(resbuf);
  free(resname);
  free(fname);
  free(fwork);
  return result;
}

void
gizmo_font_destroy(struct gizmo_font *font)
{
  if (font) {
    DeleteObject(font->font);
    RemoveFontMemResourceEx(font->resource);
  }
  free(font);
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
    gizmo_error("Failed to allocate %lu bytes for key actions\n",
                n_key_actions * sizeof(*key_actions));
    result = EXIT_FAILURE;
  } else if (!(new_mouse_actions = malloc
               (n_mouse_actions * sizeof(*mouse_actions)))) {
    gizmo_error("Failed to allocate %lu bytes for event actions\n",
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

/**
 * Return a random number between 0 and 1 selected using a
 * uniform distribution. */
float
gizmo_uniform() { return ((float)rand() / ((float)RAND_MAX + 1)); }

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
                struct gizmo_point *position,
                const char *message, ...)
{
  int result = EXIT_SUCCESS;
  char *msgout = NULL;
  TCHAR *tmsgout = NULL;
  int needed = 0;
  va_list args;
  va_start(args, message);
  needed = vsnprintf(msgout, needed, message, args);
  va_end(args);
  va_start(args, message);

  SelectObject(gizmo->hdc, font->font);
  SetTextColor(gizmo->hdc, RGB(gizmo->app->foreground.r,
                               gizmo->app->foreground.g,
                               gizmo->app->foreground.b));

  if (!(msgout = create_vformatted(message, needed, args))) {
    fail(_T("ERROR"), _T("Failed to format text to draw"));
    result = EXIT_FAILURE;
  } else if (!(tmsgout = create_tchar(msgout))) {
    fail(_T("ERROR"), _T("Failed to make TCHAR text to draw"));
    result = EXIT_FAILURE;
  } else if (position) {
    TextOut(gizmo->hdc, position->x, position->y,
            tmsgout, _tcslen(tmsgout));
  } else  {
    SIZE text_size;
    GetTextExtentPoint32
      (gizmo->hdc, tmsgout, _tcslen(tmsgout), &text_size);
    TextOut(gizmo->hdc, (gizmo->app->width - text_size.cx) / 2,
            (gizmo->app->height - text_size.cy) / 2,
            tmsgout, _tcslen(tmsgout));
  }
  va_end(args);
  free(tmsgout);
  free(msgout);
  return result;
}

int
gizmo_draw_pointloop(struct gizmo *gizmo, struct gizmo_point *position,
                     float size, float dircos, float dirsin,
                     unsigned n_points, struct gizmo_point *points)
{
  int result = EXIT_SUCCESS;
  if (n_points >= 2) {
    struct gizmo_point current = gizmo_rotate
      (&points[n_points - 1], dircos, dirsin);
    unsigned ii;

    MoveToEx(gizmo->hdc, position->x + size * current.x,
             position->y + size * current.y, NULL);
    for (ii = 0; ii < n_points; ++ii) {
      current = gizmo_rotate(&points[ii], dircos, dirsin);
      LineTo(gizmo->hdc, position->x + size * current.x,
             position->y + size * current.y);
    }
  }
  return result;
}

int
gizmo_draw_arc(struct gizmo *gizmo, struct gizmo_point *position,
               float radius, float start, float stop)
{
  int result = EXIT_SUCCESS;
  float stcos = cosf(start);
  float stsin = sinf(start);
  MoveToEx(gizmo->hdc, position->x + stcos * radius,
           position->y + stsin * radius, NULL);
  Arc(gizmo->hdc, position->x - radius, position->y - radius,
      position->x + radius, position->y + radius,
      position->x - stcos * radius,
      position->y - stsin * radius,
      position->x - cosf(stop) * radius,
      position->y - sinf(stop) * radius);
  return result;
}

int
gizmo_draw_circle(struct gizmo *gizmo, struct gizmo_point *position,
                  float radius)
{ return gizmo_draw_arc(gizmo, position, radius, 0, M_PI * 2); }

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
gizmo_set_color(struct gizmo *gizmo, struct gizmo_color *color)
{
  if (gizmo->hPen)
    DeleteObject(gizmo->hPen);
  gizmo->hPen = CreatePen
    (PS_SOLID, 2, RGB(color->r, color->g, color->b));
  SelectObject(gizmo->hdc, gizmo->hPen);
  gizmo->app->foreground = *color;
}

static enum gizmo_scancode
gizmo_scancode_convert(WPARAM scancode)
{
  enum gizmo_scancode result = gizmo_scancode_none;
  switch (scancode) {
  case VK_SPACE: result = gizmo_scancode_space; break;
  case VK_UP: result = gizmo_scancode_up; break;
  case VK_DOWN: result = gizmo_scancode_down; break;
  case VK_LEFT: result = gizmo_scancode_left; break;
  case VK_RIGHT: result = gizmo_scancode_right; break;
  case 'W': result = gizmo_scancode_w; break;
  case 'A': result = gizmo_scancode_a; break;
  case 'S': result = gizmo_scancode_s; break;
  case 'D': result = gizmo_scancode_d; break;
  }
  return result;
}

static struct gizmo gizmo;

LRESULT CALLBACK
WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  LRESULT result = 0;
  unsigned ii;
  static HBITMAP s_hbm = NULL;

  switch (msg) {
  case WM_CREATE: {
    HDC hdc = GetDC(hwnd);
    gizmo.hdc = CreateCompatibleDC(hdc);
    s_hbm = CreateCompatibleBitmap
      (hdc, gizmo.app->width, gizmo.app->height);
    ReleaseDC(hwnd, hdc);
    SelectObject(gizmo.hdc, s_hbm);

    gizmo_set_color(&gizmo, &gizmo.app->foreground);
    SetBkMode(gizmo.hdc, TRANSPARENT);
    SelectObject(gizmo.hdc, gizmo.hPen);
  } break;
  case WM_DESTROY: {
    DeleteDC(gizmo.hdc);
    DeleteObject(gizmo.hBrush); gizmo.hBrush = NULL;
    DeleteObject(gizmo.hPen);   gizmo.hPen   = NULL;
    DeleteObject(s_hbm);
    PostQuitMessage(0);
  } break;
  case WM_SIZE: {
    switch (wParam) {
    case SIZE_MAXIMIZED:
    case SIZE_RESTORED:
      DeleteDC(gizmo.hdc);
      DeleteObject(s_hbm);

      HDC hdc = GetDC(hwnd);
      gizmo.hdc = CreateCompatibleDC(hdc);
      s_hbm = CreateCompatibleBitmap
        (hdc, LOWORD(lParam), HIWORD(lParam));
      SelectObject(gizmo.hdc, s_hbm);
      ReleaseDC(hwnd, hdc);

      SetBkMode(gizmo.hdc, TRANSPARENT);
      gizmo.app->width  = LOWORD(lParam);
      gizmo.app->height = HIWORD(lParam);
      if (gizmo.app->resize)
        gizmo.app->resize
          (gizmo.app, LOWORD(lParam), HIWORD(lParam), &gizmo);
      break;
    default: /* nothing */
    }
  } break;
  case WM_ERASEBKGND: {
    result = 1; /* Tell windows we handled it */
  } break;
  case WM_PAINT: {
    RECT rect = { 0, 0, gizmo.app->width, gizmo.app->height };
    SelectObject(gizmo.hdc, gizmo.hBrush);
    FillRect(gizmo.hdc, &rect, gizmo.hBrush);
    SelectObject(gizmo.hdc, gizmo.hPen);

    if (gizmo.app->draw)
      gizmo.app->draw(gizmo.app, &gizmo);

    HDC hdc = GetDC(hwnd);
    BitBlt(hdc, 0, 0, gizmo.app->width, gizmo.app->height,
           gizmo.hdc, 0, 0, SRCCOPY);
    ReleaseDC(hwnd, hdc);
  } break;
  case WM_LBUTTONDOWN: {
    POINT point;
    GetCursorPos(&point);
    ScreenToClient(hwnd, &point);

    for (ii = 0; ii < gizmo.n_mouse_actions; ++ii) {
      struct app_mouse_action *action = &gizmo.mouse_actions[ii];
      if ((action->type == gizmo_mouse_down) && (action->action)) {
        struct gizmo_point clicked = { point.x, point.y };
        action->action(gizmo.app, &clicked);
      }
    }
  } break;
  case WM_LBUTTONUP: {
    POINT point;
    GetCursorPos(&point);
    ScreenToClient(hwnd, &point);

    for (ii = 0; ii < gizmo.n_mouse_actions; ++ii) {
      struct app_mouse_action *action = &gizmo.mouse_actions[ii];
      if ((action->type == gizmo_mouse_up) && (action->action)) {
        struct gizmo_point clicked = { point.x, point.y };
        action->action(gizmo.app, &clicked);
      }
    }
  } break;
  case WM_KEYDOWN: {
    for (ii = 0; ii < gizmo.n_key_actions; ++ii) {
      struct app_key_action *action = &gizmo.key_actions[ii];
      if (action->scancode == gizmo_scancode_convert(wParam)) {
        if (action->setting)
          *action->setting = action->value_down;
        if (action->action_down)
          action->action_down(gizmo.app, action->scancode);
      }
    }
  } break;
  case WM_KEYUP: {
    for (ii = 0; ii < gizmo.n_key_actions; ++ii) {
      struct app_key_action *action = &gizmo.key_actions[ii];
      if (action->scancode == gizmo_scancode_convert(wParam)) {
        if (action->setting)
          *action->setting = action->value_up;
        if (action->action_up)
          action->action_up(gizmo.app, action->scancode);
      }
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
  TCHAR *appname = NULL;
  if (!setlocale(LC_NUMERIC, ""))
    setlocale(LC_NUMERIC, "C");

  memset(&gizmo, 0, sizeof(gizmo));
  gizmo.hinst = hInstance;
  gizmo.app = asteroids_get_app();
  if (!gizmo.app) {
    result = fail(_T("ERROR"), _T("Failed to find app\n"));
  } else if (!(appname = create_tchar(gizmo.app->title))) {
    result = fail(_T("ERROR"), _T("Failed to create title TCHAR\n"));
  } else {
    WNDCLASSEX wc = {0};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon = LoadIcon(hInstance, _T("ICON_ASTEROIDS"));
    wc.hIconSm = LoadIcon(hInstance, _T("ICON_ASTEROIDS"));
    wc.lpszClassName = appname;
    RegisterClassEx(&wc);

    HWND hwnd = CreateWindowEx
      (0, appname, appname, WS_OVERLAPPEDWINDOW,
       CW_USEDEFAULT, CW_USEDEFAULT,
       gizmo.app->width, gizmo.app->height,
       NULL, NULL, hInstance, NULL);
    
    if (FAILED(result = setup_directsound(hwnd, &gizmo.ds))) {
    } else if (gizmo.app->init &&
               ((result = gizmo.app->init(gizmo.app, &gizmo)))) {
    } else {
      DWORD lastTick = GetTickCount();
      MSG msg = {};

      gizmo.hBrush = CreateSolidBrush
        (RGB(gizmo.app->background.r,
             gizmo.app->background.g,
             gizmo.app->background.b));
      gizmo_set_color(&gizmo, &gizmo.app->foreground);
      ShowWindow(hwnd, nCmdShow);

      while (msg.message != WM_QUIT) {
        DWORD currentTick = GetTickCount();

        if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
          TranslateMessage(&msg);
          DispatchMessage(&msg);
        }

        if (gizmo.app->update)
          gizmo.app->update(gizmo.app, currentTick - lastTick);
        InvalidateRect(hwnd, NULL, TRUE);
        lastTick = currentTick;
      }
    }
  }

  IDirectSound_Release(gizmo.ds);
  free(appname);
  return SUCCEEDED(result) ? 0 : 1;
}
