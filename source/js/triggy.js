// triggy.js
// Copyright (C) 2018-2021 by Jeff Gold.
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
// A library for visualizing geometry and trigonometry using HTML
// canvas elements.
//
// The plan is to illustrate this:
//   http://www.clowder.net/hop/cos(a+b).html
//   https://math.stackexchange.com/questions/1292/how-can-i-understand-and-prove-the-sum-and-difference-formulas-in-trigonometry
//
// The following settings are available:
// * data-enableAngles="1,2,3" - Angles the user is allowed to move
// * data-radii="2,3"    - Draw lines from origin to these points
// * data-chords1="2,3"  - Draw lines from point to these points
(function(triggy) {
    'use strict';
    if (typeof require === 'function') {
        this.ripple   = require("./ripple/ripple.js");
        this.multivec = require("./ripple/multivec.js");
    }

    var eachEntry = function(canvas, entry, fn, context) {
        // Call a function on the contents of each data entry
        // matching a string followed by a number in a canvas.
        // Starts at one and stops when the next number is missing
        // or empty.
        var value;
        var index;
        var nextEntry = function(canvas, entry, index) {
            var result = canvas.getAttribute('data-' + entry + index);
            return (result !== null) ? result : undefined;
        };

        for (index = 1; typeof(value = nextEntry(
            canvas, entry, index)) !== 'undefined'; ++index)
            fn.call(context, value, index, canvas);
        return context;
    };

    var getDataList = function(canvas, attribute) {
        var result = {};
        var value = canvas.getAttribute('data-' + attribute);
        if (value) {
            value.split(',').forEach(function(entry) {
                var current = parseInt(entry, 10);
                if (isNaN(current)) {
                    current = entry.split(":");
                    if (current.length >= 2)
                        result[parseInt(current[1], 10)] = current[0];
                } else result[current] = true;
            });
        }
        return result;
    };

    var drawCircle = function(ctx, points) {
        // Use conformal geometric algebra to draw a circle from
        // three distinct points.
        var circle = multivec(points[0])
            .createPoint()
            .wedge(multivec(points[1]).createPoint())
            .wedge(multivec(points[2]).createPoint());
        var descrim = circle.wedge(multivec.infinityPoint)
                            .normSquared();
        
        if (multivec.zeroish(descrim)) {
            var last = points[points.length - 1];
            ctx.moveTo(last.x, last.y);
            points.forEach(function(point) {
                ctx.lineTo(point.x, point.y); });
        } else {
            var center = circle.conformalCenter();
            var radius = Math.sqrt(
                circle.times(circle.conjugate())
                      .divide(descrim).scalar);
            ctx.moveTo(center.x + radius, center.y);
            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        }
    };

    var drawLabel = function(ctx, point) {
        if (!point.label)
            return;
        ctx.font = 5 + 'px sans';
        ctx.fillText(point.label,
                     point.x + ((point.x < 50) ? -4 : +1),
                     point.y + ((point.y < 50) ? -2 : +5));
    };

    var features = {
        axes: {
            draw: function(canvas, ctx, bounds, clicked, config) {
                ctx.beginPath();
                ctx.moveTo(bounds.left, bounds.origin.y);
                ctx.lineTo(bounds.right, bounds.origin.y);
                ctx.moveTo(bounds.origin.x, bounds.top);
                ctx.lineTo(bounds.origin.x, bounds.bottom);
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.strokeStyle = 'rgb(0, 0, 0)';
                ctx.stroke();
            }
        },

        circle: {
            draw: function(canvas, ctx, bounds, clicked, config) {
                ctx.beginPath();
                ctx.moveTo(bounds.origin.x + bounds.radius,
                           bounds.origin.y);
                ctx.arc(bounds.origin.x, bounds.origin.y, bounds.radius,
                        0, (bounds.origin.style === 'center') ?
                        (2 * Math.PI) : (-Math.PI / 2), true);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgb(0, 0, 0)';
                ctx.stroke();
            }
        },

        enableAngles: {
            which: null,
            setAngle: function(canvas, bounds, clicked, anum) {
                var relative = multivec({
                    x: clicked.x - bounds.origin.x,
                    y: bounds.origin.y - clicked.y
                });
                var angle = Math.acos(relative.x / relative.norm());
                if (relative.y < 0)
                    angle = -angle;

                if ((bounds.origin.style === 'center') ||
                    ((angle >= 0) && (angle <= Math.PI / 2)))
                    canvas.setAttribute('data-angle' + anum, angle);
                return anum;
            },
            down: function(canvas, bounds, clicked, config) {
                var anum = undefined;
                var best = undefined;
                var enable = getDataList(canvas, 'enableAngles');

                Object.keys(enable).forEach(function(index) {
                    var angle = canvas.getAttribute('data-angle' + index);
                    var delta = multivec({
                        x: Math.cos(angle),
                        y: -Math.sin(angle)
                    }).times(bounds.radius)
                      .plus(bounds.origin)
                      .minus(clicked).quadrance().scalar;
                    if (isNaN(best) || (delta < best)) {
                        anum = index;
                        best = delta;
                    }
                });

                if (!isNaN(anum))
                    this.which = this.setAngle(
                        canvas, bounds, clicked, anum);
            },
            drag: function(canvas, bounds, clicked, config) {
                if (!isNaN(this.which))
                    this.setAngle(canvas, bounds, clicked, this.which);
            }
        },

        conformal: {
            draw: function(canvas, ctx, bounds, clicked, config) {
                ctx.beginPath(); // Number Line
                ctx.moveTo(0, bounds.top + 2 * bounds.size / 3);
                ctx.lineTo(bounds.width,
                           bounds.top + 2 * bounds.size / 3);

                ctx.font = "20px Arial";
                for (var ii = 0; ii < 10; ++ii) {
                    ctx.moveTo(bounds.left + bounds.size / 2 +
                               ii * (bounds.width / 20),
                               bounds.top + 2 * bounds.size / 3 +
                               bounds.size / 50);
                    ctx.lineTo(bounds.left + bounds.size / 2 +
                               ii * (bounds.width / 20),
                               bounds.top + 2 * bounds.size / 3 -
                               bounds.size / 50);
                    ctx.fillText(ii.toString(),
                                 bounds.left + bounds.size / 2 +
                                 ii * (bounds.width / 20) -
                                 ctx.measureText(ii.toString()).width/2,
                                 bounds.top + 11 * bounds.size / 15);
                    if (ii) {
                        ctx.moveTo(bounds.left + bounds.size / 2 -
                                   ii * (bounds.width / 20),
                                   bounds.top + 2 * bounds.size / 3 +
                                   bounds.size / 50);
                        ctx.lineTo(bounds.left + bounds.size / 2 -
                                   ii * (bounds.width / 20),
                                   bounds.top + 2 * bounds.size / 3 -
                                   bounds.size / 50);
                        ctx.fillText(
                            (-ii).toString(),
                            bounds.left + bounds.size / 2 -
                            ii * (bounds.width / 20) -
                            ctx.measureText((-ii).toString()).width/2,
                            bounds.top + 11 * bounds.size / 15);
                    }
                }
                ctx.font = "30px Arial";
                ctx.fillText('\u221e', bounds.left + bounds.size / 2 -
                             ctx.measureText('\u221e').width / 2,
                             bounds.top + 19 * bounds.size / 60);

                ctx.moveTo(bounds.left + 2 * bounds.size / 3,
                           bounds.top + bounds.size / 2);
                ctx.arc(bounds.left + bounds.size / 2,
                        bounds.top + bounds.size / 2, bounds.size / 6,
                        0, Math.PI * 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgb(32, 32, 32)';
                ctx.stroke();

                if (clicked) {
                    ctx.beginPath();
                    ctx.moveTo(bounds.left + bounds.size / 2,
                               bounds.top + bounds.size / 3);
                    ctx.lineTo(clicked.x,
                               bounds.top + 2 * bounds.size / 3);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'rgb(32, 32, 32)';
                    ctx.stroke();

                    ctx.beginPath(); // Point on flat surface
                    ctx.moveTo(clicked.x,
                               bounds.top + 2 * bounds.size / 3);
                    ctx.arc(clicked.x,
                            bounds.top + 2 * bounds.size / 3,
                            bounds.size / 75, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgb(32, 32, 192)';
                    ctx.fill();

                    var circlePoint = intersectLineCircle(
                        {r: bounds.size / 6,
                         x: bounds.left + bounds.size / 2,
                         y: bounds.top + bounds.size / 2},
                        {x: bounds.left + bounds.size / 2,
                         y: bounds.top + bounds.size / 3},
                        {x: clicked.x,
                         y: bounds.top + 2 * bounds.size / 3});
                    ctx.beginPath(); // Point on circle
                    ctx.moveTo(circlePoint.x, circlePoint.y);
                    ctx.arc(circlePoint.x, circlePoint.y,
                            bounds.size / 75, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgb(192, 32, 192)';
                    ctx.fill();
                }

                ctx.beginPath(); // Point at infinity
                ctx.moveTo(bounds.left + bounds.size / 2,
                           bounds.top + bounds.size / 3);
                ctx.arc(bounds.left + bounds.size / 2,
                        bounds.top + bounds.size / 3, bounds.size / 75,
                        0, Math.PI * 2);
                ctx.fillStyle = 'rgb(192, 32, 32)';
                ctx.fill();
            }
        },

        inversionCircle: {
            // This module visualizes inversion with respect to a
            // circle.  This is similar to reflection around a line
            // but is more round.  It's a useful tool for proving
            // Ptolemy's Theorem, which in turn can be used to prove
            // the famous Pthagorean Theorem.
            getSettings: function(config, canvas) {
                var center, radius, color = "black";
                if (typeof(config) === 'string') {
                    var components = config.split('|');
                    if (components.length < 3) {
                        console.error("FAILED-inversionCircle:",
                                      "insufficient data:", config);
                        return false;
                    }
                    center = multivec({
                        x: parseFloat(components[0]),
                        y: parseFloat(components[1])})
                        .createPoint();
                    radius = parseFloat(components[2]);
                    color = components[3] || null;
                } else {
                    console.error("FAILED-inversionCircle:",
                                  "unknown config type:",
                                  typeof(config));
                    return false;
                }

                var result = {
                    center: center, radius: radius, color: color,
                    points: [], triangles: [], circlines: []
                };

                eachEntry(canvas, "inversionPoint", function(value) {
                    var components = value.split('|');
                    if (components.length < 2)
                        return;
                    var point = {
                        x: parseFloat(components[0]),
                        y: parseFloat(components[1]),
                        color: components[2] || "blue",
                        icolor: components[3] || null,
                        label: components[4]
                    };
                    if (!isNaN(point.x) && !isNaN(point.y))
                        this.points.push(point);
                }, result);

                eachEntry(canvas, "inversionCircline", function(
                    circline) {
                    var components = circline.split('|');
                    if (components < 3)
                        return;
                    var i1 = parseInt(components[0], 10);
                    var i2 = parseInt(components[1], 10);
                    var i3 = parseInt(components[2], 10);
                    var color  = components[3] || "green";
                    var icolor = components[4] || null;
                    if ((i1 >= 1) && (i2 >= 1) && (i3 >= 1) &&
                        (i1 <= this.points.length) &&
                        (i2 <= this.points.length) &&
                        (i3 <= this.points.length) &&
                        (i1 !== i2) && (i2 !== i3) && (i3 !== i1))
                        this.circlines.push({
                            i1: i1, i2: i2, i3: i3,
                            color: color, icolor: icolor });
                }, result);

                eachEntry(canvas, "inversionTriangle", function(
                    triangle) {
                    var components = triangle.split('|');
                    if (components.length < 2)
                        return;
                    var first  = parseInt(components[0], 10);
                    var second = parseInt(components[1], 10);
                    var color  = components[2] || "green";
                    var icolor = components[3] || null;
                    if ((first >= 1) && (second >= 1) &&
                        (first !== second) &&
                        (first <= this.points.length) &&
                        (second <= this.points.length))
                        this.triangles.push({
                            first:  first,
                            second: second,
                            color:  color, icolor: icolor});
                }, result);
                return result;
            },

            invert: function(settings, point) {
                var result = {
                    x: point.x - settings.center.x,
                    y: point.y - settings.center.y };
                var factor = (settings.radius * settings.radius /
                    (result.x * result.x + result.y * result.y));
                result.x = settings.center.x + result.x * factor;
                result.y = settings.center.y + result.y * factor;
                result.color = point.icolor;
                result.label = point.label ?
                               (point.label + '\'') : undefined;
                return result;
            },

            draw: function(canvas, ctx, bounds, clicked, config) {
                var settings = this.getSettings(config, canvas);
                if (!settings)
                    return;
                ctx.save();
                ctx.translate(bounds.left, bounds.top);
                ctx.scale(bounds.size / 100, bounds.size / 100);

                if (settings.color) {

                    ctx.beginPath();
                    ctx.lineWidth = 1;
                    ctx.moveTo(settings.center.x + ctx.lineWidth / 2,
                               settings.center.y);
                    ctx.arc(settings.center.x, settings.center.y,
                            ctx.lineWidth / 2, 0, 2 * Math.PI);
                    ctx.fillStyle = settings.color;
                    ctx.fill();

                    ctx.moveTo(settings.center.x + settings.radius,
                               settings.center.y);
                    ctx.arc(settings.center.x, settings.center.y,
                            settings.radius, 0, 2 * Math.PI);
                    ctx.strokeStyle = settings.color;
                    ctx.stroke();
                }

                settings.circlines.forEach(function(circline) {
                    var p1 = settings.points[circline.i1 - 1];
                    var p2 = settings.points[circline.i2 - 1];
                    var p3 = settings.points[circline.i3 - 1];

                    ctx.beginPath();
                    drawCircle(ctx, [p1, p2, p3]);
                    ctx.setLineDash([]);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = circline.color;
                    ctx.stroke();

                    if (!circline.icolor)
                        return;
                    p1 = this.invert(settings, p1);
                    p2 = this.invert(settings, p2);
                    p3 = this.invert(settings, p3);
                    drawCircle(ctx, [p1, p2, p3]);
                    ctx.setLineDash([5, 2, 2, 2]);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = circline.icolor;
                    ctx.stroke();
                }, this);

                settings.triangles.forEach(function(triangle) {
                    var p1 = settings.points[triangle.first - 1];
                    var p2 = settings.points[triangle.second - 1];

                    ctx.beginPath();
                    ctx.moveTo(settings.center.x, settings.center.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(settings.center.x, settings.center.y);
                    ctx.setLineDash([]);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = triangle.color;
                    ctx.stroke();

                    if (!triangle.icolor)
                        return;
                    p1 = this.invert(settings, p1);
                    p2 = this.invert(settings, p2);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(settings.center.x, settings.center.y);
                    ctx.setLineDash([5, 2, 2, 2]);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = triangle.icolor;
                    ctx.stroke();
                }, this);

                settings.points.forEach(function(point) {
                    var ratio = 3;
                    ctx.lineWidth = 1 / ratio;
                    ctx.setLineDash([]);

                    ctx.beginPath();
                    ctx.moveTo(point.x + ratio * ctx.lineWidth,
                               point.y);
                    ctx.arc(point.x, point.y,
                            1, 0, 2 * Math.PI);
                    ctx.fillStyle = point.color;
                    ctx.fill();
                    drawLabel(ctx, point);

                    if (!point.icolor)
                        return;
                    var inverted = this.invert(settings, point);
                    ctx.beginPath();
                    ctx.moveTo(inverted.x + ratio * ctx.lineWidth,
                               inverted.y);
                    ctx.arc(inverted.x, inverted.y,
                            1, 0, 2 * Math.PI);
                    ctx.strokeStyle = point.color;
                    ctx.stroke();
                    drawLabel(ctx, inverted);
                }, this);

                ctx.restore();
            },

            down: function(canvas, bounds, clicked, config) {
                // Determine which point is nearest and mark that
                // for use in the drag method below
                var settings = this.getSettings(config, canvas);
                if (!settings)
                    return;
                var adjusted = multivec({
                    x: 100 * (clicked.x - bounds.left) / bounds.size,
                    y: 100 * (clicked.y - bounds.top) / bounds.size
                });
                var current = undefined;
                this.which = undefined;

                settings.points.forEach(function(point, index) {
                    var dsquared = adjusted.minus(point).normSquared();
                    if (isNaN(current) || (dsquared < current)) {
                        this.which = index;
                        current = dsquared;
                    }
                }, this);
            },

            drag: function(canvas, bounds, clicked, config) {
                // Change the chosen points coordinates and push them
                // to the canvas data attributes
                if (isNaN(this.which) || (this.which < 0))
                    return;
                var settings = this.getSettings(config, canvas);
                if (!settings || (this.which >= settings.points.length))
                    return;
                var adjusted = {
                    x: 100 * (clicked.x - bounds.left) / bounds.size,
                    y: 100 * (clicked.y - bounds.top) / bounds.size,
                    color:  settings.points[this.which].color,
                    icolor: settings.points[this.which].icolor,
                    label:  settings.points[this.which].label
                };
                settings.points[this.which] = adjusted;
                var attribute = 
                    settings.points[this.which].x.toFixed(3) + '|' +
                    settings.points[this.which].y.toFixed(3) + '|' +
                    settings.points[this.which].color + '|' +
                    (settings.points[this.which].icolor || '');
                if (settings.points[this.which].label)
                    attribute += '|' +
                                 settings.points[this.which].label;
                canvas.setAttribute('data-inversionPoint' +
                                    (this.which + 1), attribute);
            }
        }
    };

    /**
     * Computes some useful locations within a canvas in a size
     * independent manner. */
    var computeBounds = function(canvas, origin) {
        var result = {
            width: canvas.clientWidth,
            height: canvas.clientHeight };
        result.size = Math.min(result.width, result.height);
        result.extents = {
            top: (result.height - result.size) / 2,
            left: (result.width - result.size) / 2,
            bottom: result.height - (result.height - result.size) / 2,
            right:  result.width  - (result.width  - result.size) / 2 };

        result.margin = 0.05;
        result.top = result.extents.top + (result.size * result.margin);
        result.left = result.extents.left + (
            result.size * result.margin);
        result.bottom = result.extents.bottom - (
            result.size * result.margin);
        result.right = result.extents.right - (
            result.size * result.margin);

        result.radii = getDataList(canvas, 'radii');

        var origin = canvas.getAttribute('data-origin');
        if (origin === 'center') {
            result.origin = {
                style: 'center',
                x: (result.right + result.left) / 2,
                y: (result.top + result.bottom) / 2 };
            result.radius = result.size * (1 - result.margin) / 2;
        } else {
            result.origin = {
                style: 'bleft', x: result.left, y: result.bottom };
            result.radius = Math.min(result.right - result.left,
                                     result.bottom - result.top);
        }

        return result;
    };

    var Vector = function(value, index) {
        if (!(this instanceof Vector))
            return new Vector(value, index);

        this.index = index;
        if (!Array.isArray(value))
            value = value.split('|');
        this.tail = {
            x: parseFloat(value[0]),
            y: parseFloat(value[1]) };
        this.head = {
            x: parseFloat(value[2]),
            y: parseFloat(value[3]) };
        this.color = value[4] || 'purple';
        this.fill  = value[5] || this.color;
        this.label = value[6];

        this.x = this.head.x - this.tail.x;
        this.y = this.head.y - this.tail.y;
        var cross = {x: this.y, y: -this.x };
        this.factor = Math.sqrt(cross.x * cross.x +
                                cross.y * cross.y) * 15;
        this.left = {
            x: this.head.x - this.x / this.factor +
               cross.x / this.factor / 2,
            y: this.head.y - this.y / this.factor +
               cross.y / this.factor / 2 };
        this.right = {
            x: this.head.x - this.x / this.factor -
               cross.x / this.factor / 2,
            y: this.head.y - this.y / this.factor -
               cross.y / this.factor / 2};
    };

    Vector.prototype.draw = function(ctx, bounds) {
        ctx.save();
        ctx.translate(bounds.left, bounds.top);
        ctx.scale(bounds.size, bounds.size);
        ctx.fillStyle = this.fill;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4 / bounds.size;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(this.tail.x, this.tail.y);
        ctx.lineTo(this.head.x, this.head.y);
        ctx.moveTo(this.head.x, this.head.y);
        ctx.lineTo(this.left.x, this.left.y);
        ctx.bezierCurveTo(this.head.x, this.head.y,
                          this.right.x, this.right.y,
                          this.right.x, this.right.y);
        ctx.lineTo(this.head.x, this.head.y);
        ctx.stroke();
        ctx.fill();
        ctx.restore();
        if (this.label) {
            ctx.fillStyle = this.fill;
            ctx.strokeStyle = this.color;
            ctx.font = 24 + 'px sans';
            ctx.fillText(this.label.trim().replace(/  */g, ' '),
                         bounds.left + bounds.size * (
                             this.head.x + this.x / this.factor),
                         bounds.top + bounds.size * (
                             this.head.y + this.y / this.factor));
        }
    };

    Vector.prototype.move = function(canvas, bounds, point) {
        var adjusted, factor;
        if (this.turn === 'stretch') {
            adjusted = {
                x: (point.x - bounds.left) / bounds.size,
                y: (point.y - bounds.top) / bounds.size };
            adjusted.x -= this.tail.x;
            adjusted.y -= this.tail.y;
            factor = Math.sqrt((adjusted.x * adjusted.x +
                                adjusted.y * adjusted.y) /
                (this.x * this.x + this.y * this.y));
            if (adjusted.x * this.x + adjusted.y * this.y < 0)
                factor = -1 * factor;
            this.x *= factor;
            this.y *= factor;
            this.head.x = this.tail.x + this.x;
            this.head.y = this.tail.y + this.y;
        } else if (this.turn === 'rotate') {
            adjusted = {
                x: (point.x - bounds.left) / bounds.size,
                y: (point.y - bounds.top) / bounds.size };
            adjusted.x -= this.tail.x;
            adjusted.y -= this.tail.y;
            factor = Math.sqrt((this.x * this.x + this.y * this.y) /
                (adjusted.x * adjusted.x + adjusted.y * adjusted.y));
            this.head.x = this.tail.x + adjusted.x * factor;
            this.head.y = this.tail.y + adjusted.y * factor;
        } else if (this.turn) { // default or free
            this.head.x = (point.x - bounds.left) / bounds.size;
            this.head.y = (point.y - bounds.top) / bounds.size;
            if (this.turn === 'default') {
                this.tail.x = this.head.x - this.x;
                this.tail.y = this.head.y - this.y;
            }
        } else { // tail moves like default
            this.tail.x = (point.x - bounds.left) / bounds.size;
            this.tail.y = (point.y - bounds.top) / bounds.size;
            this.head.x = this.tail.x + this.x;
            this.head.y = this.tail.y + this.y;
        }
        canvas.setAttribute("data-vector" + this.index,
                            [this.tail.x, this.tail.y,
                             this.head.x, this.head.y,
                             this.color, this.fill,
                             this.label].join('|'));
    };

    Vector.each = function(canvas, fn, context) {
        eachEntry(canvas, 'vector', function(value, index) {
            fn.call(context, Vector(value, index), index); }); };

    Vector.closest = function(canvas, bounds, point, threshold) {
        var result = undefined;
        var best = undefined;
        if (threshold)
            threshold *= bounds.size;

        Vector.each(canvas, function(vector) {
            var current;
            var metric = function(point, target) {
                var diff = { x: target.x - point.x,
                             y: target.y - point.y };
                return diff.x * diff.x + diff.y * diff.y;
            };

            current = metric(point, {
                x: bounds.left + vector.head.x * bounds.size,
                y: bounds.top + vector.head.y * bounds.size });
            if ((!threshold || (current <= threshold * threshold)) &&
                (isNaN(best) || (best > current))) {
                best = current;
                vector.turn = canvas.getAttribute('data-vector-move') ||
                              'default';
                result = vector;
            }

            current = metric(point, {
                x: bounds.left + vector.tail.x * bounds.size,
                y: bounds.top + vector.tail.y * bounds.size });
            if ((!threshold || (current <= threshold * threshold)) &&
                (isNaN(best) || (best > current))) {
                vector.turn = false;
                best = current;
                result = vector;
            }
        });
        return result;
    };

    var drawRay = function(ctx, bounds, anum, color,
                           angle, cos, sin) {
        ctx.beginPath();
        if (bounds.radii[anum]) {
            ctx.moveTo(bounds.origin.x, bounds.origin.y);
            ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                       bounds.origin.y - sin * bounds.radius);
        } else ctx.moveTo(bounds.origin.x + cos * bounds.radius,
                          bounds.origin.y - sin * bounds.radius);
        ctx.arc(bounds.origin.x + cos * bounds.radius,
                bounds.origin.y - sin * bounds.radius,
                bounds.radius / 30,
                0, 2 * Math.PI);
        ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                   bounds.origin.y - sin * bounds.radius);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fill();
    };

    var drawDeco = function(ctx, bounds, symbol, angle, sin, cos) {
        var decosize = bounds.radius * 0.1;
        var xdeco = (cos >= 0) ? decosize : -decosize;
        var ydeco = (sin >= 0) ? decosize : -decosize;

        ctx.beginPath();
        ctx.fillStyle = 'rgb(64, 64, 64)';
        ctx.strokeStyle = 'rgb(64, 64, 64)';

        // Draw a triangle using sin and cos
        ctx.moveTo(bounds.origin.x + cos * bounds.radius,
                   bounds.origin.y - sin * bounds.radius);
        ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                   bounds.origin.y);
        ctx.lineTo(bounds.origin.x, bounds.origin.y);

        // If there's enough room, draw a right-angle box
        var roomy = 0.99;
        if ((cos < roomy) && (cos > -roomy) &&
            (sin < roomy) && (sin > -roomy)) {
            ctx.moveTo(bounds.origin.x + cos * bounds.radius -
                       xdeco, bounds.origin.y);
            ctx.lineTo(bounds.origin.x + cos * bounds.radius -
                       xdeco, bounds.origin.y - ydeco);
            ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                       bounds.origin.y - ydeco);
        }

        // Draw an arc to represent the angle
        if ((angle < Math.PI / 2 - 0.02) ||
            (angle > Math.PI / 2)) {
            ctx.moveTo(bounds.origin.x + 3 * cos * decosize / 2,
                       bounds.origin.y);
            ctx.arc(bounds.origin.x, bounds.origin.y,
                    3 * decosize / 2, 0, -angle, true);
        } else {
            ctx.moveTo(bounds.origin.x + xdeco, bounds.origin.y);
            ctx.lineTo(bounds.origin.x + xdeco, bounds.origin.y - ydeco);
            ctx.lineTo(bounds.origin.x, bounds.origin.y - ydeco);
        }

        ctx.font = Math.floor(bounds.size / 10) + 'px Verdana';
        ctx.fillText(symbol, bounds.origin.x + (cos * bounds.radius / 4),
                     bounds.origin.y - (sin * bounds.radius / 8));
        ctx.font = Math.floor(bounds.size / 20) + 'px Verdana';
        ctx.fillText((sin >= 0 ? 'sin' : '-sin') + symbol,
                     bounds.origin.x + (cos * bounds.radius) +
                     bounds.size * (cos >= 0 ? 0.01 : -0.11),
                     bounds.origin.y - (sin * bounds.radius) / 2);
        ctx.fillText((cos >= 0 ? 'cos' : '-cos') + symbol,
                     bounds.origin.x + (cos * bounds.radius) / 2,
                     bounds.origin.y + bounds.size  *
            (sin >= 0 ? 0.05 : -0.03));

        ctx.lineWidth = 2;
        ctx.stroke();
    };

    var angleList = [
        {name: 'alpha',  symbol: '\u{1d6fc}', color: 'rgb(32, 32, 32)'},
        {name: 'beta',   symbol: '\u{1d6fd}', color: 'rgb(32, 32, 32)'},
        {name: 'gamma',  symbol: '\u{1d7fe}', color: 'rgb(32, 32, 32)'},
        {name: 'delta',  symbol: '\u{1d6ff}', color: 'rgb(32, 32, 32)'},
        {name: 'epsilon', symbol: '\u{1d700}',
         color: 'rgb(32, 32, 32)'},
        {name: 'zeta',   symbol: '\u{1d701}', color: 'rgb(32, 32, 32)'},
        {name: 'eta',    symbol: '\u{1d702}', color: 'rgb(32, 32, 32)'},
        {name: 'theta',  symbol: '\u{1d703}', color: 'rgb(32, 32, 32)'},
        {name: 'iota',   symbol: '\u{1d704}', color: 'rgb(32, 32, 32)'},
        {name: 'kappa',  symbol: '\u{1d705}', color: 'rgb(32, 32, 32)'},
        {name: 'lambda', symbol: '\u{1d706}', color: 'rgb(32, 32, 32)'},
        {name: 'mu',     symbol: '\u{1d707}', color: 'rgb(32, 32, 32)'},
        {name: 'nu',     symbol: '\u{1d708}', color: 'rgb(32, 32, 32)'},
        {name: 'xi',     symbol: '\u{1d709}', color: 'rgb(32, 32, 32)'},
        {name: 'omicron', symbol: '\u{1d70a}',
         color: 'rgb(32, 32, 32)'},
        {name: 'pi',     symbol: '\u{1d70b}', color: 'rgb(32, 32, 32)'},
        {name: 'rho',    symbol: '\u{1d70c}', color: 'rgb(32, 32, 32)'},
        {name: 'sigma',  symbol: '\u{1d70e}', color: 'rgb(32, 32, 32)'},
        {name: 'tau',    symbol: '\u{1d70f}', color: 'rgb(32, 32, 32)'},
        {name: 'upsilon', symbol: '\u{1d710}',
         color: 'rgb(32, 32, 32)'},
        {name: 'phi',    symbol: '\u{1d711}', color: 'rgb(32, 32, 32)'},
        {name: 'chi',    symbol: '\u{1d712}', color: 'rgb(32, 32, 32)'},
        {name: 'psi',    symbol: '\u{1d713}', color: 'rgb(32, 32, 32)'},
        {name: 'omega',  symbol: '\u{1d714}', color: 'rgb(32, 32, 32)'},
    ];
    var angleTable = {};
    angleList.forEach(function(angle) {
        angleTable[angle.name] = angle; });

    var intersectLineCircle = function(c, p1, p2) {
        var pp1 = {x: p1.x - c.x, y: p1.y - c.y};
        var pp2 = {x: p2.x - c.x, y: p2.y - c.y};
        var det = pp1.x * pp2.y - pp2.x * pp1.y;
        var delta = {x: pp2.x - pp1.x, y: pp2.y - pp1.y};
        var dr2 = delta.x * delta.x + delta.y * delta.y;
        var discrim = Math.sqrt(c.r * c.r * dr2 - det * det);
        return {x: c.x + (det * delta.y + delta.x * discrim) / dr2,
                y: c.y + (-det * delta.x + delta.y * discrim) / dr2};
    };

    var draw = function(canvas, bounds) {
        var ctx;
        canvas.width  = bounds.width;
        canvas.height = bounds.height;
        if (!canvas.getContext) {
            console.log('FAILED: no getContext', canvas);
            return;
        } else if (!(ctx = canvas.getContext('2d'))) {
            console.log('FAILED: no context', canvas);
            return;
        }
        ctx.clearRect(0, 0, bounds.width, bounds.height);

        Object.keys(features).forEach(function(name) {
            var feature = features[name];
            var config = canvas.getAttribute('data-' + name);
            if (feature.draw && config)
                feature.draw(canvas, ctx, bounds, clicked, config);
        });

        var angle, cos, sin, index, prev = undefined;
        var arcs = canvas.getAttribute('data-arcs');

        eachEntry(canvas, 'angle', function(angle, index, canvas) {
            angle = parseFloat(angle);
            cos = Math.cos(angle);
            sin = Math.sin(angle);

            var chords = getDataList(canvas, 'chords' + index);
            if (Object.keys(chords).length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = chords.color || 'rgb(32, 32, 32)';
                ctx.lineWidth = 4;
                Object.keys(chords).forEach(function(connect) {
                    if (typeof(chords[connect]) === 'string') {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.strokeStyle = chords[connect];
                    }
                    var other = parseFloat(canvas.getAttribute(
                        'data-angle' + connect));
                    ctx.moveTo(
                        bounds.origin.x + bounds.radius * cos,
                        bounds.origin.y - bounds.radius * sin);
                    ctx.lineTo(
                        bounds.origin.x + bounds.radius *
                        Math.cos(other),
                        bounds.origin.y - bounds.radius *
                            Math.sin(other));
                });
                ctx.stroke();
            }

            if (arcs) {
                if (index > 0) {
                    ctx.beginPath();
                    ctx.moveTo(bounds.origin.x + bounds.radius * cos,
                               bounds.origin.y - bounds.radius * sin);
                    ctx.arc(bounds.origin.x, bounds.origin.y,
                            bounds.radius, -angle, -prev, true);
                    ctx.strokeStyle = 'rgb(64, 234, 234)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                prev = angle;
            }
        });

        eachEntry(canvas, 'angle', function(angle, index, canvas) {
            angle = parseFloat(angle);
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var name = canvas.getAttribute('data-name' + index);
            var symbol = canvas.getAttribute('data-symbol' + index);
            var color = canvas.getAttribute('data-color' + index);
            var deco  = canvas.getAttribute('data-decorate' + index);

            var angleDesc = angleTable[name];
            if (!angleDesc)
                angleDesc = angleList[index - 1];
            if (angleDesc && !symbol)
                symbol = angleDesc.symbol;
            if (angleDesc && !color)
                color = angleDesc.color;

            if (deco)
                drawDeco(ctx, bounds, symbol, angle, sin, cos);
            drawRay(ctx, bounds, index, color, angle, cos, sin);
        });

        eachEntry(canvas, 'point', function(p, index, canvas) {
            p = p.split('|');
            var point = {
                x: bounds.left + bounds.size * parseFloat(p[0]),
                y: bounds.top  + bounds.size * parseFloat(p[1]),
                label: p[2], color: p[3] || 'blue'
            };

            point.lx = (point.x < bounds.left + bounds.size / 2) ?
                      -(bounds.radius / 20) : (bounds.radius / 60);
            point.ly = (point.y < bounds.top + bounds.size / 2) ?
                      -(bounds.radius / 30) : (bounds.radius / 15);

            ctx.beginPath();
            ctx.fillStyle = ctx.strokeStyle = point.color;
            if (point.label) {
                ctx.font = Math.floor(bounds.radius / 20) + 'px sans';
                ctx.fillText(point.label, point.x + point.lx,
                             point.y + point.ly);
            }
            ctx.arc(point.x, point.y,
                    bounds.radius / 40, 0, 2 * Math.PI, true);
            ctx.fill();
            ctx.stroke();
        });

        Vector.each(canvas, function(vector, index, canvas) {
            vector.draw(ctx, bounds); });
    };

    var clicked = undefined;

    triggy.setup = function(selector, scalefn) {
        var elements = document.querySelectorAll(selector);
        Array.prototype.forEach.call(elements, function(canvas, ii) {
            var dragging = false;
            var dragVector = null;

            var down = function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                var point = ripple.getInputPoints(
                    event, canvas, scalefn);
                clicked = point;
                dragging = true;
                dragVector = Vector.closest(
                    canvas, bounds, point, 0.25);

                Object.keys(features).forEach(function(name) {
                    var feature = features[name];
                    var config = canvas.getAttribute('data-' + name);
                    if (feature.down && config)
                        feature.down(canvas, bounds, point, config);
                });
                draw(canvas, bounds);
                return false;
            };

            var drag = function(event) {
                if (!dragging)
                    return false;

                var canvas = event.target;
                var bounds = computeBounds(canvas);
                var point = ripple.getInputPoints(
                    event, canvas, scalefn);
                if (dragVector)
                    dragVector.move(canvas, bounds, point);

                Object.keys(features).forEach(function(name) {
                    var feature = features[name];
                    var config = canvas.getAttribute(
                        'data-' + name);
                    if (feature.drag && config)
                        feature.drag(canvas, bounds, point, config);
                });
                draw(canvas, bounds);
                return false;
            };

            // Attach event handlers to the canvas
            canvas.addEventListener('mousedown', down);
            canvas.addEventListener('mousemove', drag);
            canvas.addEventListener('mouseup', function(event)
                { dragVector = null; dragging = false; return false; });
            canvas.addEventListener('mouseleave', function(event)
                { dragVector = null; dragging = false; return false; });
            canvas.addEventListener('touchstart', down);
            canvas.addEventListener('touchmove', drag);
            canvas.addEventListener('touchend', function(event)
                { dragVector = null; dragging = false; return false; });
            canvas.addEventListener('resize', function(event)
                { draw(event.target, computeBounds(event.target)); });
        });
    }

    triggy.update = function(selector, element) {
        if (!element)
            element = document;
        Array.prototype.forEach.call(
            element.querySelectorAll(selector),
            function(canvas, ii) {
                draw(canvas, computeBounds(canvas)); });
    };

})(typeof exports === 'undefined' ? this.triggy = {} : exports);
