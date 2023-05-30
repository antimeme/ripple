// multivec.js
// Copyright (C) 2017-2021 by Jeff Gold.
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
// including mixed-signature and conformal models.  A multivector is
// the sum of zero or more components each of which is a coefficient
// times zero or more ortho-normal basis vectors.  Objects from this
// library can represent real numbers, complex numbers, quaternions,
// vectors and many other kinds of mathematical objects.
//
// Orthonormal basis vectors are represented by strings like 'o1',
// 'o2', 'o1o2o3' and so on.  The letter 'o' was chosen becuase
// the more conventional 'e' is also used to represent exponents
// in IEEE 754 floating point numbers.  Strings such as 'i0' and 'i1'
// are used for negative signature ortho-normal basis vectors.
//
// The following invariants should hold for all multivec routines:
// - multivec values are immutable
// - multivec basis values are in canonical order (low index to high)
// - multivec components are omitted when very close to zero
//
// A multi-vector is constructed using the multivec() function, which
// can accept arguments in a variety of forms:
// - A number (scalar): multivec(3.14159)
// - An array (vector): multivec([3, -1, 2])
// - A string (multi-vector): multivec("2 + o2o1")
// - An object (multi-vector): multivec({'': 2, o2o1: 1})
//
// Operations on multi-vectors must use methods because JavaScript
// does not support operator overloading.  The following yields true:
//   multivec([2, 1]).plus(multivec([1, 2])).equals(multivec([3, 3]))
//
// Each multi-vector has a .scalar, .x, .y and .z field for ease
// of integration with other systems.
//   multivec(Math.PI).scalar === Math.PI // true
//   multivec([2, 1]).x === 2 // true
//   multivec("2o1 + o2").x === 2 // true
//   multivec({x: 2, y: 1}).x === 2 // true
//
// Three distinct inner products are offered.  All are equivalent
// when applied to vectors but they differ substantially for other
// kinds of multi-vectors -- including scalars.
// - inner: gemoetric product excluding the outer product
// - dot: inner product with scalar components
// - contract: non-associative dual projection
//
// Product   | o1, o1 | o1, o2 | 2, 7 | o1o2, o1 | o1, o1o2 | o1o2, o2o3
//  geometric| 1      | o1o2   | 14   | -o2      | o2       | o1o3
//  outer    | 0      | o1o2   | 14   | 0        | 0        | 0
//  inner    | 1      | 0      | 0    | -o2      | o2       | o1o3
//  dot      | 1      | 0      | 14   | -o2      | o2       | 0
//  contract | 1      | 0      | 0    | 0        | o2       | 0

/**
 * Returns true if and only if the given value is close enough
 * to zero.  This is a crude attempt to deal with rounding errors
 * in IEEE Floating Point numbers. */
function zeroish(value) {
    const epsilon = 0.00000000001;
    return (!isNaN(value) && value <= epsilon && value >= -epsilon);
};

let basisExp = new RegExp(/(([oOiIuUnN])(0|[1-9][0-9]*))|[xyzwtXYZWT]/);
let termExp = new RegExp(
    "^\\s*([-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?)?" +
    "(([oOiIuU](0|[1-9][0-9]*)|[xyzwtXYZWT])*)(\\s+([+-])\\s+)?");
let basisCache = {};

/**
 * Converts basis strings to a canonical form to make them
 * comparable.  Returns an object with the following fields:
 *  - label: string representing cannonical basis
 *  - grade: integer degree of basis
 *  - sign: either +1, -1 or 0
 * Some examples:
 *  - "yx" => {label: "o1o2", grade: 2, sign: -1}
 *  - "z"  => {label: "o3", grade: 1, sign: 1}
 *  - "o2o1o3" => {label: "o1o2o3", grade: 3, sign: -1} */
function canonicalBasis(basis) {
    if (basis in basisCache)
        return basisCache[basis]; // memoize

    let current = basis;
    let rm; // regular expression match
    let b = [];

    // Extract basis vectors for further processing
    for (current = basis;
        (rm = current.match(basisExp)) && rm[0].length;
        current = current.slice(rm[0].length)) {
        if (rm[0] === 'x' || rm[0] === 'X') {
            b.push({signature: 1, subscript: 1});
        } else if (rm[0] === 'y' || rm[0] === 'Y') {
            b.push({signature: 1, subscript: 2});
        } else if (rm[0] === 'z' || rm[0] === 'Z') {
            b.push({signature: 1, subscript: 3});
        } else if (rm[0] === 'w' || rm[0] === 'W') {
            b.push({signature: 0, subscript: 0});
        } else if (rm[0] === 't' || rm[0] === 'T') {
            b.push({signature: -1, subscript: 1});
        } else if (rm[2] === 'o' || rm[2] === 'O') {
            b.push({signature: 1, subscript: parseint(rm[3], 10) });
        } else if (rm[2] === 'i' || rm[2] === 'I') {
            b.push({signature: -1, subscript: parseint(rm[3], 10) });
        } else if (rm[2] === 'u' || rm[2] === 'U') {
            b.push({signature: 0, subscript: parseint(rm[3], 10) });
        } else throw new Error("Unknown basis: " + current);
    }

    // Bubble sort basis vectors, flipping sign each swap
    var squeeze, ii, swap, swapped;
    for (squeeze = 1; squeeze < b.length; ++squeeze) {
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

    // Collapse adjacent basis vectors into their signature
    let result = {label: "", grade: 0, sign: 1};
    for (ii = 0; ii < b.length; ++ii) {
        if ((ii + 1 >= b.length) ||
            (b[ii].signature !== b[ii + 1].signature) ||
            (b[ii].subscript !== b[ii + 1].subscript)) {
            result.label += ((b[ii].signature > 0) ? 'o' :
                             ((b[ii].signature < 0) ? 'i' : 'u')) +
                            b[ii].subscript;
            result.grade += 1;
        } else result.sign *= b[ii++].signature;
    }

    return (current.length ? undefined : (basisCache[basis] = result));
}

function fromString(value) {
    let result = {};
    let remain = value;
    let termOp = '+';
    let rm;

    while ((rm = remain.match(termExp)) && rm[0].length) {
        let basis = canonicalBasis(rm[3]);

        if (!result[basis.label])
            result[basis.label] = 0;
        result[basis.label] += (((termOp === '+') ? 1 : -1) *
            basis.sign * parseFloat(rm[1] || '1'));
        termOp = rm[7] || '+';
        remain = remain.slice(rm[0].length);
    }
    if (remain.length > 0)
        throw new TypeError(
            'Unable to parse "' + value + '" as a multivector');
    return result;
}

function polish(mv) {
    mv.scalar = mv[""] || 0.;
    mv.x = mv["o1"] || 0.;
    mv.y = mv["o2"] || 0.;
    mv.z = mv["o3"] || 0.;
    mv.t = mv["i1"] || 0.;
    mv.w = mv["u0"] || 0.;
}

class Multivec {
    constructor(value) {
        if (typeof(value) === "string")
            value = fromString(value);

        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (!zeroish(item))
                    this["o" + (index + 1)] = item; }, this);
        } else if (typeof(value) === "number") {
            this[""] = value;
        } else if (typeof(value) === "object") {
            Object.keys(value).forEach((key) => {
                if (!zeroish(value[key]))
                    this[key] = value[key]; }, this);
        } else throw new TypeError(
            "Cannot construct multi-vector from type " +
            typeof(value) + ": " + value);

        polish(this);
    }

    toString() {
        var result = "";

        Object.keys(this).sort().forEach(function(key) {
            if (key in {"o1": "x", "o2": "y", "o3": "z",
                        "i1": "t", "u0": "w", "scalar": ""})
                return;

            var coefficient = this[key];
            if (zeroish(coefficient)) {
                // skip zero coefficient terms
            } else if (!result) { // first term
                result += ((!key || !zeroish(coefficient - 1)) ?
                           coefficient : '') + key;
            } else if (coefficient >= 0) { // positive term
                result += " + " + (
                    zeroish(coefficient - 1) ? "" : coefficient) + key;
            } else result += " - " + ( // negative term
                zeroish(coefficient + 1) ? "" : -coefficient) + key;
        }, this);

        if (!result.length)
            result = "0";
        return result;
    }
}

function multivec(value) {
    return new Multivec(value);
};

multivec.test = function() {
    console.log(multivec("x + 2y").toString());
    console.log(multivec("3xy").toString());
    console.log(multivec("-1.333").toString());
};

export default multivec;
