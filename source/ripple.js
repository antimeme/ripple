// ripple.js
// Copyright (C) 2014-2020 by Jeff Gold.
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

    /**
     * Routines to retrieve parameter values either from page
     * search string or Node.js environemnt variables.  Support
     * for default values is included:
     *     ripple.param("paramname", {default: "value"});
     * This provides strings.  Other types are included below. */
    var __params = undefined;
    ripple.param = function(name, config) {
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
        return (name in __params) ? __params[name] :
               ((config && config["default"]) ? config["default"] :
                undefined);
    };

    ripple.paramBoolean = function(name, config) {
        var result = ripple.param(name, config);
        if (typeof(result) === "string")
            result = result.toLowerCase();
        return ((!isNaN(result) && result) || [
            true, "true", "t", "yes", "y",
            "on", "enable", "enabled"].some(
                function(value) { return value === result; }));
    };

    ripple.paramInteger = function(name, config) {
        var result = ripple.param(name, config);
        if (!isNaN(result)) {
            result = parseInt(result, 10);
            if (config && !isNaN(config.min))
                result = Math.max(result, config.min);
            if (config && !isNaN(config.max))
                result = Math.min(result, config.max);
        }
        return result;
    };

    /**
     * Call given function when document is ready.  This ensures
     * that the browser has all the information needed before
     * scripts begin executing. */
    ripple.ready = function(fn) {
        if (document.attachEvent ? (document.readyState === "complete") :
            (document.readyState !== "loading"))
            fn();
        else document.addEventListener('DOMContentLoaded', fn);
    };

    /**
     * Complete an action after a set of JSON objects are loaded from
     * an array of URLs. */
    ripple.preload = function(urls, action) {
        var loaded = false;
        var count = 0;
        var go = null;
        var results = {};

        if (typeof(urls) === 'string')
            urls = [urls];

        urls.forEach(function(url) {
            var request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.onload = function() {
                if (request.status >= 200 && request.status < 400) {
                    results[url] =
                        (typeof(request.responseText) === 'string') ?
                        JSON.parse(request.responseText) :
                        request.responseText;
                    ++count;
                    if ((count === urls.length) && go)
                        go(results);
                } else {
                    console.log("ERROR", "missing preload: " + url);
                    alert("ERROR missing preload: " + url);
                }
            };
            request.onerror = function() {
                console.log("ERROR", "request failed: " + url);
                alert("ERROR request failed: " + url);
            };
            request.send();
        });
        ripple.ready(function() {
            go = action;
            if (count === urls.length)
                go(results);
        });
    };

    /**
     * Creates a DOM element with attributes.  This is a shortcut
     * for document.createElement followed by some number of calls
     * to the setAttribute method on DOM elements.  Any arguments
     * after the second are added as child elements.  If they are
     * strings they are wrapped with document.createTextNode()
     * first.  Arrays are assumed to contain strings which are joined
     * by white space.  Otherwise arguments are added directly. */
    ripple.createElement = function(name, attrs) {
        var result = document.createElement(name);
        var ii, current;

        if (attrs) Object.keys(attrs).forEach(function(attr) {
            if (typeof attrs[attr] === 'undefined')
                return;

            if (attr === 'className')
                result.className = attrs[attr];
            else if (attr === 'innerHTML')
                result.innerHTML = attrs[attr];
            else if ((attr === 'data') &&
                     (typeof(attrs[attr]) === 'object'))
                Object.keys(attrs[attr]).forEach(function(entry) {
                    result.setAttribute(
                        'data-' + entry, attrs[attr][entry]); });
            else if ((attr === 'style') &&
                     (typeof(attrs[attr]) === 'object'))
                Object.keys(attrs[attr]).forEach(function(entry) {
                    result.style[entry] = attrs[attr][entry]; });
            else result.setAttribute(attr, attrs[attr]); });

        for (ii = 2; ii < arguments.length; ++ii) {
            if (typeof(arguments[ii]) === 'undefined')
                continue;
            else if (typeof(arguments[ii]) === 'string' ||
                     typeof(arguments[ii]) === 'number')
                current = document.createTextNode(arguments[ii]);
            else if (Array.isArray(arguments[ii]))
                current = document.createTextNode(
                    arguments[ii].join(" "));
            else current = arguments[ii];
            result.appendChild(current);
        }
        return result;
    };

    ripple.toggleClass = function(element, className) {
        if (!element.classList) {
            var classes = element.className.split(' ');
            var existingIndex = classes.indexOf(className);

            if (existingIndex >= 0)
                classes.splice(existingIndex, 1);
            else classes.push(className);
            element.className = classes.join(' ');
        } else element.classList.toggle(className);
        return element;
    };

    ripple.addClass = function(element, className) {
        if (!element.classList) {
            var classes = element.className.split(' ');
            var existingIndex = classes.indexOf(className);

            if (existingIndex < 0)
                classes.push(className);
            element.className = classes.join(' ');
        } else element.classList.add(className);
        return element;
    };

    ripple.removeClass = function(element, className) {
        if (!element.classList) {
            var classes = element.className.split(' ');
            var existingIndex = classes.indexOf(className);

            if (existingIndex >= 0)
                classes.splice(existingIndex, 1);
            element.className = classes.join(' ');
        } else element.classList.remove(className);
        return element;
    };

    ripple.isVisible = function(element) {
        return !!(element.offsetWidth || element.offsetHeight ||
                  element.getClientRects().length); };

    ripple.toggleVisible = function(element, display) {
        if (ripple.isVisible(element))
            ripple.hide(element);
        else ripple.show(element, display);
        return element;
    };

    ripple.show = function(element, display) {
        element.style.display = display ? display : 'block';
        return element;
    };

    ripple.hide = function(element) {
        element.style.display = 'none';
        return element;
    };

    /**
     * Provide the browser with the supplied object as a JSON download.
     * This would normally be called from within a button handler or
     * something similar.
     *
     * @param obj Javascript object to be converted to JSON
     * @param name file name to present in browser */
    ripple.downloadJSON = function(obj, name) {
        var data = "data:text/json;charset=utf-8," +
                   encodeURIComponent(JSON.stringify(obj));
        var anchor = document.createElement('a');
        anchor.setAttribute("href", data);
        anchor.setAttribute("download", name + ".json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    /**
     * Create a normalized data structure to represent a mouse or
     * multi-touch event with coordinates scaled to the element.  When
     * there are touches the coordinates of the first one will be
     * copied to the top level object x and y.  Applications can use
     * that unless multitouch support is needed.
     *
     * @param event DOM event from which to extract points
     * @param element (optional) DOM element where event occured
     * @param scalefn (optional) function called to adjust coordinates
     * @return object containing x (number), y (number),
     *         targets (array) and changed (array) */
    ripple.getInputPoints = function(event, element, scalefn) {
        var target = element ? element : event.target;
        var brect = target.getBoundingClientRect();
        var transform = function(id, x, y) {
            var result = {
                id: id, x: x - brect.left, y: y - brect.top };
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

    /**
     * Generic mouse wheel support */
    if ((typeof(document) !== "undefined") &&
        (typeof(window) !== "undefined")) {
        // https://developer.mozilla.org/en-US/docs/Web/Events/wheel
        var __wheelPrefix = "";
        var __wheelSupport =
            "onwheel" in document.createElement("div") ?
            "wheel" : document.onmousewheel !== undefined ?
            "mousewheel" : "DOMMouseScroll";
        var __addEventListener = (window.addEventListener) ?
                                 "addEventListener" : "attachEvent";
        var __addWheelListener = function(element, eventName, callback,
                                          useCapture) {
            element[__addEventListener](
                __wheelPrefix + eventName,
                (__wheelSupport === "wheel") ? callback :
                function(originalEvent) {
                    !originalEvent && (originalEvent = window.event);

                    // create a normalized event object
                    var event = {
                        // keep a ref to the original event object
                        originalEvent: originalEvent,
                        target: originalEvent.target ||
                                originalEvent.srcElement,
                        type: "wheel",
                        deltaMode: originalEvent.type ==
                            "MozMousePixelScroll" ? 0 : 1,
                        deltaX: 0,
                        deltaY: 0,
                        deltaZ: 0,
                        preventDefault: function() {
                            originalEvent.preventDefault ?
                            originalEvent.preventDefault() :
                            originalEvent.returnValue = false;
                        }
                    };
                    
                    if (__wheelSupport == "mousewheel") {
                        event.deltaY = -1/40 * originalEvent.wheelDelta;
                        originalEvent.wheelDeltaX && (
                            event.deltaX = -1/40 *
                            originalEvent.wheelDeltaX);
                    } else event.deltaY = originalEvent.deltaY ||
                                          originalEvent.detail;
                    return callback(event);
                }, useCapture || false);
        };

        ripple.addWheelListener = function(element, callback, useCapture) {
            __addWheelListener(element, __wheelSupport,
                               callback, useCapture);
            if (__wheelSupport == "DOMMouseScroll")
                __addWheelListener(element, "MozMousePixelScroll",
                                   callback, useCapture);
        };
    }

    // Browser vendors sometimes introduce features before standards
    // are agreed upon, but with prefixes.  We'll search for these
    // prefixes for some values.
    var vendors = ['moz', 'webkit', 'o', 'ms'];

    /**
     * Support for full screen requests */
    ripple.requestFullscreen = function(elem) {
        var req = elem.requestFullscreen || elem.requestFullScreen;
        var names = ["RequestFullscreen", "RequestFullScreen"];
        for (var i = 0; !req && i < vendors.length; ++i) {
            for (var n = i; !req && n < names.length; ++n)
                req = elem[vendors[i] + names[n]];
        }
        if (req) req.apply(elem);
    };

    ripple.exitFullscreen = function() {
        var efs = document.exitFullscreen ||
                  document.exitFullScreen;
        var names = ["ExitFullscreen", "ExitFullScreen",
                     "CancelFullScreen"];
        for (var i = 0; !efs && i < vendors.length; ++i) {
            for (var n = i; !efs && n < names.length; ++n)
                efs = document[vendors[i] + names[n]];
        }
        console.log("efs");
        if (efs) efs.apply(document);
    };

    ripple.toggleFullscreen = function(elem) {
        var fse = document.fullscreenElement ||
                  document.fullScreenElement;
        var names = ["FullscreenElement", "FullScreenElement"];
        for (var i = 0; !fse && i < vendors.length; ++i) {
            for (var n = i; !fse && n < names.length; ++n)
                fse = document[vendors[i] + names[n]];
        }
        return fse ? ripple.exitFullscreen() :
               ripple.requestFullscreen(elem);
    };

    // === Pairing Functions

    var pairFunctions = {
        cantor: {
            // Represents a reversable transformation from a pair of
            // positive integers to a single positive integer.
            //   http://www.math.drexel.edu/~tolya/cantorpairing.pdf
            pair: function() {
                return (x + y) * (x + y + 1) / 2 + y;
            },
            unpair: function(z) {
                var w = Math.floor((Math.sqrt(8 * z + 1) - 1) / 2);
                var t = (w * w + w) / 2;
                var y = z - t;
                return {x: w - y, y: y};
            }
        },
        szudzik: {
            // Represents a reversable transformation from a pair of
            // positive integers to a single positive integer.
            //   http://szudzik.com/ElegantPairing.pdf
            pair: function(x, y) {
                return (x >= y) ? x * x + x + y :  y * y + x; },
            unpair: function(z) {
                var rz = Math.floor(Math.sqrt(z));
                return ((z - rz * rz < rz) ?
                        {x: z - rz * rz, y: rz } :
                        {x: rz, y: z - rz * rz - rz});
            }
        }
    };

    ripple.pair = function(x, y, method) {
        var m = (method && method in pairFunctions) ?
                 pairFunctions[method] : pairFunctions.szudzik;
        var nx = (x >= 0) ? (2 * x) : (-2 * x - 1);
        var ny = (y >= 0) ? (2 * y) : (-2 * y - 1);
        return m.pair(nx, ny);
    };
    ripple.unpair = function(z, pair, method) {
        var m = (method && method in pairFunctions) ?
                 pairFunctions[method] : pairFunctions.szudzik;
        var result = m.unpair(z);
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
    // random number generator.
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
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

    // Gestur ==========================================================

    var gesturStates = {
        READY: 0,
        TAP: 1,
        PRESS: 2,
        PTAP: 3,
        PDRAG: 4,
        DRAG: 5,
        PINCH: 6,
        RESOLV: 7 };

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

        if (!config)
            config = {};
        this.config = config;
        this.doubleThreshold = isNaN(config.doubleThreshold) ? 500 :
                               config.doubleThreshold;
        this.doubleQuadrance = isNaN(config.doubleDistance) ? 400 : (
            config.doubleDistance * config.doubleDistance);
        this.dragThreshold = isNaN(config.dragThreshold) ? 100 :
                             config.dragThreshold;
        this.dragQuadrance = isNaN(config.dragDistance) ? 400 : (
            config.dragDistance * config.dragDistance);
        this.swipeThreshold = isNaN(config.swipeThreshold) ? 500 :
                              config.swipeThreshold;
        this.swipeMinDistance = isNaN(config.swipeMinDistance) ? 500 : (
            config.swipeMinDistance * config.swipeMinDistance);
        this.swipeAngle = Math.cos(isNaN(config.swipeAngle) ?
                                   (Math.PI / 8) : config.swipeAngle);
        this.reset();
        this.lastTap = undefined;

        if (target)
            this.setElement(target);
    };

    ripple.gestur.prototype.fireEvent = function(evname) {
        if (this.config[evname]) {
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            this.config[evname].apply(this, args);
        }
    };

    ripple.gestur.prototype.reset = function() {
        this.start = undefined;
        this.touchOne = undefined;
        this.touchTwo = undefined;
        this.swipe = false;
        this.drag = undefined;
        this.state = gesturStates.READY;
    };

    ripple.gestur.prototype.onStart = function(
        target, points, touching) {
        var now = new Date().getTime();

        switch (this.state) {
            case gesturStates.READY:
                this.start = { when: now, touching: touching };
                this.swipe = (this.config.swipe ? true : false);
                if (points.targets && points.targets.length > 1) {
                    this.touchOne = points.targets[0];
                    this.touchTwo = points.targets[1];
                    this.state = gesturStates.PINCH;
                    this.fireEvent('pinchStart', this.__createPinch(
                        target, this.touchOne, this.touchTwo));
                } else if (!isNaN(points.x) && !isNaN(points.y)) {
                    this.touchOne = points;
                    this.touchTwo = undefined;
                    this.state = gesturStates.TAP;
                } else this.reset();
                break;
            case gesturStates.TAP: /* fall through */
            case gesturStates.DRAG:
                if (points.targets)
                    points.targets.forEach(function(touch) {
                        if (touch.id !== this.touchOne.id) {
                            this.touchTwo = touch;
                            this.state = gesturStates.PINCH;
                            this.fireEvent(
                                'pinchStart', this.__createPinch(
                                    target, this.touchOne,
                                    this.touchTwo));
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
        return false;
    };

    ripple.gestur.prototype.__createPinch = function(target, one, two) {
        // Get the angle between two vectors.  To start, observe that:
        //   cos(theta) = v1 . v2 / (||v1|| ||v2||)
        // However, because cos(-x) = cos(x) this will give the same
        // result for an angle to the left as for an angle to the right.
        // To recover the correct sign we compute the dual of one
        // vector and take the dot product of the other against it.
        // The angle should be positive exactly when this product is.
        var current = { x: two.x - one.x, y: two.y - one.y};
        var original = {
            x: this.touchTwo.x - this.touchOne.x,
            y: this.touchTwo.y - this.touchOne.y};
        var ortho = {x: -original.y, y: original.x};

        return {
            target: target, one: one, two: two,
            length: Math.sqrt(
                dot(current) / dot(original)),
            angle: ((dot(current, ortho) >= 0) ? 1 : -1) *
            Math.acos(dot(current, original) /
                Math.sqrt(dot(current) * dot(original))) };
    };

    var findCurrent = function(points, match) {
        // Attempt to identify which of the current touches matches
        // the previous touch.
        var result = points;
        if (points.targets && match)
            points.targets.forEach(function(touch) {
                if (touch.id === match.id)
                    result = touch; });
        return result;
    };

    ripple.gestur.prototype.onMove = function(
        target, points, touching) {
        var now = new Date().getTime();
        var current, pinchOne, pinchTwo;

        switch (this.state) {
            case gesturStates.READY: /* ignore */ break;
            case gesturStates.PRESS:
            case gesturStates.TAP:
                // Move events within a small enough amount of time
                // and distance should not interrupt a tap.
                if (((now - this.start.when) < this.dragThreshold) &&
                    (dot({x: this.touchOne.x - points.x,
                          y: this.touchOne.y - points.y}) <
                        this.dragQuadrance))
                    break;

                this.drag = this.touchOne;
                this.state = gesturStates.DRAG;
                /* fall though... */
            case gesturStates.DRAG:
                if ((now - this.start.when) > this.swipeThreshold)
                    this.swipe = false;

                current = findCurrent(points, this.touchOne);
                if (!checkLine(this.swipeAngle, this.touchOne,
                               this.drag, current))
                    this.swipe = false;

                this.fireEvent('drag', {
                    target: target,
                    swipe: this.swipe,
                    start: this.touchOne,
                    last: this.drag, current: current});
                this.drag = current;
                break;
            case gesturStates.PTAP:
                this.state = gesturStates.PDRAG;
                break;
            case gesturStates.PINCH:
                pinchOne = pinchTwo = null;
                points.targets.forEach(function(touch) {
                    if (touch.id === this.touchOne.id)
                        pinchOne = touch;
                    else if (touch.id === this.touchTwo.id)
                        pinchTwo = touch;
                }, this);
                if (pinchOne && pinchTwo)
                    this.fireEvent('pinchMove', this.__createPinch(
                        target, pinchOne, pinchTwo));
                break;
            case gesturStates.RESOLV:
                // check safety threshold
                this.state = gesturStates.DRAG;
                break;
            default: // wedged
        };
        return false;
    };

    ripple.gestur.prototype.onEnd = function(target, points, touching) {
        var now = new Date().getTime();
        var current = findCurrent(points, this.touchOne);

        switch (this.state) {
            case gesturStates.READY: break;
            case gesturStates.TAP:
                // There are two possible types of tap: mouse and touch.
                // On most systems a touch tap is followed by a
                // synthetic mouse tap for compatibility with code that
                // only understand the mouse.  We want to recognize both
                // but filter out these sythnetic mouse taps.  We ignore
                // taps that don't match the starting type and we don't
                // update the last tap if the type has changed.
                if (this.start && this.start.touching === touching &&
                    ((!this.lastTap ||
                      this.lastTap.touching === touching))) {
                    this.fireEvent('tap', {
                        target: target, point: this.touchOne });

                    // If the previous tap was close to this one in both
                    // time and space then this is a double tap
                    if (this.lastTap && !isNaN(this.lastTap.when) &&
                        ((now - this.lastTap.when) <
                            this.doubleThreshold) &&
                        (dot({
                            x: this.touchOne.x - this.lastTap.where.x,
                            y: this.touchOne.y - this.lastTap.where.y
                        }) < this.doubleQuadrance)) {
                        this.fireEvent('doubleTap', {
                            target: target, point: this.touchOne});
                    }

                    this.lastTap = { when: now, touching: touching,
                                     where: this.touchOne };
                }
                this.reset();
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
                if (points.targets.length > 0)
                    this.state = gesturStates.RESOLV;
                else this.reset();
                break;
            case gesturStates.DRAG:
                if (now > this.start.when + this.swipeThreshold)
                    this.swipe = false;

                if (this.swipe) {
                    var current = this.drag;
                    if (points.targets)
                        points.targets.forEach(function(touch) {
                            if (touch.id === this.touchOne.id)
                                current = touch;
                        }, this);

                    // Swipes that are too short are probably intended
                    // as taps with accidental movement
                    if (dot(current.x - this.touchOne.x,
                            current.y - this.touchOne.y) <
                        this.swipeMinDistance)
                        this.fireEvent('tap', {
                            target: target, point: current});
                    else this.fireEvent('swipe', {
                        target: target,
                        start: this.touchOne, end: current});
                }
                // fall through
            case gesturStates.RESOLV:
                if (!points.targets || points.targets.length === 0)
                    this.reset();
                break;
            default: // wedged
        };
        return false;
    };

    ripple.gestur.prototype.onWheel = function(event) {
        this.fireEvent('wheel', {
            target: event.target,
            mode: event.deltaMode,
            x: event.deltaX,
            y: event.deltaY,
            z: event.deltaZ});
        return false;
    };

    var sanitizeEvent = function(event) {
        event = event || window.event;
        if (event && event.preventDefault)
            event.preventDefault();
        return event;
    };

    ripple.gestur.prototype.setElement = function(target) {
        var self = this;
        if ((typeof(jQuery) !== "undefined") &&
            (target instanceof jQuery))
            target = target[0];
        this.target = target;

        target.addEventListener('touchstart', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('touchstart', event);
            self.onStart(target, event.point, true);
            return false; });
        target.addEventListener('touchmove', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('touchmove', event);
            self.onMove(target, event.point, true);
            return false; });
        target.addEventListener('touchend', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('touchend', event);
            self.onEnd(target, event.point, true);
            return false; });
        target.addEventListener('touchcancel', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('touchcancel', event);
            self.reset();
            return false; });
        target.addEventListener('mousedown', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('mousedown', event);
            self.onStart(target, event.point, false);
            return false; });
        target.addEventListener('mousemove', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('mousemove', event);
            self.onMove(target, event.point, false);
            return false; });
        target.addEventListener('mouseup', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('mouseup', event);
            self.onEnd(target, event.point, false);
            return false; });
        target.addEventListener('mouseleave', function(event) {
            event = sanitizeEvent(event);
            event.point = ripple.getInputPoints(
                event, target, this.scalefn);

            self.fireEvent('mouseleave', event);
            self.reset();
            return false; });
        ripple.addWheelListener(target, function(event) {
            self.onWheel(event);
            return false; });
        return this;
    };

    /**
     * Represents a screen which can be resized, panned, scaled
     * and so on. */
    ripple.camera = {
        create: function(config) {
            var result = Object.create(this);
            if (config && typeof(config) === "object") {
                if (!isNaN(config.width) && !isNaN(config.height))
                    result.resize(config.width, config.height);
                result.center = config.center;
            } else if (arguments.length >= 2) {
                result.resize(arguments[0], arguments[1]);
                result.center = true;
            }
            result.reset();
            return result;
        },

        center: true,

        reset: function() {
            this.scale = 1;
            this.x = 0;
            this.y = 0;
            this.radians = 0;
            this.extents = null;
            return this;
        },

        resize: function(width, height) {
            if (isNaN(width) || isNaN(height))
                throw new Error("camera.resize requires numeric " +
                                "width and height: \"" +
                                width + "\", \"" + height + "\"");
            this.width  = width;
            this.height = height;
            return this;
        },

        pan: function(vector) {
            this.x += vector.x;
            this.y += vector.y;
            return this;
        },

        position: function(point) {
            this.x = point.x;
            this.y = point.y;
            return this;
        },

        drag: function(event) {
            return this.pan({
                x: (event.last.x - event.current.x) / this.scale,
                y: (event.last.y - event.current.y) / this.scale });
        },

        rotate: function(radians) {
            return this.setAngle(this.radians + radians);
        },
        setAngle: function(radians) {
            this.radians = radians;
            return this;
        },

        setScale: function(factor, min, max) {
            if (!isNaN(factor)) {
                if (!isNaN(max) && (factor > max))
                    factor = max;
                if (!isNaN(min) && (factor < min))
                    factor = min;
                this.scale = factor;
            }
            return this;
        },
        zoom: function(factor, min, max) {
            return this.setScale(this.scale * factor, min, max);
        },
        setMaxZoom: function(max) { this.__zoomMax = max; },
        setMinZoom: function(max) { this.__zoomMin = max; },
        wheel: function(event) {
            return this.zoom(1 + 0.1 * event.y,
                             this.__zoomMin || 1,
                             this.__zoomMax || 10);
        },

        toScreenFromWorld: function(point) {
            var place = { x: point.x, y: point.y };
            place.x -= this.x;
            place.y -= this.y;
            // TODO reverse rotate
            place.x = place.x * this.scale + this.width / 2;
            place.y = place.y * this.scale + this.height / 2;
            return place;
        },

        toWorldFromScreen: function(place) {
            var point = { x: place.x, y: place.y };
            point.x = (point.x - this.width / 2) / this.scale;
            point.y = (point.y - this.height / 2) / this.scale;
            // TODO rotate!
            point.x += this.x;
            point.y += this.y;
            return point;
        },

        setupContext: function(ctx) {
            if (this.center)
                ctx.translate(this.width / 2, this.height / 2);
            ctx.scale(this.scale, this.scale);
            ctx.rotate(this.angle);
            ctx.translate(-this.x, -this.y);
            return this;
        }
    };

    ripple.export = function(name, object) {
        if (typeof(module) !== "undefined") {
            module.exports = object;
        } else if (typeof(exports) !== "undefined") {
            exports = object;
        } else window[name] = object;
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

})(typeof exports === 'undefined' ? this.ripple = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var ripple = exports;
}
