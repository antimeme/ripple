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
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.awt.event.ComponentListener;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyListener;
import java.awt.event.KeyEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseEvent;
import java.text.NumberFormat;
import java.util.Random;
import java.util.List;
import java.util.LinkedList;
import net.esclat.ripple.Standalone;

/**
 * This file is an independent clone of Asteroids, a space-themed
 * arcade game originally designed by Lyle Rains, Ed Logg and Dominic
 * Walsh and released by Atari in 1979.  Source:
 * https://en.wikipedia.org/wiki/Asteroids_(video_game) */
public class Asteroids extends java.applet.Applet
    implements Runnable, ComponentListener, KeyListener, MouseListener
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
        (float sizeA, Point positionA, Point velocityA,
         float sizeB, Point positionB, Point velocityB, long elapsed)
    {
        int result = 0;
        final float gap = sizeA + sizeB;
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
        public float size;
        public Point position;
        public Point velocity;
        public float direction;
        public float duration;
        public int   dead;
        public Point[] points = null;
        public Point[] thrust = null;
        public int nsplits;
        public int ndebris;

        public boolean moveDrop(float elapsed, Dimension bounds) {
            this.position.x += this.velocity.x * elapsed;
            this.position.y += this.velocity.y * elapsed;

            duration = (duration > elapsed) ? (duration - elapsed) : 0;
            return (duration > 0) &&
                (this.position.x < this.size + bounds.width / 2) &&
                (this.position.x > -(this.size + bounds.width / 2)) &&
                (this.position.y < this.size + bounds.height / 2) &&
                (this.position.x > -(this.size + bounds.height / 2));
        }

        public boolean moveWrap(float elapsed, Dimension bounds) {
            position.x += velocity.x * elapsed;
            if (position.x > size + bounds.width / 2)
                position.x = -(size + bounds.width / 2);
            if (position.x < -(size + bounds.width / 2))
                position.x = size + bounds.width / 2;

            position.y += velocity.y * elapsed;
            if (position.y > size + bounds.height / 2)
                position.y = -(size + bounds.height / 2);
            if (position.y < -(size + bounds.height / 2))
                position.y = size + bounds.height / 2;

            duration = (duration > elapsed) ? (duration - elapsed) : 0;
            return duration > 0;
        }

        public boolean checkCollide(Movable other, long elapsed) {
            return (dead == 0) && (other.dead == 0) &&
                (checkCollidePoints
                 (size, position, velocity, other.size,
                  other.position, other.velocity, elapsed) > 0);
        }

        public static void drawPointLoop
            (Graphics ctx, float dircos, float dirsin, float size,
             Point center, Point[] loop) {
            Point last = loop[loop.length - 1]
                .rotate(dircos, dirsin).scale(size)
                .translate(center);

            for (Point current : loop) {
                current = current
                    .rotate(dircos, dirsin).scale(size)
                    .translate(center);
                ctx.drawLine((int)(last.x), (int)(last.y),
                             (int)(current.x), (int)(current.y));
                last = current;
            }
        }

        public void drawAt(Graphics ctx, Point position) {
            drawPointLoop(ctx, 0, -1, size, position, points);
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
                              size, center, points);

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
                                  size, center, jitter);
                }
            } else ctx.drawOval((int)(position.x + bounds.width / 2),
                                (int)(position.y + bounds.height / 2),
                                (int)size, (int)size);
        }
    }

    protected BufferedImage buffer = null;
    protected Thread updateThread = null;
    protected Random random = new Random();
    protected static final Color background = new Color(16, 16, 16);
    protected static final Color foreground = new Color(224, 224, 224);
    protected final Movable playerShip = new Movable();
    protected final Movable saucer = new Movable();
    protected List<Movable> asteroids = null;
    protected List<Movable> debris = null;
    protected List<Movable> playerShots = null;
    protected float baseSize = 0;
    protected boolean thrust      = false;
    protected boolean turn_left   = false;
    protected boolean turn_right  = false;
    protected boolean warp        = false;
    protected boolean shootRepeat = false;
    protected boolean holding = false;
    protected long held = 0;
    protected long tapshot = 0;
    protected float target = Float.NaN;
    protected float thrust_elapsed = 0;
    protected int score;
    protected int lives;
    protected int wavesize = 0;
    protected long nextwave = 0;
    protected long gameover = 0;
    protected long lastUpdate = 0;
    protected Font font_gameover = null;
    protected Font font_score = null;

    protected void resetPlayerShip() {
        lives -= 1;
        playerShip.position = new Point(0, 0);
        playerShip.velocity = new Point(0, 0);
        playerShip.direction = (float)-Math.PI/2;
        playerShip.dead = 0;
        playerShip.nsplits = 0;
        playerShip.ndebris = 4 + (int)(4 * random.nextFloat());
        target = Float.NaN;
    }

    protected void resetGame() {
        gameover = 0;
        wavesize = 4;
        nextwave = 1000;
        lives = 4;
        score = 0;
        resetPlayerShip();
        asteroids = new LinkedList<Movable>();
        debris = new LinkedList<Movable>();
        playerShots = new LinkedList<Movable>();
    }

    /** Implements java.awt.event.ComponentListener */
    public void componentMoved(ComponentEvent e) {}
    public void componentHidden(ComponentEvent e) {}
    public void componentShown(ComponentEvent e) {}
    public void componentResized(ComponentEvent e) {
        Dimension size = getSize();
        buffer = new BufferedImage(size.width, size.height,
                                   BufferedImage.TYPE_INT_RGB);
        baseSize = (size.width < size.height) ?
            size.width : size.height;
        playerShip.size = baseSize * 3 / 100;
        for (Movable asteroid : asteroids)
            asteroid.size = (1 << asteroid.nsplits) * baseSize / 40;

        font_score = new Font("SansSerif", Font.PLAIN,
                              (int)(baseSize / 17));
        font_gameover = new Font("SansSerif", Font.PLAIN,
                                 (int)(baseSize * 2 / 17));
    }

    @Override
    public Dimension getPreferredSize()
    { return new Dimension(640, 480); }

    @Override
    public Dimension getMinimumSize()
    { return getPreferredSize(); }

    @Override
    public void init() {
        playerShip.points = wedgeShipPoints;
        playerShip.thrust = new Point[] {
            new Point(-1, 1f/3),
            new Point(-3f/2, 0),
            new Point(-1, -1f/3),
        };

        resetGame();
        addComponentListener(this);
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
                shoot(playerShip, playerShots);
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

            if (quadrance > playerShip.size * playerShip.size) {
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
                shoot(playerShip, playerShots);
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
            piece.size = baseSize / 333;
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
            asteroid.size = (1 << asteroid.nsplits) * baseSize / 40;
            asteroid.ndebris = 1 + asteroid.nsplits * 2 +
                (int)(4 * random.nextFloat());
            if (source == null) {
                float place = 2 * random.nextFloat();
                Dimension bounds = getSize();

                asteroid.position = (place > 1) ?
                    new Point
                    ((float)((place - 1.5) * bounds.width),
                     (float)(asteroid.size + bounds.height / 2)) :
                    new Point
                    ((float)(asteroid.size + bounds.width / 2),
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

    protected void shoot(Movable source, List<Movable> shots) {
        if (shots.size() >= 9)
            return;
        Movable shot = new Movable();
        shot.size = baseSize / 50;
        shot.duration = 350;
        shot.ndebris = 0;
        shot.nsplits = 0;
        shot.position = new Point(source.position);
        shot.velocity = new Point(source.velocity);
        shot.velocity.x += Math.cos(source.direction) * baseSize / 700;
        shot.velocity.y += Math.sin(source.direction) * baseSize / 700;
        shots.add(shot);
    }

    protected int award(Movable asteroid) {
        return (asteroid.nsplits > 1) ? 20 :
            (asteroid.nsplits == 1) ? 50 : 100;
    }

    protected void updateGame(long elapsed) {
        if (gameover > 0) {
            if (elapsed >= gameover)
                gameover = 1;
            else gameover -= elapsed;
        } else if (playerShip.dead > 0) {
            if (elapsed >= playerShip.dead) {
                Movable sentinel = new Movable();
                sentinel.position = new Point(0, 0);
                sentinel.velocity = new Point(0, 0);
                sentinel.size = playerShip.size;
                sentinel.dead = 0;
                for (Movable asteroid : asteroids)
                    if (sentinel.checkCollide(asteroid, 1500))
                        playerShip.dead = 500;

                if (elapsed >= playerShip.dead)
                    resetPlayerShip();
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

            thrust_elapsed = thrust ? elapsed :
                (held > 300) ? elapsed : (held + elapsed > 300) ?
                held + elapsed - 300 : 0;
            if (holding)
                held += elapsed;
            if (thrust_elapsed > 0) {
                float factor = thrust_elapsed * baseSize / 400000;
                playerShip.velocity.x +=
                    Math.cos(playerShip.direction) * factor;
                playerShip.velocity.y +=
                    Math.sin(playerShip.direction) * factor;
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
            for (Movable shot : playerShots)
                if (shot.checkCollide(asteroid, elapsed)) {
                    shot.duration = 0;
                    score += award(asteroid);

                    createDebris(asteroid);
                    asteroid.dead = 1;
                    if (asteroid.nsplits > 0)
                        createAsteroids(asteroid, 2, fragments);
                }
            if (playerShip.checkCollide(asteroid, elapsed)) {
                createDebris(playerShip);
                score += award(asteroid);
                playerShip.dead = 3000;
                if (lives <= 0)
                    gameover = 2000;

                createDebris(asteroid);
                asteroid.dead = 1;
                if (asteroid.nsplits > 0)
                    createAsteroids(asteroid, 2, fragments);
            }
        }
        asteroids.addAll(fragments);

        Dimension bounds = getSize();
        List<Movable> survivors;

        playerShip.moveWrap(elapsed, bounds);
        survivors = new LinkedList<Movable>();
        for (Movable shot : playerShots)
            if (shot.moveWrap(elapsed, bounds))
                survivors.add(shot);
        playerShots = survivors;

        // :TODO: update saucer and its shots

        survivors = new LinkedList<Movable>();
        for (Movable asteroid : asteroids) {
            if (asteroid.dead == 0) {
                asteroid.direction += elapsed * Math.PI /
                    (asteroid.size * 30);
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
    public void update(Graphics gfx) { paint(gfx); }

    @Override
    public void paint(Graphics gfx) {
        NumberFormat nfmt = NumberFormat.getNumberInstance();
        Dimension bounds = getSize();
        Graphics ctx = buffer.getGraphics();
        ctx.setColor(background);
        ctx.fillRect(0, 0, bounds.width, bounds.height);

        ctx.setColor(foreground);
        String scoreFormatted = nfmt.format(score);
        ctx.setFont(font_score);
        ctx.drawString(scoreFormatted, (int)playerShip.size,
                       (int)(playerShip.size * 5 / 2));
        for (int ii = 0; ii < lives; ++ii)
            playerShip.drawAt
                (ctx, new Point
                 (15 * playerShip.size * (ii + 1) / 8,
                  playerShip.size + baseSize / 8));
        if (gameover > 0) {
            String message = "GAME OVER";
            FontMetrics fm;

            ctx.setFont(font_gameover);
            fm = ctx.getFontMetrics();
            ctx.drawString(message,
                           (bounds.width - fm.stringWidth(message)) / 2,
                           (bounds.height - fm.getHeight()) / 2 +
                           fm.getAscent());
        }
        playerShip.draw(ctx, bounds, thrust_elapsed > 0);
        for (Movable shot : playerShots)
            shot.draw(ctx, bounds, false);
        // :TODO: draw saucer
        for (Movable asteroid : asteroids)
            asteroid.draw(ctx, bounds, false);
        for (Movable piece : debris)
            piece.draw(ctx, bounds, false);
        gfx.drawImage(buffer, 0, 0, this);
    }

    protected static Image createIcon() {
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
    public static void main(String[] args) {
        Standalone.app(new Asteroids(), "Asteroids",
                       Asteroids.createIcon(), null, args);
    }
}
