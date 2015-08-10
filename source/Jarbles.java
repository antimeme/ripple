// Jarbles.java
// Copyright (C) 2006-2015 by Jeff Gold.
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
    Thread gameThread = null;
    GraphicPlayer gpb = new GraphicPlayer();
    GraphicPlayer gpw = gpb;
    long time = 0;

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

    public void start() {
        if (gameThread == null) {
            gameThread = new Thread(this);
            gameThread.start();
            gpb.startElapseThread();
            if (gpb != gpw)
                gpw.startElapseThread();
        }
    }

    public void stop() {
        if (gameThread != null) {
            gameThread.interrupt();
            gameThread = null;
        }
    }

    public void actionPerformed(ActionEvent action) {
        String themeName =
            ((MenuItem)action.getSource()).getActionCommand();
        if (themeName.equals("Aqua"))
            gpb.setTheme(new Aqua());
        else gpb.setTheme(new GraphicPlayer.Theme());
    }

    /** Conduct an Abalone game and determine the winner. */
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
    public Dimension getPreferredSize() {
        return mergeDimensions
            (gpb.getPreferredSize(),
             (gpb != gpw) ? gpw.getPreferredSize() : null);
    }
    public Dimension getMinimumSize() {
        return mergeDimensions
            (gpb.getMinimumSize(),
             (gpb != gpw) ? gpw.getMinimumSize() : null);
    }

    private MenuItem createMenuItem(String label) {
        MenuItem result = new MenuItem(label);
        result.addActionListener(this);
        return result;
    }

    public static void main(String args[]) throws Exception {
        Jarbles jbls = new Jarbles();
        MenuBar mb = new MenuBar();
        Menu menuTheme = new Menu("Theme");
        menuTheme.add(jbls.createMenuItem("Basic"));
        menuTheme.add(jbls.createMenuItem("Aqua"));
        mb.add(menuTheme);

        Standalone.app(jbls, null, "images/jarbles.png", mb, args);
    }
}
