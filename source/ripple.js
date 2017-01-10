// ripple.js
// Copyright (C) 2014-2016 by Jeff Gold.
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

    ripple.vector = {
        epsilon: 0.000001,

        create: function(x, y, z) {
            // Creates and returns a vector using Cartesian coordinates
            var result = Object.create(this);
            result.x = x || 0;
            result.y = y || 0;
            result.z = z || 0;
            return result;
        },

        polar: function(r, theta, phi) {
            // Creates and returns a vector using polar coordinates
            var result = Object.create(this);
            var cosphi = phi ? Math.cos(phi) : 1;
            result.x = r * Math.cos(theta) * cosphi;
            result.y = r * Math.sin(theta) * cosphi;
            result.z = phi ? (r * Math.sin(phi)) : 0;
            return result;
        },

        reverse: function()
        { return this.create(-this.x, -this.y, -this.z); },

        plus: function(other) {
            return this.create(
                this.x + other.x, this.y + other.y, this.z + other.z);
        },

        minus: function(other)
        { return this.plus(other.reverse()); },

        times: function(value) {
            return this.create(
                this.x * value, this.y * value, this.z * value);
        },

        dotp: function(other) {
            return this.x * other.x +
                   this.y * other.y +
                   this.z * other.z;
        },

        sqlen: function() { return this.dotp(this); },

        length: function() { return Math.sqrt(this.dotp(this)); },

        angle: function() { return Math.acos(this.norm().x); },

        norm: function() {
            var length = this.length();
            var result = this.create(this.x / length, this.y / length);
            result.originalLength = length;
            return result;
        },

        reflect: function(target) {
            // r = d - ((2 d . n) / (n . n)) n
            return (this.dotp(this) > this.epsilon) ?
                   target.minus(this.times(2 * this.dotp(target) /
                       this.dotp(this))) : target;
        },

        draw: function(context, center, config) {
            var length = this.length();
            var angle  = this.angle();
            var adepth = 0.9, awidth;

            context.save();
            context.lineCap = 'round';
            context.strokeStyle = (config && config.color) || 'white';
            context.fillStyle = context.strokeStyle;
            context.lineWidth = (config && config.lineWidth) || 5;
            awidth = Math.min(context.lineWidth, length / 10);

            context.translate(center ? center.x : 0,
                              center ? center.y : 0);
            context.rotate((this.y > 0 ? 1 : -1) * angle);

            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(adepth * length, 0);
            context.lineTo(adepth * length, awidth);
            context.lineTo(length, 0);
            context.lineTo(adepth * length, -awidth);
            context.lineTo(adepth * length, 0);
            context.closePath();

            context.stroke();
            context.fill();
            context.restore();
        }
    };

    // http://www.math.drexel.edu/~tolya/cantorpairing.pdf
    ripple.cantor = {
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
    ripple.szudzik = {
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
        return ripple.szudzik.pair(nx, ny);
    };
    ripple.unpair = function(z) {
        var result = ripple.szudzik.unpair(z);
        if (result.x % 2)
            result.x = -result.x + 1;
        if (result.y % 2)
            result.y = -result.y + 1;
        result.x /= 2;
        result.y /= 2;
        return result;
    };

    ripple.eval = function() {
        var index;
        for (index = 0; index < arguments.length; ++index)
            arguments[index];
    };

    // Framework for canvas applications
    // Object passed as the app is expected to have the following:
    //
    // app.resize(width, height)
    // app.update(elapsed)
    // app.draw(ctx, inv)
    // app.isActive()
    // app.actors = [] // array of actors
    //     actor.resize(width, height)
    //     actor.update(elapsed)
    //     actor.draw(ctx, inv)
    //     actor.isActive()
    // app.pressTimeout // milliseconds before press event
    // app.press(targets) // called on long press
    // app.up(targets, event)
    // app.down(targets, event)
    // app.move(targets, event)
    ripple.appify = function(app, $, parent, viewport) {
        var self = $('<canvas></canvas>').appendTo(parent);

        var tap, selected, drag, gesture, press = 0;

        var zoom = 1;
        var inv = undefined, last = new Date().getTime();
        var draw_id = 0;
        var draw = function() {
            var ctx, ii, width, height;

            draw_id = 0;
            if (self[0].getContext) {
                ctx = self[0].getContext('2d');
                width = self.width();
                height = self.height();

                // Clear invalidated portion of the canvas
                if (inv)
                    ctx.clearRect(inv.x, inv.y, inv.width, inv.height);

                // Allow each actor to increment their state
                if (app.resize)
                    app.resize(width, height);
                if (app.update)
                    app.update(now - last);
                if (app.actors)
                    app.actors.forEach(function(actor) {
                        actor.resize(width, height);
                        actor.update(now - last);
                    });
                last = now;

                // Allow each actor to draw
                ctx.save();
                if (app.draw)
                    app.draw(ctx, inv, width, height); // TODO: canvas clip?
                if (app.actors)
                    app.actors.forEach(function(actor) {
                        // TODO: canvas clip?
                        actor.draw(ctx, inv, width, height);
                        if (actor.isActive())
                            redraw();
                    });
                ctx.restore();
            }
        };

        var redraw = function(rectangle) {
            var endx, endy;
            if (typeof(inv) !== 'undefined' &&
                typeof(rectangle) !== 'undefined') { // merge
                endx = Math.max(
                    inv.x + inv.width, rectangle.x + rectangle.width);
                endy = Math.max(
                    inv.y + inv.height, rectangle.y + rectangle.height);
                inv.x = Math.min(inv.x, rectangle.x);
                inv.y = Math.min(inv.y, rectangle.y);
                inv.width = endx - inv.x;
                inv.height = endy - inv.y;
            } else if (typeof(rectangle) !== 'undefined') { // replace
                inv = rectangle;
            } else inv = { x: 0, y: 0, width: self.width,
                           height: self.height };

            if (!draw_id)
                draw_id = requestAnimationFrame(draw);
        };

        var resize = function(event) {
            // Consume enough space to fill the viewport.
            self.width(viewport.width());
            self.height(viewport.height());

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            self.attr("width", self.innerWidth());
            self.attr("height", self.innerHeight());
            redraw();
        };
        viewport.resize(resize);
        resize();

        // Process mouse and touch events on grid itself
        self.on('mousewheel', function(event) {
            // event.deltaY
        });

        self.on('mousedown touchstart', function(event) {
            var targets = $.targets(event);
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else if (targets.touches.length > 1) {
                tap = targets;
                if (targets.touches.length == 2) {
                    var t0 = targets.touches[0];
                    var t1 = targets.touches[1];
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                // Allow applications to respond to long press events
                if (app.pressTimeout)
                    press = setTimeout(function() {
                        app.press(targets); }, app.pressTimeout);
                if (app.down)
                    app.down(targets, event);
            }

            redraw();
            return false;
        });

        self.on('mousemove touchmove', function(event) {
            if (app.move)
                app.move($.targets(event), event);
            return false;
        });

        self.on('mouseleave mouseup touchend', function(event) {
            if (app.up)
                app.up($.targets(event), event);
            if (press) { clearTimeout(press); press = 0; }
            return false;
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

    var p, z, zz, methods = [ripple.cantor, ripple.szudzik];
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
