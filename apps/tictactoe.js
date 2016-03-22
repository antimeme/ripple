// tictactoe.js
// Copyright (C) 2016 by Jeff Gold.
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
(function(tictactoe) {
    "use strict";

    var ai = function(player, state) {
        // :TODO: make this less braindead
        var ii;
        for (ii in state.board)
            if (!state.board[ii]) {
                state.board[ii] = player;
                break;
            }
        return state;
    };
    
    var clear = function() {
        return { winner: 0, start: null, stop: null,
                 begin: null, end: null,
                 board: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    };

    var getPoint = function(position, width, height) {
        return {x: width * (2 * (position % 3) + 1) / 6,
                y: height * (2 * Math.floor(position / 3) + 1) / 6 }
    }

    var checkWinner = function(state) {
        if (!state.winner && state.board[0]) {
            if ((state.board[0] === state.board[1]) &&
                (state.board[1] === state.board[2])) {
                state.winner = state.board[0];
                state.start = 0;
                state.stop = 2;
            } else if ((state.board[0] === state.board[3]) &&
                       (state.board[3] === state.board[6])) {
                state.winner = state.board[0];
                state.start = 0;
                state.stop = 6;
            } else if ((state.board[0] === state.board[4]) &&
                       (state.board[4] === state.board[8])) {
                state.winner = state.board[0];
                state.start = 0;
                state.stop = 8;
            }
        }

        if (!state.winner && state.board[3]) {
            if ((state.board[3] === state.board[4]) &&
                (state.board[4] === state.board[5])) {
                state.winner = state.board[3];
                state.start = 3;
                state.stop = 5;
            }
        }
        if (!state.winner && state.board[1]) {
            if ((state.board[1] === state.board[4]) &&
                (state.board[4] === state.board[7])) {
                state.winner = state.board[1];
                state.start = 1;
                state.stop = 7;
            }
        }
        if (!state.winner && state.board[8]) {
            if ((state.board[8] === state.board[7]) &&
                (state.board[7] === state.board[6])) {
                state.winner = state.board[8];
                state.start = 6;
                state.stop = 8;
            } else if ((state.board[8] === state.board[5]) &&
                       (state.board[5] === state.board[2])) {
                state.winner = state.board[8];
                state.start = 2;
                state.stop = 8;
            }
        }
        if (!state.winner && state.board[6]) {
            if ((state.board[6] === state.board[4]) &&
                (state.board[4] === state.board[2])) {
                state.winner = state.board[6];
                state.start = 2;
                state.stop = 6;
            }
        }
        if (state.winner) {
            state.begin = new Date().getTime();
            state.end = state.begin + 1000;
        }
        return state;
    };

    tictactoe.go = function($, container) {
        var state = clear();
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
                    cpoint = getPoint(ii, width, height);
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
                    cpoint = getPoint(ii, width, height);
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
                    cpoint = getPoint(state.start, width, height);
                    dpoint = getPoint(state.stop, width, height);

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
                if (!state.winner) {
                    ai(player * -1, state);
                    checkWinner(state);
                }
                redraw();
            }
        });
        board.resize(resize);
        resize();
        var reset = function() {
            state = clear();
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
        
    }
})(typeof exports === 'undefined'? this['tictactoe'] = {}: exports);
