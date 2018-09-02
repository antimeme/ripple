// ripple.js
// Copyright (C) 2014-2018 by Jeff Gold.
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

    // === Experimental jQuery replacement
    //     http://youmightnotneedjquery.com/

    ripple.ready = function(fn) {
        if (document.attachEvent ? document.readyState === "complete" :
            document.readyState !== "loading")
            fn();
        else document.addEventListener('DOMContentLoaded', fn);
    };

    var __params = undefined;
    ripple.param = function(name) {
        if (!__params) {
            __params = {};

            if (typeof window !== 'undefined') {
                // Parse browser GET parameters
                var items = window.location.search.substr(1).split('&');

                for (var ii = 0; ii < items.length; ++ii) {
                    var p = items[ii].split('=');
                    if (p.length === 2)
                        __params[p[0]] = decodeURIComponent(
                            p[1].replace(/\+/g, " "));
                    else if (p.length === 1)
                        __params[p[0]] = true;
                }
            } else if (typeof process !== 'undefined')
                __params = process.env;
        }
        return __params[name];
    };

    // === Pairing Functions

    // Represents a reversable transformation from a pair of positive
    // integers to a single positive integer.
    //   http://www.math.drexel.edu/~tolya/cantorpairing.pdf
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

    // Represents a reversable transformation from a pair of positive
    // integers to a single positive integer.
    //   http://szudzik.com/ElegantPairing.pdf
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
        var nx = (x >= 0) ? (2 * x) : (-2 * x - 1);
        var ny = (y >= 0) ? (2 * y) : (-2 * y - 1);
        return szudzikPair.pair(nx, ny);
    };
    ripple.unpair = function(z, pair) {
        var result = szudzikPair.unpair(z);
        if (result.x % 2)
            result.x = -(result.x + 1);
        if (result.y % 2)
            result.y = -(result.y + 1);
        result.x /= 2;
        result.y /= 2;
        return result;
    };

    // === General utilities


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

        for (index = arguments.length; index > 0; --index) {
            if (arguments[index - 1] &&
                typeof(arguments[index - 1]) === 'object') {
                config = arguments[index - 1];
                Object.keys(config).forEach(function(key) {
                    if (!(key in result))
                        result[key] = config[key];
                });
            }
        }
        return result;
    };

    // Return a value claimped to a minimum and maximum
    ripple.clamp = function(value, min, max) {
        if (min < max) {
            if (value > max)
                value = max;
            else if (value < min)
                value = min;
        }
        return value;
    };

    // === User interface utilities

    // Starts an application after loading a series of URLs using
    // jQuery with AJAX
    ripple.preload = function($, urls, action) {
        var loaded = false;
        var count = 0;
        var go = null;
        var results = {};

        urls.forEach(function(url) {
            $.ajax({url: url}).done(function(data) {
                // For some reason AJAX data gets parsed in browsers
                // but not in electron.  Hack hackity hack hack...
                if (typeof(data) === 'string')
                    data = JSON.parse(data);

                results[url] = data;
                ++count;
                if ((count === urls.length) && go)
                    go($, results);
            }).fail(function(jqXHR, err) {
                console.log(err);
                alert(err);
            });
        });
        $(function($) {
            go = action;
            if (count === urls.length)
                go($, results);
        });
    };

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

    ripple.createTouches = function(event, transform) {
        var result = {current: [], changed: []};
        var touches, touch, ii;

        transform = setTransform(event, transform);
        if (event.originalEvent && event.originalEvent.targetTouches) {
            touches = event.originalEvent.targetTouches;
            for (ii = 0; ii < touches.length; ++ii) {
                touch = touches.item(ii);
                result.current.push(
                    transform({id: touch.identifier,
                               x: touch.pageX, y: touch.pageY}));
            }
        } else if ((event.type !== 'mouseup') &&
                   (event.type !== 'touchend'))
            result.current.push(
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

        if (result.current.length > 0) {
            result.x = result.current[0].x;
            result.y = result.current[0].y;
        }
        return result;
    };

    var gesturStates = {
        READY: 0,
        TAP: 1,
        PRESS: 2,
        PTAP: 3,
        PDRAG: 4,
        DRAG: 5,
        PINCH: 6,
        RESOLV: 7 };

    var createTouch = function(touch) {
        return {id: touch.id, x: touch.x, y: touch.y};
    };

    var dot = function(a, b) {
        if (typeof(b) === 'undefined')
            b = a;
        return a.x * b.x + a.y * b.y;
    };

    var checkLine = function(threshold, start, last, next) {
        var vLast = {x: last.x - start.x, y: last.y - start.y};
        var vNext = {x: next.x - start.x, y: next.y - start.y};

        return (dot(vLast, vNext) >= threshold *
            Math.sqrt(dot(vLast, vLast) * dot(vNext, vNext)));
    };

    ripple.gestur = function(config, target) {
        if (!(this instanceof ripple.gestur))
            return new ripple.gestur(config, target);

        this.config = config;
        this.next = config.next || false;
        this.doubleThreshold = isNaN(config.doubleThreshold) ? 500 :
                               config.doubleThreshold;
        this.doubleDistance = isNaN(config.doubleDistance) ? 400 : (
            config.doubleThreshold * config.doubleThreshold);
        this.flickThreshold = isNaN(config.flickThreshold) ? 500 :
                              config.flickThreshold;
        this.flickAngle = Math.cos(isNaN(config.flickAngle) ?
                                   (Math.PI / 8) : config.flickAngle);
        this.reset();

        if (target)
            this.setTarget(target);
    };

    ripple.gestur.prototype.fireEvent = function(evname) {
        if (this.config[evname])
            this.config[evname].apply(this, arguments);
    };

    ripple.gestur.prototype.reset = function() {
        this.touchOne = undefined;
        this.touchTwo = undefined;
        this.lastTap = undefined;
        this.flick = false;
        this.drag = undefined;
        this.startTime = undefined;
        this.state = gesturStates.READY;
    };

    ripple.gestur.prototype.onStart = function(event) {
        var now = new Date().getTime();
        var touches = ripple.createTouches(event);

        switch (this.state) {
            case gesturStates.READY:
                this.startTime = now;
                this.flick = (this.config.flick ? true : false);
                if (touches.current.length >= 2) {
                    this.touchOne = createTouch(
                        touches.current[0]);
                    this.touchTwo = createTouch(
                        touches.current[1]);
                    this.state = gesturStates.PINCH;
                    this.fireEvent('pinchStart',
                                   this.touchOne, this.touchTwo);
                } else if (touches.current.length === 1) {
                    this.touchOne = createTouch(
                        touches.current[0]);
                    this.touchTwo = undefined;
                    this.state = gesturStates.TAP;
                } else this.reset();
                break;
            case gesturStates.TAP:
            case gesturStates.DRAG:
                touches.current.forEach(function(touch) {
                    if (touch.id !== this.touchOne.id) {
                        this.touchTwo = createTouch(touch);
                        this.state = gesturStates.PINCH;
                        this.fireEvent('pinchStart',
                                       this.touchOne,
                                       this.touchTwo);
                    }
                }, this);
                break;
            case gesturStates.PRESS:
                this.state = gesturStates.PTAP;
                break;
            case gesturStates.PTAP:
                // ignore?
                break;
            case gesturStates.PDRAG:
                // ignore?
                break;
            case gesturStates.PINCH:
                // ignore?
                break;
            case gesturStates.RESOLV:
                // ignore?
                break;
            default: // wedged
        };
    };

    ripple.gestur.prototype.onMove = function(event) {
        var now = new Date().getTime();
        var current, original, ortho, pinchOne, pinchTwo;
        var touches = ripple.createTouches(event);

        switch (this.state) {
            case gesturStates.READY: /* ignore */ break;
            case gesturStates.PRESS:
            case gesturStates.TAP:
                this.drag = this.touchOne;
                this.state = gesturStates.DRAG;
                // fall though...
            case gesturStates.DRAG:
                current = undefined;
                touches.current.forEach(function(touch) {
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
            case gesturStates.PTAP:
                this.state = gesturStates.PDRAG;
                break;
            case gesturStates.PINCH:
                pinchOne = pinchTwo = null;
                touches.current.forEach(function(touch) {
                    if (touch.id === this.touchOne.id)
                        pinchOne = touch;
                    else if (touch.id === this.touchTwo.id)
                        pinchTwo = touch;
                }, this);
                if (pinchOne && pinchTwo) {
                    // It's actually mildly annoying to find the angle
                    // between two vectors.  Yes yes, we all know that
                    //   cos(theta) = v1 . v2 / (||v1|| ||v2||)
                    // However, this will give the same result for an
                    // angle to the left as for an angle to the right.
                    // To sort this out we first compute the dual of
                    // one vector and take the dot product of the other
                    // against it.  The angle should be positive
                    // exactly when this product is.
                    current = {
                        x: pinchTwo.x - pinchOne.x,
                        y: pinchTwo.y - pinchOne.y};
                    original = {
                        x: this.touchTwo.x - this.touchOne.x,
                        y: this.touchTwo.y - this.touchOne.y};
                    ortho = {x: -original.y, y: original.x};

                    this.fireEvent(
                        'pinchMove', Math.sqrt(
                            dot(current) / dot(original)),
                        ((dot(current, ortho) >= 0) ? 1 : -1) *
                        Math.acos(dot(current, original) /
                            Math.sqrt(dot(current) * dot(original))));
                }
                break;
            case gesturStates.RESOLV:
                // check safety threshold
                this.state = gesturStates.DRAG;
                break;
            default: // wedged
        };
    };

    ripple.gestur.prototype.onEnd = function(event) {
        var now = new Date().getTime();
        var touches = ripple.createTouches(event);

        switch (this.state) {
            case gesturStates.READY: break;
            case gesturStates.TAP:
                this.fireEvent('tap', this.touchOne);
                if (this.lastTap && !isNaN(this.lastTap.when) &&
                    (now < this.lastTap.when + this.doubleThreshold) &&
                    (dot({x: this.touchOne.x - this.lastTap.x,
                          y: this.touchOne.y - this.lastTap.y}) <
                        this.doubleDistance)) {
                    this.fireEvent('doubleTap', this.touchOne);
                    this.reset();
                } else {
                    this.lastTap = {
                        when: now,
                        x: this.touchOne.x, y: this.touchOne.y };
                    this.state = gesturStates.READY;
                }
                break;
            case gesturStates.PRESS:
                // fire press event (unless dragged?)
                this.state = gesturStates.READY;
                break;
            case gesturStates.PTAP:
                // this.fireEvent
                this.state = gesturStates.PRESS;
                break;
            case gesturStates.PINCH:
                if (touches.current.length > 0)
                    this.state = gesturStates.RESOLV;
                else this.reset();
                break;
            case gesturStates.DRAG:
                if (now > this.startTime + this.flickThreshold)
                    this.flick = false;

                if (this.flick) {
                    var current = this.drag;
                    touches.current.forEach(function(touch) {
                        if (touch.id === this.touchOne.id)
                            current = createTouch(touch);
                    }, this);
                    this.fireEvent('flick', this.touchOne, current);
                }
                // fall through
            case gesturStates.RESOLV:
                if (touches.current.length === 0)
                    this.reset();
                break;
            default: // wedged
        };
    };

    ripple.gestur.prototype.onWheel = function(event) {
        this.fireEvent('wheel', {
            factor: event.deltaFactor,
            x: event.deltaX,
            y: event.deltaY,
            z: event.deltaZ});
    };

    ripple.gestur.prototype.setTarget = function(target) {
        if (typeof(jQuery) === 'undefined') {
            // TODO fake enough jQuery to make this work
        } else if (!(target instanceof jQuery))
            target = jQuery(target);

        target
            .on('touchstart mousedown', this, function(event) {
                event.data.fireEvent('debug', event);
                var result = event.data.onStart(event);
                return event.data.next && result; })
            .on('touchend mouseup', this, function(event) {
                event.data.fireEvent('debug', event);
                var result = event.data.onEnd(event);
                return event.data.next && result; })
            .on('touchmove mousemove', this, function(event) {
                event.data.fireEvent('debug', event);
                var result = event.data.onMove(event);
                return event.data.next && result; })
            .on('touchmove mousemove', this, function(event) {
                event.data.fireEvent('debug', event);
                var result = event.data.onMove(event);
                return event.data.next && result; })
            .on('mousewheel', this, function(event) {
                event.data.fireEvent('debug', event);
                var result = event.data.onWheel(event);
                return event.data.next && result; })
            .on('touchcancel mouseleave', this, function(event) {
                event.data.fireEvent('debug', event);
                event.data.reset();
                return event.data.next; });
        return this;
    };

    ripple.transform = function(width, height) {
        if (!(this instanceof ripple.transform))
            return new ripple.transform(width, height);
        this.resize(width, height);
        this.reset();
    };
    ripple.transform.prototype.reset = function() {
        this.scale = 1;
        this.x = 0;
        this.y = 0;
        this.radians = 0;
        return this;
    };
    ripple.transform.prototype.resize = function(width, height) {
        this.width  = width;
        this.height = height;
        return this;
    };
    ripple.transform.prototype.pan = function(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    };
    ripple.transform.prototype.position = function(vector) {
        this.x = vector.x;
        this.y = vector.y;
        return this;
    };
    ripple.transform.prototype.rotate = function(radians) {
        this.radians += radians;
        return this;
    };
    ripple.transform.prototype.zoom = function(factor, min, max) {
        var scale = this.scale * factor;
        if (!isNaN(scale)) {
            if (!isNaN(max) && (scale > max))
                scale = max;
            if (!isNaN(min) && (scale < min))
                scale = min;
            this.scale = scale;
        }
        return this;
    };
    ripple.transform.prototype.toScreenFromWorld = function(point) {
        var place = { x: point.x, y: point.y };
        place.x -= this.x;
        place.y -= this.y;
        // TODO reverse rotate
        place.x = place.x * this.scale + this.width / 2;
        place.y = place.y * this.scale + this.height / 2;
        return place;
    };
    ripple.transform.prototype.toWorldFromScreen = function(place) {
        var point = { x: place.x, y: place.y };
        point.x = (point.x - this.width / 2) / this.scale;
        point.y = (point.y - this.height / 2) / this.scale;
        // TODO rotate!
        point.x += this.x;
        point.y += this.y;
        return point;
    };
    ripple.transform.prototype.setupContext = function(ctx) {
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.scale, this.scale);
        ctx.rotate(this.angle);
        ctx.translate(-this.x, -this.y);
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
})(typeof exports === 'undefined' ? this.ripple = {} : exports);

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
}
