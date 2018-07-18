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

    triggy.compute = function(event) { 
        var canvas = event.target;
        var result = {
            width: canvas.clientWidth,
            height: canvas.clientHeight
        };
        result.size = Math.min(result.width, result.height);
        result.extents = {
            top: (result.height - result.size) / 2,
            left: (result.width - result.size) / 2,
            bottom: result.height - (result.height - result.size) / 2,
            right: result.width - (result.width - result.size) / 2 };
        result.margin = 0.05;
        result.top = result.extents.top + (result.size * result.margin);
        result.left = result.extents.left + (
            result.size * result.margin);
        result.bottom = result.extents.bottom - (
            result.size * result.margin);
        result.right = result.extents.right - (
            result.size * result.margin);
        result.radius = Math.min(result.right - result.left,
                                 result.bottom - result.top);
        return result;
    };

    triggy.draw = function(event) {
        var canvas = event.target;
        var bounds = triggy.compute(event);
        var ctx;

        canvas.width  = bounds.width;
        canvas.height = bounds.height;
        if (!canvas.getContext) {
            console.log('failed: no getContext', canvas); return;
        } else if (!(ctx = canvas.getContext('2d'))) {
            console.log('failed: no context', canvas); return;
        }
        ctx.clearRect(0, 0, bounds.width, bounds.height);

        ctx.beginPath();
        ctx.moveTo(bounds.left, bounds.top);
        ctx.lineTo(bounds.left, bounds.bottom);
        ctx.lineTo(bounds.right, bounds.bottom);
        ctx.moveTo(bounds.left, bounds.top);
        ctx.arc(bounds.left, bounds.bottom, bounds.radius,
                3 * Math.PI / 2, 0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.stroke();

        var phi = canvas.getAttribute('data-phi');
        var cosphi = Math.cos(phi);
        var sinphi = Math.sin(phi);
        phi = (phi !== null) ? parseFloat(phi) : undefined;
        var theta = canvas.getAttribute('data-theta');
        var costheta = Math.cos(theta);
        var sintheta = Math.sin(theta);
        theta = (theta !== null) ? parseFloat(theta) : undefined;

        var decorate = canvas.getAttribute('data-decorate');
        if (!isNaN(theta) && (decorate === 'theta')) {
            var decosize = bounds.radius * 0.1;
            ctx.beginPath();
            ctx.moveTo(bounds.left + costheta * bounds.radius,
                       bounds.bottom - sintheta * bounds.radius);
            ctx.lineTo(bounds.left + costheta * bounds.radius,
                       bounds.bottom);
            if ((costheta < 0.993) &&
                (sintheta < 0.993)) { // enough room?
                ctx.moveTo(bounds.left + costheta * bounds.radius -
                           decosize, bounds.bottom);
                ctx.lineTo(bounds.left + costheta * bounds.radius -
                           decosize, bounds.bottom - decosize);
                ctx.lineTo(bounds.left + costheta * bounds.radius,
                           bounds.bottom - decosize);
            }

            ctx.moveTo(bounds.left + 3 * costheta * decosize / 2,
                       bounds.bottom - 3 * sintheta * decosize / 2);
            ctx.arc(bounds.left, bounds.bottom,
                    3 * decosize / 2, 2 * Math.PI - theta, 0);

            ctx.fillText(String.fromCharCode(0x1d703),
                         bounds.left, bounds.bottom);

            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgb(64, 64, 64)';
            ctx.stroke();
        }

        if (!isNaN(phi) && !isNaN(theta)) {
            ctx.beginPath();
            if (phi > theta) {
                ctx.moveTo(bounds.left + cosphi * bounds.radius,
                           bounds.bottom - sinphi * bounds.radius);
                ctx.arc(bounds.left, bounds.bottom, bounds.radius,
                        2 * Math.PI - phi, 2 * Math.PI - theta);
            } else {
                ctx.moveTo(bounds.left + costheta * bounds.radius,
                           bounds.bottom - sintheta * bounds.radius);
                ctx.arc(bounds.left, bounds.bottom, bounds.radius,
                        2 * Math.PI - theta, 2 * Math.PI - phi);
            }
            ctx.lineWidth = 10;
            ctx.strokeStyle = 'rgb(32, 192, 192)';
            ctx.stroke();
        }

        if (!isNaN(phi)) {
            ctx.beginPath();
            ctx.moveTo(bounds.left, bounds.bottom);
            ctx.lineTo(bounds.left + cosphi * bounds.radius,
                       bounds.bottom - sinphi * bounds.radius);
            ctx.arc(bounds.left + cosphi * bounds.radius,
                    bounds.bottom - sinphi * bounds.radius, 8,
                    0, 2 * Math.PI);
            ctx.lineTo(bounds.left + cosphi * bounds.radius,
                       bounds.bottom - sinphi * bounds.radius);
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgb(32, 192, 32)';
            ctx.stroke();
            ctx.fill();
        }

        if (!isNaN(theta)) {
            ctx.beginPath();
            ctx.moveTo(bounds.left, bounds.bottom);
            ctx.lineTo(bounds.left + costheta * bounds.radius,
                       bounds.bottom - sintheta * bounds.radius);
            ctx.arc(bounds.left + costheta * bounds.radius,
                    bounds.bottom - sintheta * bounds.radius, 8,
                    0, 2 * Math.PI);
            ctx.lineTo(bounds.left + costheta * bounds.radius,
                       bounds.bottom - sintheta * bounds.radius);
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgb(32, 32, 192)';
            ctx.stroke();
            ctx.fill();
        }
    };

    triggy.click = function(event) {
        var enable = event.target.getAttribute('data-enable');
        if (enable == 'theta') {
            var bounds = triggy.compute(event);
            var brect = event.target.getBoundingClientRect();
            var scale = Reveal.getScale() || 1;
            var click = { x: (event.pageX - brect.left) / scale,
                          y: (event.pageY - brect.top) / scale };
            var clicvec = { x: click.x - bounds.left,
                            y: bounds.bottom - click.y };
            var lsquared = clicvec.x * clicvec.x + clicvec.y * clicvec.y;
            
            if ((click.x < bounds.left) || (click.y > bounds.bottom)) {
            } else if (lsquared <= 0.000001) {
            } else event.target.setAttribute(
                'data-theta', Math.acos(clicvec.x / Math.sqrt(lsquared)));
            triggy.draw(event);
        }
    };

})(typeof exports === 'undefined' ? this.triggy = {} : exports);
