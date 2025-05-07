//! asteroids.rs
//! Copyright (C) 2025 by Jeff Gold.
//!
//! This program is free software: you can redistribute it and/or
//! modify it under the terms of the GNU General Public License as
//! published by the Free Software Foundation, either version 3 of the
//! License, or (at your option) any later version.
//!
//! This program is distributed in the hope that it will be useful, but
//! WITHOUT ANY WARRANTY; without even the implied warranty of
//! MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//! General Public License for more details.
//!
//! You should have received a copy of the GNU General Public License
//! along with this program.  If not, see
//! <http://www.gnu.org/licenses/>.
//!
//! ---------------------------------------------------------------------
//! A simplistic Asteroids clone. */
extern crate piston;
extern crate graphics;
extern crate opengl_graphics;

use piston_window::PistonWindow;
use piston::window::WindowSettings;
use piston::input::{
    RenderArgs, RenderEvent, UpdateArgs, UpdateEvent,
    ButtonArgs, ButtonEvent, ButtonState, Button, Key, };
use graphics::Transformed;
use opengl_graphics::{GlGraphics, OpenGL};

#[derive(Debug, Clone, Copy)]
struct Point {
    x: f32,
    y: f32,
}

fn draw_pointloop(gl: &mut GlGraphics, transform: [[f64; 3]; 2],
                  color: [f32; 4], line_width: f32,
                  points: &Vec<Point>) {
    for ii in 0..points.len() {
        let start = points[ii];
        let end = points[(ii + 1) % points.len()];
        graphics::line(color, line_width.into(),
                       [start.x as f64, start.y as f64,
                        end.x as f64, end.y as f64], transform, gl);
        graphics::ellipse(color, [
            (start.x - line_width) as f64,
            (start.y - line_width) as f64,
            (line_width * 2.) as f64,
            (line_width * 2.) as f64], transform, gl);
    }
}

trait Moveable {
    fn get_size(&self) -> f32;
    fn get_velocity(&self) -> Point;
    fn get_position(&self) -> Point;
    fn set_position(&mut self, position: Point);

    fn move_wrap(&mut self, elapsed: f32, width: f32, height: f32) {
        let size = self.get_size();
        let velocity = self.get_velocity();
        let mut position = self.get_position();

        position.x += velocity.x * elapsed;
        if position.x > size + width / 2.
        { position.x = -(size + width / 2.); }
        if position.x < -(size + width / 2.)
        { position.x = size + width / 2.; }

        position.y += velocity.y * elapsed;
        if position.y > size + height / 2.
        { position.y = -(size + height / 2.); }
        if position.y < -(size + height / 2.)
        { position.y = size + height / 2.; }

        self.set_position(position);
    }
}

pub struct Player {
    position: Point,
    velocity: Point,
    direction: f32,
    size: f32,
    points: Vec<Point>,
}

impl Player {
    pub fn new() -> Self {
        Player {
            position: Point{ x: 0., y: 0. },
            velocity: Point{ x: 0., y: 0. },
            direction: 0., size: 0.,
            points: vec![
                Point{ x:  1.,    y:  0. },
                Point{ x: -1.,    y:  2./3. },
                Point{ x: -2./3., y:  0. },
                Point{ x: -1.,    y: -2./3. }],
        }
    }

    fn resize(&mut self, width: f32, height: f32)
    { self.size = width.min(height) / 20.; }

    fn thrust(&mut self, elapsed: f32) {
        let factor = 250. * elapsed;
        self.velocity.x += self.direction.cos() * factor;
        self.velocity.y += self.direction.sin() * factor;
    }

    fn draw(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
            color: [f32; 4]) {
        draw_pointloop(gl, transform
                       .trans(self.position.x as f64,
                              self.position.y as f64)
                       .rot_rad(self.direction as f64)
                       .scale(self.size.into(), self.size.into()),
                       color, self.size / 500., &self.points);
    }
}

impl Moveable for Player {
    fn get_size(&self) -> f32 { self.size }
    fn get_velocity(&self) -> Point { self.velocity }
    fn get_position(&self) -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

pub struct Asteroids {
    gl: GlGraphics,
    player: Player,

    width: f32,
    height: f32,
    turn_left: bool,
    turn_right: bool,
    thrust: bool,
}

impl Asteroids {
    pub fn new(gl: OpenGL) -> Self {
        Asteroids {
            gl: GlGraphics::new(gl),
            player: Player::new(),
            width: 640., height: 480.,
            thrust: false, turn_left: false, turn_right: false,
        }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.width  = width;
        self.height = height;
        self.player.resize(width, height);
    }

    fn button(&mut self, args: &ButtonArgs) {
        if args.state == ButtonState::Press {
            if args.button == Button::Keyboard(Key::Space) {
                println!("Shoot");
            } else if args.button == Button::Keyboard(Key::W) ||
                args.button == Button::Keyboard(Key::Up) {
                self.thrust = true;
            } else if args.button == Button::Keyboard(Key::A) ||
                args.button == Button::Keyboard(Key::Left) {
                self.turn_left = true;
            } else if args.button == Button::Keyboard(Key::S) ||
                args.button == Button::Keyboard(Key::Down) {
                println!("Warp");
            } else if args.button == Button::Keyboard(Key::D) ||
                args.button == Button::Keyboard(Key::Right) {
                self.turn_right = true;
            }
        } else if args.state == ButtonState::Release {
            if args.button == Button::Keyboard(Key::W) ||
                args.button == Button::Keyboard(Key::Up) {
                self.thrust = false;
            } else if args.button == Button::Keyboard(Key::A) ||
                args.button == Button::Keyboard(Key::Left) {
                self.turn_left = false;
            } else if args.button == Button::Keyboard(Key::D) ||
                args.button == Button::Keyboard(Key::Right) {
                self.turn_right = false;
            }
        }
    }

    fn update(&mut self, args: &UpdateArgs) {
        if self.turn_left
        { self.player.direction -= (1.5 * args.dt) as f32; }
        if self.turn_right
        { self.player.direction += (1.5 * args.dt) as f32; }
        if self.thrust { self.player.thrust(args.dt as f32); }

        self.player.move_wrap
            (args.dt as f32, self.width as f32, self.height as f32);
    }

    fn draw(&mut self, args: &RenderArgs) {
        const BACKGROUND: [f32; 4] = [0.0625, 0.0625, 0.0625, 1.0];
        const FOREGROUND: [f32; 4] = [0.875, 0.875, 0.875, 1.0];
        let width  = args.window_size[0] as f32;
        let height = args.window_size[1] as f32;

        self.resize(width, height);
        self.gl.draw(args.viewport(), |c, gl| {
            let transform = c.transform
                .trans((width / 2.) as f64, (height / 2.) as f64);
            graphics::clear(BACKGROUND, gl);

            self.player.draw(gl, transform, FOREGROUND);
        });
    }
}

fn main() {
    let mut window: PistonWindow =
        WindowSettings::new("Asteroids", [640, 480])
        .exit_on_esc(true).build().unwrap();
    let mut app = Asteroids::new(OpenGL::V3_2);

    while let Some(event) = window.next() {
        if let Some(args) = event.button_args() {
            app.button(&args);
        }
        if let Some(args) = event.render_args() {
            app.draw(&args);
        }
        if let Some(args) = event.update_args() {
            app.update(&args);
        }
    }
}
