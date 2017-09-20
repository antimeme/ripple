// multivec.js
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
// A multi-vector library intended to support Geometric Algebra.
// Each multivector is the sum of zero or more components each
// of which is a coefficient times zero or more ortho-normal basis
// vectors.  Objects from this library can represent real numbers,
// complex numbers, quaternions, vectors and many other kinds of
// mathematical objects.

(function(multivec) {
    'use strict';
    var epsilon = 0.00000000001;
    var zeroish = function(value) {
        return (!isNaN(value) && value <= epsilon && value >= -epsilon);
    };
    var multivec;

    var convert = function(value) {
        var result;
        if (value instanceof multivec) {
            result = value; // already a multi-vector
        } else {
            result = Object.create(multivec.prototype);
            if (!isNaN(value)) {
                result.components = {'': value};
            } else if (Array.isArray(value)) {
                result.components = {};
                value.forEach(function(element, index) {
                    result.components['e' + (index + 1)] = element; });
            } else if (typeof(value) === 'string') {
                // TODO parse strings into multivectors
                throw TypeError('Not yet implemented');
            } else {
                result.components = {};
                Object.keys(value).forEach(function(key) {
                    var canonical = key;
                    var coefficient = value[key];
                    if (key === 'x' || key === 'X')
                        canonical = 'e1';
                    else if (key === 'y' || key === 'Y')
                        canonical = 'e2';
                    else if (key === 'z' || key === 'Z')
                        canonical = 'e3';
                    // TODO flip e values so that they're in order

                    result.components[canonical] = coefficient;
                });
            }
        }
        return result;
    }
    multivec = function(value) {
        var result = Object.create(multivec.prototype);
        result.components = {};
        value = convert(value);
        Object.keys(value.components).forEach(function(key) {
          result.components[key] = value.components[key]; });
        return result;
    };

    multivec.prototype.toString = function() {
        var result = '';

        Object.keys(this.components).sort().forEach(function(key) {
            var coefficient = this.components[key];
            if (zeroish(coefficient)) {
                // skip zero coefficient terms
            } else if (!result) {
                result += coefficient + key;
            } else if (coefficient >= 0) {
                result += ' + ' + coefficient + key;
            } else result += ' - ' + (-coefficient) + key;
        }, this);
        return result;
    }

    multivec.prototype.zeroish = function() {
        // Return true iff all components of this multi-vector are
        // approximately zero (actual zero not required due to floating
        // point rounding errors).
        var result = true;
        Object.keys(this.components).forEach(function(key) {
            if (!zeroish(this.components[key]))
                result = false;
        }, this);
        return result;
    };

    multivec.prototype.scalar = function() {
        return this.components[''] || 0; };
    multivec.prototype.getX = function() {
        return this.components['e1'] || 0; };
    multivec.prototype.getY = function() {
        return this.components['e2'] || 0; };

    multivec.prototype.add = function(other) {
        var result = multivec(0);

        Object.keys(this.components).forEach(function(key) {
            result.components[key] = 0; });
        Object.keys(other.components).forEach(function(key) {
            result.components[key] = 0; });
        Object.keys(result.components).forEach(function(key) {
            result.components[key] =
                (this.components[key] || 0) +
                (other.components[key] || 0); }, this);
        return result;
    };

    multivec.prototype.product = function(other) {
        // TODO return geometric product of this and other
    };

    multivec.prototype.conjugate = function() {
        // TODO flip all wedge products (so * -1 or not each term)
    };

    multivec.prototype.inverse = function() {
        var scale = this.product(this.conjugate());
        if (scale.zeroish())
            throw new TypeError('No inverse of zero');
        return this.product(scale);
        
    };

    multivec.prototype.norm = function() {
        // Multi-vectors are immutable so norm is memoized
        if (isNaN(this.__norm))
            this.__norm = Math.sqrt(
                this.product(this.conjugate()).scalar());
        return this.__norm; };

    if (typeof exports === 'undefined') {
        window['multivec'] = multivec;
    } else { exports = multivec; }
})();

if ((typeof require !== 'undefined') && (require.main === module)) {
    var multivec = exports;

    console.log(multivec([2, 1, -1]).add(
        multivec(5)).toString());
    console.log(multivec([1, 1]).add(
        multivec([4, -1])).toString());
    console.log(multivec({'': 3, 'e1e2': -2}).toString());
    //console.log(multivec('2e1 - e2').toString());
}
