// context.js
// Copyright (C) 2011-2014 by Jeff Gold.
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
// Lightweight polyfill and utility features for web apps.
(function() {
    // ECMAScript 5 introduces some useful functions which are missing
    // in earlier versions.  Fallbacks provide.
    if (typeof Object.create === 'undefined')
        Object.create = function(parent) {
            var Intermediate = function() {}
            Intermediate.prototype = parent;
            return new Intermediate(); };
    if (typeof Array.prototype.forEach === 'undefined')
        Array.prototype.forEach = function(fn) {
            for (var i = 0; i < this.length; i++) fn(this[i]); };

    var vendors = ['moz', 'webkit', 'o', 'ms'];

    if (typeof window !== 'undefined') {

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

        // Create a dictionary of query string parameters
        if (typeof window.params === 'undefined') {
            window.params = (function(a) {
                if (a == "") return {};
                var result = {};
                for (var i = 0; i < a.length; ++i) {
                    var p = a[i].split('=');
                    if (p.length != 2) continue;
                    result[p[0]] = decodeURIComponent(
                        p[1].replace(/\+/g, " "));
                }
                return result;
            })(window.location.search.substr(1).split('&'));
        }
    }

    if (typeof jQuery !== 'undefined') {

        // Process full screen events independent of browser vendor
        jQuery.requestFullscreen = function(elem) {
            var req = elem.requestFullscreen || elem.requestFullScreen;
            var names = ["RequestFullscreen", "RequestFullScreen"];
            for (var i = 0; !req && i < vendors.length; ++i)
                for (var n = i; !req && n < names.length; ++n)
                    req = elem[vendors[i] + names[n]];
            console.log("rfs", elem, req);
            if (req) req.apply(elem);
        };
        jQuery.exitFullscreen = function() {
            var efs = document.exitFullscreen ||
                document.exitFullScreen;
            var names = ["ExitFullscreen", "ExitFullScreen",
                         "CancelFullScreen"];
            for (var i = 0; !efs && i < vendors.length; ++i)
                for (var n = i; !efs && n < names.length; ++n)
                    efs = document[vendors[i] + names[n]];
            console.log("efs");
            if (efs) efs.apply(document);
        };
        jQuery.toggleFullscreen = function(elem) {
            var fse = document.fullscreenElement ||
                document.fullScreenElement;
            var names = ["FullscreenElement", "FullScreenElement"];
            for (var i = 0; !fse && i < vendors.length; ++i)
                for (var n = i; !fse && n < names.length; ++n)
                    fse = document[vendors[i] + names[n]];
            console.log(fse);
            return fse ? jQuery.exitFullscreen() :
                jQuery.requestFullscreen(elem);
        };

        // Normalize positions in mouse and touch events
        jQuery.targets = function(event) {
            var result = {};
            var offset = jQuery(event.target).offset();
            if (event.originalEvent.targetTouches) {
                var touches = event.originalEvent.targetTouches;
                if (touches.length > 0) {
                    result.x = touches[0].pageX - offset.left;
                    result.y = touches[0].pageY - offset.top;
                }
                result.touches = [];
                for (var i = 0; i < touches.length; i++)
                    result.touches.push({
                        x: touches[i].pageX - offset.left,
                        y: touches[i].pageY - offset.top });
            } else {
                result.x = event.pageX - offset.left;
                result.y = event.pageY - offset.top;
                result.touches = [{x: result.x, y: result.y}];
            }
            return result;
        }
    }
}());
