// gestur.js
// Copyright (C) 2011-2016 by Jeff Gold.
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
// Generic support for touch and mouse gestures
(function(gestur) {
    "use strict";
    var $ = jQuery;

    gestur.createTargets = function(event, now) {
        var result = {touches: []};
        var offset = jQuery(event.target).offset() || {left: 0, top: 0};
        if (typeof(now) === 'undefined')
            now = new Date().getTime();
        result.when = now;

        if (event.originalEvent && event.originalEvent.targetTouches) {
            event.originalEvent.targetTouches.forEach(function(touch) {
                result.touches.push({x: touch.pageX - offset.left,
                                     y: touch.pageY - offset.top});
            });
        } else result.touches.push({x: event.pageX - offset.left,
                                    y: event.pageY - offset.top});

        if (result.touches.length > 0) {
            result.x = result.touches[0].x;
            result.y = result.touches[0].y;
        }
        return result;
    };

    gestur.createGesture = function(config) {
        if (!(this instanceof gestur.createGesture))
            return new gestur.createGesture(config, event, $);

        this.config = config;
        this.start = null;
    };

    gestur.createGesture.prototype.down = function(event, now) {
        var targets = gestur.createTargets(event, now);

        if (this.start) {
        } else this.start = targets;
    };

    gestur.createGesture.prototype.move = function(event, now) {
        var targets = gestur.createTargets(event, now);
    };

    gestur.createGesture.prototype.up = function(event, now) {
        var targets = gestur.createTargets(event, now);

        this.start = null;
    };

    gestur.createGesture.prototype.wheel = function(event) {
    };

})(typeof exports === 'undefined' ? this['gestur'] = {} : exports);
