// Board.java
// Copyright (C) 2006-20015 by Jeff Gold.
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
// An immutable snapshot of an abalone game.
package net.esclat.jarbles.abalone;
import java.util.StringTokenizer;
import java.util.ArrayList;
import java.util.Enumeration;

/** Represents the complete state of an abalone board including which
 *  player will move next.  Objects of this class are immutable. */
public final class Board implements Cloneable {
    public  static final Object GUTTER = null;
    public  static final Object EMPTY  = new Integer( 0);
    public  static final Object BLACK  = new Integer( 1);
    public  static final Object WHITE  = new Integer(-1);
    private static final String STR_EMPTY = "+";
    private static final String STR_BLACK = "b";
    private static final String STR_WHITE = "w";
    private static final int RINGS = 4;

    /** Indicates a specific location on a board. */
    public static class Location {
        public byte row;
        public byte col;

        public Location(byte row, byte col)
        { this.row = row; this.col = col; }
    }

    /** Represents a single move for one player without regard for the
     *  state of the state of the game board. */
    public static final class Move extends Object implements Cloneable {
        private byte rowS = 0, colS = 0; // coordinate of first piece
        private byte rowE = 0, colE = 0; // coordinate of last piece
        private byte rowD = 0, colD = 0; // direction of move
        
        private byte next(StringTokenizer tokens) {
            if (tokens.hasMoreTokens())
                return Byte.parseByte(tokens.nextToken());
            else throw new IllegalArgumentException("missing value");
        }
        
        /** Creates a move from a valid string encoding.  An encoding
         *  is valid if it has the form: <code>(RStart, CStart)-(REnd,
         *  CEnd):(RTarget, CTarget)</code> where the values are
         *  replaced by integers between one and nine.  The Start
         *  coordinate is the first point on the line, the End
         *  coordinate is the last, and the Target coordinate is the
         *  destination for the piece at the End coordinate.  For
         *  example, <code>(1,1)-(3,3):(4,4)</code> is a legal move
         *  for black on a newly initialized board. */
        public Move(String source) {
            byte rowT, colT;
            StringTokenizer tokens = 
                new StringTokenizer(source, "(,):- \t");
            rowS = next(tokens);
            colS = next(tokens);
            rowE = next(tokens);
            colE = next(tokens);
            rowT = next(tokens);
            colT = next(tokens);
            rowD = (byte)(rowT - rowE);
            colD = (byte)(colT - colE);
            if (tokens.hasMoreTokens())
                throw new IllegalArgumentException("too many numbers");
        }
        
        /** Creates a move based on a complete set of specified 
         *  board coordinates. */
        public Move(byte rS, byte cS, byte rE, byte cE,
                    byte rT, byte cT) {
            rowS = rS;  colS = cS;
            rowE = rE;  colE = cE;
            
            rowD = (byte)(rT - rE);
            colD = (byte)(cT - cE);
        }
        
        public byte getRowS() { return rowS; }
        public byte getColS() { return colS; }
        public byte getRowE() { return rowE; }
        public byte getColE() { return colE; }
        public byte getRowD() { return rowD; }
        public byte getColD() { return colD; }
        public byte getRowT() { return (byte)(rowD + rowE); }
        public byte getColT() { return (byte)(colD + rowE); }
        
        /** Returns the number of pieces selected by a valid move. */
        public int getCount() {
            return Move.getCount(rowS, colS, rowE, colE);
        }
        
        /** Returns the location halfway in between the start and end
         *  locations if one exists and is along a hexagonally correct
         *  line.  Returns null otherwise. */
        public Location getMiddle() {
            return Move.getMiddle(rowS, colS, rowE, colE);
        }
        
        /** Returns true if and only if the start and end positions
         *  form a valid group for an Abalone move. */
        public boolean isGroup() {
            return Move.isGroup(rowS, colS, rowE, colE);
        }
        
        /** Returns true if and only if this move is well-formed,
         *  which is to say that it could possibly be valid for some
         *  arrangement of pieces on a board. */
        public boolean isValid() {
            return Move.isValid(rowS, colS, rowE, colE, rowD, colD);
        }
        
        /** Returns true if and only if this valid move is one with a
         *  direction in the same line formed by the group.  A single
         *  piece move is never linear. */
        public boolean isLinear() {
            return Move.isLinear(rowS, colS, rowE, colE, rowD, colD);
        }
        
        /** Returns true if and only if this valid move is one with a
         *  direction that is different from the line formed by the
         *  group.  A single piece move is always broadside. */
        public boolean isBroadside() { return !isLinear(); }
        
        public boolean equals(Object that) {
            boolean result = false;
            if (this == that) {
                result = true;
            } else if (that == null) {
                result = false;
            } else if (that.getClass().equals(getClass())) {
                Move m = (Move)that;
                if (((m.rowD == rowD) && (m.colD == colD)) &&
                    (((m.rowS == rowS) && (m.colS == colS) &&
                      (m.rowE == rowE) && (m.colE == colE)) ||
                     ((m.rowS == rowE) && (m.colS == colE) &&
                      (m.rowE == rowS) && (m.colE == colS))))
                    result = true;
            }
            return result;
        }

        public int hashCode() {
            // reversing start and end positions preserves equality
            return ((rowS ^ rowE) << 16) | 
                ((colS ^ colE) << 8) | 
                (rowD ^ colD);
        }
        
        public String toString() {
            StringBuffer buffer = new StringBuffer();
	
            buffer.append("(");
            buffer.append(rowS);
            buffer.append(",");
            buffer.append(colS);
            buffer.append(")");
	
            buffer.append("-");

            buffer.append("(");
            buffer.append(rowE);
            buffer.append(",");
            buffer.append(colE);
            buffer.append(")");
	
            buffer.append(":");

            buffer.append("(");
            buffer.append(rowE + rowD);
            buffer.append(",");
            buffer.append(colE + colD);
            buffer.append(")");
	
            return buffer.toString();
        }

        /** Returns the number of pieces selected by a valid move. */
        public static int getCount(byte rowS, byte colS, 
                                   byte rowE, byte colE) {
            return 1 + Math.max(Math.abs(rowS - rowE), 
                                Math.abs(colS - colE));
        }

        /** Returns the location of the middle piece for a three piece
         *  move if and only if there are three or more locations
         *  specified and they lined up in a hexagonally correct way
         *  or null otherwise. */
        public static Location getMiddle(byte rowS, byte colS, 
                                         byte rowE, byte colE) {
            if (getCount(rowS, colS, rowE, colE) < 3)
                return null;
            byte rowM = rowS;
            byte colM = colS;
            if ((rowE - rowS) == (colE - colS)) {
                rowM = (byte)((rowS + rowE) / 2);
                colM = (byte)((colS + colE) / 2);
            } else if (rowS == rowE) {
                colM = (byte)((colS + colE) / 2);
            } else if (colS == colE) {
                rowM = (byte)((rowS + rowE) / 2);
            } else return null;
            return new Location(rowM, colM);
        }
    
        /** Returns true if and only if the start and end positions
         *  form a valid group for an Abalone move. */
        public static boolean isGroup(byte rowS, byte colS, 
                                      byte rowE, byte colE) {
            if ((Math.abs(rowE - rowS) > 2) ||
                (Math.abs(colE - colS) > 2) ||
                ((rowE - rowS != 0) && 
                 (colE - colS != 0) && 
                 (rowE - rowS != colE - colS)))
                return false;
            return true;
        }

        /** Returns true if and only if this valid move is one with a
         *  direction in the same line formed by the group.  A single
         *  piece move is never linear. */
        public static boolean isLinear(byte rowS, byte colS,
                                       byte rowE, byte colE, 
                                       byte rowD, byte colD) {
            return ((rowE - rowS == 0) == (rowD == 0) &&
                    (colE - colS == 0) == (colD == 0));
        }

        /** Returns true if and only if this move is well-formed,
         *  which is to say that it could possibly be valid for some
         *  arrangement of pieces on a board. */
        public static boolean isValid(byte rowS, byte colS, 
                                      byte rowE, byte colE, 
                                      byte rowD, byte colD) {
            // Are all piece coordinates on the board?
            if ((rowS > 9) || (rowS < 1) ||
                (colS > 9) || (colS < 1) ||
                (rowE > 9) || (rowE < 1) ||
                (colE > 9) || (colE < 1))
                return false;
            if ((Math.abs(rowS - colS) > 4) ||
                (Math.abs(rowE - colE) > 4))
                return false;
	
            // Are all target coordinates on the board?
            if ((rowS + rowD > 9) || (rowS + rowD < 1) ||
                (colS + colD > 9) || (colS + colD < 1) ||
                (rowE + rowD > 9) || (rowE + rowD < 1) ||
                (colE + colD > 9) || (colE + colD < 1))
                return false;
            if ((Math.abs((rowS + rowD) - (colS + colD)) > 4) ||
                (Math.abs((rowE + rowD) - (colE + colD)) > 4))
                return false;
	
            // Is this a row of up to three pieces moving one space?
            if (!isGroup(rowS, colS, rowE, colE))
                return false;
            if ((rowD + colD == 0) ||
                (Math.abs(rowD) > 1) || (Math.abs(colD) > 1))
                return false;

            return true;    
        }

        public static void main(String args[]) {
            Move m, n;
	
            System.out.println("Move module tests:");
            System.out.println();

            if (args.length > 0) {
                n = new Move(args[0]);
                for(int i = 0; i < args.length; i++) {
                    m = new Move(args[i]);
                    System.out.println("Move: " + m.toString());
                    if (args.length > 1) 
                        System.out.println("  equals(" + 
                                           n.toString() + "): " + 
                                           m.equals(n));
                    if (m.isValid()) {
                        System.out.println("  isValid():     true");
                        System.out.println("  isLinear():    " + 
                                           m.isLinear());
                        System.out.println("  isBroadside(): " + 
                                           m.isBroadside());
                        System.out.println("  getCount():    " + 
                                           m.getCount());
                    } else System.out.println("  isValid(): false");
                    System.out.println();
                }
            } else System.out.println
                       ("Specify moves to test as arguments.");
        }   
    }

    /** A fixed sized collection of objects with indices that can
     *  start and end at an arbitrary integer value.  An attempt to
     *  get an object outside the array bounds results in null. */
    private static class BoundArray implements Cloneable {
        private Object rep[];
        private int lowerBound;

        /** Creates a BoundArray.
         *  @param lowerB lowest reachable value.
         *  @param upperB one more than the highest reachable value.
         *  @param value  default for each position. */
        BoundArray(int lowerB, int upperB, Object value) {
            if (lowerB <= upperB) {
                lowerBound = lowerB;
                rep = new Object[upperB - lowerB + 1];
                if (value != null)
                    for (int index = 0; index < rep.length; index++)
                        rep[index] = value;
            } else throw new IllegalArgumentException
                       ("upper bound cannot be smaller than lower");
        }
	
        /** Returns the number of element positions. */
        int getSize() { return rep.length; }

        /** Returns largest permissible index. */
        int getUBound() { return lowerBound + rep.length - 1; }

        /** Returns smallest permissable index. */
        int getLBound() { return lowerBound; }

        /** Returns the element contained in the specified array
         *  position, or null if that is out of bounds.
         *  @param index location of value to be returned. */
        Object getElement(int index) {
            Object result = null;
            if (index >= lowerBound && index < lowerBound + rep.length)
                result = rep[index - lowerBound];
            return result;
        }

        /** Sets the element contained in the specified array
         *  position.
         *  @param index location to change.
         *  @param element value to store. */
        void setElement(int index, Object element) {
            if (index >= lowerBound && index < lowerBound + rep.length)
                rep[index - lowerBound] = element;
        }

        /** Return a value which is shared by all BoundArray objects
         *  that are equal to this one. */
        public int hashCode() {
            int result = rep.length;
            for (int index = 0; index < rep.length; index++)
                if (rep[index] != null)
                    result ^= rep[index].hashCode();
            return result;
        }

        /** Returns true if and only if target is a BoundArray with
         *  identical bounds and all elements are equal. */
        public boolean equals(Object that) {
            if (this == that) return true;
            if (that == null) return false;
            if (!that.getClass().equals(getClass()))
                return false;
	    
            BoundArray t = (BoundArray)that;
            if ((lowerBound == t.lowerBound) && 
                (rep.length == t.rep.length)) {
                for (int index = 0; index < rep.length; index++) {
                    if (rep[index] == null) {
                        if (t.rep[index] != null) {
                            return false;
                        }
                    } else if (!rep[index].equals(t.rep[index])) {
                        return false;
                    }
                }
                return true;
            } 
            return false;
        }

        /** Return a deep copy of this object. */
        public Object clone() throws CloneNotSupportedException {
            // shallow copy
            BoundArray result = (BoundArray)super.clone();
            result.rep = (Object[])result.rep.clone();
            return result;
        }
    }

    // A BoundArray is used to represent a hexagonal grid using an
    // incomplete 9 x 9 rectangle of board posititions.  An index 
    // outside the array bounds is not an error, but a gutter position.
    protected BoundArray rep;
    protected int scoreBlack, scoreWhite; // number of captured pieces
    protected int countBlack, countWhite; // number of active pieces
    protected boolean nextMoveBlack;      // true iff black moves next
    
    /** Creates a clear board representation. */
    private void clear() {
        nextMoveBlack = true;
        scoreBlack = scoreWhite = 0;
        countBlack = countWhite = 0;
	   
        rep = new BoundArray(1, (RINGS * 2) + 1, null);
        for (int row = 1; row <= (RINGS * 2) + 1; row++)
            rep.setElement(row, new BoundArray
                           (Math.max(1, row - RINGS), 
                            Math.min(row + RINGS, (RINGS * 2) + 1), 
                            EMPTY));
    }

    /** Places a value at a specified board postion. */
    private void toPosition(int row, int col, Object target) {
        BoundArray rowArray = (BoundArray)(rep.getElement(row));
        if (rowArray != null)
            rowArray.setElement(col, target);
    }

    /** Returns true if and only if all board locations from the start
     *  to the end position contain the specified value. */
    private boolean isGroupOf(byte rowS, byte colS, 
                              byte rowE, byte colE, 
                              Object active) {
        Location mid = Move.getMiddle(rowS, colS, rowE, colE);
        if ((atPosition(rowS, colS) == active) &&
            (atPosition(rowE, colE) == active) &&
            ((mid == null) || (atPosition(mid.row, mid.col) == active)))
            return true;
        return false;
    }
    
    /** Returns true if and only if the specified move could be
     *  made on this board. */
    private boolean isLegalMove(byte rowS, byte colS, 
                                byte rowE, byte colE, 
                                byte rowD, byte colD) {
        Object active = blackToPlay() ? BLACK : WHITE;
        if (!Move.isValid(rowS, colS, rowE, colE, rowD, colD) ||
            !isGroupOf(rowS, colS, rowE, colE, active))
            return false;
        if (Move.isLinear(rowS, colS, rowE, colE, rowD, colD)) {
            // reverse target if necessary
            byte   rowT  = (byte)(rowE + rowD);
            byte   colT  = (byte)(colE + colD);
            Object thumb = atPosition(rowT, colT);
            if (thumb == active) {
                rowT  = (byte)(rowS + rowD);
                colT  = (byte)(colS + colD);
                thumb = atPosition(rowT, colT);
            }
            
            // no pushing friendly pieces off the board
            if (thumb == GUTTER)
                return false;
	    
            // check for pushing friendly pieces or too many enemies
            int count = Move.getCount(rowS, colS, rowE, colE);
            for (int index = 0; index < count; index++) {
                thumb = atPosition(rowT + (index * rowD), 
                                   colT + (index * colD));
                if ((thumb == EMPTY) || (thumb == GUTTER))
                    return true;
                else if (thumb == active)
                    return false;
            }
        } else return isGroupOf((byte)(rowS + rowD), 
                                (byte)(colS + colD),
                                (byte)(rowE + rowD), 
                                (byte)(colE + colD),
                                EMPTY);
        return false;
    }

    /** Displaces a chain of pieces from a starting location in a
     *  given direction until an empty or gutter space is reached. */
    private void push(int rowStart, int colStart, 
                      int rowDelta, int colDelta) {
        Object inner;
        Object outer = null;
	
        // pick up the first piece
        inner = atPosition(rowStart, colStart);
        toPosition(rowStart, colStart, EMPTY);    
	
        // displace pieces as necessary
        int rowNext = rowStart + rowDelta;
        int colNext = colStart + colDelta;
        while ((atPosition(rowNext, colNext) != EMPTY) && 
               (atPosition(rowNext, colNext) != GUTTER)) {
            outer = atPosition(rowNext, colNext);
            toPosition(rowNext, colNext, inner);
            inner = outer;
	    
            rowNext = rowNext + rowDelta;
            colNext = colNext + colDelta;
        }

        // check for piece pushed out of board boundaries
        if (atPosition(rowNext, colNext) == GUTTER) {
            // update score based on color of displaced piece
            if (inner == BLACK) {
                countBlack--;  scoreWhite++;
            } else { countWhite--;  scoreBlack++; }
        } else {
            // final position is empty, so place last piece
            toPosition(rowNext, colNext, inner);
        }
    }

    private Board makeMove(Move m, boolean check) {
        if ((m == null) || (check && (isLegalMove(m) == false)))
            return null;
	
        Board result = (Board)clone();
        if (m.isLinear()) { // Linear move
            if (atPosition(m.getRowS() + m.getRowD(),
                           m.getColS() + m.getColD()) ==
                (blackToPlay() ? BLACK : WHITE))
                result.push(m.getRowS(), m.getColS(),
                            m.getRowD(), m.getColD());
            else
                result.push(m.getRowE(), m.getColE(),
                            m.getRowD(), m.getColD());
        } else { // Broadside move
            // All potential positions are pushed, which means
            // that push() must be smart enough to do nothing 
            // when the starting position is empty.
            int count = m.getCount();
            result.push(m.getRowS(), m.getColS(), 
                        m.getRowD(), m.getColD());
            if (count > 1) 
                result.push(m.getRowE(), m.getColE(), 
                            m.getRowD(), m.getColD());
            if (count > 2)
                result.push((m.getRowS() + m.getRowE()) / 2, 
                            (m.getColS() + m.getColE()) / 2, 
                            m.getRowD(), m.getColD());
        }
        result.nextMoveBlack = !nextMoveBlack;
        return result;
    }

    /** Creates a default board. */
    public Board() {
        clear();
    
        // place black pieces
        toPosition(1,1, BLACK);  toPosition(1,2, BLACK);
        toPosition(1,3, BLACK);  toPosition(1,4, BLACK);
        toPosition(1,5, BLACK);  toPosition(2,1, BLACK);
        toPosition(2,2, BLACK);  toPosition(2,3, BLACK);
        toPosition(2,4, BLACK);  toPosition(2,5, BLACK);
        toPosition(2,6, BLACK);  toPosition(3,3, BLACK);
        toPosition(3,4, BLACK);  toPosition(3,5, BLACK);
        countBlack = 14;   
	
        // place white pieces
        toPosition(9,5, WHITE);  toPosition(9,6, WHITE);
        toPosition(9,7, WHITE);  toPosition(9,8, WHITE);
        toPosition(9,9, WHITE);  toPosition(8,4, WHITE);
        toPosition(8,5, WHITE);  toPosition(8,6, WHITE);
        toPosition(8,7, WHITE);  toPosition(8,8, WHITE);
        toPosition(8,9, WHITE);  toPosition(7,7, WHITE);
        toPosition(7,6, WHITE);  toPosition(7,5, WHITE);
        countWhite = 14;   

    }

    /** Creates a board based on the encoded string supplied. */
    public Board(String source) {
        StringTokenizer tokens = 
            new StringTokenizer(source, ": \t\f\r\n");
        clear();

        // First token indicates which player moves next
        if (tokens.hasMoreTokens()) {
            String token = tokens.nextToken();
            if (token.equals(STR_BLACK)) {
                nextMoveBlack = true;
            } else if (token.equals(STR_WHITE)) {
                nextMoveBlack = false;
            } else throw new IllegalArgumentException
                       ("invalid character");
        } else throw new IllegalArgumentException("missing tokens");

        // Fill board locations from tokens
        for (byte row = 1; row <= 9; row++) {
            byte colMin = (byte)Math.max(1, row - 4);
            byte colMax = (byte)Math.min(9, row + 4);
            for (byte col = colMin; col <= colMax; col++) {

                // Check for missing tokens
                if (!tokens.hasMoreTokens())
                    throw new IllegalArgumentException
                        ("missing tokens");

                String token = tokens.nextToken();
                if (token.equals(STR_EMPTY)) {
                    toPosition(row, col, EMPTY);
                } else if (token.equals(STR_BLACK)) {
                    toPosition(row, col, BLACK);
                    countBlack++;
                } else if (token.equals(STR_WHITE)) {
                    toPosition(row, col, WHITE);
                    countWhite++;
                }

            }
        }

        // Any pieces not accounted for must have been pushed off
        scoreBlack = 14 - countWhite;
        scoreWhite = 14 - countBlack;
    }

    /** Returns a string encoding that represents the board. */
    public String toString() {
        StringBuffer buffer = new StringBuffer();
	
        // record the player who goes next
        if (blackToPlay())
            buffer.append(STR_BLACK);
        else buffer.append(STR_WHITE);
        buffer.append(":\n");
	
        for (int index = 1; index <= rep.getUBound(); index++) {
            BoundArray rowArray = (BoundArray)rep.getElement(index);
	    
            // Pad with spaces for visual alignment
            for(int jndex = 0; jndex <= 9 - rowArray.getSize(); jndex++)
                buffer.append(" ");
	    
            // Append board information.
            for(int jndex = rowArray.getLBound(); 
                jndex <= rowArray.getUBound(); jndex++) {
                Object element = rowArray.getElement(jndex);
                buffer.append(" ");
                if (element == BLACK) {
                    buffer.append(STR_BLACK);
                } else if (element == WHITE) {
                    buffer.append(STR_WHITE);
                } else if (element == EMPTY) {
                    buffer.append(STR_EMPTY);
                }
            }
            buffer.append("\n");
        }
	
        return buffer.toString();
    }
    
    public boolean equals(Object that) {
        boolean result = false;
        if (this == that) {
            result = true;
        } else if (that == null) {
            result = false;
        } else if (that.getClass().equals(getClass())) {
            Board b = (Board)that;
	    
            // Compare target state
            if ((nextMoveBlack == b.nextMoveBlack) &&
                rep.equals(b.rep))  
                result = true;
        }
        return result;
    }

    public int hashCode() {
        int result = rep.hashCode();
        return result;
    }

    public Object clone() {
        Board result;
        try { result = (Board)super.clone(); }
        catch (CloneNotSupportedException e) 
            { throw new RuntimeException(e); }
	
        // Presumably the inherited implementation of clone 
        // does a shallow copy so the following duplicates the
        // BoundArray objects.  Note that the BoundArray clone
        // method does a shallow copy too but that's good since
        // we want to preserve pointer equality for the 
        // BLACK, WHITE and EMPTY objects.
        result.rep = new BoundArray(rep.getLBound(), rep.getUBound(), 
                                    null);
        for (int row = rep.getLBound(); row <= rep.getUBound(); row++) {
            // part of the invariant for this class is that all
            // entries of rep are non-null instances of BoundArray,
            // so the following should be safe.
            BoundArray thisrow = (BoundArray)rep.getElement(row);
            BoundArray thatrow = new BoundArray(thisrow.getLBound(), 
                                                thisrow.getUBound(), 
                                                EMPTY);
            result.rep.setElement(row, thatrow);
            for (int col = thisrow.getLBound(); 
                 col <= thisrow.getUBound(); col++)
                thatrow.setElement(col, thisrow.getElement(col));
        }
        return result;
    }

    /** Returns the contents of the board position indicated.  This
     *  might be GUTTER, EMPTY, BLACK or WHITE. */
    public Object atPosition(int row, int col) {
        Object result = rep.getElement(row);
        if (result != null)
            result = ((BoundArray)result).getElement(col);
        return result;
    }

    /** Returns true if and only if the contents of the board position 
     *  belong to the player whose turn it is. */
    public boolean activePosition(int row, int col) {
        Object atpos = atPosition(row, col);
        if (atpos == (blackToPlay() ? BLACK : WHITE))
            return true;
        return false;
    }

    /** Returns the number of displaced white pieces. */
    public int getBlackScore() { return scoreBlack; }
    /** Returns the number of displaced black pieces. */
    public int getWhiteScore() { return scoreWhite; }
    /** Rturns the number of black pieces on the board. */
    public int getBlackCount() { return countBlack; }
    /** Returns the number of white pieces on the board. */
    public int getWhiteCount() { return countWhite; }
    /** Returns true iff the next move must be made by black player. */
    public boolean blackToPlay() { return nextMoveBlack; }
    /** Returns true iff the next move must be made by white player. */ 
    public boolean whiteToPlay() { return !nextMoveBlack; }

    /** Returns the number of pieces in the group or zero if the
     *  specified selection would not be a legal group. */
    public int sizeLegalGroup(byte rowS, byte colS, 
                              byte rowE, byte colE) {
        if (Move.isGroup(rowS, colS, rowE, colE) && 
            isGroupOf(rowS, colS, rowE, colE, 
                      blackToPlay() ? BLACK : WHITE))
            return Move.getCount(rowS, colS, rowE, colE);
        return 0;
    }

    /** Returns true if and only if the given move would be legal on
     *  this board. */
    public boolean isLegalMove(Move m) {
        return isLegalMove(m.getRowS(), m.getColS(),
                           m.getRowE(), m.getColE(),
                           m.getRowD(), m.getColD());
    }
	
    /** Creates a move and adds it to the given list if and only if
     *  it is would be a legal move on this board. */
    private void considerMove(byte rowS, byte colS, 
                              byte rowE, byte colE,
                              byte rowD, byte colD,
                              ArrayList<Move> a) {
        if (isLegalMove(rowS, colS, rowE, colE, rowD, colD))
            a.add(new Move(rowS, colS, rowE, colE,
                           (byte)(rowE + rowD), 
                           (byte)(colE + colD)));
    }
    
    /** Creates all moves starting from a given location and adds any
     *  that happen to be a legal move on this board to the list. */
    private void considerMoves(byte rowS, byte colS, 
                               byte rowD, byte colD,
                               ArrayList<Move> a) {
        // Consider one piece moves
        considerMove(rowS, colS, rowS, colS, rowD, colD, a);
        
        // Consider two piece moves
        considerMove(rowS, colS, (byte)(rowS + 1), colS, rowD, colD, a);
        considerMove(rowS, colS, rowS, (byte)(colS + 1), rowD, colD, a);
        considerMove(rowS, colS, (byte)(rowS + 1), (byte)(colS + 1), 
                     rowD, colD, a);
        
        // Consider three piece moves
        considerMove(rowS, colS, (byte)(rowS + 2), colS, rowD, colD, a);
        considerMove(rowS, colS, rowS, (byte)(colS + 2), rowD, colD, a);
        considerMove(rowS, colS, (byte)(rowS + 2), (byte)(colS + 2), 
                     rowD, colD, a);
    }
    
    /** Returns an array containing each unique legal move that can be
     *  made on this board. */
    public Iterable<Move> getLegalMoves() {
        ArrayList<Move> result = new ArrayList<Move>();
	
        // Consider each valid board square
        for (byte rowS = 1; rowS <= 9; rowS++) {
            byte colMin = (byte)Math.max(1, rowS - 4);
            byte colMax = (byte)Math.min(9, rowS + 4);
            for (byte colS = colMin; colS <= colMax; colS++) {
		
                // Consider all directions.
                for (byte rowD = -1; rowD <= 1; rowD++) {
                    for (byte colD = -1; colD <= 1; colD++) {
			
                        // Consider hexagonally valid directions.
                        if (rowD + colD != 0)
                            considerMoves(rowS, colS, rowD, colD, 
                                          result);
                    }
                }
            }
        }
	
        return result;
    }
    
    /** Returns an indication of who has won the game.  This will be
     *  BLACK if the board represents a winning configuration for
     *  black, WHITE if the board represents a winning configuration
     *  for white and EMPTY otherwise.  Note that a draw is impossible
     *  in Abalone. */
    public Object winner() {
        Object result = EMPTY;

        // Fields are not used to allow subclasses to override the
        // behavior of this method.
        int blackScore = getBlackScore();
        int whiteScore = getWhiteScore();

        if (blackScore > 5 || whiteScore > 5) {
            if (blackScore > whiteScore)
                result = BLACK;
            else if (whiteScore > blackScore)
                result = WHITE;
        }
        return result;
    }
    
    /** Returns a board that is equal to the current board after the
     *  given move is made, or null if that is not legal. */
    public Board makeMove(Move m) {
        return makeMove(m, true);
    }

    /** Conducts some basic tests of board functionality. */
    private static void doTests(Board board) 
        throws CloneNotSupportedException {
        Board other;
        String encoded;

        System.out.println("Board:");
        encoded = board.toString();
        System.out.println(encoded);
        System.out.println("  board.equals(board): " + 
                           board.equals(board));
        System.out.println();

        System.out.println("FromString:");
        other = new Board(encoded);
        System.out.println(other.toString());
        System.out.println("  board.equals(other): " + 
                           board.equals(other));
        System.out.println("  other.equals(board): " + 
                           other.equals(board));
        System.out.println();

        System.out.println("Clone:");
        other = (Board)board.clone();
        System.out.println(other.toString());
        System.out.println("  board.equals(other): " + 
                           board.equals(other));
        System.out.println("  other.equals(board): " + 
                           other.equals(board));
        System.out.println();	
    }

    /** Performs module unit tests.  Arguments can be either command
     *  strings or valid move encodings.  Here are eight valid moves
     *  in sequence.  Try typing them on a command line.
     *
     *  <code>
     *    "(1,1)-(3,3):(4,4)" "(7,7)-(9,9):(8,8)" 
     *    "(1,2)-(3,4):(4,5)" "(7,5)-(9,5):(8,5)"
     *    "(2,2)-(4,4):(5,5)" "(6,6)-(8,6):(7,6)" 
     *    "(2,3)-(4,5):(5,6)" "(6,6)-(7,6):(6,6)"
     *  </code>
     * 
     *  Currently the supported command strings are "test" and
     *  "legal".  Each time "test" is encountered some simple tests
     *  will be performed on the current board positon.  These include
     *  checking that the board is equal to itself, that it can be
     *  encoded in string form and read back in to get an equivalent
     *  board and that clone() works properly.
     * 
     *  Each time "legal" is encountered all legal moves for the
     *  current board will be displayed. */
    public static void main(String args[]) 
        throws CloneNotSupportedException {
        Board board = new Board();

        if (args.length > 0) {
            for (int argc = 0; argc < args.length; argc++) {
                if (args[argc].equals("test")) {
                    doTests(board);
                } else if (args[argc].equals("legal")) {
                    int linelen = 0;
                    for (Move m : board.getLegalMoves()) {
                        String movestr = m.toString();
                        if (linelen + movestr.length() + 1 > 72) {
                            System.out.println();
                            linelen = movestr.length() + 1;
                        } else linelen += movestr.length();
                        System.out.print(movestr);
                        System.out.print(" ");
                    }
                    if (linelen > 0) System.out.println();
                } else try {
                        Move m = new Move(args[argc]);
                        if (board.isLegalMove(m)) {
                            board = board.makeMove(m);
                            System.out.println
                                ("  move: " + m.toString());
                            System.out.println(board.toString());
                        } else {
                            System.out.println("  illegal move: " + 
                                               m.toString());
                        }
                    } catch (IllegalArgumentException e) {
                        System.out.println
                            ("  invalid move: " + args[argc]);
                    }
            }
        } else doTests(board);
    }
}
