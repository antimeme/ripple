// triggy.js
// Copyright (C) 2018 by Jeff Gold.
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
//
// The following settings are available:
// * data-enable="1,2,3" - Angles the user is allowed to move
// * data-radii="2,3"    - Draw lines from origin to these points
// * data-connect1="2,3" - Draw lines from point to these points
(function(triggy) {
    'use strict';

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
            console.log('failed: no getContext', canvas); return;
        } else if (!(ctx = canvas.getContext('2d'))) {
            console.log('failed: no context', canvas); return;
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

        var angle, cos, sin, anum, prev = undefined;
        var arcs = canvas.getAttribute('data-arcs');

        var nextAngle = function(canvas, anum) {
            var result = canvas.getAttribute('data-angle' + anum);
            if (result === null)
                result = undefined;
            return result;
        };

        for (anum = 1; !isNaN(angle = nextAngle(canvas, anum));
             ++anum) {
            angle = parseFloat(angle);
            cos = Math.cos(angle);
            sin = Math.sin(angle);

            var connects = getDataList(canvas, 'connect' + anum);
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
                if (anum > 0) {
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
        }

        if (canvas.getAttribute('data-arcs')) {
            for (anum = 1; !isNaN(angle = nextAngle(canvas, anum));
                 ++anum) {
            }
        }

        for (anum = 1; !isNaN(angle = nextAngle(canvas, anum));
             ++anum) {
            angle = parseFloat(angle);
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var name = canvas.getAttribute('data-name' + anum);
            var symbol = canvas.getAttribute('data-symbol' + anum);
            var color = canvas.getAttribute('data-color' + anum);
            var deco  = canvas.getAttribute('data-decorate' + anum);

            var angleDesc = angleTable[name];
            if (!angleDesc)
                angleDesc = angleList[anum - 1];
            if (angleDesc && !symbol)
                symbol = angleDesc.symbol;
            if (angleDesc && !color)
                color = angleDesc.color;

            if (deco)
                drawDeco(ctx, bounds, symbol, angle, sin, cos);
            drawRay(ctx, bounds, anum, color, angle, cos, sin);
        }
    };

    var closestAngle = function(canvas, bounds, point) {
        var result = undefined;
        var best = undefined;
        var enable = getDataList(canvas, 'enable');

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

    var pointify = function(canvas, bounds, event, scalefn) {
        var result = null;
        var brect = canvas.getBoundingClientRect();
        if (!scalefn) // identity scaling if no scale function provided
            scalefn = function(value) { return value; };
        var transform = function(x, y) {
            if (isNaN(x) || isNaN(y))
                alert('ERROR point: ' + x + ', ' + y);
            else if (isNaN(brect.left) || isNaN(brect.top))
                alert('ERROR brect:' + brect.left + ', ' + brect.top);
            else if (isNaN(bounds.origin.x) || isNaN(bounds.origin.y))
                alert('ERROR bounds.origin:' +
                      bounds.origin.x + ', ' + bounds.origin.y);
            return { x: scalefn(x - brect.left) - bounds.origin.x,
                     y: bounds.origin.y - scalefn(y - brect.top) };
        };

        if (event.targetTouches) {
            var current = [];
            var ii;

            for (ii = 0; ii < event.targetTouches.length; ++ii) {
                var touch = event.targetTouches.item(ii);
                current.push(transform(touch.pageX, touch.pageY));
            }

            if (current.length > 0)
                result = current[0];
            else if (event.changedTouches) {
                for (ii = 0; ii < event.changedTouches.length; ++ii) {
                    var touch = event.changedTouches.item(ii);
                    current.push(
                        transform(touch.pageX, touch.pageY));
                }

                if (current.length > 0)
                    result = current[0];
                else alert('ERROR empty target and changed');
            } else { alert('ERROR empty target but no changed'); }
        } else result = transform(event.pageX, event.pageY);
        return result;
    };

    triggy.setup = function(selector, scalefn) {
        var elements = document.querySelectorAll(selector);
        Array.prototype.forEach.call(elements, function(canvas, ii) {
            var dragging = null;

            canvas.addEventListener('mousedown', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                var point = pointify(canvas, bounds, event, scalefn);
                dragging = closestAngle(canvas, bounds, point);
                draw(canvas, bounds);
                return false;
            });
            canvas.addEventListener('mousemove', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                if (dragging) {
                    var point = pointify(
                        canvas, bounds, event, scalefn);
                    setAngle(canvas, bounds, point, dragging);
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
                var point = pointify(canvas, bounds, event, scalefn);
                dragging = closestAngle(canvas, bounds, point);
                draw(canvas, bounds);
                return false;
            });
            canvas.addEventListener('touchmove', function(event) {
                var canvas = event.target;
                var bounds = computeBounds(canvas);
                if (dragging) {
                    var point = pointify(
                        canvas, bounds, event, scalefn);
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
