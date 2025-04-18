#include <windows.h>
#include <dsound.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>
#include <tchar.h>
#include "resource.h"

#define WIDTH 800
#define HEIGHT 600
#define PI 3.14159265

float angle = 0.0f;
POINT shipPos = { WIDTH / 2, HEIGHT / 2 };
DWORD lastTick = 0;
float deltaTime = 0;

/**
 * Present a failure message to the user. */
static HRESULT
fail(const char *title, const char *message, ...)
{
  HRESULT result = E_FAIL;
  char *buffer = NULL;
  int size_needed;
  va_list args;
  va_start(args, message);
  size_needed = _vscprintf(message, args) + 1;
  va_end(args);

  if (size_needed <= 0) {
    MessageBoxA(NULL, "Failed to format message", "FAIL", MB_ICONERROR);
    result = E_INVALIDARG;
  } else if (!(buffer = malloc(size_needed))) {
    MessageBoxA(NULL, "Failed to allocate bytes", "FAIL", MB_ICONERROR);
    result = E_OUTOFMEMORY;
  } else {
    va_start(args, message);
    vsnprintf(buffer, size_needed, message, args);
    va_end(args);
    MessageBoxA(NULL, buffer, title, MB_ICONERROR);
  }
  free(buffer);
  return result;
}

HANDLE g_font_resource = NULL;
HFONT  g_font         = NULL;
LPDIRECTSOUND8      g_ds                 = NULL;
LPDIRECTSOUNDBUFFER g_primary_buffer     = NULL;
LPDIRECTSOUNDBUFFER g_sound_thruster     = NULL;
LPDIRECTSOUNDBUFFER g_sound_shoot_beam   = NULL;
LPDIRECTSOUNDBUFFER g_sound_saucer_siren = NULL;
LPDIRECTSOUNDBUFFER g_sound_smash_rock   = NULL;
LPDIRECTSOUNDBUFFER g_sound_smash_ship   = NULL;

#ifdef HAVE_WIN32_VORBIS
#  include <vorbis/vorbisfile.h>

struct memory_file {
  const char* data;
  size_t size;
  size_t pos;
};

size_t
sound_callback_read(void* ptr, size_t size, size_t nmemb,
                    void* datasource)
{
  struct memory_file* mem = (struct memory_file*)datasource;
  size_t remain = mem->size - mem->pos;
  size_t bytes = (size * nmemb > remain) ? remain : (size * nmemb);
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
  case SEEK_SET: new_pos = offset; break;
  case SEEK_CUR: new_pos = mem->pos + offset; break;
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

  if (!(hRes = FindResourceA(NULL, MAKEINTRESOURCE(resID), "SOUND"))) {
    result = fail("DecodeVorbis", "Failed to find resource (%d): %s",
                  resID, MAKEINTRESOURCE(resID));
  } else if (!(hGlobal = LoadResource(NULL, hRes))) {
    result = fail("DecodeVorbis", "Failed to load resource (%d): %s",
                  resID, MAKEINTRESOURCE(resID));
  } else {
    struct memory_file mem_file = {
      (const char *)LockResource(hGlobal),
      SizeofResource(NULL, hRes), 0 };
    OggVorbis_File vf;

    if (ov_open_callbacks(&mem_file, &vf, NULL, 0,
                          sound_callbacks) < 0) {
      result = fail("DecodeVorbis",
                    "Failed to open OGG stream (%u): %s",
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

HRESULT
CreateFontResource(HINSTANCE hInstance, int resnum, LPSTR name,
                   HANDLE *oFontResource, HFONT *oFont)
{
  HRESULT result = S_OK;
  HRSRC res = FindResourceA(hInstance, MAKEINTRESOURCE(resnum), "TTF");
  HGLOBAL hRes = LoadResource(NULL, res);
  void* pFontData = LockResource(hRes);
  DWORD fontSize = SizeofResource(NULL, res);
  DWORD numFonts = 0;
  HFONT hFont = NULL;
  HANDLE hFontResource = NULL;

  if (!(hFontResource = AddFontMemResourceEx
        (pFontData, fontSize, NULL, &numFonts))) {
    result = fail("CreateFontResource", "Failed to find resource "
                  "(%d): %s", resnum, MAKEINTRESOURCE(resnum));
  } else if (!(hFont = CreateFontA
               (-32, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, name))) {
    result = fail("CreateFontResource", "Failed to create font "
                  "(%d): %s", resnum, MAKEINTRESOURCE(resnum));
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

HRESULT
setup_direct_sound(HWND hwnd)
{
  HRESULT result = S_OK;
  DSBUFFERDESC bufferDesc = {};
  bufferDesc.dwSize = sizeof(DSBUFFERDESC);
  bufferDesc.dwFlags = DSBCAPS_PRIMARYBUFFER;

  if (FAILED(result = DirectSoundCreate8(NULL, &g_ds, NULL))) {
    fail("SetupDirectSound", "Failed to initalize DirectSound");
  } else if (FAILED(result = IDirectSound_SetCooperativeLevel
                    (g_ds, hwnd, DSSCL_PRIORITY))) {
    fail("SetupDirectSound", "Failed to set cooperative level");
  } else if (FAILED(result = IDirectSound_CreateSoundBuffer
                    (g_ds, &bufferDesc, &g_primary_buffer, NULL))) {
    fail("SetupDirectSound", "Failed to create primary sound buffer");
  }
  return result;
}

void
DrawTextInfo(HDC hdc) {
  const char* text = "Use LEFT and RIGHT arrows to rotate.";
  TextOutA(hdc, 10, 10, text, strlen(text));
}

void
DrawShip(HDC hdc, float angleDeg, POINT pos) {
  float angleRad = angleDeg * PI / 180.0f;
  float cosA = cosf(angleRad);
  float sinA = sinf(angleRad);
  POINT p[4];

  p[0].x = (LONG)(pos.x + cosA * 20);
  p[0].y = (LONG)(pos.y + sinA * 20);

  p[1].x = (LONG)(pos.x + cosf(angleRad + 140 * PI / 180) * 15);
  p[1].y = (LONG)(pos.y + sinf(angleRad + 140 * PI / 180) * 15);

  p[2].x = (LONG)(pos.x + cosf(angleRad - 140 * PI / 180) * 15);
  p[2].y = (LONG)(pos.y + sinf(angleRad - 140 * PI / 180) * 15);

  p[3] = p[0];

  Polyline(hdc, p, 4);
}

void
Render(HDC hdc) {
  DrawShip(hdc, angle, shipPos);
  DrawTextInfo(hdc);
}

void
Update() {
  if (GetAsyncKeyState(VK_LEFT) & 0x8000) angle -= 2.0f;
  if (GetAsyncKeyState(VK_RIGHT) & 0x8000) angle += 2.0f;
}

LRESULT CALLBACK
WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  LRESULT result = 0;

  switch (msg) {
  case WM_PAINT: {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hwnd, &ps);

    HBRUSH hBrush = CreateSolidBrush(RGB(0, 0, 0));
    FillRect(hdc, &ps.rcPaint, hBrush);
    DeleteObject(hBrush);

    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, RGB(223, 223, 223));
    SelectObject(hdc, g_font);
    SelectObject(hdc, GetStockObject(WHITE_PEN));

    Render(hdc);

    EndPaint(hwnd, &ps);
  } break;
  case WM_KEYDOWN: {
    if (wParam == VK_SPACE)
      sound_play(g_sound_shoot_beam);
  } break;
  case WM_DESTROY: {
    PostQuitMessage(0);
  } break;
  default:
    result = DefWindowProc(hwnd, msg, wParam, lParam);
  }
  return result;
}

int WINAPI
WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int nCmdShow) {
  HRESULT result = S_OK;
  WNDCLASSEX wc = {0};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_ICON_ASTEROIDS));
  wc.hIconSm = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_ICON_ASTEROIDS));
  wc.hCursor = LoadCursor(NULL, IDC_ARROW);
  wc.lpszClassName = _T("Asteroids");
  RegisterClassEx(&wc);

  HWND hwnd = CreateWindowEx
    (0, _T("Asteroids"), _T("Asteroids"),
     WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT,
     WIDTH, HEIGHT, NULL, NULL, hInstance, NULL);

  CreateFontResource(hInstance, IDR_BRASS_MONO, "Brass Mono",
                     &g_font_resource, &g_font);
  if (FAILED(result = setup_direct_sound(hwnd))) {
    /* Already reported */
  } else if (FAILED(result = sound_resource
                    (g_ds, IDR_SOUND_THRUSTER, &g_sound_thruster))) {
  } else if (FAILED(result = sound_resource
                    (g_ds, IDR_SOUND_SHOOT_BEAM,
                     &g_sound_shoot_beam))) {
  } else if (FAILED(result = sound_resource
                    (g_ds, IDR_SOUND_SAUCER_SIREN,
                     &g_sound_saucer_siren))) {
  } else if (FAILED(result = sound_resource
                    (g_ds, IDR_SOUND_SMASH_ROCK,
                     &g_sound_smash_rock))) {
  } else if (FAILED(result = sound_resource
                    (g_ds, IDR_SOUND_SMASH_SHIP,
                     &g_sound_smash_ship))) {
  }
  sound_resource(g_ds, IDR_SOUND_THRUSTER,   &g_sound_thruster);
  sound_resource(g_ds, IDR_SOUND_SHOOT_BEAM, &g_sound_shoot_beam);
  sound_resource(g_ds, IDR_SOUND_SAUCER_SIREN, &g_sound_saucer_siren);
  sound_resource(g_ds, IDR_SOUND_SMASH_ROCK, &g_sound_smash_rock);
  sound_resource(g_ds, IDR_SOUND_SMASH_SHIP, &g_sound_smash_ship);
  ShowWindow(hwnd, nCmdShow);

  lastTick = GetTickCount();

  MSG msg = {};
  while (msg.message != WM_QUIT) {
    DWORD currentTick = GetTickCount();
    deltaTime = (currentTick - lastTick) / 1000.0f;
    lastTick = currentTick;

    if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessage(&msg);
    } else {
      Update();
      InvalidateRect(hwnd, NULL, TRUE);
      Sleep(16); // ~60 FPS
    }
  }

  IDirectSoundBuffer_Release(g_sound_thruster);
  IDirectSoundBuffer_Release(g_sound_shoot_beam);
  IDirectSoundBuffer_Release(g_sound_saucer_siren);
  IDirectSoundBuffer_Release(g_sound_smash_rock);
  IDirectSoundBuffer_Release(g_sound_smash_ship);
  IDirectSound_Release(g_ds);
  DeleteObject(g_font);
  RemoveFontMemResourceEx(g_font_resource);
  return 0;
}
