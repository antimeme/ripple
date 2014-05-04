// Standalone.java
// Copyright (C) 2007-2013 by Jeff Gold.
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
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
//
// Simulates the context of an applet so that the same code can
// operate outside an embedded environment.
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
import java.util.Enumeration;
import java.util.Iterator;
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
 *      public class ExampleApplet extends Applet {
 *          // ...
 *          public static void main(String[] args) {
 *              Standalone.app(new MyApplet(), null, null, args);
 *          }
 *      }
 *  </pre>
 */
public class Standalone implements AudioClip, AppletStub, AppletContext,
                                   WindowListener
{
    static final long serialVersionUID = 0;
    protected String arguments[];
    protected Clip clip;

    private static void app(Applet a, String title, Image icon,
                            String arguments[]) {
        Standalone s = new Standalone();
        s.arguments = arguments;
        Frame f = new Frame();
	f.add(a);
        a.setStub(s);
	a.init();
	a.start();
	f.pack(); // must happen after adding components

        if (icon != null)
            f.setIconImage(icon);
        if (title == null) { // class name is default title
            title = a.getClass().getName();
            title = title.substring(title.lastIndexOf(".") + 1);
        }
        f.setTitle(title);
	f.addWindowListener(s);
        f.setLocationRelativeTo(null); // center application
        f.setVisible(true);
    }

    public static void app(Applet a, String title, String icon_name,
                           String arguments[]) {
        Image icon = null;
        if (icon_name != null) {
            URL resource = a.getClass().getClassLoader()
                .getResource(icon_name);
            if (resource != null)
                icon = Toolkit.getDefaultToolkit().getImage(resource);
        }
        Standalone.app(a, title, icon, arguments);
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

    public static AudioClip createClip(URL resource) {
        Standalone result = new Standalone();
        try {
            result.clip = AudioSystem.getClip();
            result.clip.open(AudioSystem.getAudioInputStream(resource));
        } catch (LineUnavailableException ex) {
            throw new RuntimeException(ex);
        } catch (UnsupportedAudioFileException ex) {
            throw new RuntimeException(ex);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        return result;
    }

    // AppletStub methods
    public URL getDocumentBase() {
        try {
            return (new File(System.getProperty
                             ("user.dir"))).toURI().toURL();
        } catch(MalformedURLException e) { return null; }
    }
    public URL           getCodeBase() { return getDocumentBase(); }
    public boolean       isActive() { return true; }
    public AppletContext getAppletContext() { return this; }
    public void          appletResize(int width, int height) {}
    public String        getParameter(String name) {
        if (this.arguments != null) {
            for (int i = 0; i < this.arguments.length; i++) {
                String arg = this.arguments[i];
                int pivot = arg.indexOf('=');
                if ((pivot == name.length()) && arg.startsWith(name))
                    return arg.substring(pivot + 1);
            }
        }
        return null;
    }

    // AppletContext methods
    public Image getImage(URL url) {
        return Toolkit.getDefaultToolkit().getImage(url);
    }
    public AudioClip getAudioClip(URL url)
    { return createClip(url); }
    public Applet    getApplet(String name) { return null; }
    public Enumeration<Applet> getApplets() { return null; }
    public void showDocument(URL url)
    { throw new UnsupportedOperationException(); }
    public void showDocument(URL url, String target)
    { throw new UnsupportedOperationException(); }
    public void showStatus(String status) {}
    public void setStream(String key, InputStream stream) {}
    public Iterator<String> getStreamKeys()  { return null; }
    public InputStream getStream(String key) { return null; }

    // WindowListener methods
    public void windowActivated  (WindowEvent e) {}
    public void windowClosed     (WindowEvent e) {}
    public void windowClosing    (WindowEvent e) { System.exit(0); }
    public void windowDeactivated(WindowEvent e) {}
    public void windowDeiconified(WindowEvent e) {}
    public void windowIconified  (WindowEvent e) {}
    public void windowOpened     (WindowEvent e) {}
}
