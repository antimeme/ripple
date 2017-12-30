// gestur.js
// Copyright (C) 2017 by Jeff Gold.
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
                        y: touch.y - offset.top, id: touch.id}; };
        } else if (!transform) // null transform is identity
            transform = function(touch) { return touch; };
        return transform;
    };

    gestur.createFingers = function(event, transform) {
        var result = {touches: [], changed: []};
        var touches, touch, ii;

        transform = setTransform(event, transform);
        if (event.originalEvent && event.originalEvent.targetTouches) {
            touches = event.originalEvent.targetTouches;
            for (ii = 0; ii < touches.length; ++ii) {
                touch = touches.item(ii);
                result.touches.push(
                    transform({id: touch.identifier,
                               x: touch.pageX, y: touch.pageY}));
            }
        } else if ((event.type !== 'mouseup') &&
                   (event.type !== 'touchend'))
            result.touches.push(
                transform({id: 0, x: event.pageX, y: event.pageY}));

        if (event.originalEvent && event.originalEvent.changedTouches) {
            touches = event.originalEvent.targetTouches;
            for (ii = 0; ii < touches.length; ++ii) {
                touch = touches.item(ii);
                result.changed.push(
                    transform({id: touch.identifier,
                               x: touch.pageX, y: touch.pageY}));
            }
        } else result.changed.push(
            transform({id: 0, x: event.pageX, y: event.pageY}));

        if (result.touches.length > 0) {
            result.x = result.touches[0].x;
            result.y = result.touches[0].y;
        }
        return result;
    };

    var createTouch = function(touch) {
        return {id: touch.id, x: touch.x, y: touch.y};
    };

    var checkLine = function(threshold, start, last, next) {
        var vLast = {x: last.x - start.x, y: last.y - start.y};
        var vNext = {x: next.x - start.x, y: next.y - start.y};
        var dot = function(a, b) { return a.x * b.x + a.y * b.y; };

        return (dot(vLast, vNext) >= threshold *
            Math.sqrt(dot(vLast, vLast) * dot(vNext, vNext)));
    };

    gestur.create = function(config, target) {
        if (!(this instanceof gestur.create))
            return new gestur.create(config, target);

        this.config = config;
        this.doubleThreshold = isNaN(config.doubleThreshold) ? 500 :
                               config.doubleThreshold;
        this.flickThreshold = isNaN(config.flickThreshold) ? 500 :
                              config.flickThreshold;
        this.flickAngle = Math.cos(isNaN(config.flickAngle) ?
                                   (Math.PI / 8) : config.flickAngle);
        this.reset();

        if (target)
            this.setTarget(target);
    };

    gestur.create.prototype.fireEvent = function(evname) {
        if (this.config[evname])
            this.config[evname].apply(this, arguments);
    };

    gestur.create.prototype.reset = function() {
        this.touchOne = undefined;
        this.touchTwo = undefined;
        this.lastTap = undefined;
        this.flick = false;
        this.drag = undefined;
        this.startTime = undefined;
        this.state = states.READY;
    };

    gestur.create.prototype.onStart = function(event) {
        var now = new Date().getTime();
        var fingers = gestur.createFingers(event);

        switch (this.state) {
            case states.READY:
                this.startTime = now;
                this.flick = (this.config.flick ? true : false);
                if (fingers.changed.length >= 2) {
                    this.touchOne = createTouch(
                        fingers.changed[0]);
                    this.touchTwo = createTouch(
                        fingers.changed[1]);
                    this.state = states.PINCH;
                } else if (fingers.changed.length === 1) {
                    this.touchOne = createTouch(
                        fingers.changed[0]);
                    this.touchTwo = undefined;
                    this.state = states.TAP;
                } else this.reset();
                break;
            case states.TAP:
            case states.DRAG:
                if (fingers.changed.length >= 1) {
                    this.touchTwo = createTouch(
                        fingers.changed[0]);
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
            case states.PINCH:
                // ignore?
                break;
            case states.RESOLV:
                // ignore?
                break;
            default: // wedged
        };
    };

    gestur.create.prototype.onMove = function(event) {
        var now = new Date().getTime();
        var fingers = gestur.createFingers(event);

        switch (this.state) {
            case states.READY: /* ignore */ break;
            case states.PRESS:
            case states.TAP:
                this.drag = this.touchOne;
                this.state = states.DRAG;
                // fall though...
            case states.DRAG:
                var current = undefined;
                fingers.changed.forEach(function(touch) {
                    if (touch.id === this.touchOne.id)
                        current = createTouch(touch);
                }, this);

                if (now > this.startTime + this.flickThreshold)
                    this.flick = false;

                if (this.flick) {
                    if (!checkLine(this.flickAngle, this.touchOne,
                                   this.drag, current))
                        this.flick = false;
                } else if (current)
                    this.fireEvent(
                        'drag', this.touchOne, this.drag, current);
                this.drag = current;
                break;
            case states.PTAP:
                this.state = states.PDRAG;
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

    gestur.create.prototype.onEnd = function(event) {
        var now = new Date().getTime();
        var fingers = gestur.createFingers(event);

        switch (this.state) {
            case states.READY: break;
            case states.TAP:
                this.fireEvent('tap', this.touchOne);
                if (!isNaN(this.lastTap) && now < this.lastTap +
                                            this.doubleThreshold) {
                    this.fireEvent('doubleTap', this.touchOne);
                    this.lastTap = 0;
                } else this.lastTap = now;
                this.state = states.READY;
                break;
            case states.PRESS:
                // fire press event (unless dragged?)
                this.state = states.READY;
                break;
            case states.PTAP:
                // this.fireEvent
                this.state = states.PRESS;
                break;
            case states.PINCH:
                if (fingers.touches.length > 0)
                    this.state = states.RESOLV;
                else this.reset();
                break;
            case states.DRAG:
                if (now > this.startTime + this.flickThreshold)
                    this.flick = false;

                if (this.flick) {
                    var current = this.drag;
                    fingers.changed.forEach(function(touch) {
                        if (touch.id === this.touchOne.id)
                            current = createTouch(touch);
                    }, this);
                    this.fireEvent('flick', this.touchOne, current);
                }
                // fall through
            case states.RESOLV:
                if (fingers.touches.length === 0)
                    this.reset();
                break;
            default: // wedged
        };
    };

    gestur.create.prototype.onWheel = function(event) {
        // TODO
    };

    gestur.create.prototype.setTarget = function(target) {
        if (typeof(jQuery) === 'undefined') {
            // TODO fake enough jQuery to make this work
        } else if (!(target instanceof jQuery))
            target = jQuery(target);

        target.on('touchstart mousedown', this, function(event) {
                  event.data.fireEvent('debug', event);
                  event.data.onStart(event); return false; })
              .on('touchend mouseup', this, function(event) {
                  event.data.fireEvent('debug', event);
                  event.data.onEnd(event); return false; })
              .on('touchmove mousemove', this, function(event) {
                  event.data.fireEvent('debug', event);
                event.data.onMove(event); return false; })
              .on('touchmove mousemove', this, function(event) {
                  event.data.fireEvent('debug', event);
                  event.data.onMove(event); return false; })
              .on('mousewheel', this, function(event) {
                  event.data.fireEvent('debug', event);
                  event.data.onWheel(event); return false; })
              .on('touchcancel mouseleave', this, function(event) {
                  event.data.fireEvent('debug', event);
                  event.data.reset(); return false; });
    return this;
};

})(typeof exports === 'undefined' ? this['gestur'] = {} : exports);
