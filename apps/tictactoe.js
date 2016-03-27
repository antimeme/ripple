// tictactoe.js
// Copyright (C) 2016 by Jeff Gold and Simon Gold.
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
// An implementation of the simplistic game known as Tic-Tac-Toe
// (https://en.wikipedia.org/wiki/Tic-tac-toe)
//
// The board is represented this way:
//     [0, 1, 2]
//     [3, 4, 5]
//     [6, 7, 8]
(function(tictactoe) {
    "use strict";
    var __wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
        [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    var __findWin = function(win, player, goal, state) {
        // Return the index of the winning position if possible or
        // -1 if not
        if ((state.board[win[0]] === goal) &&
            (state.board[win[1]] === player) &&
            (state.board[win[2]] === player))
            return win[0];
        else if (goal != player) {
            if ((state.board[win[1]] === goal) &&
                (state.board[win[0]] === player) &&
                (state.board[win[2]] === player))
                return win[1];
            if ((state.board[win[2]] === goal) &&
                (state.board[win[1]] === player) &&
                (state.board[win[0]] === player))
                return win[2];
        }
        return -1;
    }
    
    // Creates a clear board state
    var __clear = function() {
        return { winner: 0, draw: false, start: null, stop: null,
                 begin: null, end: null,
                 board: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    };

    // Gets the center of the specified board square
    var __getPoint = function(position, width, height) {
        return {x: width * (2 * (position % 3) + 1) / 6,
                y: height * (2 * Math.floor(position / 3) + 1) / 6 };
    };

    // A playing algorithm that randomly selects valid moves
    var ai_random = function(player, state) {
        var done = false;
        do {
            var choice = Math.floor(Math.random() * 9);
            if (!state.board[choice]) {
                state.board[choice] = player;
                done = true;
            }
        } while (!done);
        return state;
    };

    // A playing algorithm that blocks defeat if possible but
    // otherwise randomly selects a valid move
    var ai_defensive = function(player, state) {
        var ii, w;
        for (ii in __wins) {
            w = __findWin(__wins[ii], player * -1, 0, state);
            if (w >= 0) {
                state.board[w] = player;
                return state;
            }
        }
        return ai_random(player, state);
    };

    // A playing algorithm that takes a win if immediately possible,
    // blocks defeat if possible but otherwise randomly selects a
    // valid move
    var ai_opportune = function(player, state) {
        var ii, w;
        for (ii in __wins) {
            w = __findWin(__wins[ii], player, 0, state);
            if (w >= 0) {
                state.board[w] = player;
                return state;
            }
        }
        return ai_defensive(player, state);
    };

    var ais = {
        'random': ai_random,
        'defensive': ai_defensive,
        'opportune': ai_opportune
    };

    var checkWinner = function(state) {
        var ii;
        for (ii in __wins) {
            if (__findWin(__wins[ii], 1, 1, state) >= 0) {
                state.winner = 1;
                state.start = __wins[ii][0];
                state.stop = __wins[ii][2];
            } else if (__findWin(__wins[ii], -1, -1, state) >= 0) {
                state.winner = -1;
                state.start = __wins[ii][0];
                state.stop = __wins[ii][2];
            }
        }
        if (state.winner) {
            state.begin = new Date().getTime();
            state.end = state.begin + 1000;
        } else {
            state.draw = true;
            for (ii in state.board)
                if (!state.board[ii])
                    state.draw = false;
        }
        return state;
    };

    tictactoe.go = function($, container) {
        var state = __clear();
        var ai = ai_opportune;
        var player = 1;
        var board = $('<canvas>').attr({
            'class': 'board'
        }).css({
            width: 320, height: 320, margin: 'auto', display: 'block',
            color: '#222', background: '#ddd'
        }).appendTo(container);
        var draw_id = 0;
        var draw = function() {
            var ctx, width, height, color, lineWidth;
            var ii, cpoint, dpoint, increment;
            var xcolor = '#336';
            var ocolor = '#633';
            draw_id = 0;

            if (board.get(0).getContext) {
                width = board.width();
                height = board.height();
                lineWidth = (width > height) ?
                    (width / 50) : (height / 50);
                color = board.css('color');

                ctx = board[0].getContext('2d');
                ctx.save();
                ctx.lineWidth = lineWidth;
                ctx.clearRect(0, 0, width, height);

                // Create a grid
                ctx.beginPath();
                for (ii = 1; ii < 3; ++ii) {
                    ctx.moveTo(width * ii / 3, height / 20);
                    ctx.lineTo(width * ii / 3, height * 19 / 20);
                }
                for (ii = 1; ii < 3; ++ii) {
                    ctx.moveTo(width / 20, height * ii / 3);
                    ctx.lineTo(width * 19 / 20, height * ii / 3);
                }

                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.stroke();

                // Draw X's
                ctx.beginPath();
                for (ii in state.board) {
                    cpoint = __getPoint(ii, width, height);
                    if (state.board[ii] > 0) {
                        ctx.moveTo(cpoint.x - width / 8,
                                   cpoint.y - width / 8);
                        ctx.lineTo(cpoint.x + width / 8,
                                   cpoint.y + width / 8);
                        ctx.moveTo(cpoint.x + width / 8,
                                   cpoint.y - width / 8);
                        ctx.lineTo(cpoint.x - width / 8,
                                   cpoint.y + width / 8);
                    }
                }
                ctx.strokeStyle = xcolor;
                ctx.stroke();

                // Draw O's
                ctx.beginPath();
                for (ii in state.board) {
                    cpoint = __getPoint(ii, width, height);
                    if (state.board[ii] < 0) {
                        ctx.moveTo(cpoint.x + width / 8, cpoint.y);
                        ctx.arc(cpoint.x, cpoint.y, width / 8,
                                0, Math.PI * 2);
                    }
                }
                ctx.strokeStyle = ocolor;
                ctx.stroke();

                // Draw winner line
                if (state.winner) {
                    var now = new Date().getTime();
                    increment = Math.min(1, (now - state.begin) /
                                         (state.end - state.begin));
                    cpoint = __getPoint(state.start, width, height);
                    dpoint = __getPoint(state.stop, width, height);

                    ctx.beginPath();
                    ctx.moveTo(cpoint.x, cpoint.y);
                    ctx.lineTo(cpoint.x + increment *
                               (dpoint.x - cpoint.x),
                               cpoint.y + increment *
                               (dpoint.y - cpoint.y));
                    ctx.lineCap = 'round';
                    ctx.lineWidth = 3 * lineWidth;
                    ctx.strokeStyle = (state.winner > 0) ?
                        xcolor : ocolor;
                    ctx.stroke();
                    if (now < state.end)
                        redraw();
                }
                
                ctx.restore();
            }
        };
        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };
        var resize = function(event) {
            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            board.attr("width", board.innerWidth());
            board.attr("height", board.innerHeight());

            redraw();
        };
        board.on('click', function(event) {
            var row = Math.floor(event.offsetY * 3 / board.height());
            var col = Math.floor(event.offsetX * 3 / board.width());

            if (!state.winner && !state.board[row * 3 + col]) {
                state.board[row * 3 + col] = player;
                checkWinner(state);
                if (!state.winner && !state.draw) {
                    ai(player * -1, state);
                    checkWinner(state);
                }
                redraw();
            }
        });
        board.resize(resize);
        resize();
        var reset = function() {
            state = __clear();
            if (player < 0)
                ai(player * -1, state);
            redraw();
        };

        var bbar = $('<div>').css({
            margin: 'auto', display: 'block', 'text-align': 'center'
        }).appendTo(container);

        var btnReset = $('<button class="reset">Reset</button>').
            css({margin: 'auto', display: 'inline-block'}).
            appendTo(bbar);
        btnReset.on('click', function() { reset(); });

        var btnSwitch = $('<button class="reset">Switch</button>').
            css({margin: 'auto', display: 'inline-block'}).
            appendTo(bbar);
        btnSwitch.on('click', function() {
            player = -1 * player;
            reset();
        });
        
        var aibar = $('<div>').css({
            margin: 'auto', display: 'block', 'text-align': 'center'
        }).appendTo(container);
        var ailabel = $('<label>Opponent: </label>').appendTo(aibar);
        var aiselect = $('<select>').appendTo(ailabel);
        Object.keys(ais).sort().forEach(function(value) {
            var vtitle = value.replace(/^[a-z]/, function(i) {
                return i.toUpperCase(); });
            var attrs = {value: value};
            aiselect.append($('<option>' + vtitle +
                              '</option>').attr(attrs));
            if (ais[value] === ai)
                aiselect.val(value);
        });
        aiselect.on('change', function(event) {
            var chosen = $(event.target).val();
            if (chosen in ais)
                ai = ais[chosen];
        });
    }
})(typeof exports === 'undefined'? this['tictactoe'] = {}: exports);

