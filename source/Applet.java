// Applet.java
// Copyright (C) 2024-2026 by Jeff Gold.
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
// Attempts to provide a migration path from java.applet.Applet, which
// has been scheduled for removal from the JDK.
package net.antimeme.ripple;
//import java.awt.Panel;
import java.awt.Frame;
import java.awt.Window;
import java.awt.Dimension;
import java.awt.Image;
import java.awt.MenuBar;
import java.awt.Toolkit;
import java.awt.event.WindowListener;
import java.awt.event.WindowEvent;
import java.net.URL;
import java.net.MalformedURLException;
import java.io.InputStream;
import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeMap;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.UnsupportedAudioFileException;

/**
 * A base class intended to serve as a foundation for simple desktop
 * applications.  This class is loosely based on the deprecated
 * java.applet.Applet clases, which has been scheduled for removal
 * from the Java Runtime Environment but direct use of those classes
 * is not required to use this.
 *
 * <p>
 *   An applet can be made into an application simply by calling
 *   {@link #standalone} from the main method:
 * </p>
 *
 * <pre><code>
 *    // ...
 *    import net.antimeme.ripple.Applet;
 *
 *    public class ExampleApplet extends Applet {
 *        // ...
 *        // Override methods as necessary
 *        // ...
 *        public static void main(String[] args)
 *        { Applet.standalone(new ExampleApplet(), args); }
 *    }
 * </code></pre>
 *
 * <p>
 *   A subclass can use all the usual {@link java.applet.Applet}
 *   methods in the expected way but should call the
 *   {@link #getSoundClip} methods instead of the Applet
 *   {@link #getAudioClip} methods as these can be easily
 *   replaced if the applet package is ever removed.
 * </p> */
public class Applet extends java.applet.Applet /* Panel */
{
    static final long serialVersionUID = 0;

    /**
     * Insulates other classes from the java.applet.AudioClip interface
     * which may be removed from the JDK in the future. */
    public static interface SoundClip extends java.applet.AudioClip {
        /** Play the clip */
        public void play();
        /** Play the clip in an endless loop */
        public void loop();
        /** Stop playing the clip */
        public void stop();
    }

    /**
     * A thin wrapper on top of {@link javax.sound.sampled.Clip}
     * to ease the transition from Java Applets. */
    protected static class InternalClip implements SoundClip {
        protected Clip clip;

        /**
         * Creates an audio clip for an applet to play as needed
         *
         * @param clip javax.sound.sampled clip to wrap */
        public InternalClip(Clip clip) { this.clip = clip; }

        /**
         * Play this clip */
        public void play() { clip.setFramePosition(0); clip.start(); }

        /**
         * Play this clip continuously */
        public void loop() { clip.loop(clip.LOOP_CONTINUOUSLY); }

        /**
         * Stop playing this clip */
        public void stop() { clip.stop(); }
    }

    /**
     * A wrapper around AudioClip that insulates callers from the
     * deprecated java.applet package. */
    public static class ExternalClip implements SoundClip {
        java.applet.AudioClip ac;

        /**
         * Wraps an audio clip.
         * @param ac audio clip to wrap */
        public ExternalClip(java.applet.AudioClip ac)
        { this.ac = ac; }

        public void play() { ac.play(); }
        public void loop() { ac.loop(); }
        public void stop() { ac.stop(); }
    }

    /**
     * Implements AppletContext interface for internal use */
    private static class Context implements java.applet.AppletContext {
        private static Context self = null;
        private Context() {}
        private Map<String, java.applet.Applet> map = new TreeMap<>();
        private Map<String, InputStream> streams = new TreeMap<>();

        public static Context getContext() {
            if (self == null)
                self = new Context();
            return self;
        }

        protected Context
            setApplet(String name, java.applet.Applet applet)
        {
            map.put(name, applet);
            return this;
        }

        public java.applet.Applet getApplet(String name)
        { return map.get(name); }

        public Enumeration<java.applet.Applet> getApplets()
        { return Collections.enumeration(map.values()); }

        public java.applet.AudioClip getAudioClip(URL url) {
            try {
                Clip clip = AudioSystem.getClip();
                javax.sound.sampled.AudioInputStream stream =
                    javax.sound.sampled.AudioSystem.
                    getAudioInputStream(url);
                javax.sound.sampled.AudioFormat format =
                    stream.getFormat();
                stream = javax.sound.sampled.AudioSystem.
                    getAudioInputStream
                    (new javax.sound.sampled.AudioFormat
                     (format.getSampleRate(), 16, format.getChannels(),
                      true, format.isBigEndian()), stream);
                clip.open(stream);
                return new InternalClip(clip);
            } catch (LineUnavailableException ex) {
                throw new RuntimeException(ex);
            } catch (UnsupportedAudioFileException ex) {
                throw new RuntimeException(ex);
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        }

        public Image getImage(URL url)
        { return Toolkit.getDefaultToolkit().getImage(url); }

        public InputStream getStream(String key)
        { return streams.get(key); }

        public Iterator<String> getStreamKeys()
        { return streams.keySet().iterator(); }

        public void setStream(String key, InputStream stream)
        { streams.put(key, stream); }

        public void showDocument(URL url) { /* FIXME */ }

        public void showDocument(URL url, String name) { /* FIXME */ }

        public void showStatus(String status) { /* FIXME */ }
    }

    /**
     * Implements AppletStub interface for internal use */
    private static class Stub
        implements java.applet.AppletStub, WindowListener
    {
        protected java.applet.Applet applet;
        protected Map<String,String> argmap = new TreeMap<>();
        protected Frame frame = null;
        protected boolean active = false;

        protected Stub populateArgmap(String[] args) {
            for (int index = 0; index < args.length; ++index) {
                String arg = args[index];
                int pivot = arg.indexOf('=');
                if (pivot >= 0)
                    argmap.put(arg.substring(0, pivot).toLowerCase(),
                               arg.substring(pivot + 1));
                else argmap.put(arg.toLowerCase(), "");
            }
            return this;
        }

        protected Stub go() {
            frame = new Frame();

            String title = applet.getAppletInfo();
            if (title == null) { // Class name is default title
                title = applet.getClass().getName();
                title = title.substring(title.lastIndexOf(".") + 1);
            }
            frame.setTitle(title);
            frame.addWindowListener(this);
            applet.setStub(this);

            if (applet instanceof Applet) {
                Applet aplus = (Applet)applet;

                Image icon = aplus.getIcon();
                if (icon != null)
                    frame.setIconImage(icon);

                MenuBar mb = aplus.getMenuBar();
                if (mb != null)
                    frame.setMenuBar(mb);
            }

            frame.add(applet);
            applet.init();
            frame.pack();
            frame.setLocationRelativeTo(null); // center
            frame.setVisible(true);
            applet.start();
            active = true;

            return this;
        }

        public Stub(java.applet.Applet applet, String[] args) {
            this.applet = applet;
            if (args != null)
                populateArgmap(args);
            go();
        }

        public Stub(java.applet.Applet applet) {
            this.applet = applet;
            go();
        }

        public void appletResize(int width, int height) {
            applet.setPreferredSize(new Dimension(width, height));
            frame.revalidate();
            frame.repaint();
        }

        public java.applet.AppletContext getAppletContext()
        { return Context.getContext(); }

        public URL getCodeBase() { return null; /* FIXME */ }
        public URL getDocumentBase() { return null; /* FIXME */ }

        public String getParameter(String name)
        { return argmap.get(name); }

        public boolean isActive() { return active; }

        /**
         * Blocks until the application is terminated.  Usually
         * termination is the result of a user clicking the close
         * button on the frame window decoration.
         *
         * @return This object for chained calls.
         * @throws InterruptedException If something interrupts. */
        protected Stub join() throws InterruptedException {
            if (frame != null)
                synchronized(frame) { frame.wait(); }
            return this;
        }

        /**
         * An internal signal to shut down the application. */
        protected Stub terminate() {
            frame.setVisible(false);
            applet.stop();
            active = false;
            synchronized(frame) { frame.notifyAll(); }
            applet.destroy();
            frame.dispose();
            return this;
        }

        public void windowActivated(WindowEvent event) {}
        public void windowDeactivated(WindowEvent event) {}
        public void windowDeiconified(WindowEvent event) {}
        public void windowIconified(WindowEvent event) {}
        public void windowOpened(WindowEvent event) {}
        public void windowClosed(WindowEvent event) {}
        public void windowClosing(WindowEvent event)
        { terminate(); }
    }

    /**
     * Override this to perform initialization steps necessary for the
     * application. */
    public void init() {}

    /**
     * Override this to clean up any resources allocated during the
     * call to {@link #init()}.  No calls to {@link #start()} or
     * {@link #stop()} will be made after this. */
    public void destroy() {}

    /**
     * Override this to take steps needed to start the application.
     * This is called after {@link #init()} and after allocating
     * resources needed by the window system. */
    public void start() {}

    /**
     * Override this to take steps needed to stop the application.
     * This is called after {@link #init()} and after allocating
     * resources needed by the window system. */
    public void stop() {}

    /**
     * Override this to be notified when the application is resized
     *
     * @param width updated width of the application
     * @param height updated heigh of the application */
    //public void resize(int width, int height)
    //{ if (stub != null) stub.appletResize(width, height); }

    /**
     * Override this to be notified when the application is resized
     *
     * @param size updated size of the application */
    //public void resize(Dimension size)
    //{ if (stub != null) stub.appletResize(size.width, size.height); }

    /**
     * Override this to change the location from which
     * {@link #getIcon()} attempts to retrieve an icon for this
     * application.
     * @return a pathimage suitable for use as an application icon
     *         or null to accept a default icon */
    public String getIconPath() { return null; }

    /**
     * Override this to provide an icon to represent this application
     * to the window system.  Default is to use {@link #getIconPath()}
     * as a URL to fetch.
     * @return an image suitable for use as an application icon
     *         or null to accept a default icon */
    public Image getIcon() {
        Image result = null;
        String path = getIconPath();
        if (path != null) {
            URL resource = getClass().getClassLoader()
                .getResource(path);
            if (resource != null)
                result = getImage(resource);
        }
        return result;
    }

    /**
     * Override to create a menu bar for the application.
     * @return a menu bar or null to not have one */
    public MenuBar getMenuBar() { return null; }

    /**
     * Override to document parameters recognized by this application.
     * Each entry should be an array containing three strings.
     * The first is the name of the parameter.  The second describes
     * the type.  The third should be a description of the parameter.
     *
     * <p>Example:</p>
     * <pre><code>
     *   return new String[][] {
     *      {"nthreads", "1+",      "number of threads to spawn"},
     *      {"shields",  "boolean", "if true ships have shields"}
     *   };
     * </code></pre>
     *
     * @return array of parameter description string arrays */
    //public String[][] getParameterInfo()
    //{ return null; }

    /**
     * Collect an image from the context where this applet came from.
     * @param url source from which to fetch image
     * @return an image from the specified URL */
    //public Image getImage(URL url) { return stub.getImage(url); }

    /**
     * Collect an image from the context where this applet came from.
     * @param url source from which to fetch image
     * @param spec location within URL context
     * @return an image from the specified URL */
    //public Image getImage(URL url, String spec) {
    //    Image result = null;
    //    try {
    //        result = getImage(new URL(url, spec));
    //    } catch (MalformedURLException ex) {}
    //    return result;
    //}

    /**
     * Attempts to create an audio clip from sound data at the
     * specified URL.
     *
     * @param url base location to fetch audio clip from
     * @param name specifies audio clip relative to URL
     * @return an audio clip fetched from specified location */
    //public AudioClip getAudioClip(URL url, String name) {
    //    return (stub != null) ?
    //        stub.getAudioClip(new URL(url, name)) : null;
    //}

    /**
     * Attempts to create an audio clip from sound data at the
     * specified URL.
     *
     * @param url location to fetch audio clip from
     * @return an audio clip fetched from specified location */
    //public AudioClip getAudioClip(URL url)
    //{ return (stub != null) ? stub.getAudioClip(url) : null; }

    /**
     * Fetches an AudioClip that does not explicitly use any
     * class from the deprecated java.applet package.
     *
     * @param url location to fetch audio clip from
     * @param name specifies audio clip relative to URL
     * @return an audio clip fetched from specified location */
    public SoundClip getSoundClip(URL url, String name) {
        SoundClip result = null;
        try {
            result = new ExternalClip(getAudioClip(new URL(url, name)));
        } catch (MalformedURLException ex) {
            throw new RuntimeException(ex);
        }
        return result;
    }

    /**
     * Fetches an AudioClip that does not explicitly use any
     * class from the deprecated java.applet package.
     *
     * @param url location to fetch audio clip from
     * @return an audio clip fetched from specified location */
    public SoundClip getSoundClip(URL url) {
        return new ExternalClip(getAudioClip(url));
    }

    /**
     * Gets the URL base for documents associated with this
     * application.
     *
     * @return URL of document containing this applet */
    public URL getDocumentBase() {
        try {
            return (new File(System.getProperty
                             ("user.dir"))).toURI().toURL();
        } catch(MalformedURLException e) { return null; }
    }

    /**
     * Gets the base URL that describes this application.
     *
     * @return URL of the compiled code for this applet */
    //public URL getCodeBase() { return getDocumentBase(); }

    /**
     * Override to provide status of Applet activity.
     * Default is to always return true;
     *
     * @return true if and only if this applet is running */
    //public boolean isActive() { return true; }

    /**
     * Responds with a value determined from command line arguments.
     * Each command line argument should be of this form:
     * <code>name=value</code> A call to this method with a name that
     * matches such an argument will get that value.  Otherwise this
     * method will return null, just as if no applet parameter with
     * that name had been specified. Note that a command line
     * parameter without an '=' character yields an empty string
     * instead of null.
     *
     * @ param name specifies which parameter to query
     * @ return value of specified parameter or null */
    //@Override
    //public String getParameter(String name)
    //{ stub.getParamter(name); }

    /**
     * Provides a description of this applet.  Default is to
     * return null.
     *
     * @ return a description of this applet */
    //public String getAppletInfo() { return null; }

    /**
     * Requests a status message to be displayed for user viewing.
     *
     * @ param status message describing current applet status */
    //public void showStatus(String status) { stub.showStatus(status); }

    /**
     * Run this applet as an application, turning command line arguments
     * into applet parameters.
     * @param args command line arguments.  An argument like
     * <code>example=value</code> will turn into an applet parameter
     * named <code>example</code> with the given value.
     * @return this applet for chaining */
    public java.applet.Applet standalone(String[] args)
    {
        new Stub(this, args);
        return this;
    }
}
