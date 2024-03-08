// Applet.java
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
// Attempts to provide a migration path from java.applet.Applet, which
// has been scheduled for removal from the JDK.
package net.antimeme.ripple;
import java.awt.Frame;
import java.awt.Panel;
import java.awt.Dimension;
import java.awt.Image;
import java.awt.MenuBar;
import java.awt.Toolkit;
import java.awt.image.ImageObserver;
import java.awt.event.WindowListener;
import java.awt.event.WindowEvent;
import java.awt.event.ComponentListener;
import java.awt.event.ComponentEvent;
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
 * from the Java Runtime Environment.
 *
 * <p>
 *   An applet can be made into an application simply by calling
 *   {@link #standalone} from the main method:
 * </p>
 *
 * <pre><code>
 *    // ...
 *    import net.antimeme.ripple.Standalone;
 *
 *    public class ExampleApplet extends Applet {
 *        // ...
 *        public static void main(String[] args)
 *        { new ExampleApplet().standalone(args); }
 *    }
 * </code></pre>
 *
 * <p>
 *   An application which needs to perform some steps after the frame
 *   has been clsoed can use the {@link #join} on the return value to
 *   block until the user closes the application.
 * </p> */
public class Applet extends Panel
    implements WindowListener, ComponentListener, ImageObserver
{
    static final long serialVersionUID = 0;
    protected Frame standaloneFrame = null;
    protected Map<String,String> argmap = new TreeMap<String, String>();

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
     * @param width updated width of the application
     * @param height updated heigh of the application */
    public void resize(int width, int height) {}

    /**
     * Override this to be notified when the application is resized
     * @param size updated size of the application */
    public void resize(Dimension dm) {}

    /**
     * Override to take action when application is revealed */
    public void componentShown(ComponentEvent ev) {}

    /**
     * Override to take action when application is hidden */
    public void componentHidden(ComponentEvent ev) {}

    /**
     * Override to take action when application is hidden */
    public void componentMoved(ComponentEvent ev) {}

    /**
     * Override to take action when application is resized.
     * Default is to call {@link #resize(Dimension)} and
     * {@link #resize(int, int)} */
    public void componentResized(ComponentEvent ev) {
        Dimension size = getSize();
        resize(size);
        resize(size.width, size.height);
    }

    /**
     * Override to take action when application is activated */
    public void windowActivated(WindowEvent e) {}

    /**
     * Override to take action when application is deactivated */
    public void windowDeactivated(WindowEvent e) {}
    /**
     * Override to take action when application is de-iconified */
    public void windowDeiconified(WindowEvent e) {}
    /**
     * Override to take action when application is iconified */
    public void windowIconified(WindowEvent e) {}
    /**
     * Override to take action when application is opened */
    public void windowOpened(WindowEvent e) {}
    /**
     * Override to take action when application is closed */
    public void windowClosed(WindowEvent e) {}

    /**
     * Override to take action when application is closing.
     * Default is to terminate the application. */
    public void windowClosing(WindowEvent e)
    { terminate(); }

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
     * the type.  The third should be a description of the parameter. */
    public String[][] getParameterInfo()
    { return null; }

    /**
     * Call to create an application window
     * @return this application for chaining */
    public Applet standalone() {
        standaloneFrame = new Frame();

        String title = getAppletInfo();
        if (title == null) { // Class name is default title
            title = getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
        }
        standaloneFrame.setTitle(title);

        Image icon = getIcon();
        if (icon != null)
            standaloneFrame.setIconImage(icon);

        MenuBar mb = getMenuBar();
        if (mb != null)
            standaloneFrame.setMenuBar(mb);

        standaloneFrame.add(this);
        init();
        standaloneFrame.addComponentListener(this);
        standaloneFrame.addWindowListener(this);
        standaloneFrame.pack(); // after init so that parameters matter
        standaloneFrame.setLocationRelativeTo(null); // center on screen
        standaloneFrame.setVisible(true);
        start();
        return this;
    }

    public Applet standalone(String[] args) {
        for (int index = 0; index < args.length; ++index) {
            String arg = args[index];
            int pivot = arg.indexOf('=');
            if (pivot >= 0)
                argmap.put(arg.substring(0, pivot).toLowerCase(),
                           arg.substring(pivot + 1));
            else argmap.put(arg.toLowerCase(), "");
        }
        return standalone();
    }

    /**
     * An internal signal to shut down the application. */
    protected Applet terminate() {
        stop();
        destroy();
        if (standaloneFrame != null) {
            standaloneFrame.setVisible(false);
            synchronized(standaloneFrame) {
                standaloneFrame.notifyAll();
            }
            standaloneFrame.dispose();
            standaloneFrame = null;
        }
        return this;
    }

    /**
     * Blocks until the application is terminated.  Usually termination
     * is the result of a user clicking the close button on the frame
     * window decoration.
     * @return This object for chained calls.
     * @throws InterruptedException If something interrupts. */
    protected Applet join() throws InterruptedException {
        if (standaloneFrame != null)
            synchronized(standaloneFrame) { standaloneFrame.wait(); }
        return this;
    }

    /**
     * Collect an image from the context where this applet came from.
     * @param url source from which to fetch image
     * @return an image from the specified URL */
    public Image getImage(URL url)
    { return Toolkit.getDefaultToolkit().getImage(url); }

    /**
     * Collect an image from the context where this applet came from.
     * @param url source from which to fetch image
     * @param spec location within URL context
     * @return an image from the specified URL */
    public Image getImage(URL url, String spec) {
        Image result = null;
        try {
            result = getImage(new URL(url, spec));
        } catch (MalformedURLException ex) {}
        return result;
    }

    /**
     * A thin wrapper on top of {@link javax.sound.sampled.Clip}
     * to ease the transition from Java Applets. */
    public static class AudioClip {
        protected Clip clip;
        public AudioClip(Clip clip) { this.clip = clip; }
        public void play() { clip.setFramePosition(0); clip.start(); }
        public void loop() { clip.loop(clip.LOOP_CONTINUOUSLY); }
        public void stop() { clip.stop(); }
    }

    /**
     * Attempts to create an audio clip from sound data at the
     * specified URL. */
    public AudioClip getAudioClip(URL url, String spec) {
        AudioClip result = null;
        try {
            result = getAudioClip(new URL(url, spec));
        } catch (MalformedURLException ex) {}
        return result;
    }

    /**
     * Attempts to create an audio clip from sound data at the
     * specified URL. */
    public AudioClip getAudioClip(URL url)
    {
        try {
            Clip clip = AudioSystem.getClip();
            javax.sound.sampled.AudioInputStream stream =
                javax.sound.sampled.AudioSystem.
                getAudioInputStream(url);
            javax.sound.sampled.AudioFormat format = stream.getFormat();
            stream = javax.sound.sampled.AudioSystem.getAudioInputStream
                (new javax.sound.sampled.AudioFormat
                 (format.getSampleRate(), 16, format.getChannels(),
                  true, format.isBigEndian()), stream);
            clip.open(stream);
            return new AudioClip(clip);
        } catch (LineUnavailableException ex) {
            throw new RuntimeException(ex);
        } catch (UnsupportedAudioFileException ex) {
            throw new RuntimeException(ex);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    /**
     * Gets the URL base for documents associated with this
     * application. */
    public URL getDocumentBase() {
        try {
            return (new File(System.getProperty
                             ("user.dir"))).toURI().toURL();
        } catch(MalformedURLException e) { return null; }
    }

    /**
     * Gets the base URL that describes this application. */
    public URL getCodeBase() { return getDocumentBase(); }

    /**
     * Override to provide status of Applet activity.
     * Default is to always return true; */
    public boolean isActive() { return true; }

    /**
     * Responds with a value determined from command line arguments.
     * Each command line argument should be of this form:
     * <code>name=value</code> A call to this method with a name that
     * matches such an argument will get that value.  Otherwise this
     * method will return null, just as if no applet parameter with
     * that name had been specified. Note that a command line
     * parameter without an '=' character yields an empty string
     * instead of null. */
    public String getParameter(String name)
    { return argmap.containsKey(name) ? argmap.get(name) : null; }

    /**
     * Provides a description of this applet.  Default is to
     * return null. */
    public String getAppletInfo() { return null; }

    /**
     * Requests a status message to be displayed for user viewing. */
    public void showStatus(String status) { /* ignored */ }
}
