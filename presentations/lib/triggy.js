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
(function(triggy) {
    'use strict';

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

    var drawRay = function(ctx, bounds, color,
                           angle, cosangle, sinangle) {
        ctx.beginPath();
        ctx.moveTo(bounds.origin.x, bounds.origin.y);
        ctx.lineTo(bounds.origin.x + cosangle * bounds.radius,
                   bounds.origin.y - sinangle * bounds.radius);
        ctx.arc(bounds.origin.x + cosangle * bounds.radius,
                bounds.origin.y - sinangle * bounds.radius, 8,
                0, 2 * Math.PI);
        ctx.lineTo(bounds.origin.x + cosangle * bounds.radius,
                   bounds.origin.y - sinangle * bounds.radius);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fill();
    };

    var drawDeco = function(ctx, bounds, name, angle, sin, cos) {
        var decosize = bounds.radius * 0.1;
        ctx.fillStyle = 'rgb(64, 64, 64)';
        ctx.strokeStyle = 'rgb(64, 64, 64)';

        // Draw a triangle using sin and cos
        ctx.beginPath();
        ctx.moveTo(bounds.origin.x + cos * bounds.radius,
                   bounds.origin.y - sin * bounds.radius);
        ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                   bounds.origin.y);
        ctx.lineTo(bounds.origin.x, bounds.origin.y);

        // If there's enough room, draw a right-angle box
        var roomy = 0.993;
        if ((cos < roomy) && (cos > -roomy) &&
            (sin < roomy) && (sin > -roomy)) {
            var xdeco = (cos >= 0) ? decosize : -decosize;
            var ydeco = (sin >= 0) ? decosize : -decosize;

            ctx.moveTo(bounds.origin.x + cos * bounds.radius -
                       xdeco, bounds.origin.y);
            ctx.lineTo(bounds.origin.x + cos * bounds.radius -
                       xdeco, bounds.origin.y - ydeco);
            ctx.lineTo(bounds.origin.x + cos * bounds.radius,
                       bounds.origin.y - ydeco);
        }

        // Draw an arc to represent the angle
        if ((angle >= 0) && (angle <= Math.PI / 2)) {
            ctx.moveTo(bounds.origin.x + 3 * cos * decosize / 2,
                       bounds.origin.y);
            ctx.arc(bounds.origin.x, bounds.origin.y,
                    3 * decosize / 2, 0, -angle, true);
        } else if (angle >= 0) {
            ctx.moveTo(bounds.origin.x + 3 * cos * decosize / 2,
                       bounds.origin.y - 3 * sin * decosize / 2);
            ctx.arc(bounds.origin.x, bounds.origin.y,
                    3 * decosize / 2, -angle, Math.PI, true);
        } else if (angle < -Math.PI / 2) {
            ctx.moveTo(bounds.origin.x + 3 * cos * decosize / 2,
                       bounds.origin.y);
            ctx.arc(bounds.origin.x, bounds.origin.y,
                    3 * decosize / 2, Math.PI, -angle, true);
        } else {
            ctx.moveTo(bounds.origin.x + 3 * cos * decosize / 2,
                       bounds.origin.y - 3 * sin * decosize / 2);
            ctx.arc(bounds.origin.x, bounds.origin.y,
                    3 * decosize / 2, -angle, 0, true);
        }

        ctx.font = Math.floor(bounds.size / 10) + 'px Verdana';
        ctx.fillText(name, bounds.origin.x + (cos * bounds.radius / 4),
                     bounds.origin.y - (sin * bounds.radius / 8));
        ctx.font = Math.floor(bounds.size / 20) + 'px Verdana';
        ctx.fillText('sin' + name,
                     bounds.origin.x + (cos * bounds.radius) +
                     bounds.size * (cos >= 0 ? 0.01 : -0.11),
                     bounds.origin.y - (sin * bounds.radius) / 2);
        ctx.fillText('cos' + name,
                     bounds.origin.x + (cos * bounds.radius) / 2,
                     bounds.origin.y + bounds.size  *
            (sin >= 0 ? 0.05 : -0.03));

        ctx.lineWidth = 2;
        ctx.stroke();
    };

    var draw = function(canvas, bounds) {
        var ctx;

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

        var colors = [
            'rgb(32, 32, 192)', 'rgb(32, 192, 32)', 'rgb(192, 32, 32)'];
        var names = [
            '\u{1d703}' /* theta */,
            '\u{1d711}' /* phi */,
            '\u{1d7fe}' /* gamma */];
        var angle, cos, sin;
        var anum = 1;
        var prev = undefined;

        if (canvas.getAttribute('data-arcs')) {
            while (anum > 0) {
                angle = canvas.getAttribute('data-angle' + anum);
                if ((angle === null) || (isNaN(angle)))
                    break;
                angle = parseFloat(angle);
                cos = Math.cos(angle);
                sin = Math.sin(angle);
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
                ++anum;
            }
            anum = 1;
        }
        while (anum > 0) {
            var angle = canvas.getAttribute('data-angle' + anum);
            if ((angle === null) || (isNaN(angle)))
                break;
            angle = parseFloat(angle);
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);
            var name = canvas.getAttribute('data-name' + anum);
            var color = canvas.getAttribute('data-color' + anum);
            var deco  = canvas.getAttribute('data-decorate' + anum);

            if (!name)
                name = names[anum - 1];
            if (!color)
                color = colors[anum - 1];

            if (deco)
                drawDeco(ctx, bounds, name, angle, sin, cos);
            drawRay(ctx, bounds, color, angle, cos, sin);

            ++anum;
        }
    };

    var closestAngle = function(canvas, bounds, point) {
        var result = undefined;
        var best = undefined;
        var enable = canvas.getAttribute('data-enable');
        if (enable)
            enable = enable.split(',').map(function(value) {
                return parseInt(value, 10) });
        else enable = [];

        for (var ii = 0; ii < enable.length; ++ii) {
            var angle = canvas.getAttribute('data-angle' + enable[ii]);
            var delta = {
                x: bounds.radius * Math.cos(angle) - point.x,
                y: bounds.radius * Math.sin(angle) - point.y};
            var dsquared = delta.x * delta.x + delta.y * delta.y;

            if (isNaN(best) || (dsquared < best)) {
                result = enable[ii];
                best = dsquared;
            }
        }
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
                result.current.push(
                    transform(touch.pageX, touch.pageY));
            }

            if (current.length > 0)
                result = current[0];
            else if (event.changedTouches) {
                for (ii = 0; ii < event.changedTouches.length; ++ii) {
                    var touch = event.changedTouches.item(ii);
                    result.current.push(
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
            var bounds = computeBounds(canvas);
            var dragging = null;

            canvas.addEventListener('mousedown', function(event) {
                var point = pointify(canvas, bounds, event, scalefn);
                //click(canvas, bounds, point);
                dragging = closestAngle(canvas, bounds, point);
                draw(canvas, bounds);
            });
            canvas.addEventListener('mousemove', function(event) {
                if (dragging) {
                    var point = pointify(
                        canvas, bounds, event, scalefn);
                    setAngle(canvas, bounds, point, dragging);
                    draw(canvas, bounds);
                }
            });
            canvas.addEventListener('mouseup', function(event)
                { dragging = null; });
            canvas.addEventListener('mouseleave', function(event)
                { dragging = null; });

            canvas.addEventListener('touchstart', function(event) {
                var point = pointify(canvas, bounds, event, scalefn);
                click(canvas, bounds, point);
                draw(canvas, bounds);
                // TODO touch events
            });
            canvas.addEventListener('touchmove', function(event) {
                // TODO touch events
            });
            canvas.addEventListener('touchend', function(event) {
                // TODO touch events
            });

            canvas.addEventListener('resize', function(event) {
                bounds = computeBounds(event.target);
                draw(canvas, bounds);
            });
            draw(canvas, bounds);
        });
    }

})(typeof exports === 'undefined' ? this.triggy = {} : exports);
