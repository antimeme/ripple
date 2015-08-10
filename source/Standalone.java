// Standalone.java
// Copyright (C) 2007-2015 by Jeff Gold.
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
 *          { Standalone.app(new ExampleApplet(), args); }
 *      }
 *  </pre>
 *
 * <p>
 *   An application which needs to perform some steps after the frame
 *   has been clsoed can use the {@link #join} on the return value to
 *   block until the user closes the application.
 * </p>
 */
public class Standalone
    implements AudioClip, AppletStub, AppletContext, WindowListener
{
    static final long serialVersionUID = 0;
    protected Frame appFrame = null;
    protected Applet applet = null;
    protected Map<String,String> argmap = null;
    protected Clip clip;

    /** AudioClip contructor */
    protected Standalone(Clip clip) { this.clip = clip; }

    /** AppletStub contructor */
    protected Standalone(Frame f, Applet a, String[] args)
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

        appFrame = f;
        applet = a;
        applet.setStub(this);
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
    public boolean       isActive() { return applet != null; }
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
        if (applet != null)
            v.add(applet);
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
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param icon application image
     * @param mb MenuBar to use for application
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a, String title, Image icon,
                                 MenuBar mb, String[] args)
    {
        Frame f = new Frame();
        if (icon != null)
            f.setIconImage(icon);
        if (title == null) {
            title = a.getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
        }
        f.setTitle(title);
        f.setMenuBar(mb);

        Standalone result = new Standalone(f, a, args);
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
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param iconName path to image to load for icon
     * @param mb MenuBar to use for application
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app
        (Applet a, String title, String iconName,
         MenuBar mb, String[] args)
    {
        Image icon = null;
        if (iconName != null) {
            URL resource = a.getClass().getClassLoader()
                .getResource(iconName);
            if (resource != null)
                icon = Toolkit.getDefaultToolkit().getImage(resource);
        }
        return app(a, title, icon, mb, args);
    }

    /**
     * Creates a standalone application.  This application will run
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param iconName path to image to load for icon
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a, String title,
                                 String iconName, String[] args)
    {
        Image icon = null;
        if (iconName != null) {
            URL resource = a.getClass().getClassLoader()
                .getResource(iconName);
            if (resource != null)
                icon = Toolkit.getDefaultToolkit().getImage(resource);
        }
        return app(a, title, icon, null, args);
    }

    /**
     * Creates a standalone application.  This application will run
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
     *
     * @param a Applet to present
     * @param title displayed as frame title
     * @param args command line arguments
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a, String title, String[] args)
    { return app(a, title, (Image)null, null, args); }

    /**
     * Creates a standalone application.  This application will run
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
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
     * Creates a standalone application.  This application will run
     * until something calls {@link #terminate} or a user clicks the
     * close icon in the window decoration.
     *
     * Note that the title in the application frame will be the
     * class name of the applet.
     *
     * @param a Applet to present
     * @return an AppletContext which can be used terminate or join */
    public static Standalone app(Applet a)
    { return app(a, null, null); }

    /**
     * Blocks until the application is terminated.  Usually termination
     * is the result of a user clicking the close button on the frame
     * window decoration. */
    public synchronized Standalone join()
        throws InterruptedException
    {
        while (applet != null)
            wait();
        return this;
    }

    /** Signals the application to shut down. */
    public synchronized void terminate() {
        if (applet != null) {
            if (applet.isActive())
                applet.stop();
            applet.destroy();
            applet = null;
        }
        if (appFrame != null) {
            appFrame.setVisible(false);
            appFrame.dispose();
            appFrame = null;
        }
        notifyAll();
    }
}
