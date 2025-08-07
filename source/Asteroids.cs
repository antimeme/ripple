using System;
using System.Collections.Generic;
using SDL2;

class Asteroids
{
    private IntPtr window, renderer;
    private float playerX = 400, playerY = 300, angle = 0;
    private List<Tuple<float, float>> asteroids =
      new List<Tuple<float, float>> {
      Tuple.Create(100f, 100f), Tuple.Create(700f, 500f) };
    private List<Tuple<float, float>> bullets =
      new List<Tuple<float, float>>();
    private IntPtr fireSound;

    public Asteroids()
    {
        SDL.SDL_Init(SDL.SDL_INIT_VIDEO | SDL.SDL_INIT_AUDIO);
        window = SDL.SDL_CreateWindow
          ("Asteroids Clone", SDL.SDL_WINDOWPOS_CENTERED,
           SDL.SDL_WINDOWPOS_CENTERED, 800, 600,
           SDL.SDL_WindowFlags.SDL_WINDOW_SHOWN);
        renderer = SDL.SDL_CreateRenderer
          (window, -1, SDL.SDL_RendererFlags.SDL_RENDERER_ACCELERATED);

        SDL_mixer.Mix_OpenAudio
          (44100, SDL_mixer.MIX_DEFAULT_FORMAT, 2, 2048);
        fireSound = SDL_mixer.Mix_LoadWAV("fire.ogg");
    }

    public void Run()
    {
        bool running = true;
        SDL.SDL_Event e;
        while (running)
        {
            while (SDL.SDL_PollEvent(out e) != 0)
            {
                if (e.type == SDL.SDL_EventType.SDL_QUIT) running = false;
                else if (e.type == SDL.SDL_EventType.SDL_KEYDOWN)
                    HandleInput(e.key.keysym.sym);
            }
            Update();
            Render();
        }
        Cleanup();
    }

    private void HandleInput(SDL.SDL_Keycode key)
    {
        if (key == SDL.SDL_Keycode.SDLK_LEFT) angle -= 10;
        if (key == SDL.SDL_Keycode.SDLK_RIGHT) angle += 10;
        if (key == SDL.SDL_Keycode.SDLK_UP)
        {
            playerX += (float)Math.Cos(angle * Math.PI / 180) * 5;
            playerY += (float)Math.Sin(angle * Math.PI / 180) * 5;
        }
        if (key == SDL.SDL_Keycode.SDLK_SPACE)
        {
            bullets.Add(Tuple.Create(playerX, playerY));
            SDL_mixer.Mix_PlayChannel(-1, fireSound, 0);
        }
    }

    private void Update()
    {
        for (int i = 0; i < bullets.Count; i++)
            bullets[i] = Tuple.Create(bullets[i].Item1 + 10, bullets[i].Item2);
    }

    private void Render()
    {
        SDL.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
        SDL.SDL_RenderClear(renderer);

        SDL.SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255);
        SDL.SDL_RenderDrawPoint(renderer, (int)playerX, (int)playerY);

        foreach (var asteroid in asteroids)
            SDL.SDL_RenderDrawPoint(renderer, (int)asteroid.Item1, (int)asteroid.Item2);

        foreach (var bullet in bullets)
            SDL.SDL_RenderDrawPoint(renderer, (int)bullet.Item1, (int)bullet.Item2);

        SDL.SDL_RenderPresent(renderer);
    }

    private void Cleanup()
    {
        SDL_mixer.Mix_FreeChunk(fireSound);
        SDL.SDL_DestroyRenderer(renderer);
        SDL.SDL_DestroyWindow(window);
        SDL_mixer.Mix_CloseAudio();
        SDL.SDL_Quit();
    }

    public static void Main()
    {
        new Asteroids().Run();
    }
}
