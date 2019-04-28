// triggy.js
// Copyright (C) 2018-2019 by Jeff Gold.
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
// A library for visualizing trigonometry using HTML canvas elements.
// The plan is to illustrate this:
//   http://www.clowder.net/hop/cos(a+b).html
//   https://math.stackexchange.com/questions/1292/how-can-i-understand-and-prove-the-sum-and-difference-formulas-in-trigonometry
//
// The following settings are available:
// * data-enableAngles="1,2,3" - Angles the user is allowed to move
// * data-radii="2,3"    - Draw lines from origin to these points
// * data-connect1="2,3" - Draw lines from point to these points
(function(triggy) {
    'use strict';

    /**
     * Create a normalized data structure to represent a mouse or
     * multi-touch event with coordinates scaled to the element.  When
     * there are touches the coordinates of the first one will be
     * copied to the top level object x and y.  Applications can use
     * that unless multitouch support is needed. */
    var getInputPoints = function(event, element, scalefn) {
        var target = element ? element : event.target;
        var brect = target.getBoundingClientRect();
        var transform = function(id, x, y) {
            var result = {id: id, x: x - brect.left, y: y - brect.top };
            return scalefn ? scalefn(result) : result;
        };
        var ii;
        var result = (!isNaN(event.pageX) && !isNaN(event.pageY)) ?
                     transform(0, event.pageX, event.pageY) : {};

        if (event.targetTouches) {
            result.targets = [];
            for (ii = 0; ii < event.targetTouches.length; ++ii) {
                var touch = event.targetTouches.item(ii);
                if (!isNaN(touch.pageX) && !isNaN(touch.pageY))
                    result.targets.push(
                        transform(touch.identifier,
                                  touch.pageX, touch.pageY));
            }
        }

        if (event.changedTouches) {
            result.changed = [];
            for (ii = 0; ii < event.changedTouches.length; ++ii) {
                var touch = event.changedTouches.item(ii);
                if (!isNaN(touch.pageX) && !isNaN(touch.pageY))
                    result.changed.push(
                        transform(touch.identifier,
                                  touch.pageX, touch.pageY));
            }
        }

        if (result.targets && result.targets.length > 0) {
            result.id = result.targets[0].id;
            result.x = result.targets[0].x;
            result.y = result.targets[0].y;
        } else if (result.changed && result.changed.length > 0) {
            result.id = result.changed[0].id;
            result.x = result.changed[0].x;
            result.y = result.changed[0].y;
        }
        result.target = target;
        return result;
    };

    var eachEntry = function(canvas, entry, fn, context) {
        var value;
        var index;
        var nextEntry = function(canvas, entry, index) {
            var result = canvas.getAttribute('data-' + entry + index);
            return (result === null) ? undefined : result;
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
                result[parseInt(entry, 10)] = true;
            });
        }
        return result;
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
                x: point.x / bounds.size,
                y: (bounds.bottom - point.y) / bounds.size };
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
                x: point.x / bounds.size,
                y: (bounds.bottom - point.y) / bounds.size };
            adjusted.x -= this.tail.x;
            adjusted.y -= this.tail.y;
            factor = Math.sqrt((this.x * this.x + this.y * this.y) /
                (adjusted.x * adjusted.x + adjusted.y * adjusted.y));
            this.head.x = this.tail.x + adusted.x * factor;
            this.head.y = this.tail.y + adusted.y * factor;
        } else if (this.turn) { // default or free
            this.head.x = point.x / bounds.size;
            this.head.y = (bounds.bottom - point.y) / bounds.size;
            if (this.turn === 'default') {
                this.tail.x = this.head.x - this.x;
                this.tail.y = this.head.y - this.y;
            }
        } else { // tail moves like default
            this.tail.x = point.x / bounds.size;
            this.tail.y = (bounds.bottom - point.y) / bounds.size;
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
                x: vector.head.x * bounds.size,
                y: bounds.bottom - vector.head.y * bounds.size });
            if ((!threshold || (current <= threshold * threshold)) &&
                (isNaN(best) || (best > current))) {
                best = current;
                vector.turn = canvas.getAttribute('data-vector-turn') ||
                              'default';
                result = vector;
            }

            current = metric(point, {
                x: vector.tail.x * bounds.size,
                y: bounds.bottom - vector.tail.y * bounds.size });
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
        ctx.fillText('sin' + symbol,
                     bounds.origin.x + (cos * bounds.radius) +
                     bounds.size * (cos >= 0 ? 0.01 : -0.11),
                     bounds.origin.y - (sin * bounds.radius) / 2);
        ctx.fillText('cos' + symbol,
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

    var draw = function(canvas, bounds) {
        var ctx;

        if (!bounds)
            bounds = computeBounds(canvas);
        canvas.width  = bounds.width;
        canvas.height = bounds.height;
        if (!canvas.getContext) {
            console.log('failed: no getContext', canvas);
            return;
        } else if (!(ctx = canvas.getContext('2d'))) {
            console.log('failed: no context', canvas);
            return;
        }
        ctx.clearRect(0, 0, bounds.width, bounds.height);

        if (canvas.getAttribute('data-axes')) {
            ctx.beginPath();
            ctx.moveTo(bounds.left, bounds.origin.y);
            ctx.lineTo(bounds.right, bounds.origin.y);
            ctx.moveTo(bounds.origin.x, bounds.top);
            ctx.lineTo(bounds.origin.x, bounds.bottom);
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgb(0, 0, 0)';
            ctx.stroke();
        }

        if (canvas.getAttribute('data-circle')) {
            ctx.beginPath();
            ctx.moveTo(bounds.origin.x + bounds.radius, bounds.origin.y);
            ctx.arc(bounds.origin.x, bounds.origin.y, bounds.radius,
                    0, (bounds.origin.style === 'center') ?
                    (2 * Math.PI) : (-Math.PI / 2), true);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgb(0, 0, 0)';
            ctx.stroke();
        }

        var angle, cos, sin, index, prev = undefined;
        var arcs = canvas.getAttribute('data-arcs');

        eachEntry(canvas, 'angle', function(angle, index, canvas) {
            angle = parseFloat(angle);
            cos = Math.cos(angle);
            sin = Math.sin(angle);

            var connects = getDataList(canvas, 'connect' + index);
            if (Object.keys(connects).length > 0) {
                ctx.beginPath();
                Object.keys(connects).forEach(function(connect) {
                    var other = parseFloat(canvas.getAttribute(
                        'data-angle' + connect));
                    ctx.moveTo(bounds.origin.x + bounds.radius * cos,
                               bounds.origin.y - bounds.radius * sin);
                    ctx.lineTo(bounds.origin.x + bounds.radius *
                        Math.cos(other),
                               bounds.origin.y - bounds.radius *
                        Math.sin(other));
                });
                ctx.strokeStyle = 'rgb(32, 32, 32)';
                ctx.lineWidth = 4;
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
            vector.draw(ctx, bounds);

            /* ctx.beginPath();
             * ctx.moveTo(bounds.left, bounds.top);
             * ctx.lineTo(bounds.right, bounds.top);
             * ctx.lineTo(bounds.right, bounds.bottom);
             * ctx.lineTo(bounds.left, bounds.bottom);
             * ctx.lineTo(bounds.left, bounds.top);
             * ctx.lineWidth = 3;
             * ctx.strokeStyle = 'black';
             * ctx.stroke();
             */
            if (thunk && false) {
                var tx = thunk.x + bounds.left;
                var ty = bounds.bottom - thunk.y;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.arc(tx, ty, 3, 0, 2 * Math.PI);
                ctx.fillStyle = 'black';
                ctx.fill();
            }
        });
    };

    var thunk = undefined;

    var closestAngle = function(canvas, bounds, point) {
        var result = undefined;
        var best = undefined;
        var enable = getDataList(canvas, 'enableAngles');

        Object.keys(enable).forEach(function(key) {
            var angle = canvas.getAttribute('data-angle' + key);
            var delta = {
                x: bounds.radius * Math.cos(angle) - point.x,
                y: bounds.radius * Math.sin(angle) - point.y};
            var dsquared = delta.x * delta.x + delta.y * delta.y;

            if (isNaN(best) || (dsquared < best)) {
                result = key;
                best = dsquared;
            }
        });
        if (!isNaN(result))
            setAngle(canvas, bounds, point, result);
        return result;
    };

    var setAngle = function(canvas, bounds, point, anum) {
        var lsquared = point.x * point.x + point.y * point.y;
        var angle = Math.acos(point.x / Math.sqrt(lsquared));
        if (point.y < 0)
            angle = -angle;

        if ((bounds.origin.style === 'center') ||
            ((angle >= 0) && (angle <= Math.PI / 2)))
            canvas.setAttribute('data-angle' + anum, angle);
    };

    var boundsfn = function(bounds, scalefn) {
        return function(value) {
            if (isNaN(bounds.origin.x) || isNaN(bounds.origin.y))
                alert('ERROR bounds.origin:' +
                      bounds.origin.x + ', ' + bounds.origin.y);
            else value = {
                x: scalefn(value.x) - bounds.origin.x,
                y: bounds.origin.y - scalefn(value.y) };
            return value;
        };
    };

    triggy.setup = function(selector, scalefn) {
        var elements = document.querySelectorAll(selector);
        Array.prototype.forEach.call(elements, function(canvas, ii) {
            var dragging = null;

            canvas.addEventListener('mousedown', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                var point = getInputPoints(
                    event, canvas, boundsfn(bounds, scalefn));
                thunk = point;
                if (!(dragging = Vector.closest(
                    canvas, bounds, point, 0.25)))
                    dragging = closestAngle(canvas, bounds, point);
                draw(canvas, bounds);
                return false;
            });
            canvas.addEventListener('mousemove', function(event) {
                if (dragging) {
                    var canvas = event.target;
                    var bounds = computeBounds(canvas);
                    var point = getInputPoints(
                        event, canvas, boundsfn(bounds, scalefn));
                    if (dragging instanceof Vector) {
                        dragging.move(canvas, bounds, point);
                    } else setAngle(canvas, bounds, point, dragging);
                    draw(canvas, bounds);
                }
                return false;
            });
            canvas.addEventListener('mouseup', function(event)
                { dragging = null; return false; });
            canvas.addEventListener('mouseleave', function(event)
                { dragging = null; return false; });

            canvas.addEventListener('touchstart', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                var point = getInputPoints(
                    event, canvas, boundsfn(bounds, scalefn));
                dragging = closestAngle(canvas, bounds, point);
                draw(canvas, bounds);
                return false;
            });
            canvas.addEventListener('touchmove', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                if (dragging) {
                    var point = getInputPoints(
                        event, canvas, boundsfn(bounds, scalefn));
                    setAngle(canvas, bounds, point, dragging);
                    draw(canvas, bounds);
                }
                return false;
            });
            canvas.addEventListener('touchend', function(event)
                { dragging = null; return false; });

            canvas.addEventListener('resize', function(event)
                { draw(event.target); });
        });
    }

    triggy.update = function(selector, element) {
        if (!element)
            element = document;
        Array.prototype.forEach.call(
            element.querySelectorAll(selector),
            function(canvas, ii) { draw(canvas); });
    };

})(typeof exports === 'undefined' ? this.triggy = {} : exports);
