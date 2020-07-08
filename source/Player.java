// Player.java
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
// Player represents anything that can play a game of Abalone.
package net.esclat.jarbles.abalone;

/**
 * Represents anything that can play a game of Abalone.  This might
 * include a graphical interface which allows a person to play, a
 * program that attempts to make the best possible moves or a network
 * connection to some remote player. */
public interface Player {
    /**
     * Changes the state of play as understood by this player.  This
     * method may be called while makeMove is in progress, in which
     * case that method should return null as soon as possible.
     *  
     * @param start current board state.  A player may use this
     * immutable object directly and without cloning.
     * @param timeBlack amount of time remaining for black player or
     * zero for untimed games.
     * @param timeWhite amount of time remaining for white player or
     * zero for untimed games. */
    public void setBoard(Board start, long timeBlack, long timeWhite);

    /**
     * Changes the state of play as understood by this player so that
     * the specified move is made.  This allows an application to
     * demonstrate a sequence of moves to the player.  Calling this
     * method while either {@link #setBoard} or {@link #makeMove} is
     * not allowed and has undefined results.
     *  
     * @param move a legal move to be applied to the current board.
     * @param timeBlack amount of time remaining for black player or
     * zero for untimed games.
     * @param timeWhite amount of time remaining for white player or
     * zero for untimed games. */
    public void noteMove(Board.Move move, long timeBlack,
                         long timeWhite);

    /**
     * Requests a legal move for the current player according to this
     * player's understanding of the board.  Calling this method while
     * {@link #setBoard} is in progress or before a call to that
     * method has been made on this player has undefined results.
     *
     * @param last either null or the move made by the opposing
     * player.  Because a player may be pitted against itself this
     * move may be illegal, in which case it must be ignored.
     * Otherwise the player must update its understanding of the state
     * of play to include this move.
     * @param timeBlack amount of time remaining for black player or
     * zero in untimed games.
     * @param timeWhite amount of time remaining for white player or
     * zero in untimed games.
     * @return the move desired by the player or null to resign */
    public Board.Move makeMove(Board.Move last, long timeBlack,
                               long timeWhite);
}
