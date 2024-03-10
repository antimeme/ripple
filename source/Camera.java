// Camera.java
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
package net.antimeme.ripple.Camera;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Dimension;
import java.awt.Panel;
import java.awt.Frame;
import java.awt.Window;
import java.awt.MenuBar;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.awt.geom.AffineTransform;
import java.awt.event.WindowEvent;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseEvent;
import java.awt.event.WindowListener;
import java.awt.event.ComponentListener;
import java.awt.event.KeyListener;
import java.awt.event.MouseListener;
import java.util.Deque;
import java.util.LinkedList;

/**
 * Creates and maintains a distinct world space in two dimensions. */
public class Camera {

    public interface App {
        public void init();
        public void start();
        public void stop();
        public void destroy();
        public void resize(Dimension size);

        public void update(Camera camera, int elapsed);
        public void draw(Camera camera, Graphics2D gfx);
        public void keyPressed(Camera camera, KeyEvent event);
        public void keyReleased(Camera camera, KeyEvent event);
        public void mousePressed(Camera camera, MouseEvent event);
        public void mouseReleased(Camera camera, MouseEvent event);
        public void mouseMoved(Camera camera, MouseEvent event);

        public MenuBar getMenuBar();
        public Image   getIcon();
        public String  getTitle();
    }

    public class Application implements App {
        public void init() {}
        public void start() {}
        public void stop() {}
        public void destroy() {}
        public void resize(Dimension size) {}

        public void update(Camera camera, int elapsed) {}
        public void draw(Camera camera, Graphics2D gfx) {}
        public void keyPressed(Camera camera, KeyEvent event) {}
        public void keyReleased(Camera camera, KeyEvent event) {}
        public void mousePressed(Camera camera, MouseEvent event) {}
        public void mouseReleased(Camera camera, MouseEvent event) {}
        public void mouseMoved(Camera camera, MouseEvent event) {}

        public MenuBar getMenuBar() { return null; }
        public Image   getIcon() { return null; }
        public String  getTitle() {// Class name is default title
            String title = getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
            return title;
        }
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

        public Point translate(float x, float y)
        { return new Point(this.x + x, this.y + y); }

        public String toString() {
            return "(" + String.format("%.2f", x) +
                ", " + String.format("%.2f", y) + ")";
        }
    }

    protected Deque<AffineTransform> state =
        new LinkedList<AffineTransform>();
    protected Dimension bounds;
    protected float scale = 1f;
    protected float spin = 0f;
    protected Point position = new Point(0f, 0f);

    public Camera(Dimension value) {
        resize(value);
    }

    public Camera(int width, int height) {
        resize(width, height);
    }

    public Camera configure(Graphics2D gfx) {
        state.addLast(gfx.getTransform());
        gfx.translate(bounds.width / 2, bounds.height / 2);
        gfx.scale(getRadius() / scale, -getRadius() / scale);
        gfx.rotate(spin);
        gfx.translate(position.x, position.y);
        return this;
    }

    public Camera restore(Graphics2D gfx) {
        if (state.size() > 0)
            gfx.setTransform(state.pollLast());
        return this;
    }

    public Camera resize(Dimension value) {
        bounds = value;
        return this;
    }

    public Camera resize(int width, int height) {
        bounds = new Dimension(width, height);
        return this;
    }

    public float getRadius() {
        return Math.min(bounds.width, bounds.height) / 2;
    }

    /**
     * Move the camera to the world space position provided. */
    public Camera setPosition(Point point) {
        position = position.translate(point.scale(-1));
        return this;
    }

    /**
     * Slide the camera along the world space vector. */
    public Camera pan(Point vector) {
        position = position.translate(vector);
        return this;
    }

    public float getScale() { return scale; }

    public Camera setScaleNatural()
    { scale = getRadius(); return this; }

    public Camera setScale(float value)
    { value = scale; return this; }

    public Camera setScale(float factor, float min, float max) {
        if (!Float.isNaN(factor)) {
            if (!Float.isNaN(min) && (factor < min))
                factor = min;
            if (!Float.isNaN(max) && (factor > max))
                factor = max;
            setScale(factor);
        }
        return this;
    }

    public Camera zoom(float factor, float min, float max) {
        return setScale(scale * factor, min, max);
    }

    /**
     * Returns the point in world space corresponding to the
     * specified point in screen space.
     * @param target location in screen space to transform
     * @return point in world space corresponding to argument */
    public Point toWorld(Point target) {
        Point point = target.translate
            (-bounds.width / 2, -bounds.height / 2);
        point.x *= scale / getRadius();
        point.y *= -scale / getRadius();

        if (spin != 0f) {
            final float cos = (float)Math.cos(spin);
            final float sin = (float)Math.sin(spin);
            point = new Point(point.y * sin + point.x * cos,
                              point.y * cos - point.x * sin);
        }
        return point.translate(position.scale(-1));
    }

    /**
     * Returns the point in screen space corresponding to the
     * specified point in world space.
     * @param target location in world space to transform
     * @return point in screen space corresponding to argument */
    public Point toScreen(Point target) {
        Point point = target.translate(position);

        if (spin != 0f) {
            final float cos = (float)Math.cos(spin);
            final float sin = (float)Math.sin(spin);
            point = new Point(point.x * cos - point.y * sin,
                              point.x * sin + point.y * cos);
        }

        point.x *= getRadius() / scale;
        point.y *= -getRadius() / scale;
        return point.translate(bounds.width / 2, bounds.height / 2);
    }

    protected class Screen extends Panel
        implements WindowListener, ComponentListener,
                   KeyListener, MouseListener
    {
        protected Camera camera;
        protected App app;
        protected BufferedImage buffer = null;

        public Screen(Camera c, App a) {
            camera = c; app = a;

            Frame frame = new Frame();
            String title = app.getTitle();
            if (title != null)
                frame.setTitle(title);

            Image icon = app.getIcon();
            if (icon != null)
                frame.setIconImage(icon);

            MenuBar mb = app.getMenuBar();
            if (mb != null)
                frame.setMenuBar(mb);

            this.addKeyListener(this);
            this.addMouseListener(this);
            frame.add(this);
            app.init();
            frame.addComponentListener(this);
            frame.addWindowListener(this);
            frame.pack(); // after init so that parameters matter
            frame.setLocationRelativeTo(null); // center on screen
            frame.setVisible(true);
            app.start();
        }

        public void paint(Graphics gfx) {
            Graphics ctx = buffer.getGraphics();
            app.draw(camera, (Graphics2D)ctx);
            gfx.drawImage(buffer, 0, 0, this);
        }

        public void update(Graphics gfx) { paint(gfx); }

        public void terminate(Window target) {
            target.setVisible(false);
            app.stop();
            app.destroy();
            target.dispose();
        }

        public void windowActivated(WindowEvent event) {}
        public void windowDeactivated(WindowEvent event) {}
        public void windowDeiconified(WindowEvent event) {}
        public void windowIconified(WindowEvent event) {}
        public void windowOpened(WindowEvent event) {}
        public void windowClosed(WindowEvent event) {}
        public void windowClosing(WindowEvent event)
        { terminate(event.getWindow()); }

        public void componentShown(ComponentEvent event) {}
        public void componentHidden(ComponentEvent event) {}
        public void componentMoved(ComponentEvent event) {}
        public void componentResized(ComponentEvent event) {
            Dimension size = getSize();
            buffer = new BufferedImage(size.width, size.height,
                                       BufferedImage.TYPE_INT_RGB);
            camera.resize(size);
            app.resize(size);
        }

        public void keyTyped(KeyEvent event) {}
        public void keyPressed(KeyEvent event)
        { app.keyPressed(camera, event); }
        public void keyReleased(KeyEvent event)
        { app.keyReleased(camera, event); }

        public void mouseClicked(MouseEvent event) {}
        public void mouseEntered(MouseEvent event) {}
        public void mouseExited(MouseEvent event) {}
        public void mousePressed(MouseEvent event)
        { app.mousePressed(camera, event); }
        public void mouseReleased(MouseEvent event)
        { app.mouseReleased(camera, event); }
    }

    public Camera manage(App app) {
        new Screen(this, app);
        return this;
    }
}
