// Jarbles.java
// Copyright (C) 2006-2020 by Jeff Gold.
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
// An applet for containing a GraphicPlayer.  At some point this should
// evolve to support theme selection, artificial opponents, network play
// and so on.
package net.esclat.jarbles;
import net.esclat.ripple.Standalone;
import net.esclat.jarbles.abalone.Player;
import net.esclat.jarbles.abalone.Board;
import net.esclat.jarbles.abalone.GraphicPlayer;
import net.esclat.jarbles.abalone.Aqua;
import java.util.List;
import java.util.LinkedList;
import java.net.URL;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.applet.Applet;
import java.applet.AudioClip;
import java.awt.Graphics;
import java.awt.GridLayout;
import java.awt.Dimension;
import java.awt.MenuBar;
import java.awt.Menu;
import java.awt.MenuItem;
import java.awt.Container;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;

public class Jarbles extends Applet
    implements Runnable, ActionListener {
    static final long serialVersionUID = 0;
    protected final String ptheme = "theme:";
    Thread gameThread = null;
    GraphicPlayer gpb = new GraphicPlayer();
    GraphicPlayer gpw = gpb;
    long time = 0;

    /** Implements java.awt.Applet */
    public void init() {
        setLayout(new GridLayout());
        gpb.setContext(getAppletContext());
        add(gpb);

        try {
            if (Boolean.parseBoolean(getParameter("duel"))) {
                gpw = new GraphicPlayer();
                gpw.setContext(getAppletContext());
                add(gpw);
            }
        } catch (NumberFormatException ex) { /* ignored */ }

        try {
            time = 1000 * Long.parseLong(getParameter("time"));
        } catch (NumberFormatException ex) { /* ignored */ }
    }

    /** Implements java.awt.Applet */
    public void start() {
        if (gameThread == null) {
            gameThread = new Thread(this);
            gameThread.start();
            gpb.startElapseThread();
            if (gpb != gpw)
                gpw.startElapseThread();
        }
    }

    /** Implements java.awt.Applet */
    public void stop() {
        if (gameThread != null) {
            gameThread.interrupt();
            gameThread = null;
        }
    }

    /** Implements java.awt.event.ActionListener */
    public void actionPerformed(ActionEvent action) {
        String command = action.getActionCommand();

        if (command.startsWith(ptheme)) {
            try {
                Class<?> cls = Class.forName
                    (command.substring(ptheme.length()));
                Constructor cons = cls.getDeclaredConstructor();
                gpb.setTheme((GraphicPlayer.Theme)cons.newInstance());
            } catch (ClassNotFoundException ex) {
                System.out.println("Failed to find class: " + command);
            } catch (NoSuchMethodException ex) {
                System.out.println
                    ("Missing no-argument constructor: " + command);
            } catch (IllegalAccessException ex) {
                System.out.println
                    ("No public no-argument constructor: " + command);
            } catch (InvocationTargetException ex) {
                System.out.println
                    ("InstantionException? " + ex.getMessage());
            } catch (InstantiationException ex) {
                System.out.println
                    ("InstantionException? " + ex.getMessage());
            }
        }
    }

    /**
     * Implements java.lang.Runnable by conducting an Abalone game and
     * determining the winner. */
    public void run() {
        Board board = new Board();
        Board.Move move;
        Object status = Board.EMPTY;
        long currTime = time;
        long nextTime = time;
        Player currP  = gpb;
        Player nextP  = gpw;

        currP.setBoard(board, currTime, nextTime);
        nextP.setBoard(board, currTime, nextTime);
        while (!Thread.interrupted() && status == Board.EMPTY) {
            long clock = System.currentTimeMillis();
            move = currP.makeMove
                (null, board.blackToPlay() ? currTime : nextTime,
                 board.blackToPlay() ? nextTime : currTime);

            // Update the clock during timed games.
            if ((currTime > 0) || (nextTime > 0)) {
                currTime -= System.currentTimeMillis() - clock;
                if (currTime <= 0) {
                    status = board.blackToPlay() ?
                       Board.WHITE : Board.BLACK;
                    break;
                }
            }

            // Confirm that the move is valid and update the board.
            Board nextB = board.makeMove(move);
            if (nextB != null) {
                nextP.noteMove
                    (move, nextB.blackToPlay() ? nextTime : currTime,
                     nextB.blackToPlay() ? currTime : nextTime);

                Player p = currP;
                currP    = nextP;
                nextP    = p;

                long t = currTime;
                currTime = nextTime;
                nextTime = t;

                status = nextB.winner();
                board  = nextB;
            } else status = board.blackToPlay() ?
                       Board.WHITE : Board.BLACK;
        }
        // :TODO: do something with status
    }

    /** Implements java.awt.Component */
    public void update(Graphics g) { paint(g); }

    private Dimension mergeDimensions(Dimension a, Dimension b) {
        Dimension result = new Dimension(a.width, a.height);
        if (b != null) {
            result.width += b.width;
            if (b.height > result.height)
                result.height = b.height;
        }
        return result;
    }

    /** Implements java.awt.Component */
    public Dimension getPreferredSize() {
        return mergeDimensions
            (gpb.getPreferredSize(),
             (gpb != gpw) ? gpw.getPreferredSize() : null);
    }

    /** Implements java.awt.Component */
    public Dimension getMinimumSize() {
        return mergeDimensions
            (gpb.getMinimumSize(),
             (gpb != gpw) ? gpw.getMinimumSize() : null);
    }

    private List<Class> getThemes() {
        List<Class> themes = new LinkedList<Class>();
        try {
            URL resource = this.getClass().getClassLoader().
                getResource(".classes");
            if (resource != null) {
                BufferedReader in = new BufferedReader
                    (new InputStreamReader(resource.openStream()));
                String line;
                while ((line = in.readLine()) != null) {
                    line = line.trim();
                    if (line.length() == 0)
                        continue;
                    try {
                        Class<?> c = Class.forName(line);
                        c.asSubclass(GraphicPlayer.Theme.class);
                        themes.add(c);
                    } catch (ClassCastException ex) { /* ignored */
                    } catch (ClassNotFoundException ex) {
                        ex.printStackTrace(System.err);
                    }
                }
            } else System.err.println(this.getClass().getName() +
                                      ": .classes not found");
        } catch (IOException ex) {
            System.err.println(this.getClass().getName() +
                               ": .classes I/O");
            ex.printStackTrace(System.err);
        }
        return themes;
    }

    private MenuItem setupTheme(Class clazz) {
        MenuItem result = null;
        String themeName = null;
        try {
            Method method = clazz.getMethod("getName");
            themeName = (String)method.invoke(null);
            result = new MenuItem(themeName);
            result.setActionCommand(ptheme + clazz.getName());
            result.addActionListener(this);
        } catch (IllegalArgumentException ex) {
            ex.printStackTrace(System.err);
        } catch (IllegalAccessException ex) {
            ex.printStackTrace(System.err);
        } catch (InvocationTargetException ex) {
            ex.printStackTrace(System.err);
        } catch (SecurityException ex) {
            ex.printStackTrace(System.err);
        } catch (NoSuchMethodException ex) {
            ex.printStackTrace(System.err);
        }
        return result;
    }

    /**
     * Jarbles application entry point
     * @param args command line arguments
     * @throws Exception anything can happen */
    public static void main(String args[]) throws Exception {
        Jarbles jarbles = new Jarbles();
        MenuBar mb = new MenuBar();
        Menu menuTheme = new Menu("Theme");
        menuTheme.add(jarbles.setupTheme(GraphicPlayer.Theme.class));
        for (Class clazz : jarbles.getThemes())
            menuTheme.add(jarbles.setupTheme(clazz));
        mb.add(menuTheme);

        Standalone.app(jarbles, null, "images/jarbles.png", mb, args);
    }
}
