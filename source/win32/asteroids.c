// x86_64-w64-mingw32-windres source/win32/asteroids.rc -O coff -o asteroids.res && x86_64-w64-mingw32-gcc -DUNICODE -D_UNICODE source/win32/asteroids.c asteroids.res -o asteroids.exe -Isource/win32 -mwindows && wine asteroids.exe
#include <windows.h>
#include <math.h>
#include <tchar.h>
#include "resource.h"

#define WIDTH 800
#define HEIGHT 600
#define PI 3.14159265

HANDLE gFontResource = NULL;
HFONT  gFont         = NULL;

float angle = 0.0f;
POINT shipPos = { WIDTH / 2, HEIGHT / 2 };

DWORD lastTick = 0;
float deltaTime = 0;

void DrawShip(HDC hdc, float angle, POINT pos);
void Update();
void Render(HDC hdc);
void DrawTextInfo(HDC hdc);

void
PlayOGGSound(const char* filename) {
  // Placeholder: PlaySoundA("sound.wav", NULL, SND_FILENAME | SND_ASYNC);
}

void
Update() {
  if (GetAsyncKeyState(VK_LEFT) & 0x8000) angle -= 2.0f;
  if (GetAsyncKeyState(VK_RIGHT) & 0x8000) angle += 2.0f;
}

void
Render(HDC hdc) {
  DrawShip(hdc, angle, shipPos);
  DrawTextInfo(hdc);
}

void
DrawTextInfo(HDC hdc) {
  const wchar_t* text = L"Use LEFT and RIGHT arrows to rotate.";
  TextOut(hdc, 10, 10, text, wcslen(text));
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
CreateFontResource(HINSTANCE hInstance, int resnum, LPWSTR name,
                   HANDLE *oFontResource, HFONT *oFont)
{
  DWORD result = EXIT_SUCCESS;
  HRSRC res = FindResource
    (hInstance, MAKEINTRESOURCE(resnum), L"TTF");
  HGLOBAL hRes = LoadResource(NULL, res);
  void* pFontData = LockResource(hRes);
  DWORD fontSize = SizeofResource(NULL, res);
  DWORD numFonts = 0;
  HFONT hFont = NULL;
  HANDLE hFontResource = NULL;

  if (!(hFontResource = AddFontMemResourceEx
        (pFontData, fontSize, NULL, &numFonts))) {
    MessageBoxW(NULL, L"Failed to find resource",
                L"Error", MB_ICONERROR);
    result = EXIT_FAILURE;
  } else if (!(hFont = CreateFontW
               (-32, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS,
                DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
                L"Brass Mono"))) {
    MessageBoxW(NULL, L"Failed to find resource",
                L"Error", MB_ICONERROR);
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
  CreateFontResource(hInstance, IDR_BRASS_MONO, L"Brass",
                     &gFontResource, &gFont);

  WNDCLASS wc = { };
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.lpszClassName = _T("AsteroidsClone");
  wc.hCursor = LoadCursor(NULL, IDC_ARROW);

  RegisterClass(&wc);

  HWND hwnd = CreateWindowEx
    (0, _T("AsteroidsClone"), _T("Asteroids"),
     WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT,
     WIDTH, HEIGHT, NULL, NULL, hInstance, NULL);
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
