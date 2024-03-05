// polyfill.js
// Copyright (C) 2011-2019 by Jeff Gold.
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
// A lightweight polyfill for JavaScript features
(function() {
    "use strict";

    // ECMAScript 5 introduces some useful functions which are missing
    // in earlier versions.  Let's add them if they're missing!

    if (typeof Object.create === 'undefined')
        Object.create = function(parent) {
            var Intermediate = function() {};
            Intermediate.prototype = parent;
            return new Intermediate(); };

    if (typeof Date.now === 'undefined')
        Date.now = function() { return new Date().getTime(); };

    if (typeof Array.prototype.forEach === 'undefined')
        Array.prototype.forEach = function(fn, self) {
            for (var index = 0; index < this.length; index++)
                fn.call(self, this[index], index, this); };

    if (typeof Array.prototype.some === 'undefined')
        Array.prototype.some = function(fn, self) {
            var result = false;
            for (var index = 0; index < this.length; index++) {
                result = fn.call(self, this[index], index, this);
                if (result)
                    break; }
            return result; };

    if (typeof Array.prototype.every === 'undefined')
        Array.prototype.every = function(fn, self) {
            var result = true;
            for (var index = 0; index < this.length; index++) {
                result = fn.call(self, this[index], index, this);
                if (!result)
                    break; }
            return result; };

    if (typeof Math.imul === 'undefined')
        Math.imul = function(a, b) {
            // Performs a 32-bit multiplication modulo 2^32,
            // approximating the unsigned type in C.  Javascript
            // integers are stored as a double precision floating
            // point value, which means they have 53 bits of for
            // integer values -- an awkward amount.
            var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
            var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
            var high = ((ah * bl) + (al * bh)) & 0xffff;
            return (((high << 16) + (al * bl)) & 0xffffffff) >>> 0;
        }


    // Browser vendors sometimes introduce features before standards
    // are agreed upon, but with prefixes.  We'll search for these
    // prefixes for some values.
    var vendors = ['moz', 'webkit', 'o', 'ms'];

    // This indicates that the runtime environment is a browser
    if (typeof window !== 'undefined') {

        // Based on Douglas Crockford's talk The Metamorphosis of Ajax
        if (typeof window.getElementsByClassName === 'undefined') {
            var walkDOM = function(node, fn) {
                fn(node);
                node = node.firstChild;
                while (node) {
                    walkDOM(node, fn);
                    node = node.nextSibling;
                }
            };

            window.getElementsByClassName = function(className) {
                var result = [];
                walkDOM(document.body, function(node) {
                    var a, i, c = node.className;
                    if (c) {
                        a = c.split(' ');
                        for (i = 0; i < a.length; ++i) {
                            if (a[i] === className) {
                                result.push(node);
                                break;
                            }
                        }
                    }
                });
                return result;
            };
        }

        // Support animation even in older browsers which are missing
        // requestAnimationFrame or have a vendor prefixed version.
        // Adapted from Erik Möller's blog post (http://goo.gl/qVfYlu).
        var lastTime = 0;
        for (var index = 0; typeof window.requestAnimationFrame ===
            'undefined' && index < vendors.length; ++index) {
            window.requestAnimationFrame =
                window[vendors[index] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame =
                window[vendors[index] + 'CancelAnimationFrame'] ||
                window[vendors[index] + 'CancelRequestAnimationFrame'];
        }
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function(callback, elem) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(
                    0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() {
                    callback(currTime + timeToCall);
                }, timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
            window.cancelAnimationFrame = function(id)
            { clearTimeout(id); };
        }
    }

}());
