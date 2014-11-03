// Standalone.java
// Copyright (C) 2007-2014 by Jeff Gold.
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
// Simulates the context of an applet so that the same code can
// operate outside an embedded environment without the complexity of
// an applet viewer application or an HTML file.
package net.esclat.ripple;
import java.applet.Applet;
import java.applet.AppletStub;
import java.applet.AppletContext;
import java.applet.AudioClip;
import java.awt.Frame;
import java.awt.Image;
import java.awt.Toolkit;
import java.awt.event.WindowListener;
import java.awt.event.WindowEvent;
import java.net.URL;
import java.net.MalformedURLException;
import java.io.InputStream;
import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.Vector;
import java.util.Enumeration;
import java.util.Iterator;
import java.util.Map;
import java.util.HashMap;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.UnsupportedAudioFileException;

/** <p>Simulates the context of an applet so that the same code can
 *  operate outside an embedded environment.</p>
 *
 *  <p>An applet can be made into an application simply by calling
 *  {@link #app} in its main method:</p>
 *
 *  <pre>
 *      // ...
 *      import net.esclat.ripple.Standalone;
 *
 *      public class ExampleApplet extends Applet {
 *          // ...
 *          public static void main(String[] args)
 *          { Standalone.app(new ExampleApplet(), args).joinQuit(0); }
 *      }
 *  </pre>
 */
public class Standalone
    implements AudioClip, AppletStub, AppletContext, WindowListener
{
    static final long serialVersionUID = 0;
    protected Applet active = null;
    protected Map<String,String> argmap = null;
    protected Clip clip;

    /** AudioClip contructor */
    protected Standalone(Clip clip) { this.clip = clip; }

    /** AppletStub contructor */
    protected Standalone(Applet a, String[] args)
    {
        if (args != null) {
            argmap = new HashMap<String,String>();
            for (int index = 0; index < args.length; ++index) {
                String arg = args[index];
                int pivot = arg.indexOf('=');
                if (pivot >= 0)
                    argmap.put(arg.substring(0, pivot).toLowerCase(),
                               arg.substring(pivot + 1));
                else argmap.put(arg.toLowerCase(), "");
            }
        }

        active = a;
        active.setStub(this);
    }

    // AudioClib methods
    public void loop() {
        if (clip != null)
            clip.loop(clip.LOOP_CONTINUOUSLY);
    }
    public void play() {
        if (clip != null) {
            clip.setFramePosition(0);
            clip.start();
        }
    }
    public void stop() { if (clip != null) clip.stop(); }

    // AppletStub methods
    public URL getDocumentBase() {
        try {
            return (new File(System.getProperty
                             ("user.dir"))).toURI().toURL();
        } catch(MalformedURLException e) { return null; }
    }
    public URL           getCodeBase() { return getDocumentBase(); }
    public boolean       isActive() { return active != null; }
    public AppletContext getAppletContext() { return this; }
    public void          appletResize(int width, int height) {}

    /**
     * Responds with a value determined from command line arguments.
     * Each command line argument should be of this form:
     * <q>name=value</q> A call to this method with a name that
     * matches such an argument will get that value.  Otherwise this
     * method will return null, just as if no applet parameter with
     * that name had been specified. Note that a command line
     * parameter without an '=' character yields an empty string
     * instead of null. */
    public String getParameter(String name)
    { return argmap.containsKey(name) ? argmap.get(name) : null; }

    // AppletContext methods
    public Image getImage(URL url)
    { return Toolkit.getDefaultToolkit().getImage(url); }
    public AudioClip getAudioClip(URL url)
    {
        try {
            Standalone result = new Standalone(AudioSystem.getClip());
            result.clip.open(AudioSystem.getAudioInputStream(url));
            return result;
        } catch (LineUnavailableException ex) {
            throw new RuntimeException(ex);
        } catch (UnsupportedAudioFileException ex) {
            throw new RuntimeException(ex);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }
    public Applet getApplet(String name) { return null; }
    public Enumeration<Applet> getApplets() {
        // There can only ever be one applet.  Perhaps at some point
        // it may make sense to permit this class to manage more than
        // one applet at a time.
        Vector<Applet> v = new Vector<Applet>();
        if (active != null)
            v.add(active);
        return Collections.enumeration(v);
    }
    public void showDocument(URL url)
    { throw new UnsupportedOperationException(); }
    public void showDocument(URL url, String target)
    { throw new UnsupportedOperationException(); }
    public void showStatus(String status) { /* ignored */ }
    public void setStream(String key, InputStream stream) {}
    public Iterator<String> getStreamKeys()  { return null; }
    public InputStream getStream(String key) { return null; }

    // WindowListener methods
    public void windowActivated  (WindowEvent e) {}
    public void windowDeactivated(WindowEvent e) {}
    public void windowDeiconified(WindowEvent e) {}
    public void windowIconified  (WindowEvent e) {}
    public void windowOpened     (WindowEvent e) {}
    public void windowClosed     (WindowEvent e) {}
    public void windowClosing    (WindowEvent e) { terminate(); }

    /**
     * Creates a standalone application.  This application will run
     * until something terminates it, but no non-daemon threads are
     * created.  This means that unless the calling application
     * continues or calls join on the return value the JVM may
     * terminate immediately, taking the application with it.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param icon application image
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app
        (Applet a, String title, Image icon, String[] args)
    {
        Frame f = new Frame();
        if (icon != null)
            f.setIconImage(icon);
        if (title == null) {
            title = a.getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
        }
        f.setTitle(title);

        Standalone result = new Standalone(a, args);
        f.add(a);
        f.pack();
        f.setLocationRelativeTo(null);
        a.init();
        f.addWindowListener(result);
        f.setVisible(true);
        a.start();
        return result;
    }

    /**
     * Creates a standalone application.  This application will run
     * until something terminates it, but no non-daemon threads are
     * created.  This means that unless the calling application
     * continues or calls join on the return value the JVM may
     * terminate immediately, taking the application with it.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param iconName path to image to load for icon
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app
        (Applet a, String title, String iconName, String[] args)
    {
        Image icon = null;
        if (iconName != null) {
            URL resource = a.getClass().getClassLoader()
                .getResource(iconName);
            if (resource != null)
                icon = Toolkit.getDefaultToolkit().getImage(resource);
        }
        return app(a, title, icon, args);
    }

    /**
     * Creates a standalone application.  This application will run
     * until something terminates it, but no non-daemon threads are
     * created.  This means that unless the calling application
     * continues or calls join on the return value the JVM may
     * terminate immediately, taking the application with it.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a, String title, String[] args)
    { return app(a, title, (Image)null, args); }

    /**
     * Creates a standalone application.  This application will run
     * until something terminates it, but no non-daemon threads are
     * created.  This means that unless the calling application
     * continues or calls join on the return value the JVM may
     * terminate immediately, taking the application with it.
     *
     * Note that the title in the application frame will be the
     * class name of the applet.
     *
     * @param a Applet to present
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a, String[] args)
    { return app(a, null, args); }

    /**
     * Blocks until the application is terminated.  Usually termination
     * is the result of a user clicking the close button on the frame
     * window decoration. */
    public synchronized Standalone join()
        throws InterruptedException
    {
        if (active != null)
            wait();
        return this;
    }

    /**
     * Blocks until the application is terminated and then terminates
     * the entire JVM. */
    public synchronized void joinQuit(int status)
        throws InterruptedException { join(); System.exit(status); }

    /** Signals the application to shut down. */
    public synchronized void terminate() {
        if (active != null) {
            if (active.isActive())
                active.stop();
            active.destroy();
            active = null;
            notifyAll();
        }
    }
}
