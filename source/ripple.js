// ripple.js
// Copyright (C) 2014-2017 by Jeff Gold.
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

(function(ripple) {
    'use strict';

    var buildBSP = function(walls) {
        // Creates a Binary Space Partition tree that allows
        // best-case logarithmic searching for collisions with
        // a given array of walls.  Each entry in the walls array
        // must be an object with an 's' and 'e' property, each
        // of which contains an 'x' and a 'y' property.
        walls.forEach(function(wall) {
            // TODO
        });
    };

    // http://www.math.drexel.edu/~tolya/cantorpairing.pdf
    var cantorPair = {
        name: "Cantor",
        pair: function(x, y) {
            return (x + y) * (x + y + 1) / 2 + y; },
        unpair: function(z) {
            var w = Math.floor((Math.sqrt(8 * z + 1) - 1) / 2);
            var t = (w * w + w) / 2;
            var y = z - t;
            return {x: w - y, y: y};
        }
    };

    // http://szudzik.com/ElegantPairing.pdf
    var szudzikPair = {
        name: "Szudzik",
        pair: function(x, y) {
            return (x >= y) ? x * x + x + y :  y * y + x; },
        unpair: function(z) {
            var rz = Math.floor(Math.sqrt(z));
            return ((z - rz * rz < rz) ?
                    {x: z - rz * rz, y: rz } :
                    {x: rz, y: z - rz * rz - rz});
        }
    };

    ripple.pair = function(x, y) {
        var nx = (x >= 0) ? 2 * x : -2 * x - 1;
        var ny = (y >= 0) ? 2 * y : -2 * y - 1;
        return szudzikPair.pair(nx, ny);
    };
    ripple.unpair = function(z) {
        var result = szudzikPair.unpair(z);
        if (result.x % 2)
            result.x = -result.x + 1;
        if (result.y % 2)
            result.y = -result.y + 1;
        result.x /= 2;
        result.y /= 2;
        return result;
    };

    // Randomize the order of an array in place, using an optional
    // random number generator
    ripple.shuffle = function(elements, rand) {
        var ii, jj, swap;

        if (!rand || !rand.random)
            rand = Math;
        for (ii = elements.length; ii; --ii) { // swap at random
            jj = Math.floor(rand.random() * ii);
            swap = elements[ii - 1];
            elements[ii - 1] = elements[jj];
            elements[jj] = swap;
        }
        return elements;
    }

    // Given a set of objects, return an object which contains the
    // union of the keys found in each with preference given to values
    // encountered first
    ripple.mergeConfig = function() {
        var result = {}, index, config;

        for (index = 0; index < arguments.length; ++index) {
            if (arguments[index] &&
                typeof(arguments[index]) === 'object') {
                config = arguments[index];
                Object.keys(config).forEach(function(key) {
                    if (!(key in result))
                        result[key] = config[key];
                });
            }
        }
        return result;
    };

    ripple.clamp = function(value, max, min) {
        if (value > max)
            value = max;
        else if (value < min)
            value = min;
        return value;
    };

    // Framework for canvas applications
    // Object passed as the app is expected to have the following:
    //
    // app.init($, container, viewport)
    // app.draw(ctx, width, height, now)
    // app.resize(width, height)
    // app.keydown(event, redraw)
    // app.keyup(event, redraw)
    // app.mtdown(targets, event, redraw)
    // app.mtup(targets, event, redraw)
    // app.mtmove(targets, event, redraw)
    // app.isActive() // return falsy if redraw not needed
    // app.color
    // app.background
    ripple.app = function($, container, viewport, app) {
        var canvas = $('<canvas>')
            .attr('class', 'ripple-app')
            .appendTo(container);

        if (app.init)
            app.init($, container, viewport);

        var draw_id = 0, draw_last = 0;
        var draw = function() {
            var ii, ctx, width, height;
            var now = new Date().getTime();
            draw_id = 0;

            if (canvas.get(0).getContext) {
                width = canvas.innerWidth();
                height = canvas.innerHeight();
                ctx = canvas[0].getContext('2d');
                ctx.clearRect(0, 0, width, height);
                if (app.draw)
                    app.draw(ctx, width, height, now, draw_last);
            }
            draw_last = now;
            if (!app.isActive || app.isActive())
                redraw();
        };

        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        var resize = function(event) {
            var width = viewport.width();
            var height = viewport.height();
            var size = Math.min(width, height);

            canvas.width(width);
	    canvas.height(height);
            if (app.resize)
                app.resize(
                    canvas.innerWidth(), canvas.innerHeight(), $);

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            canvas.attr("width",  Math.floor(canvas.innerWidth()));
            canvas.attr("height", Math.floor(canvas.innerHeight()));
            redraw();
        };

        viewport.resize(resize);
        resize();

	viewport.on('keydown', function(event) {
            if (app.keydown)
                return app.keydown(event, redraw);
	});

	viewport.on('keyup', function(event) {
            if (app.keyup)
                return app.keyup(event, redraw);
	});

        canvas.on('mousedown touchstart', function(event) {
            var targets;
            if (app.mtdown) {
                targets = $.targets(event);
                return app.mtdown(targets, event, redraw);
            }
        });

        canvas.on('mousemove touchmove', function(event) {
            var targets;
            if (app.mtmove) {
                targets = $.targets(event);
                return app.mtmove(targets, event, redraw);
            }
        });

        canvas.on('mouseleave mouseup touchend', function(event) {
            var targets;
            if (app.mtup) {
                targets = $.targets(event);
                return app.mtup(targets, event, redraw);
            }
        });

        canvas.on('mousewheel', function(event) {
            if (app.mwheel)
                return app.mwheel(event, redraw);
        });
    };

})(typeof exports === 'undefined' ? window['ripple'] = {} : exports);

// Library routines that apply only to Node.js applications
if (typeof require !== 'undefined') (function(ripple) {
    'use strict';
    var fs   = require('fs');
    var path = require('path');

    /** Emulates jQuery Ajax using local file operations.  This allows
     *  us to use grimoire.loadAJAX directly. */
    ripple.fakejax = {
        getJSON: function(url) { return this.ajax({url: url}); },
        ajax: function(options) {
            var result = {
                base: this, cbs: [],
                url: options.url,
                done: function(fn) {
                    this.cbs.push({which: 'done', fn: fn});
                    return this;
                },
                fail: function(fn) {
                    this.cbs.push({which: 'fail', fn: fn});
                    return this;
                },
                always: function(fn) {
                    this.cbs.push({which: null, fn: fn});
                    return this;
                },
            };
            if (!this.pending)
                this.pending = [];
            this.pending.push(result);
            return result;
        },
        sync: function() {
            // Process tome loading until completion.  This isn't
            // necessary in a real AJAX application because the
            // browser event loop takes care of things but it's
            // necessary for a synchronous command line application.
            var directory = process.argv[1].substring(
                0, process.argv[1].lastIndexOf(path.sep));
            var data = null, mode, status, fname;
            var index, jndex, current, request, request, callback;
            while (this.pending) {
                current = this.pending;
                this.pending = undefined;

                for (index = 0; index < current.length; ++index) {
                    request = current[index];
                    status = 'success';
                    mode = 'done';
                    fname = directory + path.sep + path.join.apply(
                        null, request.url.split('/')) + '.json';
                    try {
                        data = JSON.parse(fs.readFileSync(
                            fname, {encoding: 'utf8'}));
                    } catch (error) { mode = 'fail'; status = error; }

                    for (jndex = 0; jndex < request.cbs.length;
                         ++jndex) {
                        callback = request.cbs[jndex];
                        if (!callback.which || callback.which === mode)
                            callback.fn(data, mode, status);
                    }
                }
            }
        }
    };

    // TODO create a simple programming language for handling
    // user scripts
    ripple.eval = function() {
        var index;
        for (index = 0; index < arguments.length; ++index)
            arguments[index];
    };

})(typeof exports === 'undefined' ? this['ripple'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var ripple = exports;
    var index;
    var tests = [
        ['2'], ['+'], ['foo'], ['foo', {'foo': 7}],
        ['(+ 7 5)'], ['(* 2, (+ (sqrt 16) 4))'],
        ['(sqr 7)', {'sqr': function(x) { return x * x; }}]
    ];
    for (index = 0; index < tests.length; ++index)
        console.log(JSON.stringify(tests[index]) + ' -> ' +
                    ripple.eval.apply(ripple.eval, tests[index]));

    var p, z, zz, methods = [ripple.cantorPair, ripple.szudzikPair];
    for (index = 0; index < methods.length; ++index) {
        console.log(methods[index].name, "pairs:");
        for (z = 0; z < 1000; ++z) {
            p = methods[index].unpair(z);
            zz = methods[index].pair(p.x, p.y);
            if (z != zz)
                console.log("FAIL: " + z + " != " + zz);
            else if (!(z && z % 100))
                console.log(z + " <=> " + p.x + ", " + p.y);
        }
    }
}
