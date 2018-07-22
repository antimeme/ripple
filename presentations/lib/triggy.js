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

    var scale = function(value) { return value; };
    triggy.setScaleFn = function(fn) { scale = fn; };

    triggy.computeBounds = function(event, origin) {
        var canvas = event.target;
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

    var drawDecoration = function(ctx, bounds, name, angle, sin, cos) {
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
        ctx.fillText('r sin(' + name + ')',
                     bounds.origin.x + (cos * bounds.radius) +
                     bounds.size * 0.01,
                     bounds.origin.y - (sin * bounds.radius) / 2);

        ctx.lineWidth = 2;
        ctx.stroke();
    };

    var innerDraw = function(canvas, bounds) {
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
            '\u{1d703}', '\u{1d711}', '\u{1d7fe}'];
        var anum = 1;
        while (anum > 0) {
            var name = canvas.getAttribute('data-name' + anum);
            var color = canvas.getAttribute('data-color' + anum);
            var angle = canvas.getAttribute('data-angle' + anum);
            var deco  = canvas.getAttribute('data-decorate' + anum);

            if ((angle === null) || (isNaN(angle)))
                break;

            if (!name)
                name = names[anum - 1];
            if (!color)
                color = colors[anum - 1];

            angle = parseFloat(angle);
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);

            if (deco)
                drawDecoration(ctx, bounds, name, angle, sin, cos);
            drawRay(ctx, bounds, color, angle, cos, sin);
            anum++;
        }
    };

    triggy.draw = function(event) {
        var canvas = event.target;
        var bounds = triggy.computeBounds(event);
        return innerDraw(canvas, bounds);
    }

    triggy.click = function(event) {
        var enable = event.target.getAttribute('data-enable');
        if (enable)
            enable = enable.split().map(function(value) {
                return parseInt(value, 10) });

        if (enable.length > 0) {
            var bounds = triggy.computeBounds(event);
            var brect = event.target.getBoundingClientRect();
            var click = { x: scale(event.pageX - brect.left) -
                             bounds.origin.x,
                          y: scale(event.pageY - brect.top) -
                             bounds.origin.y};
            var lsquared = click.x * click.x + click.y * click.y;
            var angle = Math.acos(click.x / Math.sqrt(lsquared));
            if (click.y > 0)
                angle = -angle;

            if ((bounds.origin.style === 'center') ||
                ((angle >= 0) && (angle <= Math.PI / 2)))
                event.target.setAttribute(
                    'data-angle' + enable[0], angle);
            innerDraw(event.target, bounds);
        }
    };

})(typeof exports === 'undefined' ? this.triggy = {} : exports);
