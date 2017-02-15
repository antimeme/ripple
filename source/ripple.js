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
    'use strict';
    var epsilon = 0.000001;

    var zeroish = function(value)
    { return (value <= epsilon && value >= -epsilon); };

    ripple.vector = {
        // Represents an immutable three dimensional vector.  Only the
        // create and polar methods are safe to call from this object.
        // Other methods are intended for use within instances.
        __length: undefined,

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
            var x, y, z;
            var cosphi = phi ? Math.cos(phi) : 1;
            return this.create(r * Math.cos(theta) * cosphi,
                               r * Math.sin(theta) * cosphi,
                               phi ? (r * Math.sin(phi)) : 0);
        },

        norm: function() {
            var length = this.length();
            var result = this.times(1 / length);
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

        length: function() {
            return (typeof(this.__length) !== 'undefined') ?
                   this.__lenght :
                   (this.__length = Math.sqrt(this.dotp(this)));
        },

        angle: function() {
            // FIXME: account for z
            return Math.acos(this.norm().x);
        },

        reflect: function(target) {
            // r = d - ((2 d . n) / (n . n)) n
            return (this.dotp(this) > epsilon) ?
                   target.minus(this.times(2 * this.dotp(target) /
                       this.dotp(this))) : target;
        },

        closestLineT: function(p1, p2) {
            // Computes time representing the closest point on a line,
            // where time represents parameterized movement from p1
            // to p2 in one unit of time.
            var p1mp  = p1.minus(this);
            var p2mp1 = p2.minus(p1);
            return -(p1mp.dot(p2mp1) / p2mp1.dot(p2mp1));
        },
        closestLinePoint: function(p1, p2) {
            // Computes the point on a line closest to this point
            var t = this.closestLineT(p1, p2);
            return this.create(p1.x + (p2.x - p1.x) * t,
                               p1.y + (p2.y - p1.y) * t,
                               p1.z + (p2.z - p1.z) * t);
        },

        closestLineD2: function(p1, p2) {
            // Computes square of the distance between a line and this
            var p1mp  = p1.minus(this);
            var p2mp1 = p2.minus(p1);
            return (((p1mp.dot(p1mp) * p2mp1.dot(p2mp1)) -
                     p1mp.dot(p2mp1) * p1mp.dot(p2mp1)) /
                p2mp1.dot(p2mp1));
        },
        closestLineDistance: function(p1, p2)
        { return Math.sqrt(this.closestLineD2(p1, p2)); },

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

    var buildBSP = function(walls) {
        // Creates a Binary Space Partition tree that allows
        // best-case logarithmic searching for collisions with
        // a given array of walls.  Each entry in the walls array
        // must be an object with an 's' and 'e' property, each
        // of which contains an 'x' and a 'y' property.
        walls.forEach(function(wall) {
        });
    };

    var linearCollide = function(s1, e1, r1, s2, e2, r2) {
        // Given the two spherical objects moving at constant
        // velocity, this routine computes the earliest time
        // greater than or equal to zero at which they will collide.
        // If no collision is possible the result will be undefined.
        // Each object requires a starting point, ending point and
        // radius for this computation.
        //
        // The math here is derived by computing a parameterized
        // path followed by both objects and computing the distance
        // between them over time.  Then the quadratic formula is
        // used to find where that distance is equal to the sum
        // of the radii, which is when their edges touch.
        var result = undefined;
        var startDiff, pathDiff;
        var a, b, c, discriminant;
        var t1, t2;

        startDiff = this.sub(s1, s2);
        pathDiff = this.sub(this.sub(e1, s1), this.sub(e2, s2));
        a = pathDiff.sqdist();
        b = 2 * pathDiff.dot(startDiff);
        c = startDiff.sqdist() - (r1 + r2) * (r1 + r2);
        if (zeroish(a)) {
            // When a is zero (or close enough) the parameterized
            // distance is linear rather than quadratic with time.
            // There can be only one collision point.
            if (c <= 0)
                result = 0;
            else if (b < 0)
                result = -c / b;
        } else {
            discriminant = b * b - 4 * a * c;
            if (discriminant < 0) {
                // The paths don't overlap enough for a collision to
                // ever take place.  Result remains undefined
            } else if (discriminant > 0) {
                discriminant = Math.sqrt(discriminant);
                t1 = (-b + discriminant) / (2 * a);
                t2 = (-b - discriminant) / (2 * a);

                if (t1 >= 0) {
                    if (t2 >= 0)
                        result = t1 < t2 ? t1 : t2;
                    else result = t1;
                } else if (t2 >= 0)
                    result = t2;
            } else if (b <= 0)
                result = -b / (2 * a);
        }
        return result;
    }

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
    ripple.app = function($, container, viewport, app) {
        var canvas = $('<canvas>').attr({
            'class': 'board'
        }).css({
            margin: 'auto', display: 'block',
            color: app.color || '#222',
            background: app.background || '#ddd'
        }).appendTo(container);

        var draw_id = 0, draw_last = 0;
        var draw = function() {
            var ii, ctx, width, height;
            var now = new Date().getTime();
            draw_id = 0;

            if (canvas.get(0).getContext) {
                width = canvas.width();
                height = canvas.height();
                ctx = canvas[0].getContext('2d');
                ctx.clearRect(0, 0, width, height);
                app.draw(ctx, width, height, now, draw_last);
            }
            draw_last = now;
            if (!app.isActive || app.isActive())
                redraw();
        };

        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        var resize = function(event) {
	    canvas.width(viewport.width());
	    canvas.height(viewport.height());
            if (app.resize)
                app.resize(canvas.innerWidth(), canvas.innerHeight());

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            canvas.attr("width", canvas.innerWidth());
            canvas.attr("height", canvas.innerHeight());

            redraw();
        };

        canvas.resize(resize);
        resize();

	viewport.on('keydown', function(event) {
            if (app.keydown)
                return app.keydown(event, redraw);
	});

	viewport.on('keyup', function(event) {
            if (app.keyup)
                return app.keyup(event, redraw);
	});

        viewport.on('mousedown touchstart', function(event) {
            if (app.mtdown)
                return app.mtdown(event, redraw);
        });

        viewport.on('mousemove touchmove', function(event) {
            if (app.mtmove)
                return app.mtmove(event, redraw);
        });

        viewport.on('mouseleave mouseup touchend', function(event) {
            if (app.mtup)
                return app.mtup(event, redraw);
        });

        viewport.on('mousewheel', function(event) {
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
