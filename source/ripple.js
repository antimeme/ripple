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
    var epsilon = 0.000001;
    var zeroish = function(value) {
        return (!isNaN(value) && value <= epsilon &&
                value >= -epsilon); };

    ripple.vector = {
        // Represents an immutable three dimensional vector.  Only the
        // create, polar and convert methods are safe to call from
        // this object.  Other methods are intended for use within
        // instances.  Vector length is memoized so only the first call
        // performs the computation.
        __length: undefined,
        length: function() {
            return (typeof(this.__length) !== 'undefined') ?
                   this.__length :
                   (this.__length = Math.sqrt(this.dotp(this)));
        },

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

        convert: function(o) {
            // Converts a vector-like object into a proper vector
            return this.create(o.x || 0, o.y || 0, o.z || 0);
        },

        norm: function() {
            // Returns a unit vector with the same direction
            return this.times(1 / this.length());
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

        crossp: function(other) {
            // WARNING: the cross product is a fraud! A cross product is
            // actually the orthogonal complement of the outer
            // product of two vectors.  Geometric algebra is a much
            // better way to solve problems than cross products!
            // https://en.wikipedia.org/wiki/Geometric_algebra
            return ripple.vector.create(
                this.y * other.z - this.z * other.y,
                this.z * other.x - this.x * other.z,
                this.x * other.y - this.y * other.x);
        },

        sqlen: function() { return this.dotp(this); },

        angle: function() {
            // FIXME: account for z
            return Math.acos(this.norm().dotp(this.create(1, 0, 0)));
        },

        rotate: function(v, w) {
            // Return this vector rotated this vector in the plane
            // described by vectors v and w by twice the angle between
            // them.  To rotate by exactly the angle betwen v and w, use
            // v and (v + w) instead since the length of the vectors
            // doesn't affect the result.
            var a, b, c, d; // product of v and w (quaternion or rotor)
            var m, n, o, p; // multivector product of u v w
            var scale = v.sqlen() * w.sqlen();
            if (zeroish(scale))
                return null;
            if (zeroish(v.z) && zeroish(w.z)) {
                // Rotation in two dimensions
                a = v.x * w.x + v.y * w.y;
                b = v.x * w.y - v.y * w.x;
                m = a * this.x - b * this.y;
                n = b * this.x + a * this.y;
                return this.create(
                    (a * m - b * n) / scale,
                    (a * n + b * m) / scale, this.z);
            } else {
                // Rotation in three dimensions
                // Trivector magnitude (a * p - b * o - c * m - d * n)
                // cancels out to zero so the result is a pure vector
                a = v.x * w.x + v.y * w.y + v.z * w.z;
                b = v.x * w.y - v.y * w.x;
                c = v.y * w.z - v.z * w.y;
                d = v.z * w.x - v.x * w.z;
                m = a * this.x - b * this.y + d * this.z;
                n = b * this.x + a * this.y - c * this.z;
                o = c * this.y + a * this.z - b * this.x;
                p = c * this.x + d * this.y + b * this.z;
                return this.create(
                    (a * m - b * n + c * p + d * o) / scale,
                    (a * n + b * m - c * o + d * p) / scale,
                    (a * o + b * p + c * n - d * m) / scale);
            }
        },

        reflect: function(target) {
            // r = d - ((2 d . n) / (n . n)) n
            return (!zeroish(this.dotp(this))) ?
                   target.minus(this.times(2 * this.dotp(target) /
                       this.dotp(this))) : target;
        },

        interpolate: function(destination, t) {
            return this.plus(destination.minus(this).times(t));
        },

        shortestSegment: function(segment) {
            // Returns a vector going from the point represented
            // by this vector to the closest point on the line.
            // The output of this method plus the original vector
            // is the closest point on the line
            var q = segment.q ? segment.q : segment.e.minus(segment.s);
            var q2 = segment.sqlen ? segment.sqlen : q.sqlen();
            return this.minus(segment.s).minus(
                q.times(this.minus(segment.s).dotp(q) / q2));
        },

        toString: function() {
            return 'ripple.vector.create(' + this.x + ', ' +
                   this.y + ', ' + this.z + ')';
        },

        draw: function(context, config) {
            // Draw an arrow representing this vector
            // Intended for debugging purposes
            var length = (config && config.length) ? config.length : 1;
            var bar = ripple.vector.create(-this.y, this.x).times(0.1);
            var lineTo = function(ctx, vector) {
                ctx.lineTo(vector.x, vector.y);
            };

            context.save();
            context.lineCap = 'round';
            context.strokeStyle = (config && config.color) || 'black';
            context.fillStyle = (config && config.fill) || 'white';
            context.lineWidth = (config && config.lineWidth) || 5;
            if (config.center)
                context.translate(config.center.x, config.center.y);

            context.beginPath();
            context.moveTo(0, 0);
            lineTo(context, this.times(length * 0.9));
            lineTo(context, this.plus(bar).times(length * 0.9));
            lineTo(context, this.times(length));
            lineTo(context, this.minus(bar).times(length * 0.9));
            lineTo(context, this.times(length * 0.9));
            context.fill();
            context.stroke();
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
            // TODO
        });
    };

    var quadraticRoots = function(a, b, c) {
        // Computes the real roots of a quadradic expression.  Returns
        // an array with either zero (no real roots) one or two numbers
        // at which the expression is zero
        var result = [];
        var discriminant;
        if (zeroish(a)) {
            result = [-c / b];
        } else {
            discriminant = b * b - 4 * a * c;
            if (discriminant < 0) {
                // No real roots exist so result remains empty
            } else if (discriminant > 0) {
                discriminant = Math.sqrt(discriminant);
                result = [(-b + discriminant) / (2 * a),
                          (-b - discriminant) / (2 * a)];
            } else result = [-b / (2 * a)];
        }
        return result;
    };

    ripple.collideRadiusRadius = function(s1, e1, r1, s2, e2, r2) {
        // Given the two round objects moving at constant velocity,
        // compute the earliest time during the interval at which they
        // will collide. If no collision is possible return undefined.
        //
        // A parameterized path is computed for both objects and the
        // quadratic formula is used to find where that distance is
        // equal to the sum of the radii, which is where edges touch.
        var result = undefined;
        var d1 = e1.minus(s1);
        var d2 = e2.minus(s2);
        var gap = r1 + r2;

        result = quadraticRoots(
            d1.dotp(d1) + d2.dotp(d2) - 2 * d1.dotp(d2),
            2 * s1.dotp(d1) + 2 * s2.dotp(d2) -
            2 * d1.dotp(s2) - 2 * d2.dotp(s1),
            s1.dotp(s1) + s2.dotp(s2) - 2 * s1.dotp(s2) - gap * gap);
        result = result.map(function(v) {
            // Avoids rounding errors that cause missed collisions
            return zeroish(v) ? 0 : v;
        }).filter(function(v) { return ((v >= 0 && v <= 1)); });
        result = (result.length > 0) ? Math.min(result) : undefined;

        // Don't report collision when close and moving away
        if (zeroish(result) &&
            (s1.minus(s2).sqlen() < e1.minus(e2)))
            result = undefined;

        return result;
    }

    ripple.collideRadiusSegment = function(s, e, r, segment) {
        // Given a spherical object moving at constant velocity and a
        // line segment, this routine computes the time at which the
        // two will collide.  The object is assumed to be at s (start
        // point) when t == 0 and at e (end point) when t == 1. If no
        // collision occurs this routine returns undefined.  The
        // segment is an object with the following fields expected:
        //
        //   segment {
        //     s: vector representing starting point
        //     e: vector representing ending point
        //     q: (optional) vector e - s
        //     sqlen: (optional) squared length of segment
        //     width: (optional) width of the segment
        // thickness.  The distance bewteen the end points is an
        // optional which can be used to reduce unnecessary steps.
        //
        // A parameterized path is computed nad the quadratic formula
        // is used to find the fraction of the path at which the edges
        // of the sphere and segment touch
        var result = undefined; // undefined means no collision
        var q = segment.q ? segment.q : segment.e.minus(segment.s);
        var q2 = segment.sqlen ? segment.sqlen : q.sqlen();
        var width = segment.width ? segment.width : 0;
        var ps = s.minus(segment.s).dotp(q) / q.length();
        var pe = e.minus(segment.s).dotp(q) / q.length();
        var ds = s.shortestSegment(segment);
        var de = e.shortestSegment(segment);
        var m, n, mq, nq, gap; // line distance computation variables

        // A zero length segment would create divide-by-zero problems
        // so treat it as a round object instead
        if (zeroish(q2))
            return ripple.collideRadiusRadius(
                s, e, r, segment.s, segment.e, width / 2);
        gap = r + width / 2;
        gap *= gap;

        if (ds.sqlen() < gap) {
            if (ps < 0)
                return ripple.collideRadiusRadius(
                    s, e, r, segment.s, segment.s, width / 2);
            else if (ps > q.length())
                return ripple.collideRadiusRadius(
                    s, e, r, segment.e, segment.e, width / 2);
        }

        // Distance squared is
        //   (p - segment.s) - ((p - segment.s) . q)q/q^2)^2
        // A collision happens when this value is less than
        //   (r - width/2)^2
        // Since p is moving, it can be expanded to p = s + (e - s)t
        // Then we break things down in terms of t and find roots
        m = e.minus(s); mq = m.dotp(q);
        n = s.minus(segment.s); nq = n.dotp(q);

        // Rather than computing square roots, which can be expensive,
        // we compare the square of the distance between point and line
        // to the square of the sum of the radius and wall width.
        // The roots represent the points in time when the difference
        // between these values is zero, which are the moments of
        // collison
        result = quadraticRoots(
            m.dotp(m) - mq * mq / q2,
            2 * m.dotp(n) - 2 * mq * nq / q2,
            n.dotp(n) - nq * nq / q2 - gap);
        result = result.map(function(v) {
            // Avoids rounding errors that cause missed collisions
            return zeroish(v) ? 0 : v;
        }).filter(function(v) { return ((v >= 0 && v <= 1)); });
        result = (result.length > 0) ? Math.min(result) : undefined;

        if (zeroish(result)) {
            // Don't report collisions if the object starts up against
            // the segment but is moving away
            var ds = s.shortestSegment(segment);
            var de = e.shortestSegment(segment);
            if ((de.sqlen() > ds.sqlen()) && ds.dotp(de) > 0)
                result = undefined;
        }

        if (!isNaN(result)) {
            // Ignore collisions that occur outside the boundaries of
            // the segment -- makes it possible to go around segments
            var ps = s.minus(segment.s).dotp(q) / q.length();
            var pe = e.minus(segment.s).dotp(q) / q.length();
            if (ps + r < 0 && pe + r < 0) {
                result = undefined;
            } else if (ps - r > q.length() && pe -r > q.length()) {
                result = undefined;
            }
        }
        return result;
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
