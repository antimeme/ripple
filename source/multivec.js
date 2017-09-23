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
//
// Orthonormal basis vectors are represented by strings like 'o1',
// 'o2', 'o1o2o3' and so on.  The letter 'o' was chosen becuase
// the more conventional 'e' is also used to represent exponents
// in IEEE 754 floating point numbers.
//
// The following invariants should hold for all multivec routines:
// - multivec values are immutable
// - multivec basis values are in canonical order (low to high)
// - multivec components are omitted when within rounding of zero

(function(multivec) {
    'use strict';
    var epsilon = 0.00000000001;
    var zeroish = function(value) {
        return (!isNaN(value) && value <= epsilon && value >= -epsilon);
    };
    var numExp = '([-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?)';
    var basisExp = '(([oO][1-9][0-9]*)*)';
    var multivec;

    var canonicalizeBasis = function(basis) {
        // Converts basis strings to a canonical form to make them
        // comparable.  Returns an array containing the updated
        // basis string as well as the sign (either 1 or -1)
        var sign = 1, result = "";
        var b = [], breakdown = {}, m, ii, swap, squeeze = 0;

        // Extract basis vectors for further processing
        while ((m = basis.match(/([oO]([1-9][0-9]*))|[xyzXYZ]/)) &&
               m[0].length) {
            if (m[0] === 'x' || m[0] === 'X') {
                ii = 1;
            } else if (m[0] === 'x' || m[0] === 'X') {
                ii = 2;
            } else if (m[0] === 'x' || m[0] === 'X') {
                ii = 3;
            } else ii = parseInt(m[2], 10);

            b.push(ii);
            breakdown[ii] = (breakdown[ii] || 0) + 1;
            basis = basis.slice(m[0].length);
        }

        do { // Bubble sort basis vectors, flipping sign each swap
            squeeze += 1;
            m = false;
            for (ii = 0; ii < b.length - squeeze; ++ii)
                if (b[ii] > b[ii + 1]) {
                    swap = b[ii];
                    b[ii] = b[ii + 1];
                    b[ii + 1] = swap;
                    sign *= -1;
                    m = true;
                }
        } while (m);

        // Collapse adjacent basis vectors
        Object.keys(breakdown).sort().forEach(function(key) {
            if (breakdown[key] % 2)
                result += 'o' + key;
        });
        return [result, sign];
    };

    var fromString = function(value) {
        var termExp = ('^\\s*' + numExp + '?' +
                       basisExp + '(\\s+([+-])\\s+)?');
        var bsign, basis, sign, termOp = '+', components = {}, m;
        var result = Object.create(multivec.prototype);
        result.components = {};

        while ((m = value.match(new RegExp(termExp))) &&
               (m[0].length > 0)) {
            bsign = canonicalizeBasis(m[3]);
            basis = bsign[0]; sign = bsign[1];
            if (!components[basis])
                components[basis] = 0;
            components[basis] += (((termOp === '+') ? 1 : -1) * sign *
                parseFloat(m[1] || '1'));
            termOp = m[6] || '+';
            value = value.slice(m[0].length);
        }

        Object.keys(components).forEach(function(key) {
            if (!zeroish(components[key]))
                result.components[key] = components[key];
        });
        return result;
    };

    var convert = function(value) {
        var result;
        if (value instanceof multivec)
            return value; // already a multi-vector
        else if (typeof(value) === 'string')
            return fromString(value);

        result = Object.create(multivec.prototype);
        result.components = {};
        if (!isNaN(value)) {
            result.components[''] = value;
        } else if (typeof(value) === 'undefined') {
        } else if (Array.isArray(value)) {
            value.forEach(function(element, index) {
                result.components['o' + (index + 1)] = element; });
        } else {
            result.components = {};
            Object.keys(value).forEach(function(key) {
                var bsign = canonicalizeBasis(key);
                if (!zeroish(value[bsign[0]]))
                    result.components[bsign[0]] = bsign[1] * value[key];
            });
        }
        return result;
    };

    multivec = function(value) {
        if (!(this instanceof multivec))
            return new multivec(value);
        this.components = {};
        value = convert(value);
        Object.keys(value.components).forEach(function(key) {
            if (!zeroish(value.components[key]))
                this.components[key] = value.components[key];
        }, this);
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
                result += ' + ' + (zeroish(coefficient - 1) ?
                                   '' : coefficient) + key;
            } else result += ' - ' + (zeroish(coefficient + 1) ?
                                     '' : -coefficient) + key;
        }, this);

        if (!result.length)
            result = '0';
        return result;
    };

    multivec.prototype.zeroish = function() {
        // Return true iff all components of this multi-vector are
        // approximately zero (actual zero not required due to floating
        // point rounding errors).
        var result = true;
        Object.keys(this.components).forEach(function(key) {
            if (!zeroish(this.components[key]))
                result = false;
        }, this);
        return result; };

    multivec.prototype.scalar = function() {
        return this.components[''] || 0; };
    multivec.prototype.getX = function() {
        return this.components['o1'] || 0; };
    multivec.prototype.getY = function() {
        return this.components['o2'] || 0; };
    multivec.prototype.getZ = function() {
        return this.components['o3'] || 0; };

    multivec.prototype.add = function(other) {
        var result = multivec();
        var components = {};

        Object.keys(this.components).forEach(function(key) {
            components[key] = 0; });
        Object.keys(other.components).forEach(function(key) {
            components[key] = 0; });
        Object.keys(components).forEach(function(key) {
            components[key] =
                (this.components[key] || 0) +
                  (other.components[key] || 0); }, this);

        Object.keys(components).forEach(function(key) {
            if (!zeroish(components[key]))
                result.components[key] = components[key]; });
        return result;
    };

    multivec.prototype.product = function(other) {
        var result = multivec();
        var components = {};

        Object.keys(this.components).forEach(function(left) {
            Object.keys(other.components).forEach(function(right) {
                var bsign = canonicalizeBasis(left + right);

                components[bsign[0]] =
                    (components[bsign[0]] || 0) + (
                        bsign[1] * this.components[left] *
                        other.components[right]);
            }, this);
        }, this);

        Object.keys(components).forEach(function(key) {
            if (!zeroish(components[key]))
                result.components[key] = components[key]; });
        return result;
    };

    multivec.prototype.conjugate = function() {
        var result = multivec(this);
        Object.keys(result.components).forEach(function(key) {
            var k = key.split('o').length - 1;
            if ((k * (k - 1) / 2) % 2)
                result.components[key] *= -1;
        });
        return result;
    };

    multivec.prototype.inverse = function() {
        // Everything except 0 has an inverse
        var scale = this.product(this.conjugate());
        if (scale.zeroish())
            throw new TypeError('No inverse of zero');
        return this.product(1 / scale);
    };

    multivec.prototype.norm = function() {
        // Multi-vectors are immutable outside this library
        // so norm can be memoized to minimize square roots
        if (isNaN(this.__norm))
            this.__norm = Math.sqrt(
                this.product(this.conjugate()).scalar());
        return this.__norm;
    };

    // This library exports only one function so the name of the
    // library itself is used.
    if (typeof exports === 'undefined') {
        window['multivec'] = multivec;
    } else { exports = multivec; }
})();

if ((typeof require !== 'undefined') && (require.main === module)) {
    var multivec = exports;
    var tests = [
        [0], [[2, 2, 2]], [0, [2, 2, 2]],
        [[2, 1, -1], 5],
        [[1, 1], [4, -1]],
        [[1, 1], [4, -1], [-3, 0]],
        [' 2o1o2 +  3.14159  - 3o1o2'],
        [{'': 3, 'o1o2': -2}],
        ['2o1 - o2', 'o2 - 2o1']];

    tests.forEach(function(test) {
        var mvecs = test.map(multivec);
        if (!test.length) {
        } else if (test.length === 1) {
            console.log(mvecs[0].toString());
        } else {
            console.log('SUM  (' + mvecs
                .map(function(a) { return a.toString(); })
                .join(') + (') + ') = ' +
                        mvecs.reduce(function(a, b) {
                            return a.add(b); }));
            console.log('PROD (' + mvecs
                .map(function(a) { return a.toString(); })
                .join(') * (') + ') = ' +
                        mvecs.reduce(function(a, b) {
                            return a.product(b); }));
        }
    });
}
