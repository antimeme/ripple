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
package net.antimeme.ripple;
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
import java.awt.event.MouseWheelEvent;
import java.awt.event.WindowListener;
import java.awt.event.ComponentListener;
import java.awt.event.KeyListener;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.awt.event.MouseWheelListener;
import java.util.Deque;
import java.util.LinkedList;

/**
 * Creates and maintains a distinct world space in two dimensions. */
public class Camera {

    /**
     * Represents an application managed by a camera.
     * Methods are called to handle events. */
    public static interface App {
        /**
         * Called once before starting this App
         * @param camera camera object */
        public void init(Camera camera);

        /**
         * Called to start this App
         * @param camera camera object */
        public void start(Camera camera);

        /**
         * Called to stop this App
         * @param camera camera object */
        public void stop(Camera camera);

        /** Called to finish clean up on this App */
        public void destroy();

        /**
         * Called to change the size of this App
         * @param camera camera object
         * @param size new size for App */
        public void resize(Camera camera, Dimension size);

        /**
         * Called to check whether App is running
         * @return true if and only if App is running */
        public boolean isActive();

        /**
         * Called to check whether App needs mouse movement events
         * @return true if mouse movement events are needed */
        public boolean useMouseMove();

        /**
         * Called frequently to update application state
         * @param camera camera object
         * @param elapsed milliseconds passed since last call */
        public void update(Camera camera, long elapsed);

        /**
         * Called to draw current App state with transformations
         * applied.  Coordinate (0, 0) is the center of the screen.
         * The y-axis increases toward the top of the screen.
         * Anything drawn here will cover things drawn by
         * {@link #drawBefore} but not anything drawn by
         * {@link #drawAfter}.
         * @param camera camera object
         * @param gfx graphics context for drawing */
        public void draw(Camera camera, Graphics2D gfx);

        /**
         * Called to draw current App state before transformations
         * have been applied.  Coordinate (0, 0) is the top left of
         * the screen.  Coordinate (width, height) is the bottom
         * right.  Anything drawn here may be overwritten by either
         * {@link #draw} or {@link #drawAfter} calls.
         * @param camera camera object
         * @param gfx graphics context for drawing */
        public void drawBefore(Camera camera, Graphics2D gfx);

        /**
         * Called to draw current App state after transformations have
         * been unwound.  Coordinate (0, 0) is the top left of the
         * screen.  Coordinate (width, height) is the bottom right.
         * Anything drawn here will write over {@link #draw} and
         * {@link #drawBefore} calls.
         * @param camera camera object
         * @param gfx graphics context for drawing */
        public void drawAfter(Camera camera, Graphics2D gfx);

        /**
         * Called when a key is pressed
         * @param camera camera object
         * @param event key event */
        public void keyPressed(Camera camera, KeyEvent event);

        /**
         * Called when a key is released
         * @param camera camera object
         * @param event key event */
        public void keyReleased(Camera camera, KeyEvent event);

        /**
         * Called when a mouse button is pressed
         * @param camera camera object
         * @param event mouse event */
        public void mousePressed(Camera camera, MouseEvent event);

        /**
         * Called when a mouse button is released
         * @param camera camera object
         * @param event mouse event */
        public void mouseReleased(Camera camera, MouseEvent event);

        /**
         * Called when the mouse is moved, but only if
         * {@link #useMouseMove} returned true before {@link #init}
         * @param camera camera object
         * @param event mouse event */
        public void mouseMoved(Camera camera, MouseEvent event);

        /**
         * Called when the mouse is dragged
         * @param camera camera object
         * @param event mouse event */
        public void mouseDragged(Camera camera, MouseEvent event);

        /**
         * Called when the mouse wheel is moved
         * @param camera camera object
         * @param event mouse wheel event */
        public void mouseWheelMoved
            (Camera camera, MouseWheelEvent event);

        /**
         * Retrieves the menu bar for this App
         * @return menu bar to use for this App */
        public MenuBar getMenuBar();

        /**
         * Retrieves the icon to use for this App
         * @return the icon for this App */
        public Image getIcon();

        /**
         * Retrieves the title for this App
         * @return the title for this App */
        public String getTitle();
    }

    /**
     * A mostly inert implementation of the App interface with
     * defaults for most methods.  This makes it possible to
     * create an App without overriding unused methods. */
    public static class Application implements App {
        @Override
        public void init(Camera camera) {}

        @Override
        public void start(Camera camera) {}

        @Override
        public void stop(Camera camera) {}

        @Override
        public void destroy() {}

        @Override
        public void resize(Camera camera, Dimension size) {}

        @Override
        public boolean isActive() { return true; }

        @Override
        public boolean useMouseMove() { return false; }

        /**
         * Override and return true to automatically zoom the
         * application when the mouse wheel is moved.
         * @return true if and only if auto zoom should be performed */
        protected boolean useAutoZoom() { return false; }

        /**
         * Override to set smallest zoom allowed by auto zoom
         * @return smallest zoom allowed by auto zoom */
        protected float getMinZoom() { return 1f; }

        /**
         * Override to set largest zoom allowed by auto zoom
         * @return largest zoom allowed by auto zoom */
        protected float getMaxZoom() { return 25f; }

        @Override
        public void update(Camera camera, long elapsed) {}

        @Override
        public void draw(Camera camera, Graphics2D gfx) {}

        @Override
        public void drawBefore(Camera camera, Graphics2D gfx) {}

        @Override
        public void drawAfter(Camera camera, Graphics2D gfx) {}

        @Override
        public void keyPressed(Camera camera, KeyEvent event) {}

        @Override
        public void keyReleased(Camera camera, KeyEvent event) {}

        @Override
        public void mousePressed(Camera camera, MouseEvent event) {}

        @Override
        public void mouseReleased(Camera camera, MouseEvent event) {}

        @Override
        public void mouseMoved(Camera camera, MouseEvent event) {}

        @Override
        public void mouseDragged(Camera camera, MouseEvent event) {}

        @Override
        public void mouseWheelMoved
            (Camera camera, MouseWheelEvent event) {
            if (useAutoZoom()) {
                final float factor =
                    (event.getPreciseWheelRotation() > 0) ?
                    1.1f : 0.9f;
                camera.zoom(factor, getMinZoom(), getMaxZoom());
            }
        }

        @Override
        public MenuBar getMenuBar() { return null; }

        @Override
        public Image getIcon() { return null; }

        @Override
        public String getTitle() {// Class name is default title
            String title = getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
            return title;
        }
    }

    /**
     * Represents a point using floating points values. */
    public static class Point {
        /** x coordinate of this point */
        public final float x;
        /** y coordinate of this point */
        public final float y;

        /**
         * Create a new point with given coordinates
         * @param x horizontal coordinate for new point
         * @param y vertical coordinate for new point */
        public Point(float x, float y) { this.x = x; this.y = y; }

        /**
         * Creates a new point by copying an existing point
         * @param p point to copy */
        public Point(Point p) { this.x = p.x; this.y = p.y; }

        /**
         * Create a new point by rotating this one about the origin.
         * @param dircos Cosine of angle of rotation
         * @param dirsin Sine of angle of rotation
         * @return a rotated point */
        public Point rotate(float dircos, float dirsin) {
            return new Point(this.x * dircos - this.y * dirsin,
                             this.x * dirsin + this.y * dircos);
        }

        /**
         * Create a new point by scaling distance to the origin.
         * @param size amount of scaling to perform
         * @return a scaled point */
        public Point scale(float size)
        { return new Point(this.x * size, this.y * size); }

        /**
         * Create a new point by translating this point along another
         * @param value point along which to translate
         * @return a translated point */
        public Point translate(Point value)
        { return new Point(this.x + value.x, this.y + value.y); }

        /**
         * Create a new point by translating
         * @param x horizontal translation
         * @param y vertical translation
         * @return a translated point */
        public Point translate(float x, float y)
        { return new Point(this.x + x, this.y + y); }

        /**
         * Create a new point by subtracting another from this one
         * @param other point to subtract
         * @return point representing the difference */
        public Point difference(Point other)
        { return new Point(this.x - other.x, this.y - other.y); }

        /**
         * Compute the dot product of this point and another
         * @param other point to use for dot product
         * @return dot product of this point with other */
        public float dot(Point other)
        { return this.x * other.x + this.y * other.y; }

        /**
         * Compute the dot product of this point with itself
         * @return dot product of this point with itself */
        public float quadrance() { return dot(this); }

        /**
         * Compute the distance betwen this point and the origin
         * @return distance between this point and the origin */
        public float length() { return (float)Math.sqrt(quadrance()); }

        /**
         * Create a point with the same angle but unit distance from
         * the origin.
         * @return normalized point */
        public Point normalize() { return scale(1/length()); }

        @Override
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

    /**
     * Creaets a camera with specified dimensions
     * @param size current screen size */
    public Camera(Dimension size) {
        resize(size);
    }

    /**
     * Creates a camera with specified dimensions
     * @param width horizontal screen size
     * @param height vertical screen size */
    public Camera(int width, int height) {
        resize(width, height);
    }

    /**
     * Apply transformations to graphics context
     * @param gfx graphics context to transform
     * @return this camera for chaining */
    public Camera configure(Graphics2D gfx) {
        state.addLast(gfx.getTransform());
        gfx.translate(bounds.width / 2, bounds.height / 2);
        gfx.scale(getRadius() / scale, -getRadius() / scale);
        gfx.rotate(spin);
        gfx.translate(position.x, position.y);
        return this;
    }

    /**
     * Revert transformations on graphics context
     * @param gfx graphics context to transform
     * @return this camera for chaining */
    public Camera restore(Graphics2D gfx) {
        if (state.size() > 0)
            gfx.setTransform(state.pollLast());
        return this;
    }

    /**
     * Change camera size
     * @param value new size to make camera
     * @return this camera for chaining */
    public Camera resize(Dimension value) {
        bounds = value;
        return this;
    }

    /**
     * Change camera size
     * @param width new horizontal size to make camera
     * @param height new vertical size to make camera
     * @return this camera for chaining */
    public Camera resize(int width, int height) {
        bounds = new Dimension(width, height);
        return this;
    }

    /**
     * Retrieve current size of camera
     * @return current camera size */
    public Dimension getSize() { return bounds; }

    /**
     * Retrieve current width of camera
     * @return current camera width */
    public float getWidth() { return bounds.width; }

    /**
     * Retrieve current height of camera
     * @return current camera height */
    public float getHeight() { return bounds.height; }

    /**
     * Retrieve current radius of camera.  This is the radius of the
     * largest circle that can fit on the screen.
     * @return current camera radius */
    public float getRadius() {
        return Math.min(bounds.width, bounds.height) / 2;
    }

    /**
     * Retrieve the current position of the camera
     * @return current camera position */
    public Point getPosition() { return position; }

    /**
     * Move the camera to the world space position provided.
     * @param point position that should become the new origin
     * @return this camera for chaining */
    public Camera setPosition(Point point) {
        position = point.scale(-1);
        return this;
    }

    /**
     * Move the camera to the world space position provided.
     * @param x horizontal coordinate of position
     * @param y vertical coordinate of position
     * @return this camera for chaining */
    public Camera setPosition(float x, float y)
    { return setPosition(new Camera.Point(x, y)); }

    /**
     * Slide the camera along the world space vector.
     *
     * @param vector direction and distance to pan this camera
     * @return this camera for chaining */
    public Camera pan(Point vector) {
        position = position.translate(vector);
        return this;
    }

    /**
     * Fetch the current camera scale
     *
     * @return scale of camera when called */
    public float getScale() { return scale; }

    /**
     * Scales the camera so to a boundary related to screen size
     * @return this camera for chaining */
    public Camera setScaleNatural()
    { scale = getRadius(); return this; }

    /**
     * Sets camera scale to specified value.
     * @param value scale to set on this camera
     * @return this camera for chaining */
    public Camera setScale(float value)
    { scale = value; return this; }

    /**
     * Sets camera scale to specified value, within bounds.
     * @param value scale to set on this camera
     * @param min smallest acceptable scale (or Float.NaN to disable)
     * @param max largest acceptable scale (or Float.NaN to disable)
     * @return this camera for chaining */
    public Camera setScale(float value, float min, float max) {
        if (!Float.isNaN(value)) {
            if (!Float.isNaN(min) && (value < min))
                value = min;
            if (!Float.isNaN(max) && (value > max))
                value = max;
            setScale(value);
        }
        return this;
    }

    /**
     * Change scale by zooming.
     * @param factor relative scale to set on this camera
     * @param min smallest acceptable scale (or Float.NaN to disable)
     * @param max largest acceptable scale (or Float.NaN to disable)
     * @return this camera for chaining */
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
        point = new Point(point.x * scale / getRadius(),
                          point.y * -scale / getRadius());
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

        point = new Point(point.x * getRadius() / scale,
                          point.y * -getRadius() / scale);
        return point.translate(bounds.width / 2, bounds.height / 2);
    }

    protected static class Screen extends Panel
        implements Runnable, WindowListener,
                   ComponentListener, KeyListener,
                   MouseListener, MouseWheelListener,
                   MouseMotionListener
    {
        /** Camera to use for transformations */
        protected Camera camera;

        /** App to delegate important events to */
        protected App app;

        /** Image for double buffering */
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
            this.addMouseWheelListener(this);
            if (app.useMouseMove())
                this.addMouseMotionListener(this);
            frame.add(this);
            app.init(camera);
            frame.addComponentListener(this);
            frame.addWindowListener(this);
            frame.pack(); // after init so that parameters matter
            frame.setLocationRelativeTo(null); // center on screen
            frame.setVisible(true);
            app.start(camera);

            Thread th = new Thread(this);
            th.setDaemon(true);
            th.start();
        }

        public Dimension getPreferredSize() {
            return camera.getSize();
        }

        public void paint(Graphics gfx) {
            Graphics2D ctx = (Graphics2D)buffer.getGraphics();
            app.drawBefore(camera, ctx);
            camera.configure(ctx);
            app.draw(camera, ctx);
            camera.restore(ctx);
            app.drawAfter(camera, ctx);
            gfx.drawImage(buffer, 0, 0, this);
        }

        public void update(Graphics gfx) { paint(gfx); }

        public void terminate(Window target) {
            target.setVisible(false);
            app.stop(camera);
            app.destroy();
            app = null;
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
            if (app != null)
                app.resize(camera, size);
        }

        public void keyTyped(KeyEvent event) {}
        public void keyPressed(KeyEvent event)
        { if (app != null) app.keyPressed(camera, event); }
        public void keyReleased(KeyEvent event)
        { if (app != null) app.keyReleased(camera, event); }

        public void mouseClicked(MouseEvent event) {}
        public void mouseEntered(MouseEvent event) {}
        public void mouseExited(MouseEvent event) {}
        public void mousePressed(MouseEvent event)
        { if (app != null) app.mousePressed(camera, event); }
        public void mouseReleased(MouseEvent event)
        { if (app != null) app.mouseReleased(camera, event); }

        public void mouseMoved(MouseEvent event)
        { if (app != null) app.mouseMoved(camera, event); }
        public void mouseDragged(MouseEvent event)
        { if (app != null) app.mouseDragged(camera, event); }
        public void mouseWheelMoved(MouseWheelEvent event)
        { if (app != null) app.mouseWheelMoved(camera, event); }

        public void run() {
            long lastUpdate = 0;

            while ((app != null) && !Thread.interrupted()) {
                long now = System.currentTimeMillis();
                long elapsed = (lastUpdate == 0) ? 0 :
                    (now - lastUpdate);

                app.update(camera, elapsed);
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
    }

    /**
     * Create a stand alone application using this camera and the
     * specified App object.
     * @param app App to implement application logic
     * @return this camera for chaining */
    public Camera manage(App app) {
        new Screen(this, app);
        return this;
    }
}
