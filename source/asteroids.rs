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
//! --------------------------------------------------------------------
//! A simplistic Asteroids clone.
//!
//! TODO:
//! - Debris
//! - Warp
//! - Saucer
//! - Score (TTF)
//! - Game Over (TTF)
//! - Sounds (OGG): thrust/shoot-beam/smash-rock/smash-ship/saucer-siren
//! - SVG icon
extern crate piston;
extern crate graphics;
extern crate opengl_graphics;
use piston_window::PistonWindow;
use piston::window::WindowSettings;
use piston::input::{
    RenderEvent, ResizeEvent,
    UpdateArgs, UpdateEvent,
    ButtonArgs, ButtonEvent,
    ButtonState, Button, Key, };
use graphics::Transformed;
use opengl_graphics::{GlGraphics, OpenGL};

const PI: f32 = std::f32::consts::PI;

/// Represents a single point or vector on the screen
/// Screen coordinates are usually represented with the origin (0., 0.)
/// in the center.  This makes it easy to resize the screen without
/// too much disruption.
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f32,
    y: f32,
}

/// Create a closed loop of lines based on an array of points.
/// Resembles a polygon but only the outline is drawn.
fn draw_pointloop(gl: &mut GlGraphics, transform: [[f64; 3]; 2],
                  color: [f32; 4], line_width: f32,
                  points: &Vec<Point>)
{
    for ii in 0..points.len() {
        let start = points[ii];
        let end = points[(ii + 1) % points.len()];
        graphics::line(color, line_width.into(),
                       [start.x as f64, start.y as f64,
                        end.x as f64,   end.y as f64], transform, gl);
        graphics::ellipse(color, [
            (start.x - line_width) as f64,
            (start.y - line_width) as f64,
            (line_width * 2.) as f64,
            (line_width * 2.) as f64], transform, gl);
    }
}

/// Generates a uniform distributed random value between zero and one
fn uniform() -> f32
{ rand::random() }

/// Returns true iff value is close enough to zero.
/// Useful because floating point values have rounding errors.
fn zeroish(value: f32) -> bool
{ value.abs() <= f32::EPSILON }

/// Closed form solution for first or second degree polynomials
fn quadratic_real_roots(c: f32, b: f32, a: f32) ->
    Option<(f32, Option<f32>)>
{ // FIXME: what if a and b are both zeroish?
    if zeroish(a) {
        Some((-c / b, None))
    } else {
        let discriminant = b.powi(2) - 4. * a * c;
        match discriminant {
            disc if zeroish(disc) => { Some((-b / (2. * a), None)) }
            disc if disc < 0. => None,
            disc => {
                let sqrt_d = disc.sqrt();
                Some(((-b - sqrt_d) / (2. * a),
                      Some((-b + sqrt_d) / (2. * a))))
            }
        }
    }
}

trait Moveable {
    fn get_points(&self)    -> &Vec<Point>;
    fn get_size(&self)      -> f32;
    fn get_radius(&self)    -> f32;
    fn get_direction(&self) -> f32;
    fn get_velocity(&self)  -> Point;
    fn get_position(&self)  -> Point;
    fn set_position(&mut self, position: Point);

    fn draw_points(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
                   color: [f32; 4]) {
        let radius = self.get_radius();
        let direction = self.get_direction();
        let position = self.get_position();
        draw_pointloop(gl, transform
                       .trans(position.x.into(),
                              position.y.into())
                       .rot_rad(direction.into())
                       .scale(radius.into(), radius.into()),
                       color, self.get_size() / radius / 500.,
                       self.get_points());
    }

    fn move_wrap(&mut self, elapsed: f32, width: f32, height: f32) {
        let mut position = self.get_position();
        let velocity = self.get_velocity();
        let radius = self.get_radius();

        position.x += velocity.x * elapsed;
        if position.x > radius + width / 2.
        { position.x = -(radius + width / 2.); }
        if position.x < -(radius + width / 2.)
        { position.x = radius + width / 2.; }

        position.y += velocity.y * elapsed;
        if position.y > radius + height / 2.
        { position.y = -(radius + height / 2.); }
        if position.y < -(radius + height / 2.)
        { position.y = radius + height / 2.; }

        self.set_position(position);
    }

    fn check_collide(&self, other: &impl Moveable, elapsed: f32) -> bool
    {
        let gap = self.get_radius() + other.get_radius();
        let pos_a = self.get_position();
        let pos_b = other.get_position();
        let vel_a = self.get_velocity();
        let vel_b = other.get_velocity();
        let dp = Point{ x: pos_a.x - pos_b.x, y: pos_a.y - pos_b.y };
        let dm = Point{ x: vel_a.x - vel_b.y, y: vel_a.y - vel_b.y };

        if dp.x * dp.x + dp.y * dp.y > gap * gap {
            match quadratic_real_roots(
                dp.x * dp.x + dp.y * dp.y - gap * gap,
                2. * (dp.x * dm.x + dp.y * dm.y),
                dm.x * dm.x + dm.y * dm.y)
            {
                None => false,
                Some((first, None)) => {
                    (first >= 0.) && (first < elapsed)
                },
                Some((first, Some(second))) => {
                    ((first >= 0.) && (first < elapsed)) ||
                        ((second >= 0.) && (second < elapsed))
                }
            }
        } else { false }
    }
}

struct Shot {
    position: Point,
    velocity: Point,
    direction: f32,
    radius: f32,
    size: f32,
    duration: f32,
    points: Vec<Point>
}

impl Shot {
    fn new(source: &impl Moveable) -> Self {
        let direction = source.get_direction();
        let size = source.get_size();
        let mut velocity = source.get_velocity();
        velocity.x += direction.cos() * size * 10. / 7.;
        velocity.y += direction.sin() * size * 10. / 7.;

        Shot {
            position: source.get_position(),
            velocity: velocity,
            direction: direction,
            radius: size / 100.,
            size: size,
            duration: 0.350,
            points: Vec::new(),
        }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.size = width.min(height);
        self.radius = self.size / 100.;
    }

    fn update(&mut self, elapsed: f32, width: f32, height: f32) -> bool
    {
        self.move_wrap(elapsed, width, height);
        if elapsed < self.duration {
            self.duration -= elapsed; true
        } else { false }
    }

    fn draw(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
            color: [f32; 4]) {
        graphics::ellipse(color, [
            (self.position.x - self.radius) as f64,
            (self.position.y - self.radius) as f64,
            (self.radius * 2.) as f64,
            (self.radius * 2.) as f64], transform, gl);
    }    
}

impl Moveable for Shot {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

/// Represents the ship controlled by the player
struct Player {
    position: Point,
    velocity: Point,
    direction: f32,
    radius: f32,
    size: f32,
    dead: f32,
    gameover: f32,
    lives: u32,
    points: Vec<Point>,
    shots: Vec<Shot>,
}

impl Player {
    fn new() -> Self {
        Player {
            position: Point{ x: 0., y: 0. },
            velocity: Point{ x: 0., y: 0. },
            direction: -PI / 2., radius: 0., size: 0.,
            dead: 0., gameover: 0., lives: 3,
            shots: Vec::new(),
            points: vec![
                Point{ x:  1.,    y:  0. },
                Point{ x: -1.,    y:  2./3. },
                Point{ x: -2./3., y:  0. },
                Point{ x: -1.,    y: -2./3. }],
        }
    }

    fn thrust(&mut self, elapsed: f32) {
        let factor = 1000. * elapsed * self.radius / 20.;
        self.velocity.x += self.direction.cos() * factor;
        self.velocity.y += self.direction.sin() * factor;
    }

    fn shoot(&mut self) {
        if self.dead > 0. {
        } else if self.shots.len() < 9 {
            self.shots.push(Shot::new(self));
            // TODO: sound shoot-beam
        }
    }

    fn impact(&mut self) {
        self.dead = 3.;
        if self.lives == 0 {
            self.gameover = 2.
        }
        // TODO: sound smash-ship
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.size = width.min(height);
        self.radius = self.size * 3. / 100.;
        for shot in &mut self.shots
        { shot.resize(width, height); }
    }

    fn update(&mut self, elapsed: f32, width: f32, height: f32) {
        self.shots.retain_mut(|shot| {
            shot.update(elapsed, width, height) });

        if self.gameover > 0. {
        } else if self.dead > 0. {
            if elapsed > self.dead {
                self.lives -= 1;
                self.position = Point{ x: 0., y: 0. };
                self.velocity = Point{ x: 0., y: 0. };
                self.direction = -PI / 2.;
                self.dead = 0.
            } else { self.dead -= elapsed; }
        } else { self.move_wrap(elapsed, width, height); }
    }

    fn draw(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
            color: [f32; 4], thrust: bool) {
        self.draw_points(gl, transform, color);
        if thrust {
            let mut points = vec![
                Point{ x: -1.,    y:  1./3. },
                Point{ x: -3./2., y:  0. },
                Point{ x: -1.,    y: -1./3. }];
            for point in &mut points {
                point.x += (uniform() - 0.5) * 0.33;
                point.y += (uniform() - 0.5) * 0.33;
            }
            draw_pointloop(
                gl, transform
                    .trans(self.position.x.into(),
                           self.position.y.into())
                    .rot_rad(self.direction.into())
                    .scale(self.radius.into(), self.radius.into()),
                color, self.size / self.radius / 500., &points);
        }
    }

    fn draw_lives(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
                  color: [f32; 4]) {
        for ii in 0..self.lives {
            let position = Point{
                x: 15. * self.radius * (ii + 1) as f32 / 8.,
                y: self.radius + self.size / 8.,
            };
            draw_pointloop(
                gl, transform
                    .trans(position.x.into(), position.y.into())
                    .rot_rad((-PI / 2.).into())
                    .scale(self.radius.into(), self.radius.into()),
                color, self.size / self.radius / 500., &self.points);
        }
    }
}

impl Moveable for Player {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

struct Asteroid {
    position: Point,
    velocity: Point,
    direction: f32,
    radius: f32,
    size: f32,
    n_splits: u32,
    dead: bool,
    points: Vec<Point>,
}

enum Init<'a> {
    Parent(&'a Asteroid),
    Create {
        n_splits: u32,
        width: f32,
        height: f32,
    }
}

impl Asteroid {

    fn new(args: Init) -> Self {
        let n_splits = match args {
            Init::Parent(asteroid) => asteroid.n_splits - 1,
            Init::Create{ n_splits, .. } => n_splits,
        };
        let size = match args {
            Init::Parent(asteroid) => asteroid.size,
            Init::Create{ width, height, .. } =>
                width.min(height),
        };
        let radius = 2f32.powi(n_splits as i32) * size / 40.;
        let position = match args {
            Init::Parent(asteroid) => asteroid.position,
            Init::Create{ width, height, .. } => {
                let value = uniform();
                if value < 0.5 {
                    Point{ x: width / 2. + radius -
                           2. * value * width,
                           y: height / 2. + radius, }
                } else {
                   
                    Point{ x: width / 2. + radius,
                           y: height / 2. + radius -
                           2. * value * height, }
                }                
            }
        };
        let speed = size / 2000. / 2f32.powi(n_splits as i32);
        let direction = (uniform() * 2. - 1.) * PI;
        let velocity = Point{
            x: direction.cos() * speed * 1000.,
            y: direction.sin() * speed * 1000. };
        let n_points = n_splits * 2 + 10;
        let mut points = Vec::new();

        for ii in 0..n_points {
            let spar = (uniform() * 5. + 7.) / 12.;
            let angle = PI * 2. * (ii as f32) / n_points as f32;
            points.push(Point{
                x: spar * angle.cos(),
                y: spar * angle.sin() });
        }

        Asteroid {
            position: position,
            velocity: velocity,
            direction: direction,
            radius: radius,
            size: size,
            dead: false,
            n_splits: n_splits,
            points: points,
        }
    }

    fn impact(&mut self, asteroids: &mut Vec<Asteroid>) {
        // TODO: sound smash-rock
        self.dead = true;
        if self.n_splits > 0 {
            asteroids.push(Asteroid::new(Init::Parent(&self)));
            asteroids.push(Asteroid::new(Init::Parent(&self)));
        }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.size = width.min(height);
        self.radius = self.size * 2f32.powi(self.n_splits as i32) / 40.;
    }
    
    fn update(&mut self, elapsed: f32, width: f32, height: f32) {
        self.move_wrap(elapsed, width, height);
        self.direction += PI * elapsed * 1000. /
            self.radius / 30.;
    }

    fn draw(&self, gl: &mut GlGraphics, transform: [[f64; 3]; 2],
            color: [f32; 4]) { self.draw_points(gl, transform, color); }
}

impl Moveable for Asteroid {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

pub struct Asteroids {
    width:  f32,
    height: f32,

    turn_left:  bool,
    turn_right: bool,
    thrust:     bool,

    player: Player,
    //saucer: Saucer,
    asteroids: Vec<Asteroid>,
    //debris: Vec<Debris>,

}

impl Asteroids {
    pub fn new(width: f32, height: f32) -> Self {
        Asteroids {
            width: width, height: height,
            turn_left: false, turn_right: false,
            thrust: false,

            player: Player::new(),
            //saucer: Saucer::new(),
            asteroids: Vec::new(),
            //debris: Vec::new(),
        }
    }

    fn reset(&mut self) {
        self.player.dead = 0.;
        self.player.position = Point{ x: 0., y: 0. };
        self.player.velocity = Point{ x: 0., y: 0. };
        self.player.direction = -PI / 2.;
        self.player.lives = 3;
        self.asteroids.clear();
        // self.debris.clear();

        for _ii in 0..5 {
            self.asteroids.push(Asteroid::new(Init::Create {
                width: self.width, height: self.height,
                n_splits: 2, }));
        }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.width  = width;
        self.height = height;
        self.player.resize(width, height);
        for asteroid in &mut self.asteroids
        { asteroid.resize(width, height); }
        //for debris in &mut self.debris
        //{ debris.resize(width, height); }
    }

    fn button(&mut self, args: &ButtonArgs) {
        if args.state == ButtonState::Press {
            if args.button == Button::Keyboard(Key::Space) {
                self.player.shoot();
            } else if args.button == Button::Keyboard(Key::W) ||
                args.button == Button::Keyboard(Key::Up) {
                self.thrust = true;
            } else if args.button == Button::Keyboard(Key::A) ||
                args.button == Button::Keyboard(Key::Left) {
                self.turn_left = true;
            } else if args.button == Button::Keyboard(Key::S) ||
                args.button == Button::Keyboard(Key::Down) {
                    println!("Warp");
                    self.reset();
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
        let elapsed = args.dt as f32;
        let turn = PI * elapsed;

        if self.turn_left  { self.player.direction -= turn; }
        if self.turn_right { self.player.direction += turn; }
        if self.thrust     { self.player.thrust(elapsed); }

        let mut asteroids = Vec::<Asteroid>::new();
        for shot in &mut self.player.shots {
            for asteroid in &mut self.asteroids {
                if shot.duration > 0. && !asteroid.dead &&
                    shot.check_collide(asteroid, elapsed)
                {
                    shot.duration = 0.;
                    asteroid.impact(&mut asteroids);
                }
            }
            //if shot.check_collide(saucer, elapsed) {
            //    TODO: sound smash-ship
            //    shot.duration = 0.;
            //    saucer.dead = true;
            //}
        }
        // for shot in &mut self.saucer.shots {
        //   for asteroid in &mut self.asteroids {
        //       ...
        //   }
        //   if shot.check_collide(player, elapsed) {
        //       ...
        //   }
        // }
        for asteroid in &mut self.asteroids {
            if self.player.dead == 0. && !asteroid.dead &&
                self.player.check_collide(asteroid, elapsed)
            {
                asteroid.impact(&mut asteroids);
                self.player.impact();
            }
        }
        self.asteroids.retain(|asteroid| { !asteroid.dead });
        self.asteroids.append(&mut asteroids);
        for asteroid in &mut self.asteroids
        { asteroid.update(elapsed, self.width, self.height); }

        if self.player.dead > 0. && elapsed > self.player.dead {
            for asteroid in &self.asteroids {
                if self.player.check_collide(asteroid, 1.5)
                { self.player.dead = 0.5; }
            }
        }            
        self.player.update(elapsed, self.width, self.height);

    }

    fn draw(&mut self, gl: &mut GlGraphics, base: [[f64; 3]; 2]) {
        const BACKGROUND: [f32; 4] = [0.0625, 0.0625, 0.0625, 1.0];
        const FOREGROUND: [f32; 4] = [0.875, 0.875, 0.875, 1.0];
        let transform = base.trans((self.width / 2.) as f64,
                                   (self.height / 2.) as f64);
        graphics::clear(BACKGROUND, gl);
        self.player.draw_lives(gl, base, FOREGROUND);

        if self.player.dead == 0.
        { self.player.draw(gl, transform, FOREGROUND, self.thrust); }
        for shot in &self.player.shots
        { shot.draw(gl, transform, FOREGROUND); }

        for asteroid in &self.asteroids
        { asteroid.draw(gl, transform, FOREGROUND); }
    }
}

fn main() {
    let mut window: PistonWindow =
        WindowSettings::new("Asteroids", [640, 480])
        .exit_on_esc(true).build().unwrap();
    let wsize = window.window.window.inner_size();
    let mut gl = GlGraphics::new(OpenGL::V3_2);
    let mut app = Asteroids::new(
        wsize.width as f32, wsize.height as f32);
    app.reset();

    while let Some(event) = window.next() {
        if let Some(args) = event.resize_args() {
            app.resize(args.viewport().window_size[0] as f32,
                       args.viewport().window_size[1] as f32);
        }
        if let Some(args) = event.button_args() {
            app.button(&args);
        }
        if let Some(args) = event.render_args() {
            gl.draw(args.viewport(), |c, gl| {
                app.draw(gl, c.transform); });
        }
        if let Some(args) = event.update_args() {
            app.update(&args);
        }
    }
}
