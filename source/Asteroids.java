// Asteroids.java
// Copyright (C) 2024 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
package net.antimeme.asteroids;
import net.antimeme.ripple.Applet;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.awt.event.KeyListener;
import java.awt.event.KeyEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseEvent;
import java.text.NumberFormat;
import java.util.Random;
import java.util.List;
import java.util.LinkedList;

/**
 * This file is an independent clone of Asteroids, a space-themed
 * arcade game originally designed by Lyle Rains, Ed Logg and Dominic
 * Walsh and released by Atari in 1979.  Source:
 * https://en.wikipedia.org/wiki/Asteroids_(video_game) */
public class Asteroids extends net.antimeme.ripple.Applet
    implements Runnable, KeyListener, MouseListener
{
    protected static boolean zeroish(float value) {
        final float epsilon = 0.00000000001f;
        return (value <= epsilon) && (value >= -epsilon);
    }

    /**
     * Use the quadradic equation to find polynomial roots. */
    protected static float[] quadraticRealRoots
        (float c, float b, float a)
    {
        float[] result = null;
        if (!zeroish(a)) {
            final float discriminant = b * b - 4 * a * c;

            if (zeroish(discriminant)) {
                result = new float[] { -b / (2 * a) };
            } else if (discriminant > 0) {
                final float sqrtdisc = (float)Math.sqrt(discriminant);
                result = new float[] {
                    (-b + sqrtdisc) / (2 * a),
                    (-b - sqrtdisc) / (2 * a) };
            }
        } else result = new float[] { -c / b };
        return result;
    }

    /**
     * Represents a point using floating points values. */
    protected static class Point {
        public float x;
        public float y;

        public Point(float x, float y) { this.x = x; this.y = y; }
        public Point(Point p) { this.x = p.x; this.y = p.y; }

        public Point rotate(float dircos, float dirsin) {
            return new Point(this.x * dircos - this.y * dirsin,
                             this.x * dirsin + this.y * dircos);
        }

        public Point scale(float size)
        { return new Point(this.x * size, this.y * size); }

        public Point translate(Point value)
        { return new Point(this.x + value.x, this.y + value.y); }

        
        public String toString() {
            return "(" + String.format("%.2f", x) +
                ", " + String.format("%.2f", y) + ")";
        }
    }

    static final Point[] wedgeShipPoints = new Point[] {
        new Point(1, 0),
        new Point(-1, 2f/3),
        new Point(-2f/3, 0),
        new Point(-1, -2f/3),
    };

    /**
     * Return non-zero iff the spherical objects represented by given
     * position, velocity and size collide within the elapsed time. */
    protected static int checkCollidePoints
        (float radiusA, Point positionA, Point velocityA,
         float radiusB, Point positionB, Point velocityB,
         long elapsed)
    {
        int result = 0;
        final float gap = radiusA + radiusB;
        Point dp = new Point(positionA.x - positionB.x,
                             positionA.y - positionB.y);

        if (dp.x * dp.x + dp.y * dp.y > gap * gap) {
            Point dm = new Point(velocityA.x - velocityB.x,
                                 velocityA.y - velocityB.y);            
            float[] roots = quadraticRealRoots
                (dp.x * dp.x + dp.y * dp.y - gap * gap,
                 2 * (dp.x * dm.x + dp.y * dm.y),
                 dm.x * dm.x + dm.y * dm.y);

            if (roots != null) {
                for (int ii = 0; ii < roots.length; ++ii)
                    if ((roots[ii] >= 0) && (roots[ii] < elapsed))
                        result = 1;
            }
        } else result = 1;
        return result;
    }

    /**
     * Anything in the game that must move can be represented by an
     * instance of this class. */
    protected static class Movable {
        public float radius;
        public Point position;
        public Point velocity;
        public float direction;
        public float duration;
        public int   dead;
        public Point[] points = null;
        public Point[] thrust = null;
        public float dome = 0;
        public int nsplits;
        public int ndebris;

        public boolean moveDrop(float elapsed, Dimension bounds) {
            position.x += velocity.x * elapsed;
            position.y += velocity.y * elapsed;

            duration = (duration > elapsed) ? (duration - elapsed) : 0;
            return (duration > 0) &&
                (position.x < radius + bounds.width / 2) &&
                (position.x > -(radius + bounds.width / 2)) &&
                (position.y < radius + bounds.height / 2) &&
                (position.x > -(radius + bounds.height / 2));
        }

        public boolean moveWrap(float elapsed, Dimension bounds) {
            moveDrop(elapsed, bounds);
            if (position.x > radius + bounds.width / 2)
                position.x = -(radius + bounds.width / 2);
            if (position.x < -(radius + bounds.width / 2))
                position.x = radius + bounds.width / 2;
            if (position.y > radius + bounds.height / 2)
                position.y = -(radius + bounds.height / 2);
            if (position.y < -(radius + bounds.height / 2))
                position.y = radius + bounds.height / 2;
            return duration > 0;
        }

        public boolean checkCollide(Movable other, long elapsed) {
            return (dead == 0) && (other.dead == 0) &&
                (checkCollidePoints
                 (radius, position, velocity, other.radius,
                  other.position, other.velocity, elapsed) > 0);
        }

        public static void drawPointLoop
            (Graphics ctx, float dircos, float dirsin, float radius,
             Point center, Point[] loop) {
            Point last = loop[loop.length - 1]
                .rotate(dircos, dirsin).scale(radius)
                .translate(center);

            for (Point current : loop) {
                current = current
                    .rotate(dircos, dirsin).scale(radius)
                    .translate(center);
                ctx.drawLine((int)(last.x), (int)(last.y),
                             (int)(current.x), (int)(current.y));
                last = current;
            }
        }

        public void drawAt(Graphics ctx, Point position) {
            drawPointLoop(ctx, 0, -1, radius, position, points);
        }

        public void draw(Graphics ctx, Dimension bounds,
                         boolean thrusting) {
            if (dead > 0) {
                // Do not draw dead things
            } else if ((points != null) && (points.length > 0)) {
                final Point center = new Point
                    (position.x + bounds.width / 2,
                     position.y + bounds.height / 2);
                final float dircos = (float)Math.cos(direction);
                final float dirsin = (float)Math.sin(direction);
                drawPointLoop(ctx, dircos, dirsin,
                              radius, center, points);

                if (thrusting && (thrust != null) &&
                    (thrust.length > 0)) {
                    Random random = new Random();
                    Point[] jitter = new Point[thrust.length];
                    for (int ii = 0; ii < jitter.length; ++ii)
                        jitter[ii] = new Point
                            (thrust[ii].x + (float)
                             ((random.nextFloat() - 0.5) * 0.33),
                             thrust[ii].y + (float)
                             ((random.nextFloat() - 0.5) * 0.33));
                    drawPointLoop(ctx, dircos, dirsin,
                                  radius, center, jitter);
                }

                if (dome > 0)
                    ctx.drawArc
                        ((int)(position.x - radius * dome +
                               bounds.width / 2),
                         (int)(position.y - radius * dome +
                               bounds.height / 2),
                         (int)(radius * dome * 2),
                         (int)(radius * dome * 2), 0, 180);
            } else ctx.drawOval((int)(position.x + bounds.width / 2),
                                (int)(position.y + bounds.height / 2),
                                (int)radius, (int)radius);
        }
    }

    /** backing store for double buffering */
    protected BufferedImage buffer = null;
    /** color to draw background */
    protected static final Color background = new Color(16, 16, 16);
    /** color to draw asteroids, debris and ships in foreground */
    protected static final Color foreground = new Color(224, 224, 224);
    /** continuously updates game state in the background */
    protected Thread updateThread = null;
    /** a source of random numbers */
    protected Random random = new Random();
    /** number of points needed to earn another extra life */
    protected final int newlife = 10000;
    /** ship controlled by the player */
    protected final Movable playerShip = new Movable();
    /** player shots that have not yet timed out or hit something */
    protected List<Movable> playerShots = new LinkedList<Movable>();
    /** determines whether saucer is large (easy) or small (hard) */
    protected boolean saucerSmall = false;

    /** counts down until it's time for saucer to change direction */
    protected int saucerTurn = 0;
    /** counts down until it's time for saucer to shoot */
    protected int saucerShoot = 0;

    /** flying saucer antagonist */
    protected final Movable saucer = new Movable();
    /** saucer shots that have not yet timed out or hit something */
    protected List<Movable> saucerShots = new LinkedList<Movable>();
    /** asteroids that have not been destroyed */
    protected List<Movable> asteroids = new LinkedList<Movable>();
    /** pieces of debris that haven't yet timed out */
    protected List<Movable> debris = new LinkedList<Movable>();
    /** reference unit for sizes that is updated on resize */
    protected float baseSize = 0;
    /** true when player is pressing key to thrust */
    protected boolean thrust      = false;
    /** true when player is pressing key to turn left */
    protected boolean turn_left   = false;    
    /** true when player is pressing key to turn right */
    protected boolean turn_right  = false;
    /** true when player is pressing key to warp */
    protected boolean warp        = false;
    /** when true the shoot key has not been releases since last shot */
    protected boolean shootRepeat = false;
    /** true when mouse button is being held down */
    protected boolean holding = false;
    /** milliseconds the mouse button has been held down */
    protected long held = 0;
    /** milliseconds during which next click will shoot */
    protected long tapshot = 0;
    /** direction player should point (if not NaN) */
    protected float target = Float.NaN;
    /** number of milliseconds of unprocessed thrust */
    protected float thrustElapsed = 0;
    /** true iff the thruster sound is playing */
    protected boolean thrusterChannel = false;
    /** current player score */
    protected int score;
    /** number of extra lives remaining for player */
    protected int lives;
    /** how many large rocks in next wave */
    protected int wavesize = 0;
    /** milliseconds until next wave begins */
    protected long nextwave = 0;
    /** set to non-zero when player runs out of lives */
    protected long gameover = 0;
    /** milliseconds when last update occured */
    protected long lastUpdate = 0;

    /** Starting point from which to derive fonts */
    protected Font fontBase = null;
    /** font to use for rendering "game over" text */
    protected Font fontGameOver = null;
    /** font to use for rendering score */
    protected Font fontScore = null;

    /** See ../apps/credits.html for details on sounds */
    protected Applet.AudioClip soundShootBeam;
    /** See ../apps/credits.html for details on sounds */
    protected Applet.AudioClip soundSmashShip;
    /** See ../apps/credits.html for details on sounds */
    protected Applet.AudioClip soundSmashRock;
    /** See ../apps/credits.html for details on sounds */
    protected Applet.AudioClip soundThruster;
    /** See ../apps/credits.html for details on sounds */
    protected Applet.AudioClip soundSaucerSiren;

    protected Applet.AudioClip fetchSound(String resource) {
        Applet.AudioClip result = null;
        try {
            java.net.URL url =
                getClass().getClassLoader().getResource(resource);
            result = getAudioClip(url);
        } catch (IllegalArgumentException ex) {
            // ...            
            throw ex;
        } catch (RuntimeException ex) {
            if (ex.getCause() instanceof
                javax.sound.sampled.UnsupportedAudioFileException) {
                System.out.println("ERROR unsupported AudioClip(" +
                                   resource + "): " +
                                   ex.getCause().getMessage());
            } else throw ex;
        }
        return result;
    }

    protected Font fetchFont(String resource, String fallback) {
        Font result = null;
        java.io.InputStream fontStream = getClass().getClassLoader()
            .getResourceAsStream(resource);
        if (fontStream != null) {
            try {
                result = Font.createFont
                    (Font.TRUETYPE_FONT, fontStream);
            } catch (java.io.IOException ex) {
                ex.printStackTrace();
            } catch (java.awt.FontFormatException ex) {
                ex.printStackTrace();
            }
        }
        if ((result == null) && (fallback != null))
            result = new Font(fallback, Font.PLAIN, 12);
        return result;
    }

    protected void impactAsteroid(Movable asteroid,
                                  List<Movable> fragments) {
        createDebris(asteroid);
        asteroid.dead = 1;
        if (asteroid.nsplits > 0) {
            createAsteroids(asteroid, 2, fragments);
        }
        if (soundSmashRock != null)
            soundSmashRock.play();
    }

    protected void impactSaucer() {
        createDebris(saucer);
        resetSaucer();
        if (soundSmashShip != null)
            soundSmashShip.play();
        if (soundSaucerSiren != null)
            soundSaucerSiren.stop();
    }

    protected void resetSaucer() {
        saucer.dead = (int)(8000 * (1 + random.nextFloat()));
        saucer.position = new Point(0, 0);
        saucer.velocity = new Point(0, 0);
        saucer.direction = (float)Math.PI;
        saucer.ndebris = 4 + (int)(4 * random.nextFloat());
    }

    protected void impactPlayerShip() {
        playerShip.dead = 3000;
        createDebris(playerShip);
        resetPlayerShip();
        if ((soundThruster != null) && thrusterChannel)
            soundThruster.stop();
        thrusterChannel = false;
        if (soundSmashShip != null)
            soundSmashShip.play();
        if (lives <= 0)
            gameover = 2000;
    }

    protected void resetPlayerShip() {
        playerShip.position = new Point(0, 0);
        playerShip.velocity = new Point(0, 0);
        playerShip.direction = (float)-Math.PI/2;
        playerShip.nsplits = 0;
        playerShip.ndebris = 4 + (int)(4 * random.nextFloat());
        target = Float.NaN;
    }

    protected void resetGame() {
        gameover = 0;
        wavesize = 4;
        nextwave = 1000;
        lives = 3;
        score = 0;
        resetSaucer();
        resetPlayerShip();
        playerShip.dead = 0;
        asteroids.clear();
        debris.clear();
        playerShots.clear();
        saucerShots.clear();
    }

    @Override
    public void resize(Dimension size) {
        buffer = new BufferedImage(size.width, size.height,
                                   BufferedImage.TYPE_INT_RGB);
        baseSize = (size.width < size.height) ?
            size.width : size.height;
        playerShip.radius = baseSize * 3 / 100;
        saucer.radius = baseSize / (saucerSmall ? 50 : 25);
        for (Movable asteroid : asteroids)
            asteroid.radius = (1 << asteroid.nsplits) * baseSize / 40;

        fontScore = fontBase.deriveFont(baseSize / 17);
        fontGameOver = fontBase.deriveFont(baseSize * 2 / 17);
    }

    @Override
    public Dimension getPreferredSize()
    { return new Dimension(640, 480); }

    @Override
    public Dimension getMinimumSize()
    { return getPreferredSize(); }

    @Override
    public void init() {
        soundShootBeam   = fetchSound("sounds/shoot-beam.ogg");
        soundSmashShip   = fetchSound("sounds/smash-ship.ogg");
        soundSmashRock   = fetchSound("sounds/smash-rock.ogg");
        soundThruster    = fetchSound("sounds/thruster.ogg");
        soundSaucerSiren = fetchSound("sounds/saucer-siren.ogg");
        fontBase = fetchFont("fonts/brass-mono.ttf", "SansSerif");

        playerShip.points = wedgeShipPoints;
        playerShip.thrust = new Point[] {
            new Point(-1, 1f/3),
            new Point(-3f/2, 0),
            new Point(-1, -1f/3), };
        saucer.points = new Point[] {
            new Point(2f/3, 0),
            new Point(1, -1f/3),
            new Point(2f/3, -2f/3),
            new Point(-2f/3, -2f/3),
            new Point(-1, -1f/3),
            new Point(-2f/3, 0), };
        saucer.dome = 2f / 3;
        resetGame();

        addKeyListener(this);
        addMouseListener(this);
    }

    @Override
    public void start() {
        updateThread = new Thread(this);
        updateThread.start();
    }

    @Override
    public void stop() { updateThread = null; }

    @Override
    public void run() {
        while (updateThread != null) {
            long now = System.currentTimeMillis();
            long elapsed = (lastUpdate == 0) ? 0 : (now - lastUpdate);

            updateGame(elapsed);
            lastUpdate = now;
            repaint();

            // Limit frame rate to approximately 60 Hz
            long consumed = System.currentTimeMillis() - now;
            if (consumed < 16)
                try {
                    Thread.sleep(16 - consumed);
                } catch (InterruptedException ex)
                    { ex.printStackTrace(); }
        }
    }

    /** Implements java.awt.event.KeyListener */
    public void keyTyped(KeyEvent event) {}
    public void keyPressed(KeyEvent event) {
        switch (event.getKeyCode()) {
        case KeyEvent.VK_UP:
        case KeyEvent.VK_W:
            if (gameover == 1)
                resetGame();
            else thrust = true;
            break;
        case KeyEvent.VK_LEFT:
        case KeyEvent.VK_A:
            if (gameover == 1)
                resetGame();
            else turn_left = true;
            break;
        case KeyEvent.VK_RIGHT:
        case KeyEvent.VK_D:
            if (gameover == 1)
                resetGame();
            else turn_right = true;
            break;
        case KeyEvent.VK_DOWN:
        case KeyEvent.VK_S:
            if (gameover == 1)
                resetGame();
            else warp = true;
            break;
        case KeyEvent.VK_SPACE:
            if (gameover == 1)
                resetGame();
            else if (!shootRepeat && (playerShip.dead == 0))
                shoot(playerShip, playerShip.direction, playerShots);
            shootRepeat = true;
            break;
        }
    }
    public void keyReleased(KeyEvent event) {
        switch (event.getKeyCode()) {
        case KeyEvent.VK_UP:
        case KeyEvent.VK_W:
            thrust = false;
            break;
        case KeyEvent.VK_LEFT:
        case KeyEvent.VK_A:
            turn_left = false;
            break;
        case KeyEvent.VK_RIGHT:
        case KeyEvent.VK_D:
            turn_right = false;
            break;
        case KeyEvent.VK_DOWN:
        case KeyEvent.VK_S:
            warp = false;
            break;
        case KeyEvent.VK_SPACE:
            shootRepeat = false;
            break;
        }
    }

    /** Implements java.awt.event.MouseListener */
    public void mouseClicked(MouseEvent event) {}
    public void mouseEntered(MouseEvent event) {}
    public void mouseExited(MouseEvent event) {}
    public void mousePressed(MouseEvent event) {
        if (gameover == 1)
            resetGame();
        else {
            Dimension bounds = getSize();
            Point vector = new Point
                ((event.getX() - bounds.width / 2) -
                 playerShip.position.x,
                 (event.getY() - bounds.height / 2) -
                 playerShip.position.y);
            float quadrance = vector.x * vector.x + vector.y * vector.y;

            if (quadrance > playerShip.radius * playerShip.radius) {
                float sx = (float)Math.cos(playerShip.direction);
                float sy = (float)Math.sin(playerShip.direction);
                float cosangle = (vector.x * sx + vector.y * sy) /
                    (float)Math.sqrt(quadrance);
                float angle =
                    ((sx * vector.y - sy * vector.x > 0) ? 1 : -1) *
                    (float)Math.acos((cosangle > 1) ? 1 :
                                     (cosangle < -1) ? -1 : cosangle);
                target = playerShip.direction + angle;
            }

            if ((playerShip.dead == 0) && (tapshot > 0))
                shoot(playerShip, playerShip.direction, playerShots);
            tapshot = 350;
            holding = true;
            held = 0;
        }
    }
    public void mouseReleased(MouseEvent event) {
        holding = false;
        held = 0;
    }

    protected void createDebris(Movable source) {
        source.duration = 0;
        for (int ii = 0; ii < source.ndebris; ++ii) {
            Movable piece = new Movable();
            piece.dead = 0;
            piece.duration = 900;
            piece.radius = baseSize / 333;
            piece.position = new Point(source.position);

            float speed = baseSize * (random.nextFloat() + 1) / 2500;
            piece.direction =
                (float)(Math.PI * 2 * random.nextFloat());
            piece.velocity = new Point
                ((float)(speed * Math.cos(piece.direction)),
                 (float)(speed * Math.sin(piece.direction)));

            int npoints = 3 + (int)(3 * random.nextFloat());
            piece.points = new Point[npoints];
            for (int jj = 0; jj < npoints; ++jj) {
                float spar = (random.nextFloat() + 1) * 2;
                piece.points[jj] = new Point
                    ((float)(spar * Math.cos
                             (Math.PI * 2 * jj / npoints)),
                     (float)(spar * Math.sin
                             (Math.PI * 2 * jj / npoints)));
            }

            debris.add(piece);
        }
    }

    protected void createAsteroids(Movable source, int count,
                                   List<Movable> destination) {
        if (destination == null)
            destination = asteroids;
        for (int ii = 0; ii < count; ++ii) {
            Movable asteroid = new Movable();
            asteroid.nsplits = (source == null) ? 2 :
                (source.nsplits - 1);
            asteroid.dead = 0;
            asteroid.radius = (1 << asteroid.nsplits) * baseSize / 40;
            asteroid.ndebris = 1 + asteroid.nsplits * 2 +
                (int)(4 * random.nextFloat());
            if (source == null) {
                float place = 2 * random.nextFloat();
                Dimension bounds = getSize();

                asteroid.position = (place > 1) ?
                    new Point
                    ((float)((place - 1.5) * bounds.width),
                     (float)(asteroid.radius + bounds.height / 2)) :
                    new Point
                    ((float)(asteroid.radius + bounds.width / 2),
                     (float)((place - 0.5) * bounds.height));
            } else asteroid.position = new Point(source.position);

            float speed = baseSize / 2000 / (1 << asteroid.nsplits);
            asteroid.direction =
                (float)(Math.PI * 2 * random.nextFloat());
            asteroid.velocity = new Point
                ((float)(speed * Math.cos(asteroid.direction)),
                 (float)(speed * Math.sin(asteroid.direction)));

            int npoints = 2 * asteroid.nsplits + 10;
            asteroid.points = new Point[npoints];
            for (int jj = 0; jj < npoints; ++jj) {
                float spar = (random.nextFloat() * 5 + 7) / 12;
                asteroid.points[jj] = new Point
                    ((float)(spar * Math.cos(Math.PI * 2 * jj / npoints)),
                     (float)(spar * Math.sin(Math.PI * 2 * jj / npoints)));
            }

            destination.add(asteroid);
        }
    }

    protected synchronized void shoot
        (Movable source, float direction, List<Movable> shots)
    {
        if (shots.size() >= 9)
            return;
        Movable shot = new Movable();
        shot.radius = baseSize / 50;
        shot.duration = 350;
        shot.ndebris = 0;
        shot.nsplits = 0;
        shot.position = new Point(source.position);
        shot.velocity = new Point(source.velocity);
        shot.velocity.x += Math.cos(direction) * baseSize / 700;
        shot.velocity.y += Math.sin(direction) * baseSize / 700;
        shots.add(shot);
        if (soundShootBeam != null)
            soundShootBeam.play();
    }

    protected void award(int npoints) {
        if (((score + npoints) / newlife) > (score / npoints))
            lives += 1;
        score += npoints;
    }

    protected void award(Movable asteroid) {
        award((asteroid.nsplits > 1) ? 20 :
              (asteroid.nsplits == 1) ? 50 : 100);
    }

    protected synchronized void updateGame(long elapsed) {
        if (gameover > 0) {
            if (elapsed >= gameover)
                gameover = 1;
            else gameover -= elapsed;
        } else if (playerShip.dead > 0) {
            if (elapsed >= playerShip.dead) {
                Movable sentinel = new Movable();
                sentinel.position = new Point(0, 0);
                sentinel.velocity = new Point(0, 0);
                sentinel.radius = playerShip.radius;
                sentinel.dead = 0;
                playerShip.dead = 0;
                for (Movable asteroid : asteroids)
                    if (sentinel.checkCollide(asteroid, 1500))
                        playerShip.dead = 500;

                if (playerShip.dead <= 0) {
                    resetPlayerShip();
                    lives -= 1;
                }
            } else playerShip.dead -= elapsed;
        } else {
            if (turn_left || turn_right)
                target = Float.NaN;
            if (turn_left) {
                playerShip.direction -= (float)elapsed / 200;
            } else if (turn_right) {
                playerShip.direction += (float)elapsed / 200;
            } else if (!Float.isNaN(target)) {
                float difference = target - playerShip.direction;

                if (difference > Math.PI)
                    difference -= Math.PI;
                else if (difference < -Math.PI)
                    difference += Math.PI;

                if (Math.abs(difference) < (float)elapsed / 200) {
                    playerShip.direction = target;
                    target = Float.NaN;
                } else if (difference > 0)
                    playerShip.direction += (float)elapsed / 200;
                else playerShip.direction -= (float)elapsed / 200;
            }

            thrustElapsed = thrust ? elapsed :
                (held > 300) ? elapsed : (held + elapsed > 300) ?
                held + elapsed - 300 : 0;
            if (holding)
                held += elapsed;
            if (thrustElapsed > 0) {
                float factor = thrustElapsed *
                    playerShip.radius / 20000;
                playerShip.velocity.x += factor *
                    Math.cos(playerShip.direction);
                playerShip.velocity.y += factor *
                    Math.sin(playerShip.direction);

                if ((soundThruster != null) && !thrusterChannel) {
                    soundThruster.loop();
                    thrusterChannel = true;
                }
            } else if ((soundThruster != null) && thrusterChannel) {
                soundThruster.stop();
                thrusterChannel = false;
            }
        }

        if (nextwave > 0) {
            if (elapsed >= nextwave) {
                nextwave = 0;
                createAsteroids(null, wavesize, null);
            } else nextwave -= elapsed;
        } else if (asteroids.size() == 0) {
            wavesize = (wavesize > 11) ? 11 : (wavesize + 2);
            nextwave = 5000;
        }

        List<Movable> fragments = new LinkedList<Movable>();
        for (Movable asteroid : asteroids) {
            for (Movable shot : saucerShots)
                if (shot.checkCollide(asteroid, elapsed)) {
                    shot.duration = 0;
                    impactAsteroid(asteroid, fragments);
                }
            for (Movable shot : playerShots)
                if (shot.checkCollide(asteroid, elapsed)) {
                    shot.duration = 0;
                    impactAsteroid(asteroid, fragments);
                    award(asteroid);
                }
            if (playerShip.checkCollide(asteroid, elapsed)) {
                impactPlayerShip();
                impactAsteroid(asteroid, fragments);
                award(asteroid);
            } else if (saucer.checkCollide(asteroid, elapsed)) {
                impactSaucer();
                impactAsteroid(asteroid, fragments);
            }
        }
        asteroids.addAll(fragments);

        for (Movable shot : playerShots)
            if (shot.checkCollide(saucer, elapsed)) {
                shot.duration = 0;
                impactSaucer();
                award(saucerSmall ? 1000 : 200);
            }
        for (Movable shot : saucerShots)
            if (shot.checkCollide(playerShip, elapsed)) {
                shot.duration = 0;
                impactPlayerShip();
            }
        if (playerShip.checkCollide(saucer, elapsed)) {
            impactPlayerShip();
            impactSaucer();
            award(saucerSmall ? 1000 : 200);
        }

        Dimension bounds = getSize();
        List<Movable> survivors = null;

        if (saucer.dead > 0) {
            if ((gameover > 0) && (elapsed >= saucer.dead)) {
                saucer.dead = 1000;
            } else if (elapsed >= saucer.dead) {
                saucer.dead = 0;

                saucerSmall = (10000 > score) ? false :
                    (random.nextFloat() * 40000 < score);
                saucer.position.x = saucer.radius + bounds.width / 2;
                saucer.position.y = saucer.radius + bounds.height / 2;
                saucer.velocity.x =
                    (((random.nextFloat() * 2 > 1) ? 1 : -1) *
                     saucer.radius / (saucerSmall ? 400 : 800));
                saucer.velocity.y = 0;
                saucerTurn = 1000;
                saucerShoot = 2000;
                if (soundSaucerSiren != null)
                    soundSaucerSiren.loop();
            } else saucer.dead -= elapsed;
        }

        survivors = new LinkedList<Movable>();
        for (Movable shot : playerShots)
            if (shot.moveWrap(elapsed, bounds))
                survivors.add(shot);
        playerShots = survivors;

        survivors = new LinkedList<Movable>();
        for (Movable shot : saucerShots)
            if (shot.moveWrap(elapsed, bounds))
                survivors.add(shot);
        saucerShots = survivors;

        if (playerShip.dead <= 0)
            playerShip.moveWrap(elapsed, bounds);

        if (saucer.dead <= 0) {
            if (saucerTurn <= elapsed) {
                final int which =
                    (((saucer.position.y < 0) ? -1 : 1) *
                     ((random.nextFloat() > 0.125) ? -1 : 1));
                saucer.velocity.y =
                    Math.abs(saucer.velocity.x) *
                    (random.nextFloat() + 1) * which;
                saucerTurn = (int)(500 + 2500 * random.nextFloat());
            } else saucerTurn -= elapsed;

            if (saucerShoot <= elapsed) {
                float direction = 0;
                if (saucerSmall) {
                    Point vector = new Point(playerShip.position);
                    vector.x -= saucer.position.x;
                    vector.y -= saucer.position.y;
                    direction = (float)Math.atan2(vector.y, vector.x);
                } else direction = (float)
                           (Math.PI * 2 * random.nextFloat());
                shoot(saucer, direction, saucerShots);
                saucerShoot = (int)((saucerSmall ? 800 : 1600) *
                                    (1 + random.nextFloat()));
            } else saucerShoot -= elapsed;
            saucer.moveWrap(elapsed, bounds);
        }

        survivors = new LinkedList<Movable>();
        for (Movable asteroid : asteroids) {
            if (asteroid.dead == 0) {
                asteroid.direction += elapsed * Math.PI /
                    (1 << asteroid.nsplits) / 1000;
                asteroid.moveWrap(elapsed, bounds);
                survivors.add(asteroid);
            }
        }
        asteroids = survivors;

        survivors = new LinkedList<Movable>();
        for (Movable piece : debris)
            if (piece.moveDrop(elapsed, bounds))
                survivors.add(piece);
        debris = survivors;
    }

    @Override
    public void paint(Graphics gfx) {
        NumberFormat nfmt = NumberFormat.getNumberInstance();
        Dimension bounds = getSize();
        Graphics ctx = buffer.getGraphics();
        ctx.setColor(background);
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        ctx.setColor(foreground);

        synchronized(this) {
            if (gameover > 0) {
                String message = "GAME OVER";
                FontMetrics fm;

                ctx.setFont(fontGameOver);
                fm = ctx.getFontMetrics();
                ctx.drawString
                    (message,
                     (bounds.width - fm.stringWidth(message)) / 2,
                     (bounds.height - fm.getHeight()) / 2 +
                     fm.getAscent());
            }

            String scoreFormatted = nfmt.format(score);
            ctx.setFont(fontScore);
            ctx.drawString(scoreFormatted, (int)playerShip.radius,
                           (int)(playerShip.radius * 5 / 2));
            for (int ii = 0; ii < lives; ++ii)
                playerShip.drawAt
                    (ctx, new Point
                     (15 * playerShip.radius * (ii + 1) / 8,
                      playerShip.radius + baseSize / 8));

            playerShip.draw(ctx, bounds, thrustElapsed > 0);
            for (Movable shot : playerShots)
                shot.draw(ctx, bounds, false);

            saucer.draw(ctx, bounds, false);
            for (Movable shot : saucerShots)
                shot.draw(ctx, bounds, false);

            for (Movable asteroid : asteroids)
                asteroid.draw(ctx, bounds, false);
            for (Movable piece : debris)
                piece.draw(ctx, bounds, false);
        }

        gfx.drawImage(buffer, 0, 0, this);
    }

    /**
     * Because this application uses double buffering, paint and
     * update need to do the same thing.  Otherwise update calls
     * clear the screen which causes intense flickering. */
    @Override
    public void update(Graphics gfx) { paint(gfx); }

    @Override
    public Image getIcon() {
        final int size = 32;
        final float factor = size * 9 / 20;
        final Point center = new Point(size / 2, size / 2);
        BufferedImage result = new BufferedImage
            (size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics gfx = result.getGraphics();
        int[] xpoints = new int[wedgeShipPoints.length];
        int[] ypoints = new int[wedgeShipPoints.length];

        for (int ii = 0; ii < wedgeShipPoints.length; ++ii) {
            xpoints[ii] = (int)
                (center.x + wedgeShipPoints[ii].y * factor);
            ypoints[ii] = (int)
                (center.y - wedgeShipPoints[ii].x * factor);
        }
        gfx.setColor(Asteroids.background);
        gfx.fillPolygon(xpoints, ypoints, wedgeShipPoints.length);
        gfx.setColor(Asteroids.foreground);
        Movable.drawPointLoop
            (gfx, 0, -1, factor, center, wedgeShipPoints);
        return result;
    }

    /**
     * Entry point to start Asteroids application.
     * @param args command line arguments */
    public static void main(String[] args)
    {
        ClassLoader parent = Asteroids.class.getClassLoader();
        java.net.URL resource = parent.getResource
            ("vorbisspi-1.0.3.3.jar");
        java.net.URLClassLoader urlcl =
            new java.net.URLClassLoader(new java.net.URL[]
                { resource }, parent);
        try (java.util.jar.JarFile jarfile = new java.util.jar.JarFile
             (new java.io.File(resource.getPath()))) {
            java.util.Enumeration<java.util.jar.JarEntry> entries =
                jarfile.entries();
            while (entries.hasMoreElements()) {
                java.util.jar.JarEntry entry = entries.nextElement();
                if (!entry.isDirectory() &&
                    entry.getName().startsWith
                    ("META-INF/services/"))
                    System.out.println("ENTRY: " + entry.getName());
            }
        } catch (java.io.IOException ex) { ex.printStackTrace(); }

        new Asteroids().standalone(args);
    }
}
