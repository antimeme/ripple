// multivec.js
// Copyright (C) 2017-2018 by Jeff Gold.
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
// A multi-vector library intended to support Geometric Algebra,
// including mixed signature conformal models.  A multivector is the sum
// of zero or more components each of which is a coefficient times zero
// or more ortho-normal basis vectors.  Objects from this library can
// represent real numbers, complex numbers, quaternions, vectors and
// many other kinds of mathematical objects.
//
// Orthonormal basis vectors are represented by strings like 'o1',
// 'o2', 'o1o2o3' and so on.  The letter 'o' was chosen becuase
// the more conventional 'e' is also used to represent exponents
// in IEEE 754 floating point numbers.  Strings like 'i1' are used for
// negative signature ortho-normal basis vectors.
//
// The following invariants should hold for all multivec routines:
// - multivec values are immutable
// - multivec basis values are in canonical order (low index to high)
// - multivec components are omitted when within epsilon of zero

(function() {
    'use strict';
    var multivec;
    var epsilon = 0.00000000001;
    var zeroish = function(value) {
        return (!isNaN(value) && value <= epsilon && value >= -epsilon);
    };
    var basisCache = {};
    var basisExp = new RegExp(/(([oOiI])(0|[1-9][0-9]*))|[xyzXYZ]/);
    var termExp = new RegExp(
        '^\\s*([-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?)?' +
        '(([oOiI](0|[1-9][0-9]*))*)(\\s+([+-])\\s+)?');

    var canonicalizeBasis = function(basis) {
        // Converts basis strings to a canonical form to make them
        // comparable.  Returns an array containing the updated
        // basis string as well as the sign (either 1 or -1)
        if (basis in basisCache) // use cached result if possible
            return basisCache[basis];

        var result = {label: "", grade: 0, sign: 1};
        var b = [], current = basis, m, entry;

        // Extract basis vectors for further processing
        for (current = basis; (m = current.match(basisExp)) &&
             m[0].length; current = current.slice(m[0].length)) {
            if (m[0] === 'x' || m[0] === 'X') {
                entry = {signature: 1, subscript: 1};
            } else if (m[0] === 'y' || m[0] === 'Y') {
                entry = {signature: 1, subscript: 2};
            } else if (m[0] === 'z' || m[0] === 'Z') {
                entry = {signature: 1, subscript: 3};
            } else entry = {
                signature: (m[2] === 'o' || m[2] === 'O') ? 1 : -1,
                subscript: parseInt(m[3], 10)};
            b.push(entry);
        }

        var squeeze, ii, swap, swapped;
        for (squeeze = 1; squeeze < b.length; ++squeeze) {
            // Bubble sort basis vectors, flipping sign each swap
            swapped = false;
            for (ii = 0; ii < b.length - squeeze; ++ii)
                if ((b[ii].signature > b[ii + 1].signature) ||
                    (b[ii].subscript > b[ii + 1].subscript)) {
                    swap = b[ii];
                    b[ii] = b[ii + 1];
                    b[ii + 1] = swap;

                    result.sign *= -1;
                    swapped = true;
                }
            if (!swapped)
                break;
        };

        // Collapse adjacent basis vectors
        for (ii = 0; ii < b.length; ++ii) {
            if ((ii + 1 >= b.length) ||
                (b[ii].signature !== b[ii + 1].signature) ||
                (b[ii].subscript !== b[ii + 1].subscript)) {
                result.label += (b[ii].signature > 0 ? 'o' : 'i') +
                                b[ii].subscript;
                result.grade += 1;
            } else {
                result.sign *= b[ii].signature;
                ++ii;
            }
        }

        return basisCache[basis] = result;
    };

    var polish = function(value) {
        // Give multivector some helpful values
        value.scalar = value.components[''] || 0;
        value.x = value.components['o1'] || 0;
        value.y = value.components['o2'] || 0;
        value.z = value.components['o3'] || 0;
        return value;
    };

    var fromString = function(value) {
        var basis, termOp = '+', m;
        var remain = value;
        var components = {};

        while ((m = remain.match(termExp)) && m[0].length) {
            basis = canonicalizeBasis(m[3]);
            if (!components[basis.label])
                components[basis.label] = 0;
            components[basis.label] += (((termOp === '+') ? 1 : -1) *
                basis.sign * parseFloat(m[1] || '1'));
            termOp = m[7] || '+';
            remain = remain.slice(m[0].length);
        }
        if (remain.length > 0)
            throw new TypeError(
                'Unable to parse "' + value + '" as a multivector');
        return convert(components);
    };

    var convert = function(value) {
        var result;

        if (value instanceof multivec)
            result = value; // already a multi-vector
        else if (typeof(value) === 'string')
            result = fromString(value);
        else {
            result = Object.create(multivec.prototype);
            result.components = {};
            if (!isNaN(value)) {
                result.components[''] = value;
            } else if (typeof(value) === 'undefined') {
            } else if (Array.isArray(value)) {
                value.forEach(function(element, index) {
                    result.components['o' + (index + 1)] = element; });
            } else if (!isNaN(value.theta)) {
                var factor = isNaN(value.r) ? 1 : value.r;
                if (!isNaN(value.phi)) {
                    result.components['o3'] =
                        factor * Math.sin(value.phi);
                    factor *= Math.cos(phi);
                }
                result.components['o1'] =
                    factor * Math.cos(value.theta);
                result.components['o2'] =
                    factor * Math.sin(value.theta);
            } else {
                Object.keys(value).forEach(function(key) {
                    var basis = canonicalizeBasis(key);
                    if (!zeroish(value[key]))
                        result.components[basis.label] =
                            (result.components[basis.label] || 0) +
                            basis.sign * value[key];
                });
            }
        }
        return result;
    };

    multivec = function(value) {
        // Represents a multi-vector suitable for Geometric Algebra
        if (!(this instanceof multivec))
            return new multivec(value);
        this.components = {};
        value = convert(value);

        Object.keys(value.components).forEach(function(key) {
            if (!zeroish(value.components[key]))
                this.components[key] = value.components[key];
        }, this);
        polish(this);
    };

    multivec.prototype.toString = function() {
        var result = '';

        Object.keys(this.components).sort().forEach(function(key) {
            var coefficient = this.components[key];
            if (zeroish(coefficient)) {
                // skip zero coefficient terms
            } else if (!result) {
                result += ((!key || !zeroish(coefficient - 1)) ?
                           coefficient : '') + key;
            } else if (coefficient >= 0) {
                result += ' + ' + (
                    zeroish(coefficient - 1) ? '' : coefficient) + key;
            } else result += ' - ' + (
                zeroish(coefficient + 1) ? '' : -coefficient) + key;
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
        return result;
    };
    multivec.zeroish = function() {
        // Return true iff all supplied mutlivectors are approximately
        // zero (actual zero not required due to floating point
        // rounding errors).
        var result = true;
        for (var ii = 0; ii < arguments.length; ++ii)
            if (!convert(arguments[ii]).zeroish())
                result = false;
        return result;
    };

    multivec.prototype.equals = function() {
        // Return true iff all supplied multivectors are approximately
        // equal to this one (actual equality not required due to
        // floating point rounding errors).
        var result = true;

        for (var ii = 0; ii < arguments.length; ++ii) {
            var checks = {};
            var other = convert(arguments[ii]);

            Object.keys(this.components).forEach(function(key) {
                checks[key] = true; });
            Object.keys(other.components).forEach(function(key) {
                checks[key] = true; });
            Object.keys(checks).forEach(function(key) {
                if (!zeroish((this.components[key] || 0) -
                             (other.components[key] || 0)))
                    result = false; }, this);
        }
        return result;
    };
    multivec.equals = function() {
        // Return true iff all supplied multivectors are approximately
        // equal (actual equality not required due to floating point
        // rounding errors).
        var result = true;
        if (arguments.length > 1) {
            var first = convert(arguments[0]);
            for (var ii = 1; ii < arguments.length; ++ii) {
                if (!first.equals(arguments[ii]))
                    result = false;
            }
        }
        return result;
    };

    multivec.prototype.grade = function(homogeneous) {
        // Returns the grade of the higest grade component in this
        // multivector (or undefined if homogenous is true and the
        // multivector is not homogenous)
        var result = undefined;
        var mixed = false;

        Object.keys(this.components).forEach(function(key) {
            if (!zeroish(this.components[key])) {
                var basis = canonicalizeBasis(key);
                var current = basis.grade;

                if (homogeneous) {
                    if (isNaN(result)) {
                        if (!mixed)
                            result = current;
                    } else if (result !== current) {
                        result = undefined;
                        mixed = true;
                    }
                } else if (isNaN(result) || result < current)
                    result = current;
            }
        }, this);
        return result;
    };
    multivec.prototype.isHomogeneous =
        function() { return !isNaN(this.grade(true)); }

    multivec.prototype.isGrade = function(grade) {
        return this.zeroish() || (this.grade(true) === grade);
    };
    multivec.prototype.isScalar =
        function() { return this.isGrade(0); };
    multivec.prototype.isVector =
        function() { return this.isGrade(1); };
    multivec.prototype.isBivector =
        function() { return this.isGrade(2); };
    multivec.prototype.isTrivector =
        function() { return this.isGrade(3); };

    multivec.prototype.reverse = function() {
        var components = {};
        Object.keys(this.components).forEach(function(key) {
            var k = canonicalizeBasis(key).grade;
            components[key] = ((((k * (k - 1) / 2) % 2) ? -1 : 1) *
                this.components[key]);
        }, this);
        return polish(convert(components));
    };

    multivec.prototype.normSquared = function() {
        // Return the square of the multi-vector norm.  This is
        // sometimes sufficient and saves a square root operation, for
        // example to determine whether a vector is greater than a
        // certain length.  Memoized because multi-vectors are immutable
        if (isNaN(this.__normSquared))
            this.__normSquared = this.multiply(this.reverse()).scalar;
        return this.__normSquared;
    };

    multivec.prototype.norm = function() {
        // Return the Euclidian or 2-norm of a multi-vector.
        // Memoized because multi-vectors are immutable.
        if (isNaN(this.__norm))
            this.__norm = Math.sqrt(this.normSquared());
        return this.__norm;
    };

    multivec.prototype.normalize = function() {
        // Multi-vectors are immutable outside this library so norm can
        // be memoized to minimize square roots
        var scale = this.norm();
        if (zeroish(scale))
            throw new RangeError('Zero cannot be normalized');
        return this.multiply(1 / scale);
    };

    multivec.prototype.inverseAdd = function() {
        // Returns the additive inverse of a multi-vector.
        return this.multiply(-1);
    };
    multivec.prototype.negate = multivec.prototype.inverseAdd;

    multivec.prototype.inverseMult = function() {
        // Returns the multiplicative inverse of a multi-vector,
        // except for zero which has no inverse and throws an error.
        var scale = this.normSquared();
        if (zeroish(scale))
            throw new RangeError(
                'No multiplicative inverse of ' + this.toString() +
                ' (normSquared: ' + scale + ')');
        return this.reverse().multiply(1 / scale);
    };

    var fieldOp = {
        add: 0,
        multiply: 1,
        outer: 2,
        inner: 3,
        dot: 4,
        contract: 5};

    var fieldOpBinary = function(op, a, b) {
        // Generic field operations (add, subtract, multiply)
        // Division is excluded because it's a bit complex
        var result = {};
        b = convert(b);

        if (op === fieldOp.add) {
            Object.keys(a.components).forEach(function(key) {
                result[key] = 0; });
            Object.keys(b.components).forEach(function(key) {
                result[key] = 0; });
            Object.keys(result).forEach(function(key) {
                result[key] = (a.components[key] || 0) +
                              (b.components[key] || 0); });
        } else Object.keys(a.components).forEach(function(left) {
            Object.keys(b.components).forEach(function(right) {
                var basis = canonicalizeBasis(left + right);

                if (op === fieldOp.outer || op === fieldOp.inner ||
                    op === fieldOp.dot || op === fieldOp.contract) {
                    var k = canonicalizeBasis(right).grade;
                    var l = canonicalizeBasis(left).grade;

                    if (((op === fieldOp.outer) &&
                         (k + l !== basis.grade)) ||
                        ((op === fieldOp.inner) &&
                         (k + l === basis.grade)) ||
                        ((op === fieldOp.dot) &&
                         (Math.abs(k - l) !== basis.grade)) ||
                        ((op === fieldOp.contract) &&
                         (k - l !== basis.grade))) {
                        return;
                    }
                }

                result[basis.label] =
                    (result[basis.label] || 0) +
                     (basis.sign * a.components[left] *
                         b.components[right]);
            });
        });
        return convert(result);
    };

    multivec.prototype.add = function(other) {
        var result;
        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.add, this, other);
        else
            for (var ii = 0, result = this; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.add, result, arguments[ii]);
        return polish(result);
    };
    multivec.prototype.plus = multivec.prototype.add;
    multivec.prototype.sum = multivec.prototype.add;
    multivec.sum = function() {
        return multivec.prototype.add.apply(multivec(0), arguments);
    };

    multivec.prototype.subtract = function(other) {
        var result;
        if (arguments.length === 1)
            result = fieldOpBinary(
                fieldOp.add, this, convert(other).inverseAdd());
        else
            for (var ii = 0, result = this; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.add, result,
                    convert(arguments[ii]).inverseAdd());
        return polish(result);
    };
    multivec.prototype.minus = multivec.prototype.subtract;

    multivec.prototype.multiply = function(other) {
        var result;
        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.multiply, this, other);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.multiply, result, arguments[ii]);
        }
        return polish(result);
    };
    multivec.prototype.product = multivec.prototype.multiply;
    multivec.prototype.times = multivec.prototype.multiply;
    multivec.product = function() {
        return multivec.prototype.multiply.apply(
            multivec(1), arguments);
    };

    multivec.prototype.divide = function(other) {
        var result;
        if (arguments.length === 1)
            result = fieldOpBinary(
                fieldOp.multiply, this, convert(other).inverseMult());
        else
            for (var ii = 0, result = this; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.multiply, result, convert(
                        arguments[ii]).inverseMult());
        return polish(result);
    };

    multivec.prototype.inner = function(other) {
        var result;

        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.inner, this, other);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.inner, result, arguments[ii]);
        }
        return polish(result);
    };
    multivec.inner = function() {
        var result = undefined;
        for (var ii = 0; ii < arguments.length; ++ii)
            result = (typeof result === 'undefined') ?
                     arguments[ii] : result.inner(arguments[ii]);
        return result;
    };

    multivec.prototype.dot = function(other) {
        var result;

        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.dot, this, other);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.dot, result, arguments[ii]);
        }
        return polish(result);
    };
    multivec.dot = function() {
        var result = undefined;
        for (var ii = 0; ii < arguments.length; ++ii)
            result = (typeof result === 'undefined') ?
                     arguments[ii] : result.dot(arguments[ii]);
        return result;
    };

    multivec.prototype.contract = function(other) {
        var result;

        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.contract, this, other);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.contract, result, arguments[ii]);
        }
        return polish(result);
    };
    multivec.contract = function() {
        var result = undefined;
        for (var ii = 0; ii < arguments.length; ++ii)
            result = (typeof result === 'undefined') ?
                     arguments[ii] : result.contract(arguments[ii]);
        return result;
    };

    multivec.prototype.wedge = function(other) {
        var result;

        if (arguments.length === 1)
            result = fieldOpBinary(fieldOp.outer, this, other);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = fieldOpBinary(
                    fieldOp.outer, result, arguments[ii]);
        }
        return polish(result);
    };
    multivec.prototype.outer = multivec.prototype.wedge;
    multivec.wedge = function() {
        var result = undefined;
        for (var ii = 0; ii < arguments.length; ++ii)
            result = (typeof result === 'undefined') ?
                     arguments[ii] : result.wedge(arguments[ii]);
        return result;
    };
    multivec.outer = multivec.wedge;

    multivec.prototype.project = function(space) {
        return this.inner(space).divide(space); };

    multivec.prototype.reject = function(space) {
        return this.outer(space).divide(space); };

    multivec.prototype.applyVersor = function() {
        var result = this;
        for (var ii = 0; ii < arguments.length; ++ii) {
            var v = convert(arguments[ii]);
            result = v.multiply(result).multiply(v.inverseMult());
        }
        return result;
    };

    multivec.prototype.rotate = function(v, w) {
        // Rotates a vector along the plane defined by vectors v and w
        // by the angle between the two vectors.
        return this.applyVersor(v, v.plus(w));
    };

    multivec.originPoint = multivec({'o0': 0.5, 'i0': 0.5});
    multivec.infinityPoint = multivec({'o0': -1,  'i0': 1});

    multivec.prototype.createPoint = function() {
        // Convert a vector to a conformal geometric algebra point
        return this.plus(multivec.originPoint,
                         multivec.infinityPoint.times(
                             this.normSquared(), 0.5));
    };

    multivec.prototype.normalizePoint = function() {
        // Normalize a conformal point, usually for conversion
        // back to a vector
        return this.divide(multivec.infinityPoint.inner(this), -1);
    };

    multivec.prototype.vectorizePoint = function() {
        // Convert a conformal point to a vector representation
        // (without origin and infinity points)
        return this.normalizePoint().reject(
            multivec.originPoint.outer(multivec.infinityPoint));
    };

    multivec.conformalDistance = function(point1, point2) {
        // Compute the distance between two conformal points
        return Math.sqrt(point1.dot(point2).times(-2).scalar);
    };

    multivec.conformalDual = function(object) {
        return convert(object).multiply({'i0o0o1o2o3': 1});
    };

    multivec.createRotation = function(bivector, angle) {
        // Create a rotation that can be applied as a versor
        bivector = bivector.divide(bivector.norm());
        return bivector.times(
            Math.sin(-angle/2)).plus(Math.cos(-angle/2));
    };

    var versor = function(mvec, sign) {
        if (!(this instanceof versor))
            return new versor(mvec, sign);
        this.sign = sign || 1;
        this.value = mvec;
    };
    versor.prototype.apply = function(mvec) {
        return multivec.product(
            this.sign, this.value, mvec, this.value.inverseMult());
    };
    versor.prototype.compose = function(other) {
        var result;

        if (arguments.length === 1)
            result = versor(this.value.multiply(other.value),
                            this.sign * other.sign);
        else {
            result = this;
            for (var ii = 0; ii < arguments.length; ++ii)
                result = versor(
                    result.value.multiply(arguments[ii].value),
                    result.sign * arguments[ii].sign);
        }
        return result;
    };
    versor.compose = function() {
        var result = undefined;
        for (var ii = 0; ii < arguments.length; ++ii)
            result = (typeof result === 'undefined') ?
                     arguments[ii] : result.compose(arguments[ii]);
        return result;
    };

    multivec.createTranslation = function(vector) {
        return versor(multivec(1).minus(
            vector.times(multivec.infinityPoint, 0.5)));
    };

    multivec.createReflection = function(vector) {
        return versor(vector, -1);
    };

    multivec.createDilution = function(scalar) {
        return versor(multivec.sum(1, multivec.originPoint.outer(
            multivec.infinityPoint)).times(scalar / 2));
    };

    multivec.createInvertion = function() {
        return versor(multivec.originPoint.minus(
            multivec.infinityPoint.divide(2)), -1);
    };

    multivec.prototype.draw = function(ctx, config) {
        // Draw an arrow representing the o1 and o2 components of this
        // multi-vector (intended for debugging purposes)
        var length = (config && config.length) ? config.length : 1;
        var bar = multivec([-this.y, this.x]).multiply(0.1);
        var lineTo = function(ctx, vector) {
            ctx.lineTo(vector.x, vector.y);
        };

        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = (config && config.color) || 'black';
        ctx.fillStyle = (config && config.fill) || 'white';
        ctx.lineWidth = (config && config.lineWidth) || 5;
        if (config.center)
            ctx.translate(config.center.x,
                          config.center.y);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        lineTo(ctx, this.multiply(length * 0.9));
        lineTo(ctx, this.add(bar).multiply(length * 0.9));
        lineTo(ctx, this.multiply(length));
        lineTo(ctx, this.add(bar.multiply(-1)).multiply(length * 0.9));
        lineTo(ctx, this.multiply(length * 0.9));
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    };

    var quadraticRoots = function(a, b, c) {
        // Computes the real roots of a quadradic expression.  Returns
        // an array with either zero (no real roots) one or two numbers
        // at which the expression is zero
        var result = [];
        var discriminant;
        if (zeroish(a)) {
            result = [-c / b];
        } else {
            discriminant = b * b - 4 * a * c;
            if (discriminant < 0) {
                // No real roots exist so result remains empty
            } else if (discriminant > 0) {
                discriminant = Math.sqrt(discriminant);
                result = [(-b + discriminant) / (2 * a),
                          (-b - discriminant) / (2 * a)];
            } else result = [-b / (2 * a)];
        }
        return result;
    };

    var shortestSegment = function(v, segment) {
        // Returns a vector going from the point represented
        // by this vector to the closest point on the line.
        // The output of this method plus the original vector
        // is the closest point on the line
        var q = segment.q ? segment.q : segment.e.subtract(segment.s);
        var q2 = segment.normSquared ? segment.normSquared :
                 q.normSquared();
        return v.subtract(segment.s).subtract(
            q.multiply(v.subtract(segment.s).dot(q).divide(q2)));
    };

    multivec.collideRadiusRadius = function(s1, e1, r1, s2, e2, r2) {
        // Given the two round objects moving at constant velocity,
        // compute the earliest time during the interval at which they
        // will collide. If no collision is possible return undefined.
        //
        // A parameterized path is computed for both objects and the
        // quadratic formula is used to find where that distance is
        // equal to the sum of the radii, which is where edges touch.
        var result = undefined;
        var d1 = e1.subtract(s1);
        var d2 = e2.subtract(s2);
        var gap = r1 + r2;

        result = quadraticRoots(
            d1.dot(d1).scalar + d2.dot(d2).scalar -
            2 * d1.dot(d2).scalar,
            2 * s1.dot(d1).scalar + 2 * s2.dot(d2).scalar -
            2 * d1.dot(s2).scalar - 2 * d2.dot(s1).scalar,
            s1.dot(s1).scalar + s2.dot(s2).scalar -
            2 * s1.dot(s2).scalar - gap * gap);

        result = result.map(function(v) {
            // Avoids rounding errors that cause missed collisions
            return zeroish(v) ? 0 : v;
        }).filter(function(v) { return ((v >= 0 && v <= 1)); });
        result = (result.length > 0) ? Math.min(result) : undefined;

        // Don't report collision when close and moving away
        if (zeroish(result) &&
            (s1.subtract(s2).normSquared() <
                e1.subtract(e2).normSquared()))
            result = undefined;

        return result;
    }

    multivec.collideRadiusSegment = function(s, e, r, segment) {
        // Given a spherical object moving at constant velocity and a
        // line segment, this routine computes the time at which the
        // two will collide.  The object is assumed to be at s (start
        // point) when t == 0 and at e (end point) when t == 1. If no
        // collision occurs this routine returns undefined.  The
        // segment is an object with the following fields expected:
        //
        //   segment {
        //     s: vector representing starting point
        //     e: vector representing ending point
        //     q: (optional) vector e - s
        //     sqlen: (optional) squared length of segment
        //     width: (optional) width of the segment
        // thickness.  The distance bewteen the end points is an
        // optional which can be used to reduce unnecessary steps.
        //
        // A parameterized path is computed nad the quadratic formula
        // is used to find the fraction of the path at which the edges
        // of the sphere and segment touch
        var result = undefined; // undefined means no collision
        var q = segment.q ? segment.q : segment.e.subtract(segment.s);
        var q2 = segment.normSquared ? segment.normSquared :
                 q.normSquared();
        var width = segment.width ? segment.width : 0;
        var ps = s.subtract(segment.s).dot(q).divide(q.norm()).scalar;
        var pe = e.subtract(segment.s).dot(q).divide(q.norm()).scalar;
        var ds = shortestSegment(s, segment);
        var de = shortestSegment(e, segment);
        var m, n, mq, nq, gap; // line distance computation variables

        // A zero length segment would create divide-by-zero problems
        // so treat it as a round object instead
        if (zeroish(q2))
            return multivec.collideRadiusRadius(
                s, e, r, segment.s, segment.e, width / 2);
        gap = r + width / 2;
        gap *= gap;

        if (ds.normSquared() < gap) {
            if (ps < 0)
                return multivec.collideRadiusRadius(
                    s, e, r, segment.s, segment.s, width / 2);
            else if (ps > q.norm())
                return multivec.collideRadiusRadius(
                    s, e, r, segment.e, segment.e, width / 2);
        }

        // Distance squared is
        //   (p - segment.s) - ((p - segment.s) . q)q/q^2)^2
        // A collision happens when this value is less than
        //   (r - width/2)^2
        // Since p is moving, it can be expanded to p = s + (e - s)t
        // Then we break things down in terms of t and find roots
        m = e.subtract(s); mq = m.dot(q).scalar;
        n = s.subtract(segment.s); nq = n.dot(q).scalar;

        // Rather than computing square roots, which can be expensive,
        // we compare the square of the distance between point and line
        // to the square of the sum of the radius and wall width.
        // The roots represent the points in time when the difference
        // between these values is zero, which are the moments of
        // collison
        result = quadraticRoots(
            m.dot(m).scalar - mq * mq / q2,
            2 * m.dot(n).scalar - 2 * mq * nq / q2,
            n.dot(n).scalar - nq * nq / q2 - gap);
        result = result.map(function(v) {
            // Avoids rounding errors that cause missed collisions
            return zeroish(v) ? 0 : v;
        }).filter(function(v) { return ((v >= 0 && v <= 1)); });
        result = (result.length > 0) ? Math.min(result) : undefined;

        if (zeroish(result)) {
            // Don't report collisions if the object starts up against
            // the segment but is moving away
            var ds = shortestSegment(s, segment);
            var de = shortestSegment(e, segment);
            if ((de.normSquared() > ds.normSquared()) &&
                ds.dot(de).scalar > 0)
                result = undefined;
        }

        if (!isNaN(result)) {
            // Ignore collisions that occur outside the boundaries of
            // the segment -- makes it possible to go around segments
            var ps = s.subtract(segment.s).dot(q).divide(q.norm());
            var pe = e.subtract(segment.s).dot(q).divide(q.norm());
            if (ps.scalar + r < 0 && pe.scalar + r < 0) {
                result = undefined;
            } else if (ps.scalar - r > q.norm() &&
                       pe.scalar -r > q.norm()) {
                result = undefined;
            }
        }
        return result;
    };

    // This library exports only one function so the name of the
    // library itself is used.
    if (typeof exports === 'undefined') {
        window['multivec'] = multivec;
    } else { exports = multivec; }
})();

if ((typeof require !== 'undefined') && (require.main === module)) {
    var multivec = exports;
    var tests = {
        indivdual: {
            vectors: [
                [0], [7], [[2, 2, 2]], [' 2o1o2 +  3.14159 - 3o1o2'],
                [{'': 3, 'o1o2': -2}]] },
        products: {
            sum: true, product: true, inner: true, outer: true,
            vectors: [
                [0, [2, 2, 2]], [[2, 1, -1], 5],
                [[1, 1], [4, -1]],  [[1, 1], [4, -1], [-3, 0]],
                ['2o1 - o2', 'o2 - 2o1'],  ['o1', 'o2'],
                ['o1 + o2', 'o2 + o1'], ['o1 + o2', '2o2 + 2o1'],
                ['2o1o2 + 3o3 + 1', '3o3 - 2o1o2 - 1']] },
        conformal: {
            inner: true, outer: true,
            vectors: [
                [multivec.originPoint, multivec.infinityPoint],
                [multivec.createTranslation(multivec([1, 1, 1])).value],
                [multivec.createTranslation(multivec([1, 1, 1])).apply(
                    multivec([2, 2, 2]).createPoint())],
                [multivec.createTranslation(multivec([1, 1, 1])).apply(
                    multivec([2, 2, 2]).createPoint()).vectorizePoint()]
            ]}};

    var conduct = function(name, test) {
        console.log('===', name);
        test.vectors.forEach(function(vecs) {
            var mvecs = vecs.map(multivec);
            var svecs = mvecs.map(function(a) { return a.toString(); });
            if (!vecs.length) {
            } else if (vecs.length === 1) {
                console.log(svecs[0], 'grade?', mvecs[0].grade());
            } else {
                var eq = multivec.equals.apply(null, mvecs);
                console.log(svecs.join(', '), "eq?", eq);
                if (test.sum)
                    console.log('  SUM  (' + svecs.join(') + (') +
                                ') = ' + multivec.sum.apply(
                                    null, mvecs).toString());
                if (test.product)
                    console.log('  PROD (' + svecs.join(') * (') +
                                ') = ' + multivec.product.apply(
                                    null, mvecs).toString());
                if (test.inner)
                    console.log('  INNER (' + svecs.join(') . (') +
                                ') = ' + multivec.inner.apply(
                                    null, mvecs).toString());
                if (test.outer)
                    console.log('  OUTER (' + svecs.join(') ^ (') +
                                ') = ' + multivec.wedge.apply(
                                    null, mvecs).toString());
            }
        });
    };

    var chosen = process.argv.slice(2);

    if (chosen.length)
        chosen.forEach(function(arg) {
            if (arg in tests)
                conduct(arg, tests[arg]);
            else console.log('===', arg, 'MISSING'); });
    else Object.keys(tests).forEach(function(key) {
        conduct(key, tests[key]); });
}
