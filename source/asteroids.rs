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
//! - Mouse control
//! - Warp
//! - Saucer
//! - SVG icon
use std::io::{BufReader, Read, Seek};
use std::sync::{Arc, Mutex};
use num_format::{Locale, ToFormattedString};
use sys_locale::get_locale;
use piston_window::{
    PistonWindow, Context, CharacterCache, TextureSettings};
use piston::window::WindowSettings;
use piston::input::{
    RenderEvent, ResizeEvent, UpdateArgs, UpdateEvent,
    ButtonArgs, ButtonEvent, ButtonState, Button, Key, };
use graphics::{Graphics, Transformed, Text};
use opengl_graphics::{GlGraphics, OpenGL, GlyphCache};
use rodio::{Decoder, OutputStream, OutputStreamHandle,
            Sink, Source, source::Buffered};

const PI: f32 = std::f32::consts::PI;

fn number_format(num: u32) -> String {
    let name = get_locale().unwrap_or("en-US".to_string());
    let locale = Locale::from_name(&name).unwrap_or(Locale::en);
    num.to_formatted_string(&locale)
}

fn measure_text_width<C: CharacterCache>(
    cache: &mut C, text: &str, font_size: u32,
) -> f64 {
    let mut width = 0.0;
    for ch in text.chars() {
        if let Ok(character) = cache.character(font_size, ch) {
            width += character.advance_width();
        }
    }
    width
}

trait AudioRead: Read + Seek + Send + Sync + 'static {}
impl<T: Read + Seek + Send + Sync + 'static> AudioRead for T {}

struct Sound {
    audio_data: Buffered<Decoder<BufReader<Box<dyn AudioRead>>>>,
    sink: Arc<Mutex<Option<Sink>>>,
    stream_handle: OutputStreamHandle,
    _stream: OutputStream,
}

impl Sound {
    pub fn new<R: AudioRead>(
        reader: R,
        stream_handle: OutputStreamHandle,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            audio_data: Decoder::new(BufReader::new(
                Box::new(reader) as Box<dyn AudioRead>))?.buffered(),
            sink: Arc::new(Mutex::new(None)),
            stream_handle: stream_handle.clone(),
            _stream: OutputStream::try_default()?.0,
        })
    }

    pub fn _from_file(
        path: &str,
        stream_handle: OutputStreamHandle,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let file = std::fs::File::open(path)?;
        Self::new(file, stream_handle)
    }

    pub fn from_bytes(
        bytes: &'static [u8],
        stream_handle: OutputStreamHandle,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let cursor = std::io::Cursor::new(bytes);
        Self::new(cursor, stream_handle)
    }

    pub fn play(
        &self, looped: bool
    ) -> Result<(), Box<dyn std::error::Error>> {
        let new_sink = Sink::try_new(&self.stream_handle)?;
        let source: Box<dyn Source<Item = i16> + Send> = if looped {
            Box::new(self.audio_data.clone().repeat_infinite())
        } else {
            Box::new(self.audio_data.clone())
        };
        new_sink.append(source);

        let mut sink_guard = self.sink.lock().unwrap();
        *sink_guard = Some(new_sink); // Keep control of the sink
        Ok(())
    }

    pub fn stop(&self) {
        let mut sink_guard = self.sink.lock().unwrap();
        if let Some(sink) = sink_guard.take() {
            sink.stop();
        }
    }
}

/// Represents a single point or vector on the screen.  Screen
/// coordinates are usually represented with the origin (0., 0.)  in
/// the center.  This makes it easy to resize the screen without too
/// much disruption.
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f32,
    y: f32,
}

impl Point {
    fn minus(&self, other: &Point) -> Self {
        Point{ x: self.x - other.x, y: self.y - other.y }
    }

    fn dot(&self, other: &Point) -> f32 {
        self.x * other.x + self.y * other.y
    }
}

/// Create a closed loop of lines based on an array of points.
/// Resembles a polygon but only the outline is drawn.
fn draw_pointloop(graphics: &mut impl Graphics,
                  transform: [[f64; 3]; 2], color: [f32; 4],
                  line_width: f32, points: &Vec<Point>)
{
    for ii in 0..points.len() {
        let start = points[ii];
        let end = points[(ii + 1) % points.len()];
        graphics::line(color, line_width.into(),
                       [start.x as f64, start.y as f64,
                        end.x as f64,   end.y as f64],
                       transform, graphics);
        graphics::ellipse(color, [
            (start.x - line_width) as f64,
            (start.y - line_width) as f64,
            (line_width * 2.) as f64,
            (line_width * 2.) as f64], transform, graphics);
    }
}

/// Generates a uniform distributed random value between zero and one
fn uniform() -> f32 { rand::random() }

/// Returns true iff value is close enough to zero.  Useful because
/// floating point values have rounding errors.
fn zeroish(value: f32) -> bool {
    const EPSILON: f32 = 0.00000000001;
    value < EPSILON && value > -EPSILON
}

/// Closed form solution for first or second degree polynomials
fn quadratic_real_roots(c: f32, b: f32, a: f32) ->
    Option<(f32, Option<f32>)>
{
    if zeroish(a) && zeroish(b) {
        None
    } else if zeroish(a) {
        Some((-c / b, None))
    } else {
        let discriminant = b * b - 4. * a * c;
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

/// Anything that can move.  Allows free movement, screen wrapped
/// movement and collision detection against other Moveables.
trait Moveable {
    fn get_size(&self)      -> f32;
    fn get_radius(&self)    -> f32;
    fn get_direction(&self) -> f32;
    fn get_velocity(&self)  -> Point;
    fn get_position(&self)  -> Point;
    fn set_position(&mut self, position: Point);

    fn move_free(&mut self, elapsed: f32) {
        let mut position = self.get_position();
        let velocity = self.get_velocity();
        position.x += velocity.x * elapsed;
        position.y += velocity.y * elapsed;
        self.set_position(position);
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
        let dp = self.get_position().minus(&other.get_position());
        let dv = self.get_velocity().minus(&other.get_velocity());

        if dp.dot(&dp) < gap * gap {
            true
        } else { match quadratic_real_roots(
            dp.dot(&dp) - gap * gap, 2. * dp.dot(&dv), dv.dot(&dv)) {
            None => false,
            Some((first, None)) => {
                (first >= 0.) && (first < elapsed)
            },
            Some((first, Some(second))) => {
                ((first >= 0.) && (first < elapsed)) ||
                    ((second >= 0.) && (second < elapsed))
            }
        } }
    }
}

/// Objects that have a loop of points that can be drawn.
/// Asteroids and debris are drawn completely using this method.
/// Player ship and saucer are partially drawn this way.
trait PointLoop : Moveable {
    fn get_points(&self)    -> &Vec<Point>;

    fn draw_points(&self, graphics: &mut impl Graphics,
                   transform: [[f64; 3]; 2], color: [f32; 4]) {
        let radius = self.get_radius();
        let direction = self.get_direction();
        let position = self.get_position();
        draw_pointloop(graphics, transform
                       .trans(position.x.into(),
                              position.y.into())
                       .rot_rad(direction.into())
                       .scale(radius.into(), radius.into()),
                       color, self.get_size() / radius / 500.,
                       self.get_points());
    }
}

struct Debris {
    position: Point,
    velocity: Point,
    direction: f32,
    radius: f32,
    size: f32,
    duration: f32,
    points: Vec<Point>
}

impl Debris {
    fn new(source: &impl Moveable) -> Self {
        let size   = source.get_size();
        let speed  = size * (uniform() + 1.) / 2.5;
        let direction = PI * (2. * uniform() - 1.);
        let mut velocity = source.get_velocity();
        velocity.x += direction.cos() * speed;
        velocity.y += direction.sin() * speed;

        let mut points = Vec::<Point>::new();
        let n_points = (3. * uniform() + 3.) as u32;
        for ii in 0..n_points {
            let spar = (uniform() + 1.) / 2.;
            let angle = PI * 2. * (ii as f32) / n_points as f32;
            points.push(Point{
                x: spar * angle.cos(), y: spar * angle.sin() });
        }

        Debris {
            position: source.get_position(),
            velocity, direction,
            size: size, radius: size / 100., duration: 0.9,
            points,
        }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.size = width.min(height);
        self.radius = self.size / 100.;
    }

    fn update(&mut self, elapsed: f32, _w: f32, _h: f32) -> bool
    {
        self.move_free(elapsed);
        if elapsed < self.duration {
            self.duration -= elapsed; true
        } else { false }
    }

    fn draw(&self, graphics: &mut impl Graphics,
            transform: [[f64; 3]; 2], color: [f32; 4]) {
        draw_pointloop(graphics, transform
                       .trans(self.position.x.into(),
                              self.position.y.into())
                       .rot_rad(self.direction.into())
                       .scale(self.radius.into(), self.radius.into()),
                       color, self.size / self.radius / 500.,
                       &self.points);
    }    
}

impl Moveable for Debris {
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

impl PointLoop for Debris {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
}

struct Shot {
    position: Point,
    velocity: Point,
    direction: f32,
    radius: f32,
    size: f32,
    duration: f32,
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

    fn draw(&self, graphics: &mut impl Graphics,
            transform: [[f64; 3]; 2], color: [f32; 4]) {
        graphics::ellipse(color, [
            (self.position.x - self.radius) as f64,
            (self.position.y - self.radius) as f64,
            (self.radius * 2.) as f64,
            (self.radius * 2.) as f64], transform, graphics);
    }    
}

impl Moveable for Shot {
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

    fn shoot(&mut self, sound: &Sound) {
        if self.dead > 0. {
        } else if self.shots.len() < 9 {
            self.shots.push(Shot::new(self));
            sound.play(false).expect("Failed to play sound");
        }
    }

    fn impact(&mut self, sound: &Sound, debris: &mut Vec<Debris>) {
        let n_debris = 4 + (4. * uniform()) as u32;
        for _ii in 0..n_debris
        { debris.push(Debris::new(self)); }
        sound.play(false).expect("Failed to play smash-ship sound");

        self.dead = 3.;
        if self.lives == 0 { self.gameover = 2. }
        self.position = Point{ x: 0., y: 0. };
    }

    fn update(&mut self, elapsed: f32, width: f32, height: f32) {
        self.shots.retain_mut(|shot| {
            shot.update(elapsed, width, height) });

        if self.gameover > 0. {
            if elapsed >= self.gameover {
                self.gameover = 0.001;
            } else { self.gameover -= elapsed; }
        } else if self.dead > 0. {
            if elapsed > self.dead {
                self.dead      = 0.;
                self.lives    -= 1;
                self.direction = -PI / 2.;
                self.position  = Point{ x: 0., y: 0. };
                self.velocity  = Point{ x: 0., y: 0. };
            } else { self.dead -= elapsed; }
        } else { self.move_wrap(elapsed, width, height); }
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.size = width.min(height);
        self.radius = self.size * 3. / 100.;
        for shot in &mut self.shots
        { shot.resize(width, height); }
    }

    fn draw(&self, graphics: &mut impl Graphics,
            transform: [[f64; 3]; 2], color: [f32; 4], thrust: bool) {
        self.draw_points(graphics, transform, color);
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
                graphics, transform
                    .trans(self.position.x.into(),
                           self.position.y.into())
                    .rot_rad(self.direction.into())
                    .scale(self.radius.into(), self.radius.into()),
                color, self.size / self.radius / 500., &points);
        }
    }

    fn draw_lives(&self, graphics: &mut impl Graphics,
                  transform: [[f64; 3]; 2], color: [f32; 4]) {
        for ii in 0..self.lives {
            let position = Point{
                x: 15. * self.radius * (ii + 1) as f32 / 8.,
                y: self.radius + self.size / 8.,
            };
            draw_pointloop(
                graphics, transform
                    .trans(position.x.into(), position.y.into())
                    .rot_rad((-PI / 2.).into())
                    .scale(self.radius.into(), self.radius.into()),
                color, self.size / self.radius / 500., &self.points);
        }
    }
}

impl Moveable for Player {
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

impl PointLoop for Player {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
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

    fn impact(&mut self, sound: &Sound,
              asteroids: &mut Vec<Asteroid>,
              debris: &mut Vec<Debris>)
    {
        sound.play(false).expect("Failed to play smash rock");
        self.dead = true;
        let n_debris = 1 + self.n_splits * 2 + (4. * uniform()) as u32;
        for _ii in 0..n_debris {
            debris.push(Debris::new(self));
        }

        if self.n_splits > 0 {
            asteroids.push(Asteroid::new(Init::Parent(&self)));
            asteroids.push(Asteroid::new(Init::Parent(&self)));
        }
    }

    fn points(&self) -> u32 {
        if self.n_splits == 0 {
            100
        } else if self.n_splits < 2 { 50 } else { 20 }
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

    fn draw(&self, graphics: &mut impl Graphics,
            transform: [[f64; 3]; 2], color: [f32; 4]) {
        self.draw_points(graphics, transform, color);
    }
}

impl Moveable for Asteroid {
    fn get_size(&self)      -> f32 { self.size }
    fn get_radius(&self)    -> f32 { self.radius }
    fn get_direction(&self) -> f32 { self.direction }
    fn get_velocity(&self)  -> Point { self.velocity }
    fn get_position(&self)  -> Point { self.position }
    fn set_position(&mut self, position: Point)
    { self.position = position; }
}

impl PointLoop for Asteroid {
    fn get_points(&self)    -> &Vec<Point> { &self.points }
}

pub struct Asteroids {
    width:  f32,
    height: f32,

    score: u32,
    turn_left:  bool,
    turn_right: bool,
    thrust:     bool,

    wavesize: u32,
    nextwave: f32,

    player: Player,
    //saucer: Saucer,
    asteroids: Vec<Asteroid>,
    debris:    Vec<Debris>,

    thruster:     Sound,
    shoot_beam:   Sound,
    smash_rock:   Sound,
    smash_ship:   Sound,
    //saucer_siren: Sound<'a>,

    glyphs: Arc<Mutex<GlyphCache<'static>>>,
    _stream_handle: OutputStreamHandle,
    _stream: OutputStream,
}

impl Asteroids {

    pub fn new(
        glyphs: Arc<Mutex<GlyphCache<'static>>>
    ) -> Result<Self, Box<dyn std::error::Error>> {
        const THRUSTER_OGG: &[u8] = include_bytes!(concat!(
            env!("ASSET_PATH"), "/sounds/thruster.ogg"));
        const SHOOT_BEAM_OGG: &[u8] = include_bytes!(concat!(
            env!("ASSET_PATH"), "/sounds/shoot-beam.ogg"));
        const SMASH_SHIP_OGG: &[u8] = include_bytes!(concat!(
            env!("ASSET_PATH"), "/sounds/smash-ship.ogg"));
        const SMASH_ROCK_OGG: &[u8] = include_bytes!(concat!(
            env!("ASSET_PATH"), "/sounds/smash-rock.ogg"));
        //const SAUCER_SIREN_OGG: &[u8] = include_bytes!(concat!(
        //    env!("ASSET_PATH"), "/sounds/saucer-siren.ogg"));
        let (_stream, stream_handle) = OutputStream::try_default()?;

        Ok(Asteroids {
            width: 0., height: 0., score: 0,
            thrust: false, turn_left: false, turn_right: false,

            player: Player::new(),
            //saucer: Saucer::new(),
            asteroids: Vec::new(),
            debris: Vec::new(),

            wavesize: 4, nextwave: 1.,

            thruster: Sound::from_bytes(
                THRUSTER_OGG, stream_handle.clone())?,
            shoot_beam: Sound::from_bytes(
                SHOOT_BEAM_OGG, stream_handle.clone())?,
            smash_ship: Sound::from_bytes(
                SMASH_SHIP_OGG, stream_handle.clone())?,
            smash_rock: Sound::from_bytes(
                SMASH_ROCK_OGG, stream_handle.clone())?,
            //saucer_siren: Sound::from_bytes(
            //    SAUCER_SIREN_OGG, stream_handle)?,
            _stream_handle: stream_handle, _stream,
            glyphs,
        })
    }

    fn reset(&mut self) {
        self.score = 0;
        self.player.gameover = 0.;
        self.player.dead = 0.;
        self.player.position = Point{ x: 0., y: 0. };
        self.player.velocity = Point{ x: 0., y: 0. };
        self.player.direction = -PI / 2.;
        self.player.lives = 3;
        self.asteroids.clear();
        self.debris.clear();
        self.wavesize = 4;
        self.nextwave = 1.;
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.width  = width;
        self.height = height;
        self.player.resize(width, height);
        for asteroid in &mut self.asteroids
        { asteroid.resize(width, height); }
        for debris in &mut self.debris
        { debris.resize(width, height); }
    }

    fn award(&mut self, points: u32) {
        const NEWLIFE: u32 = 10000;
        if (self.score + points) / NEWLIFE > self.score / NEWLIFE {
            self.player.lives += 1;
        }
        self.score += points;
    }

    fn activate(&mut self) -> bool {
        if self.player.gameover > 0. && self.player.gameover <= 0.001 {
            self.reset();
            false
        } else { true }
    }

    fn button(&mut self, args: &ButtonArgs) {
        if args.state == ButtonState::Press {
            if args.button == Button::Keyboard(Key::Space) {
                if self.activate() {
                    self.player.shoot(&self.shoot_beam);
                }
            } else if args.button == Button::Keyboard(Key::W) ||
                args.button == Button::Keyboard(Key::Up) {
                    if self.activate() {
                        self.thrust = true;
                        if self.player.dead == 0. {
                            self.thruster.play(true)
                                .expect("Failed to play thruster sound");
                        }
                    }
            } else if args.button == Button::Keyboard(Key::A) ||
                args.button == Button::Keyboard(Key::Left) {
                    if self.activate() { self.turn_left = true; }
            } else if args.button == Button::Keyboard(Key::S) ||
                args.button == Button::Keyboard(Key::Down) {
                    println!("Warp");
                    self.activate();
            } else if args.button == Button::Keyboard(Key::D) ||
                args.button == Button::Keyboard(Key::Right) {
                    if self.activate() { self.turn_right = true; }
            }
        } else if args.state == ButtonState::Release {
            if args.button == Button::Keyboard(Key::W) ||
                args.button == Button::Keyboard(Key::Up) {
                    self.thrust = false;
                    self.thruster.stop();
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
        let mut points: u32 = 0;

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
                    points += asteroid.points();
                    asteroid.impact(&self.smash_rock,
                                    &mut asteroids, &mut self.debris);
                }
            }
            //if shot.check_collide(saucer, elapsed) {
            //    self.smash_ship.play(false);
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
                points += asteroid.points();
                asteroid.impact(&self.smash_rock,
                                &mut asteroids, &mut self.debris);
                self.player.impact(&self.smash_ship, &mut self.debris);
                self.thruster.stop();
                self.thrust = false;
            }
        }
        self.asteroids.retain(|asteroid| { !asteroid.dead });
        self.asteroids.append(&mut asteroids);
        for asteroid in &mut self.asteroids
        { asteroid.update(elapsed, self.width, self.height); }

        self.debris.retain_mut(|debris| {
            debris.update(elapsed, self.width, self.height) });

        if self.player.dead > 0.5 {
            for asteroid in &self.asteroids {
                if self.player.check_collide(asteroid, 1.5)
                { self.player.dead = 0.5; }
            }
        }
        self.player.update(elapsed, self.width, self.height);
        self.award(points);

        if self.nextwave > 0. {
            if elapsed > self.nextwave {
                self.nextwave = 0.;
                for _ii in 0..self.wavesize {
                    self.asteroids.push(Asteroid::new(Init::Create {
                        width: self.width, height: self.height,
                        n_splits: 2, }));
                }
                self.wavesize += 2;
                if self.wavesize > 11 { self.wavesize = 11; }
            } else { self.nextwave -= elapsed; }
        } else if self.asteroids.len() == 0 { self.nextwave = 5.; }
    }

    fn draw(&mut self, graphics: &mut GlGraphics, context: &Context)
    {
        const BACKGROUND: [f32; 4] = [0.0625, 0.0625, 0.0625, 1.0];
        const FOREGROUND: [f32; 4] = [0.875, 0.875, 0.875, 1.0];
        let transform = context.transform.trans(
            (self.width / 2.) as f64,
            (self.height / 2.) as f64);

        graphics::clear(BACKGROUND, graphics);
        let mut glyphs = self.glyphs.lock().unwrap();
        let size = self.width.min(self.height);
        Text::new_color(FOREGROUND, (size / 17.) as u32).draw(
            &format!("{}", number_format(self.score)),
            &mut *glyphs, &context.draw_state,
            context.transform.trans(
                (size / 30.).into(), (size / 12.).into()), graphics)
            .expect("Failed to draw score");

        self.player.draw_lives(graphics, context.transform, FOREGROUND);

        if self.player.gameover > 0. {
            let message = "GAME OVER";
            let fsize = (size * 2. / 17.) as u32;
            let (w_text, h_text) = (measure_text_width(
                &mut *glyphs, message, fsize), 0);

            Text::new_color(FOREGROUND, fsize).draw(
                message, &mut *glyphs, &context.draw_state,
                context.transform.trans(
                    ((self.width - w_text as f32) / 2.).into(),
                    ((self.height - h_text as f32) / 2.).into()),
                graphics).expect("Failed to draw GAME OVER");
        }
        if self.player.dead == 0. {
            self.player.draw(graphics, transform,
                             FOREGROUND, self.thrust);
        }
        for shot in &self.player.shots
        { shot.draw(graphics, transform, FOREGROUND); }

        for asteroid in &self.asteroids
        { asteroid.draw(graphics, transform, FOREGROUND); }
        for debris in &self.debris
        { debris.draw(graphics, transform, FOREGROUND); }
    }
}

fn main() {
    const BRASS_MONO_TTF: &[u8] = include_bytes!(concat!(
        env!("ASSET_PATH"), "/fonts/brass-mono.ttf"));

    let mut window: PistonWindow =
        WindowSettings::new("Asteroids", [640, 480])
        .exit_on_esc(true).build().unwrap();
    let mut gl = GlGraphics::new(OpenGL::V3_2);
    let mut app = Asteroids::new(Arc::new(Mutex::new(
        GlyphCache::from_bytes(
            BRASS_MONO_TTF, (),
            TextureSettings::new())
            .expect("Failed to decode font"))))
        .expect("Failed to create Asteroids app");
    app.resize(640., 480.);
    app.reset();


    while let Some(event) = window.next() {
        if let Some(args) = event.resize_args() {
            let wsize = args.viewport().window_size;
            app.resize(wsize[0] as f32, wsize[1] as f32);
        }
        if let Some(args) = event.button_args() { app.button(&args); }
        if let Some(args) = event.update_args() { app.update(&args); }
        if let Some(args) = event.render_args() {
            gl.draw(args.viewport(), |context, gl| {
                app.draw(gl, &context);
            });
        }
    }
}
