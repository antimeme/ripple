// gestur.js
// Copyright (C) 2011-2017 by Jeff Gold.
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
    var states = {
        READY: 0,
        TAP: 1,
        PRESS: 2,
        PTAP: 3,
        PDRAG: 4,
        DRAG: 5,
        PINCH: 6,
        RESOLV: 7 };

    var setTransform = function(event, transform) {
        // An undefined transform means we should attempt to remove
        // the component offset, giving coordinates relative to the
        // element itself rather than the page as a whole
        if (typeof(transform) === 'undefined') {
            var offset = (typeof(jQuery) !== 'undefined') ?
                         jQuery(event.target).offset() :
                         {top: 0, left: 0};
            transform = function(touch) {
                return {x: touch.x - offset.left,
                        y: touch.y - offset.top}; };
        } else if (!transform) // null transform is identity
            transform = function(touch) { return touch; };
        return transform;
    };

    gestur.createTargets = function(event, transform) {
        var result = {touches: [], changed: []};

        transform = setTransform(event, transform);
        if (event.originalEvent && event.originalEvent.targetTouches) {
            event.originalEvent.targetTouches.forEach(function(touch) {
                result.touches.push(
                    transform({id: touch.identifier,
                               x: touch.pageX, y: touch.pageY}));
            });
        } else result.touches.push(
            transform({id: 0, x: event.pageX, y: event.pageY}));

        if (event.originalEvent && event.originalEvent.changedTouches) {
            event.originalEvent.changedTouches.forEach(function(touch) {
                result.changed.push(
                    transform({id: touch.identifier,
                               x: touch.pageX, y: touch.pageY}));
            });
        } else result.changed.push(
            transform({id: 0, x: event.pageX, y: event.pageY}));

        if (result.touches.length > 0) {
            result.x = result.touches[0].x;
            result.y = result.touches[0].y;
        }
        return result;
    };

    gestur.create = function(config) {
        if (!(this instanceof gestur.create))
            return new gestur.create(config);

        this.config = config;
        this.state = states.READY;
        this.touchOne = undefined;
        this.touchTwo = undefined;
        this.lastTap = undefined;
        this.doubleThreshold = isNaN(config.doubleThreshold) ? 500 :
                               config.doubleThreshold;
    };

    gestur.create.prototype.createTouch = function(touch) {
        return {id: touch.id, x: touch.x, y: touch.y};
    };

    gestur.create.prototype.fireEvent = function(evname) {
        if (this.config[evname]) {
            this.config[evname](/* ... */);
        }
    };

    gestur.create.prototype.onStart = function(event) {
        var targets = gestur.createTargets(event);

        switch (this.state) {
            case states.READY:
                if (targets.changed.length >= 2) {
                    this.touchOne = this.createTouch(
                        targets.changed[0]);
                    this.touchTwo = this.createTouch(
                        targets.changed[1]);
                    this.state = states.PINCH;
                } else if (targets.changed.length === 1) {
                    this.touchOne = this.createTouch(
                        targets.changed[0]);
                    this.touchTwo = undefined;
                    this.state = states.TAP;
                }
                break;
            case states.TAP:
                if (targets.changed.length >= 1) {
                    this.touchTwo = this.createTouch(
                        targets.changed[0]);
                    this.state = states.PINCH;
                }
                break;
            case states.PRESS:
                this.state = states.PTAP;
                break;
            case states.PTAP:
                // ignore?
                break;
            case states.PDRAG:
                // ignore?
                break;
            case states.DRAG:
                // ingore?
                break;
            case states.PINCH:
                // ignore?
                break;
            case states.RESOLV:
                // ignore?
                break;
            default: // wedged
        };
    };

    gestur.create.prototype.onEnd = function(event) {
        var now = new Date().getTime();
        var targets = gestur.createTargets(event);

        switch (this.state) {
            case states.READY: break;
            case states.TAP:
                this.fireEvent('tap');
                if (!isNaN(this.lastTap) && now < this.lastTap +
                                            this.doubleThreshold) {
                    this.fireEvent('doubleTap');
                    this.lastTap = 0;
                } else this.lastTap = now;
                this.state = states.READY;
                break;
            case states.PRESS:
                // fire press event (unless dragged?)
                this.state = states.READY;
                break;
            case states.PTAP:
                this.state = states.PRESS;
                break;
            case states.DRAG:
                this.state = states.READY;
                break;
            case states.PINCH:
                // if one ending
                this.state = states.RESOLV;
                // else
                this.state = states.READY;
                break;
            case states.RESOLV: this.state = states.READY; break;
            default: // wedged
        };
    };

    gestur.create.prototype.onMove = function(event) {
        switch (this.state) {
            case states.READY: break;
            case states.TAP:
                this.state = states.DRAG;
                break;
            case states.PRESS:
                this.state = states.DRAG;
                break;
            case states.PTAP:
                this.state = states.PDRAG;
                break;
            case states.DRAG:
                // check for flick
                // fire drag event
                break;
            case states.PINCH:
                // fire pinch event (distance and rotation)
                break;
            case states.RESOLV:
                // check safety threshold
                this.state = states.DRAG;
                break;
            default: // wedged
        };
    };

    gestur.create.prototype.onWheel = function(event) {
    };

    gestur.create.prototype.setTarget = function(target) {
        if (typeof(jQuery) === 'undefined') {
            // TODO fake enough jQuery to make this work
        } else if (!(target instanceof jQuery))
            target = jQuery(target);

        target.on('mousedown touchstart', this, function(event) {
            event.data.onStart(event); return false; });
        target.on('mouseup touchend', this, function(event) {
            event.data.onEnd(event); return false; });
        target.on('mousemove touchmove', this, function(event) {
            event.data.onMove(event); return false; });
        target.on('mousewheel', this, function(event) {
            event.data.onWheel(event); return false; });
    };

})(typeof exports === 'undefined' ? this['gestur'] = {} : exports);
