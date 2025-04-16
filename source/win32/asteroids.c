#include <windows.h>
#include <math.h>
#include <tchar.h>
#include <dsound.h>
#include "resource.h"

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
  size_t bytes = size * nmemb;
  if (bytes > remain) bytes = remain;
  memcpy(ptr, mem->data + mem->pos, bytes);
  mem->pos += bytes;
  return bytes / size;
}

int
sound_callback_seek(void* datasource, ogg_int64_t offset, int whence) {
  struct memory_file* mem = (struct memory_file*) datasource;
  size_t new_pos = 0;

  switch (whence) {
  case SEEK_SET: new_pos = offset; break;
  case SEEK_CUR: new_pos = mem->pos + offset; break;
  case SEEK_END: new_pos = mem->size + offset; break;
  default: return -1;
  }

  if (new_pos > mem->size) return -1;
  mem->pos = new_pos;
  return 0;
}

long
sound_callback_tell(void* datasource) {
  struct memory_file* mem = (struct memory_file*) datasource;
  return (long)mem->pos;
}

ov_callbacks sound_callbacks = {
  sound_callback_read,
  sound_callback_seek,
  NULL,
  sound_callback_tell
};

HRESULT
decode_ogg_vorbis(LPDIRECTSOUND8 ds, int resID,
                  DWORD* size, BYTE** data)
{
  HRESULT result = S_OK;
  HRSRC hRes = NULL;
  HGLOBAL hGlobal = NULL;
  void *resource = NULL;

  if (!(hRes = FindResourceA(NULL, MAKEINTRESOURCE(resID), "SOUND"))) {
    MessageBox(NULL, "Failed to find resource", "Error", MB_OK);
    // TODO messagebox
  } else if (!(hGlobal = LoadResource(NULL, hRes))) {
    MessageBox(NULL, "Failed to load resource", "Error", MB_OK);
    // TODO messagebox
  } else {
    struct memory_file mem_file = {
      (const char *)LockResource(hGlobal),
      SizeofResource(NULL, hRes), 0 };
    OggVorbis_File vf;

    if (ov_open_callbacks(&mem_file, &vf, NULL, 0,
                          sound_callbacks) < 0) {
      MessageBox(NULL, "Failed to open OGG stream", "Error", MB_OK);
      // TODO messagebox
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
        if (bytes > 0) {
          pcmData = realloc(pcmData, totalSize + bytes);
          memcpy(pcmData + totalSize, buffer, bytes);
          totalSize += bytes;
        }
      } while (bytes > 0);
      ov_clear(&vf);

      DSBUFFERDESC desc = {0};
      desc.dwSize = sizeof(DSBUFFERDESC);
      desc.dwFlags = DSBCAPS_CTRLVOLUME;
      desc.dwBufferBytes = totalSize;
      desc.lpwfxFormat = &wfx;

      LPDIRECTSOUNDBUFFER pBuffer;
      if (FAILED(IDirectSound_CreateSoundBuffer
                 (ds, &desc, &pBuffer, NULL))) {
        MessageBox(NULL, "Failed to create buffer", "Error", MB_OK);
      } else {
        /* void* p1; DWORD s1; */
        /* void* p2; DWORD s2; */
        /* if (SUCCEEDED(pBuffer->Lock */
        /*               (0, totalSize, &p1, &s1, &p2, &s2, 0))) { */
        /*   memcpy(p1, pcmData, s1); */
        /*   if (p2 && s2 > 0) memcpy(p2, pcmData + s1, s2); */
        /*   pBuffer->Unlock(p1, s1, p2, s2); */

        /*   g_SoundBank[i].resourceID = resourceIDs[i]; */
        /*   g_SoundBank[i].buffer = pBuffer; */
        /* } */
      }
      free(pcmData);
    }
  }
  return result;
}
#else
// ...
#endif

#define WIDTH 800
#define HEIGHT 600
#define PI 3.14159265

float angle = 0.0f;
POINT shipPos = { WIDTH / 2, HEIGHT / 2 };
DWORD lastTick = 0;
float deltaTime = 0;

HANDLE gFontResource = NULL;
HFONT  gFont         = NULL;
LPDIRECTSOUND8      gDS            = NULL;
LPDIRECTSOUNDBUFFER gPrimaryBuffer = NULL;

HRESULT
SetupDirectSound(HWND hwnd)
{
  HRESULT result = S_OK;
  DSBUFFERDESC bufferDesc = {};
  bufferDesc.dwSize = sizeof(DSBUFFERDESC);
  bufferDesc.dwFlags = DSBCAPS_PRIMARYBUFFER;

  if (FAILED(result = DirectSoundCreate8(NULL, &gDS, NULL))) {
    MessageBoxA(NULL, "Failed to initalize DirectSound",
                "Error", MB_ICONERROR);
  } else if (FAILED(result = IDirectSound_SetCooperativeLevel
                    (gDS, hwnd, DSSCL_PRIORITY))) {
    MessageBoxA(NULL, "Failed to set cooperative level",
                "Error", MB_ICONERROR);
  } else if (FAILED(result = IDirectSound_CreateSoundBuffer
                    (gDS, &bufferDesc, &gPrimaryBuffer, NULL))) {
    MessageBoxA(NULL, "Failed to create primary sound buffer",
                "Error", MB_ICONERROR);
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
    SelectObject(hdc, gFont);
    SelectObject(hdc, GetStockObject(WHITE_PEN));

    Render(hdc);

    EndPaint(hwnd, &ps);
  } break;
  case WM_DESTROY: {
    PostQuitMessage(0);
  } break;
  default:
    result = DefWindowProc(hwnd, msg, wParam, lParam);
  }
  return result;
}

DWORD
CreateFontResource(HINSTANCE hInstance, int resnum, LPSTR name,
                   HANDLE *oFontResource, HFONT *oFont)
{
  DWORD result = EXIT_SUCCESS;
  HRSRC res = FindResourceA(hInstance, MAKEINTRESOURCE(resnum), "TTF");
  HGLOBAL hRes = LoadResource(NULL, res);
  void* pFontData = LockResource(hRes);
  DWORD fontSize = SizeofResource(NULL, res);
  DWORD numFonts = 0;
  HFONT hFont = NULL;
  HANDLE hFontResource = NULL;

  if (!(hFontResource = AddFontMemResourceEx
        (pFontData, fontSize, NULL, &numFonts))) {
    MessageBoxA(NULL, "Failed to find resource", "Error", MB_ICONERROR);
    result = EXIT_FAILURE;
  } else if (!(hFont = CreateFontA
               (-32, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, name))) {
    MessageBoxA(NULL, "Failed to find resource", "Error", MB_ICONERROR);
    result = EXIT_FAILURE;
  } else {
    if (oFontResource) {
      *oFontResource = hFontResource;
      hFontResource = NULL;
    }
    if (oFont) {
      *oFont = hFont;
      hFont = NULL;
    }
  }
  DeleteObject(hFont);
  RemoveFontMemResourceEx(hFontResource);
  return result;
}

int WINAPI
WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int nCmdShow) {
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
                     &gFontResource, &gFont);
  SetupDirectSound(hwnd);
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

  DeleteObject(gFont);
  RemoveFontMemResourceEx(gFontResource);
  return 0;
}
