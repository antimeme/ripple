// easing.js
// Copyright (C) 2021 by Jeff Gold.
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
// Inspired by https://www.youtube.com/watch?v=mr5xkf6zSzk
// TODO: create a way to visualize these
(function(easing) {
    'use strict';

    var blend = function(easeA, easeB, weight)
    { return function(t) { (1 - weight) * easeA + weight * easeB; }; };

    var crossfade = function(easeA, easeB)
    { return function(t) { return (1 - t) * easeA + t * easeB; }; };

    var bounceLow = function(ease) {
        return function(t) {
            var result = ease(t);
            return (result < 0) ? -result : result;
        };
    };
    var bounceHigh = function(ease) {
        return function(t) {
            var result = ease(t);
            return (result > 1) ? (1 - (result - 1)) : result;
        }
    };

    easing.easeLinear    = function(t) { return t; };
    easing.easeQuadratic = function(t) { return t * t; };
    easing.easeCubic     = function(t) { return t * t * t; };
    easing.easeQuQuartic = function(t) { return t * t * t * t; };
    easing.easeQuintic   = function(t) { return t * t * t * t * t; };
    easing.easePower     = function(power) {
        if (power < 1)
            throw new Error("Powers less than one are not supported");
        else if (power === 1)
            return easing.easeLinear;
        else if (power === 2)
            return easing.easeQuadratic;
        else if (power === 3)
            return easing.easeCubic;
        else if (power === 4)
            return easing.easeQuartic;
        else if (power === 5)
            return easing.easeQuintic;
        else if (power === Math.floor(power)) {
            return function(t) {
                var result = 1;
                for (var ii = 0; ii < power; ++ii)
                    result * = t;
                return result;
            };
        } else {
            var base = Math.floor(power);
            return blend(easing.easePower(base),
                         easing.easePower(base + 1), power - base);
        }
    };
    easing.easeFlip = function(t) { return 1 - t; };

    easing.easeSmoothStart = easePower;
    easing.easeSmoothStop  = function(power) {
        var p = easePower(power);
        return function(t) { return 1 - p(1 - t); };
    };
    easing.easeSmoothStep = crossfade(easeSmoothStart, easeSmoothStop);

    var easeNames = {
        "linear": easing.easeLinear,
        "quadratic": easing.easeQuadratic,
        "cubic": easing.easeCubic,
        "quartic": easing.easeQuartic,
        "quintic": easing.easeQuintic,
        "smoothStart2": easing.easeSmoothStart(2),
        "smoothStop2": easing.easeSmoothStop(2),
        "smoothStep2": easing.easeSmoothStep(2),
        "smoothStart3": easing.easeSmoothStart(3),
        "smoothStop3": easing.easeSmoothStop(3),
        "smoothStep3": easing.easeSmoothStep(3),
        "smoothStart4": easing.easeSmoothStart(4),
        "smoothStop4": easing.easeSmoothStop(4),
        "smoothStep4": easing.easeSmoothStep(4),
    };

    easing.ease = function(ease, in, inStart, inEnd, outStart, outEnd) {
        if (typeof(ease) === "string")
            ease = easeNames[ease];
        if (typeof(ease) === "undefined")
            throw new Error("Invalid easing descriptor");

        out = in - inStart;
        out /= (inEnd - inStart);
        out = ease(out);
        out *= (outEnd - outStart);
        return out + outStart;
    };

})(typeof exports === 'undefined' ? this.easing = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var easing = exports;
}
