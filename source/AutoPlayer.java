// Board.java
// Copyright (C) 2006-2007 by Jeff Gold.
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
// A simple automatic player for abalone.
package net.antimeme.jarbles.abalone;
import java.util.ArrayList;

/** A simple computer controlled player. */
public class AutoPlayer implements Player {
    protected static class WeightedMove {
        public Board.Move move;
        public double     weight;

        public WeightedMove(Board.Move m, double w)
        { move = m; weight = w; }
    }
    
    protected static final double[] deflFriend = { 40, 35, 30, 25, 20};
    protected static final double[] deflEnemy  = {-60,-50,-40,-30,-20};

    protected Board b;
    protected int lambda;
    protected double[] ringFriend;
    protected double[] ringEnemy;

    /**
     * Create an automatic player
     * @param lambda depth to search move tree
     * @param ringFriend weights for friendly pieces by ring
     * @param ringEnemy weights for enemy pieces by ring */
    public AutoPlayer(int lambda, double[] ringFriend,
                      double[] ringEnemy) {
        b = new Board();
        this.lambda = lambda;
        this.ringFriend = ringFriend;
        this.ringEnemy  = ringEnemy;
    }

    /**
     * Create an automatic player
     * @param lambda depth to search move tree */
    public AutoPlayer(int lambda)
    { this(lambda, deflFriend, deflEnemy); }

    /**
     * Create an automatic player with default settings */
    public AutoPlayer() { this(3, deflFriend, deflEnemy); }

    /**
     * Change the current board
     * @param start current state of game board
     * @param timeBlack milliseconds remaining for black player
     * @param timeWhite milliseconds remaining for white player */
    public void setBoard(Board start, long timeBlack, long timeWhite) {
        b = start;
    }

    /**
     * Update board state based on a single move
     * @param move applied to current state of game board
     * @param timeBlack milliseconds remaining for black player
     * @param timeWhite milliseconds remaining for white player */
    public void noteMove(Board.Move move, long timeBlack,
                         long timeWhite) {
        Board change = b.makeMove(move);
        if (change != null)
            b = change;
    }

    /**
     * Requests a calculated move from this player
     * @param last previous move made by opponent
     * @param timeBlack milliseconds remaining for black player
     * @param timeWhite milliseconds remaining for white player */
    public Board.Move makeMove(Board.Move last, long timeBlack,
                               long timeWhite) {
        noteMove(last, timeBlack, timeWhite);
        return alpha_beta(b, 3, Double.NEGATIVE_INFINITY,
                          Double.POSITIVE_INFINITY).move;
    }

    /** Return a value representing the desirablity of the current
     *  board position to the current player. */
    private double evaluate(Board b) {
        Object winner = b.winner();
        if (winner != Board.EMPTY)
            return (winner == Board.GUTTER) ? 0 :
                (((winner == Board.BLACK) == b.blackToPlay()) ?
                 Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY);
        Thread.yield();
        
        Object friend = b.blackToPlay() ? Board.BLACK : Board.WHITE;
        Object enemy  = b.blackToPlay() ? Board.WHITE : Board.BLACK;        
        double score = 0.0;
        for (int row = 1; row < 10; row++)
            for (int col = Math.max(1, row - 4);
                 col < Math.min(10, 5 + row); col++) {
                int ring = ((5 - row > 0) == (5 - col > 0)) ?
                    Math.max(Math.abs(5 - row), Math.abs(5 - col)) :
                    Math.abs((5 - row) - (5 - col));
                if (b.atPosition(row, col) == friend)
                    if (ringFriend.length > ring)
                        score += ringFriend[ring];
                if (b.atPosition(row, col) == enemy)
                    if (ringEnemy.length > ring)
                        score += ringEnemy[ring];
            }
        
        return score;
    }
    
    /** Choose a move using the minimax algorithm with the evaluate
     *  routine.  Assuming ideal play from both sides the best move
     *  is the one that leaves the opponent with the worst available
     *  best choice. */
    protected WeightedMove minimax(Board root, int lambda) {
        if (lambda > 0) {
            WeightedMove best = new WeightedMove
                (null, Double.NEGATIVE_INFINITY);
            for (Board.Move m : root.getLegalMoves()) {
                WeightedMove current =
                    minimax(root.makeMove(m), lambda - 1);
                if (best.weight < -(current.weight))
                    best = new WeightedMove(m, -(current.weight));
            }
            return best;
        } else return new WeightedMove(null, evaluate(root));
    }

    /** Choose a move using the minimax algorithm and alpha-beta
     *  pruning with the evaluate routine.  Assuming ideal play from
     *  both sides the best move is the one that leaves the opponent
     *  with the worst available best choice.  By keeping track of
     *  the worst and best moves available so far it is possible to
     *  avoid processing parts of the decision tree which are 
     *  provably less advantageous to the deciding player without
     *  affecting the final result. */
    protected WeightedMove alpha_beta(Board root, int lambda,
                                      double alpha, double beta) {
        if (lambda > 0) {
            WeightedMove best = new WeightedMove(null, alpha);
            for (Board.Move m : root.getLegalMoves()) {
                WeightedMove current =
                    alpha_beta(root.makeMove(m), lambda - 1,
                               -beta, -best.weight);
                if (best.weight < -(current.weight))
                    best = new WeightedMove(m, -(current.weight));
                if (best.weight >= beta)
                    break;
            }
            return best;
        } else return new WeightedMove(null, evaluate(root));
    }

    /**
     * Display board with weights in place of pieces
     * @param b board state to display */
    public void ringTest(Board b) {
        StringBuffer buffer = new StringBuffer();
        for (int row = 1; row < 10; row++) {
            // Pad with spaces for visual alignment
            for(int j = 0; j < Math.abs(5 - row); j++)
                buffer.append(" ");
            
            for (int col = Math.max(1, row - 4);
                 col < Math.min(10, 5 + row); col++) {
                int ring = ((5 - row > 0) == (5 - col > 0)) ?
                    Math.max(Math.abs(5 - row), Math.abs(5 - col)) :
                    Math.abs((5 - row) - (5 - col));
                if (b != null) {
                    Object friend = b.blackToPlay() ? 
                        Board.BLACK : Board.WHITE;
                    Object enemy  = b.blackToPlay() ? 
                        Board.WHITE : Board.BLACK;        
                    Object thing = b.atPosition(row, col);
                    if (thing == friend)
                        buffer.append(" " + ringFriend[ring]);
                    else if (thing == enemy)
                        buffer.append(" " + ringEnemy[ring]);
                    else buffer.append(" *");
                } else buffer.append(" " + ringFriend[ring]);
            }    
            buffer.append("\n");
        }
        System.out.println(buffer.toString());
    }
    
    /**
     * Entry point for test program
     * @param args command line arguments */
    public static void main(String args[]) {
        Board b = new Board();
        Player t = new AutoPlayer();
        t.setBoard(b, 0, 0);
        Board.Move lastMove = null;
        long tBlack = 0, tWhite = 0, clock;
        
        System.out.println("Abalone AutoPlay Test");
        System.out.println("=====================");
        System.out.println();
        System.out.println(b.toString());
        
        while (b.winner() == Board.EMPTY) {
            clock = System.currentTimeMillis();
            lastMove = t.makeMove(lastMove, 0, 0);
            clock = System.currentTimeMillis() - clock;
            
            System.out.println((b.blackToPlay() ? "Black" : "White") +
                               " moves: " + lastMove.toString() + 
                               " [" + clock + " milliseconds]");
            if (b.blackToPlay())
                tBlack += clock;
            else tWhite += clock;
            
            b = b.makeMove(lastMove);
            System.out.println(b.toString());
        }
        System.out.println((b.winner() == Board.BLACK ? 
                            "Black" : "White") + " wins.");
        System.out.println("Black used " + tBlack + " milliseconds.");
        System.out.println("White used " + tWhite + " milliseconds.");
    }   
}
