// GraphicPlayer.java
// Copyright (C) 2006-2013 by Jeff Gold.
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
// A lightweight component that provides a complete user interface for
// playing Abalone.
package net.esclat.jarbles.abalone;
import net.esclat.ripple.HexagonGrid;
import java.applet.AppletContext;
import java.applet.AudioClip;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.Dimension;
import java.awt.Rectangle;
import java.awt.Point;
import java.awt.event.ComponentListener;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseEvent;

// Dependencies needed only for module unit test.
import java.awt.Frame;
import java.awt.GridLayout;
import java.awt.event.WindowEvent;
import java.awt.event.WindowAdapter;

/** A lightweight component that provides a complete user interface
 *  for playing Abalone.  Double buffering, animation and custom
 *  themes are supported. */
public class GraphicPlayer extends Component
    implements ComponentListener, MouseListener, Runnable, Player {
    static final long serialVersionUID = 0;

    /** Represents a range of pieces selected for a potential move. */
    private static class Selection implements Cloneable {
        private int rowL, colL, rowH, colH;
        private boolean empty = true;

        private Board.Move tryMove(Board board, int rowD, int colD) {
            final int size = 5;
            Board.Move m = new Board.Move((byte)(rowL + size),
                                          (byte)(colL + size),
                                          (byte)(rowH + size),
                                          (byte)(colH + size),
                                          (byte)(rowH + rowD + size),
                                          (byte)(colH + colD + size));
            return board.isLegalMove(m) ? m : null;
        }

        /** Makes this selection empty. */
        void clear()  { empty = true; }
        int getRowL() { return rowL; }
        int getColL() { return colL; }
        int getRowH() { return rowH; }
        int getColH() { return colH; }

        /** Returns true if and only if the specified board location
         *  is currently selected. */
        boolean isSelected(int row, int col) {
            if (empty) return false;
            int rowC = row - rowL;
            int colC = col - colL;
            if ((rowC >= 0) && (rowC <= rowH - rowL) &&
                (colC >= 0) && (colC <= colH - colL) &&
                ((rowL == rowH) || (colL == colH) ||
                 (rowC == colC)))
                return true;
            return false;
        }

        /** Returns a move based on the current selection and the
         *  specified row and column delta values. */;
        Board.Move getMove(Board board, int rowD, int colD) {
            if (empty)
                return null;
            return tryMove(board, rowD, colD);
        }
	
        /** Process the effect of a single click on the selection. */
        Board.Move click(Board board, Board.Location loc) {
            return click(board, loc.row, loc.col);
        }

        /** Process the effect of a single click on the selection. */
        Board.Move click(Board board, int row, int col) {
            if (board.activePosition((byte)(row + 5),
                                     (byte)(col + 5))) {
                if (empty) {
                    rowL = rowH = row;  colL = colH = col;
                    empty = false;
                } else if (((row == rowL) && (col == colL)) ||
                           ((row == rowH) && (col == colH))) {
                    empty = true;
                } else {
                    int rowS = rowL;  int colS = colL;
                    int rowE = rowH;  int colE = colH;

                    int count = 0;
                    count = board.sizeLegalGroup((byte)(rowS + 5),
                                                 (byte)(colS + 5),
                                                 (byte)(row + 5),
                                                 (byte)(col + 5));
                    if (board.sizeLegalGroup((byte)(rowE + 5),
                                             (byte)(colE + 5),
                                             (byte)(row + 5),
                                             (byte)(col + 5)) > count) {
                        rowS = row;  colS = col;
                    } else if (count > 0) {
                        rowE = row;  colE = col;
                    } else { rowS = rowE = row;  colS = colE = col; }
                    rowL = Math.min(rowS, rowE);
                    colL = Math.min(colS, colE);
                    rowH = Math.max(rowS, rowE);
                    colH = Math.max(colS, colE);
                }
            } else if (empty == false) {
                // Consider the direction to be from the start of the
                // selection to the target, unless this would be
                // impossible because of distance or the wrong axis.
                Board.Move m;
                int rowD = row - rowL;
                int colD = col - colL;
                if (((m = tryMove(board, rowD, colD)) == null) &&
                    ((rowL != rowH) || (colL != colH))) {
                    rowD = row - rowH;
                    colD = col - colH;
                    m = tryMove(board, rowD, colD);
                }
                if (m == null)
                    empty = true;
                return m;
            }
            return null;
        }

        public boolean equals(Object that) {
            boolean result = false;
            if (this == that) {
                result = true;
            } else if (that == null) {
                result = false;
            } else if (that.getClass().equals(getClass())) {
                Selection s = (Selection)that;
                if (!empty) {
                    result = (!s.empty &&
                              (s.rowL == rowL) && (s.colL == colL) &&
                              (s.rowH == rowH) && (s.colH == colH));
                } else result = s.empty;
            }
            return result;
        }
        
        public Object clone() {
            try { return super.clone(); }
            catch (CloneNotSupportedException e) {
                throw new RuntimeException(e);
            }
        }
    }

    /** Represents a group of pieces in motion. */
    private static class Animation implements Cloneable {
        private int   rowL, colL, rowH, colH, rowD, colD;
        private float progress;
        private Board board;

        Animation(Board b, Board.Move m) {
            progress = 0.0f;
            board = b.makeMove(m);
            rowD = m.getRowD();
            colD = m.getColD();

            // Start boundaries at sorted extremes of move.
            rowL = Math.min(m.getRowS() - 5, m.getRowE() - 5);
            colL = Math.min(m.getColS() - 5, m.getColE() - 5);
            rowH = Math.max(m.getRowS() - 5, m.getRowE() - 5);
            colH = Math.max(m.getColS() - 5, m.getColE() - 5);
            if (m.isLinear()) {
                int rowT;  int colT;
                if ((rowD <= 0) && (colD <= 0)) {
                    rowT = rowL;  colT = colL;
                } else { rowT = rowH;  colT = colH; }
		
                // Determine the number of cells affected including
                // the final destination of the last piece so that
                // the bounds of this animation will include every
                // cell that will need to be redrawn.
                int count  = m.getCount();
                int pushes = 0;
                while (pushes < count) {
                    int rowX = rowD * (pushes + 1);
                    int colX = colD * (pushes + 1);
		    
                    Object current = b.atPosition(rowT + rowX + 5,
                                                  colT + colX + 5);
                    if ((current == Board.EMPTY) ||
                        (current == Board.GUTTER))
                        break;
                    pushes++;
                }
                rowL += Math.min(0, rowD * pushes);
                colL += Math.min(0, colD * pushes);
                rowH += Math.max(0, rowD * pushes);
                colH += Math.max(0, colD * pushes);
            }
        }

        /** Returns true if the specified position is part of the
         *  animation in progress. */
        boolean contains(int row, int col) {
            int rowC = row - rowL;
            int colC = col - colL;
            return ((rowC >= 0) && (rowC <= rowH - rowL) &&
                    (colC >= 0) && (colC <= colH - colL) &&
                    ((rowL == rowH) || (colL == colH) ||
                     (rowC == colC)));
        }
	
        float getProgress()        { return progress; }
        float setProgress(float p) { return progress = p; }
        int   getRowD()            { return rowD; }
        int   getColD()            { return colD; }
        int   getRowL()            { return rowL; }
        int   getColL()            { return colL; }
        int   getRowH()            { return rowH; }
        int   getColH()            { return colH; }

        public boolean equals(Object that) {
            boolean result = false;
            if (this == that) {
                result = true;
            } else if (that == null) {
                result = false;
            } else if (that.getClass().equals(getClass())) {
                Animation a = (Animation)that;
                result = ((a.rowL == rowL) && (a.colL == colL) &&
                          (a.rowH == rowH) && (a.colH == colH) &&
                          (a.rowD == rowD) && (a.colD == colD) &&
                          (a.progress == progress) &&
                          (a.board == board));
            }
            return result;
        }
        
        public Object clone() {
            try { return super.clone(); }
            catch (CloneNotSupportedException e) {
                throw new RuntimeException(e);
            }
        }
    }

    /** An engine for customizing the appearance of a GraphicPlayer. */
    public static class Theme {
        protected long duration   =  500; // millisecond animation time
        protected long resolution = 1000; // millisecond clock precision

        protected double pieceAdjust = 1.125;
        protected double cellAdjust  = 0.925;

        // Fonts and Colors
        protected String fontName      = "SansSerrif";
        protected Color  background    = Color.lightGray;
        protected Color  pieceWhite    = new Color(240, 240, 240);
        protected Color  pieceBlack    = new Color(40, 40, 40);
        protected Color  upperWhite    = Color.white;
        protected Color  upperBlack    = Color.white;
        protected Color  lowerWhite    = Color.black;
        protected Color  lowerBlack    = Color.black;
        protected Color  cellHighOuter = Color.darkGray;
        protected Color  cellLowOuter  = Color.gray;
        protected Color  cellHighInner = Color.black;
        protected Color  cellLowInner  = Color.white;
        protected Color  scoreBacking  = Color.black;
        protected Color  scoreText     = Color.lightGray;

        protected String lineOne = "Jarbles";
        protected String lineTwo = "by Jeff Gold";

        // Representation Data
        protected Rectangle region = null;
        protected Rectangle boardR = null;
        protected Rectangle moveR  = null;
        protected Rectangle scoreR = null;
        protected HexagonGrid boardQ = new HexagonGrid();
        protected HexagonGrid moveQ  = new HexagonGrid();
        protected Font font = null;

        // Sounds
        protected AudioClip sound_move = null;

        public void setContext(AppletContext ctx) {
            sound_move = ctx.getAudioClip
                (getClass().getClassLoader().getResource
                 ("sounds/clickclack.wav"));
        }

        public void beginMove() {
            if (sound_move != null)
                sound_move.play();
        }

        /** Must be called before any paint event and after any
         *  resize event. */
        public void reshape(Dimension dim) {
            region = new Rectangle(0, 0, dim.width, dim.height);
            boardR        = (Rectangle)region.clone();
            boardR.width  = 3 * boardR.width / 4;
            moveR         = (Rectangle)region.clone();
            moveR.x       = 3 * moveR.width / 4;
            moveR.width   = moveR.width / 4;
            moveR.height  = 9 * moveR.height / 25;
            scoreR        = (Rectangle)region.clone();
            scoreR.x      = 3 * scoreR.width / 4;
            scoreR.y      = 9 * scoreR.height / 25;
            scoreR.width  = scoreR.width / 4;
            scoreR.height = 16 * scoreR.height / 25;

            boardQ.reshape(boardR, 5, true);
            moveQ.reshape(moveR, 2, true);	    
            font = new Font(fontName, Font.PLAIN, 
                            Math.min(scoreR.height / 12, 
                                     scoreR.width / 7));
        }
        public Rectangle getBoardR() { return boardR; }
        public Rectangle getMoveR()  { return moveR;  }
        public Rectangle getScoreR() { return scoreR; }

        /** Return clock precision in milliseconds. */
        public long getResolution() { return resolution; }

        /** Advance a progress indicator based on elapsed time.  This
         *  moves in a linear manner by default but could be changed
         *  for customized themes.
         *
         *  @param progress Current state.
         *  @param elapsed Milliseconds since last update. */
        public float elapse(float progress, long elapsed) {
            return progress + (elapsed / (float)duration);
        }

        /** Draws a single cell of the sort one finds on a board.
         *  This is a raw method meant to be used by others that will
         *  do clever things to make the size right. */
        protected void drawCell(Graphics g, Point p, int size) {
            double adjSize = (int)(size * cellAdjust);
            double edge = adjSize;
            double half = adjSize / 2;
            double perp = adjSize * HexagonGrid.PERPENDICULAR;
	    
            // derive points on hexagon
            Point p1 = new Point((int)(p.x + perp), (int)(p.y - half));
            Point p2 = new Point((int)(p.x + perp), (int)(p.y + half));
            Point p3 = new Point((int)(p.x),        (int)(p.y + edge));
            Point p4 = new Point((int)(p.x - perp), (int)(p.y + half));
            Point p5 = new Point((int)(p.x - perp), (int)(p.y - half));
            Point p6 = new Point((int)(p.x),        (int)(p.y - edge));
	    
            // draw the outer shell
            g.setColor(cellHighOuter);
            g.drawLine(p4.x, p4.y, p5.x, p5.y);
            g.drawLine(p5.x, p5.y, p6.x, p6.y);
            g.drawLine(p6.x, p6.y, p1.x, p1.y);
            g.setColor(cellLowOuter);
            g.drawLine(p1.x - 1, p1.y, p2.x - 1, p2.y);
            g.drawLine(p2.x, p2.y - 1, p3.x, p3.y - 1);
            g.drawLine(p3.x, p3.y - 1, p4.x, p4.y - 1);
	    
            // draw the inner shell
            g.setColor(cellHighInner);
            g.drawLine(p4.x + 1, p4.y, p5.x + 1, p5.y);
            g.drawLine(p5.x, p5.y + 1, p6.x, p6.y + 1);
            g.drawLine(p6.x, p6.y + 1, p1.x, p1.y + 1);
            g.setColor(cellLowInner);
            g.drawLine(p1.x, p1.y, p2.x, p2.y);
            g.drawLine(p2.x, p2.y, p3.x, p3.y);
            g.drawLine(p3.x, p3.y, p4.x, p4.y);
        }

        /** Draws a grid of cells with specified number of cells along
         *  each edge. */
        protected void drawGrid(Graphics g, HexagonGrid q) {
            // Draw each cell.
            int size = q.getGridEdge();
            for (int row = 1 - size; row < size; row++) {
                for (int col = Math.max(0, row) - size + 1; 
                     col < Math.min(row, 0) + size; col++) {
                    Point gridP;
		    
                    gridP = q.getGridPoint(row, col);		
                    drawCell(g, gridP, q.getCellEdge());
                }
            }
        }

        /** Draws a single game piece.  This is a raw method meant to
         *  be used by others that will do clever things to make the
         *  size right. */
        protected void drawPiece(Graphics g, Point p, int size,
                                 boolean isBlack, boolean isSelected) {
            double adjSize = size * pieceAdjust;
            Point c = new Point((int)(p.x - (adjSize / 2)), 
                                (int)(p.y - (adjSize / 2)));
	    
            Color upper, lower, middle;
            if (isBlack) {
                middle = pieceBlack;
                if (isSelected) {
                    upper  = lowerBlack;
                    lower  = upperBlack;
                } else {
                    upper  = upperBlack;
                    lower  = lowerBlack;
                }
            } else {
                middle = pieceWhite;
                if (isSelected) {
                    upper  = lowerWhite;
                    lower  = upperWhite;
                } else {
                    upper  = upperWhite;
                    lower  = lowerWhite;
                }
            }
	    
            int roundSize = (int)adjSize;
            g.setColor(middle);
            g.fillOval(c.x, c.y, roundSize, roundSize);
            g.setColor(upper);
            g.drawArc(c.x, c.y - 1, roundSize, roundSize, 30, 180);
            g.drawArc(c.x, c.y, roundSize, roundSize, 30, 180);
            g.setColor(lower);
            g.drawArc(c.x, c.y, roundSize, roundSize, 30, -180);
            g.drawArc(c.x, c.y + 1, roundSize, roundSize, 30, -180);
        }

        protected void drawMoving(Graphics g, int rowS, int colS,
                                  int rowD, int colD, float progress,
                                  boolean isBlack) {
            Point p = boardQ.getGridPoint(rowS, colS);
            Point q = boardQ.getGridPoint(rowS + rowD, colS + colD);
            p.x += (int)((q.x - p.x) * progress);
            p.y += (int)((q.y - p.y) * progress);
            drawPiece(g, p, boardQ.getCellEdge(), isBlack, false);
        }

        public Board.Location getMoveLocation(Point p) {
            HexagonGrid.Location qloc = moveQ.getLocation(p, true);
            if (qloc == null) return null;
            return new Board.Location((byte)qloc.row, (byte)qloc.col);
        }
        public Board.Location getBoardLocation(Point p) {
            HexagonGrid.Location qloc = boardQ.getLocation(p, true);
            if (qloc == null) return null;
            return new Board.Location((byte)qloc.row, (byte)qloc.col);
        }

        /** Returns a string representing the given time value. */
        protected String getTime(String prefix, long time) {
            StringBuffer buffer = new StringBuffer(prefix);
            if (time > 0) {
                long hours = (time / (60 * 60 * 1000));
                buffer.append(hours);
                buffer.append(':');
                long minutes = (time / (60 * 1000)) % 60;
                if (minutes < 10) 
                    buffer.append('0');
                buffer.append(minutes);
                buffer.append(':');
                long seconds = (time / 1000) % 60;
                if (seconds < 10) 
                    buffer.append('0');
                buffer.append(seconds);
            } else buffer.append("0:00:00");
            return buffer.toString();
        }

        /** Display a centered line of text. */
        protected void drawScoreText(Graphics g, Rectangle scoreR,
                                     FontMetrics fm, int position,
                                     String text) {
            int height = fm.getHeight();
            int xpos = (scoreR.width - fm.stringWidth(text)) / 2;
            int ypos = (position >= 0) ? height * position :
                scoreR.height + height +
                (position * (height + fm.getDescent()));
            g.drawString(text, scoreR.x + xpos, scoreR.y + ypos);
        }

        /** Display current clock values and captured pieces. */
        protected void drawScore(Graphics g, Rectangle scoreR, 
                                 boolean enabled,
                                 int scoreBlack, int scoreWhite,
                                 long timeBlack, long timeWhite) {
            g.setFont(font);
            FontMetrics fm = g.getFontMetrics();
            int size = 2 * (fm.getHeight() + fm.getDescent());

            g.setColor(scoreBacking);
            g.fillRect(scoreR.x, scoreR.y, scoreR.width, size);
            g.fillRect(scoreR.x, scoreR.y + (scoreR.height - size), 
                       scoreR.width, size);

            g.setColor(scoreText);
            drawScoreText(g, scoreR, fm, 1, lineOne);
            drawScoreText(g, scoreR, fm, 2, lineTwo);
            drawScoreText(g, scoreR, fm, -2,
                          getTime("Black ", timeBlack));
            drawScoreText(g, scoreR, fm, -1,
                          getTime("White ", timeWhite));

            for (int i = 0; i < scoreBlack; i++)
                drawPiece(g, new Point(scoreR.x + (scoreR.width / 3),
                                       scoreR.y + size + 
                                       ((scoreR.height - (2 * size)) *
                                        (i + 1) / (scoreBlack + 1))), 
                          moveQ.getCellEdge(), false, false);
            for (int i = 0; i < scoreWhite; i++)
                drawPiece(g, new Point(scoreR.x + 
                                       (2 * scoreR.width / 3),
                                       scoreR.y + size + 
                                       ((scoreR.height - (2 * size)) *
                                        (i + 1) / (scoreWhite + 1))), 
                          moveQ.getCellEdge(), true, false);
        }

        /** Returns a rectangle that should completely enclose the
         *  area between the two board locations. */
        public Rectangle getBounds(int rowS, int colS, 
                                   int rowE, int colE) {
            Point p = boardQ.getGridPoint(rowS, colS);	
            Point q = boardQ.getGridPoint(rowE, colE);
            int size = (int)(2.5 * boardQ.getCellEdge());
	    
            Rectangle result = new Rectangle();
            result.x = Math.min(p.x, q.x) - size;
            result.y = Math.min(p.y, q.y) - size;
            result.width  = Math.abs(q.x - p.x) + (2 * size);
            result.height = Math.abs(q.y - p.y) + (2 * size);
            return result;
        }
        public Rectangle getBounds(Selection s) {
            return getBounds(s.getRowL(), s.getColL(),
                             s.getRowH(), s.getColH());
        }
        public Rectangle getBounds(Animation a) {
            return getBounds(a.getRowL(), a.getColL(),
                             a.getRowH(), a.getColH());
        }

        protected void drawBoardGrid(Graphics g, boolean enabled) {
            drawGrid(g, boardQ);         
        }
        protected void drawBoardPiece(Graphics g, boolean enabled, 
                                      int row, int col,
                                      Selection s, Animation a,
                                      boolean isBlack) {
            if ((a != null) && a.contains(row, col))
                drawMoving(g, row, col, a.getRowD(), a.getColD(), 
                           a.getProgress(), isBlack);
            else drawPiece(g, boardQ.getGridPoint(row, col), 
                           boardQ.getCellEdge(), isBlack, 
                           s.isSelected(row, col));
        }
    
        protected void drawMoveGrid(Graphics g, boolean enabled, 
                                    boolean isBlack) {
            drawGrid(g, moveQ);
            if (enabled)
                drawPiece(g, moveQ.getGridPoint(0, 0), 
                          moveQ.getCellEdge(), isBlack, true);
        }
        protected void drawMovePiece(Graphics g, boolean enabled, 
                                     int row, int col, 
                                     boolean isBlack) {
            drawPiece(g, moveQ.getGridPoint(row, col), 
                      moveQ.getCellEdge(), isBlack, false);
        }

        /** Display the specified board. */
        public void draw(Graphics g, Board b, boolean enabled,
                         long timeBlack, long timeWhite,
                         Selection s, Animation a) {
            g.setColor(background);
            g.fillRect(0, 0, region.width, region.height);	    
            drawScore(g, scoreR, enabled, 
                      b.getBlackScore(), b.getWhiteScore(), 
                      timeBlack, timeWhite);

            int size;
            Object winner = b.winner();
            if (winner == Board.EMPTY) { 
                if ((timeBlack > 0) && (timeWhite == 0))
                    winner = Board.BLACK;
                if ((timeBlack == 0) && (timeWhite > 0))
                    winner = Board.WHITE;
            }

            drawMoveGrid(g, enabled, b.blackToPlay());
            size = 2;
            for (int row = 1 - size; row < size; row++)
                for (int col = Math.max(0, row) - (size - 1); 
                     col < Math.min(row, 0) + size; col++)
                    if ((row != 0) || (col != 0)) {
                        if (winner == Board.BLACK)
                            drawMovePiece(g, enabled, row, col, true);
                        else if (winner == Board.WHITE)
                            drawMovePiece(g, enabled, row, col, false);
                        else if (s.getMove(b, row, col) != null)
                            drawMovePiece(g, enabled, row, col,
                                          b.blackToPlay());
                    }
            drawBoardGrid(g, enabled);
            size = 5;
            for (int row = 1 - size; row < size; row++)
                for (int col = Math.max(0, row) - (size - 1); 
                     col < Math.min(row, 0) + size; col++) {
                    Object current = b.atPosition(row + size, 
                                                  col + size);
                    if ((current == Board.BLACK) ||
                        (current == Board.WHITE))
                        drawBoardPiece(g, enabled, row, col,
                                       s, a, current == Board.BLACK);
                }
        }
    }

    private Board      board;    // board state to display
    private Board.Move lastMove; // most recently posted move
    private long  timeBlack; // milliseconds left for black player
    private long  timeWhite; // milliseconds left for white player
    private long  timeLast;  // timestamp when elapsed() last called

    private boolean   enabled;   // player can make a move when true
    private boolean   animated;  // pieces move gradually when true
    private Animation animation; // represents current animation state
    private Selection selection; // represents currently selected pieces

    private Image     buffer;  // backing store for double buffering
    private Theme     theme;   // implements visual details
    private Theme     retheme; // replace theme with this one

    /** Creates a graphic player. */
    public GraphicPlayer(Theme t, Board b) {
        buffer = null;
        addComponentListener(this);
        addMouseListener(this);

        enabled   = false;
        animated  = true;
        animation = null;
        selection = new Selection();
        lastMove  = null;

        theme = t;
        board = b;
        timeBlack = timeWhite = 0;
        timeLast  = System.currentTimeMillis();
    }
    /** Creates a graphic player with default board. */
    public GraphicPlayer(Theme t) { this(t, new Board()); }
    /** Creates a graphic player with default theme. */
    public GraphicPlayer(Board b) { this(new Theme(), b); }
    /** Creates a graphic player with default theme and board. */
    public GraphicPlayer()
    { this(new Theme(), new Board()); }

    /** Configures themes with any necessary sound clips. */
    public GraphicPlayer setContext(AppletContext ctx)
    { theme.setContext(ctx); return this; }

    public boolean getAnimated() { return animated; }
    public void    setAnimated(boolean value) { animated = value; }
    public Theme   getTheme() { return theme; }
    public void    setTheme(Theme t) { 
        retheme = t;
        repaint();
    }

    /** Launches a thread to call the {@link #elapse()}
     *  method on this object every few hundred milliseconds.  Unless
     *  this method is called the creator of this class should do so
     *  itself to ensure that animations and clock values are updated.
     *  The return value can be ignored or interrupted to shut it
     *  down. */
    public Thread startElapseThread() {
        Thread result = new Thread(this);
        result.setDaemon(true);
        result.start();
        return result;
    }

    /** Continuously updates time counters and animation. */
    public void run() {
        final long interval = 50; // millisecond loop delay
        while (Thread.interrupted() == false) {
            try { Thread.sleep(interval); }
            catch (InterruptedException e) { break; }
            elapse();
        }
    }

    /** Update animation and timers.  This method should be called
     *  about eight times per second for best results. */
    public void elapse() { elapse(System.currentTimeMillis()); }

    /** Update animation and timers.  This method should be called
     *  about eight times per second for best results.  When the
     *  calling program already has the current time for other
     *  reasons there is no need for elapse to request it again. */
    public synchronized void elapse(long timeNow) {
        long elapsed = timeNow - timeLast;
        timeLast = timeNow;
	
        Board b;
        if (animation != null) { // process animation progress
            b = animation.board;
            repaint(theme.getBounds(animation));
            if (animation.setProgress(theme.elapse
                                      (animation.getProgress(),
                                       elapsed)) >= 1.0f) {
                if ((board.getBlackScore() != b.getBlackScore()) ||
                    (board.getWhiteScore() != b.getWhiteScore()))
                    repaint(theme.getScoreR());
                board = b;
                animation = null;
                selection.clear();
                repaint(theme.getMoveR());
            }
        } else b = board;
	
        if ((b.winner() == Board.EMPTY) && 
            (timeBlack > 0) && (timeWhite > 0)) {
            long timeBefore;
            long timeAfter;
            if (b.blackToPlay()) {
                timeBefore = timeBlack;
                timeAfter  = timeBlack =
                    Math.max(0, timeBlack - elapsed);
            } else {
                timeBefore = timeWhite;
                timeAfter  = timeWhite =
                    Math.max(0, timeWhite - elapsed);
            }
            if ((timeAfter == 0) && (timeBefore > 0)) {
                lastMove = null;
                enabled = false;
                notifyAll();
                repaint();
            } else if ((timeBefore / theme.getResolution()) >
                       (timeAfter  / theme.getResolution()))
                repaint(theme.getScoreR());
        }
    }

    private void repaint(Rectangle rect) {
        if (rect != null)
            repaint((rect.x < 0) ? 0 : rect.x,
                    (rect.y < 0) ? 0 : rect.y, 
                    rect.width, rect.height);
    }

    public void update(Graphics g) { paint(g); }
    public void paint(Graphics g) { 
        Graphics guff;
        Dimension dim;
        Animation a = null;
        Board b;
        synchronized (this) {
            if (retheme != null) {
                theme = retheme;
                retheme = null;
            }
            b = board;
            if (animation != null)
                a = (Animation)animation.clone();
            dim = getSize();
            if (buffer == null) {
                buffer = createImage(dim.width, dim.height);
                theme.reshape(dim);
            }
            guff = buffer.getGraphics();
        }
        theme.draw(guff, b, (a == null) && enabled, 
                   timeBlack, timeWhite, selection, a);
        g.drawImage(buffer, 0, 0, dim.width, dim.height, null);
    }

    public Dimension getPreferredSize() {
        return new Dimension(640, 420);
    }
    public Dimension getMinimumSize() {
        return new Dimension(192, 126);
    }

    /** Change the internal board representation by applying the
     *  specified move, changing the current animation if necessary.
     *  This must be called within a synchrononized block. */
    private void applyMove(Board.Move m) {
        Board b = (animation != null) ? animation.board : board;
        if (!animated) {
            animation = null;  
            board = b.makeMove(m); 
        } else {
            animation = new Animation(b, m);
            board = b;
            theme.beginMove();
        }
    }

    /** Use the specfied move as the answer to a {@link Player.makeMove}
     *  request and update internal state as necessary. */
    private void postMove(Board.Move m) {
        if (m != null) {
            applyMove(m);
            lastMove = m;
            enabled = false;
            notifyAll();
        }
    }
    
    public synchronized void setBoard(Board b, long tB, long tW) {
        board = (b != null) ? b : new Board();
        timeBlack = tB;
        timeBlack = tW;
        animation = null;
        lastMove  = null;
        selection.clear();
        repaint();
        notifyAll();
    }

    public synchronized void noteMove(Board.Move m, long tB, long tW) {
        timeBlack = tB;
        timeWhite = tW;
        enabled   = false;
        selection.clear();
        if ((lastMove == null) || (!lastMove.equals(m)))
            applyMove(m);
    }

    public synchronized Board.Move makeMove(Board.Move m,
                                            long tB, long tW) {
        timeBlack = tB;
        timeWhite = tW;
        if ((m != null) && ((lastMove == null) || 
                            (!lastMove.equals(m))))
            applyMove(m);
        enabled = true;
        try { wait(); } catch (InterruptedException e)
            { Thread.currentThread().interrupt(); }
        return lastMove;
    }

    public void componentHidden(ComponentEvent e) {}
    public void componentMoved(ComponentEvent e) {}
    public synchronized void componentResized(ComponentEvent e) {
        buffer = null;
        repaint();
    }
    public void componentShown(ComponentEvent e) {}
    public void mouseClicked(MouseEvent e) {} 
    public void mouseEntered(MouseEvent e) {}
    public void mouseExited(MouseEvent e) {}
    public void mousePressed(MouseEvent e) {}
    public synchronized void mouseReleased(MouseEvent e) {
        Point p = e.getPoint();
        int pressed = e.getButton();
        if (pressed == MouseEvent.BUTTON1) {
            if (enabled && (animation == null)) {
                Board.Location loc;
                if ((loc = theme.getBoardLocation(p)) != null) {
                    Selection old = (Selection)selection.clone();
                    postMove(selection.click(board, loc));
                    if (!selection.equals(old)) {
                        repaint(theme.getBounds(selection));
                        repaint(theme.getBounds(old));
                        repaint(theme.getMoveR());
                    }
                } else if ((loc = theme.getMoveLocation(p)) != null) {
                    if ((loc.row == 0) && (loc.col == 0)) {
                        selection.clear();
                        repaint(theme.getBoardR());
                    } else postMove(selection.getMove(board, loc.row, 
                                                      loc.col));
                    repaint(theme.getMoveR());
                }
            }
        }
    }
    
    /** Performs module unit tests.  Arguments can be chosen
     *  from among the following: 
     *  
     *  <ul>
     *    <li>single    - use one board for both players (default)</li>
     *    <li>duel      - show two boards side by side</li>
     *    <li>animate   - animate moves (default)</li>
     *    <li>quick     - move pieces instantaneously</li>
     *    <li>&lt;seconds&gt; - give each side this amount of time</li>
     *    <li>0         - game is untimed</li>
     *  </ul>
     *
     *  A graphical game of abalone should ensue. */
    public static void main(String args[]) {
        // Parse command line arguments.
        long    time = 0;
        boolean duel = false;
        boolean anim = true;
        for (int argc = 0; argc < args.length; argc++) {
            if (args[argc].equals("single"))
                duel = false;
            else if (args[argc].equals("duel"))
                duel = true;
            else if (args[argc].equals("animate"))
                anim = true;
            else if (args[argc].equals("quick"))
                anim = false;
            else try {
                    int timeArg = new Integer(args[argc]).intValue();
                    time = Math.max(timeArg * 1000, 0);
                } catch (NumberFormatException nfe) {}
        }

        GraphicPlayer gpb, gpw;
        Frame f = new Frame("GraphicPlayer Test") {
                static final long serialVersionUID = 0;
                public void update(Graphics g) { paint(g); }
            };
        f.setLayout(new GridLayout());
        f.addWindowListener(new WindowAdapter() {
                public void windowClosing(WindowEvent e) {
                    System.exit(0); 
                }
            });
        gpb = new GraphicPlayer();
        gpb.setAnimated(anim);
        gpb.startElapseThread();
        f.add(gpb);
        if (duel) {
            gpw = new GraphicPlayer();
            gpw.setAnimated(anim);
            gpw.startElapseThread();
            f.add(gpw);
        } else gpw = gpb;
        f.pack();
        f.setVisible(true);
        
        Object status = Board.game(time, gpb, gpw);
        String winner = "Neither player";
        if (status == Board.BLACK)
            winner = "Black";
        else if (status == Board.WHITE)
            winner = "White";
        System.out.println(winner + " wins.");
    }
}
