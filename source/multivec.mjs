// multivec.mjs
// Copyright (C) 2017-2023 by Jeff Gold.
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
// including projective, mixed-signature and conformal models.  A
// multivector is the sum of zero or more components each of which is
// a coefficient times zero or more ortho-normal basis vectors.
// Objects from this library can represent real numbers, complex
// numbers, quaternions, vectors, rotors and many other kinds of
// mathematical objects.
//
// Orthonormal basis vectors are represented by strings like 'o1',
// 'o2', 'o1o2o3' and so on.  The letter 'o' was chosen becuase
// the more conventional 'e' is also used to represent exponents
// in IEEE 754 floating point numbers.  Strings such as 'i0' and 'i1'
// are used for negative signature ortho-normal basis vectors (useful
// for Minkowski metrics and conformal models).  Strings such as 'u0'
// and 'u1' are used for degenerate signature ortho-normal basis vectors
// (useful for some formulations of projective geometric algebra).
//
// The following invariants should hold for all multivec routines:
// - multivec values are immutable
// - multivec basis values are kept in canonical order:
//   = positive, degenerate, negative
//   = low index to high
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

/**
 * Returns true if and only if the given value is close enough
 * to zero.  This is a crude attempt to deal with rounding errors
 * in IEEE Floating Point numbers. */
function zeroish(value) {
    const epsilon = 0.00000000001;
    return (!isNaN(value) && value <= epsilon && value >= -epsilon);
};

// Support for canonicalBasis routine
let basisExp = new RegExp(/(([oOiIuUnN])(0|[1-9][0-9]*))|[xyzwtXYZWT]/);
let termExp = new RegExp(
    "^\\s*([-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?)?" +
    "(([oOiIuU](0|[1-9][0-9]*)|[xyzwtXYZWT])*)(\\s+([+-])\\s+)?");
let basisCache = {};

/**
 * Converts basis strings to a canonical form to make them
 * comparable.  Returns an object with the following fields:
 *  - label: string representing cannonical basis
 *  - vectors: array of basis vectors in order
 *  - sign: quadrance of basis (either +1, -1 or 0)
 * Some examples:
 *  - "yx" => {label: "o1o2", vectors: ["o1", "o2"], sign: -1}
 *  - "z"  => {label: "o3", vectors: ["o3"], sign: 1}
 *  - "o2o1o3" => {label: "o1o2o3", vectors: ["o1", "o2", "o3"],
 *                 sign: -1} */
function canonicalBasis(basis) {
    if (basis in basisCache)
        return basisCache[basis]; // memoize

    let current = basis;
    let rm; // regular expression match
    let vectors = [];

    // Extract basis vectors for further processing
    for (current = basis;
        (rm = current.match(basisExp)) && rm[0].length;
        current = current.slice(rm[0].length)) {
        if (rm[0] === 'x' || rm[0] === 'X') {
            vectors.push({signature: 1, subscript: 1});
        } else if (rm[0] === 'y' || rm[0] === 'Y') {
            vectors.push({signature: 1, subscript: 2});
        } else if (rm[0] === 'z' || rm[0] === 'Z') {
            vectors.push({signature: 1, subscript: 3});
        } else if (rm[0] === 'w' || rm[0] === 'W') {
            vectors.push({signature: 0, subscript: 0});
        } else if (rm[0] === 't' || rm[0] === 'T') {
            vectors.push({signature: -1, subscript: 1});
        } else if (rm[2] === 'o' || rm[2] === 'O') {
            vectors.push({signature: 1,
                          subscript: parseInt(rm[3], 10) });
        } else if (rm[2] === 'i' || rm[2] === 'I') {
            vectors.push({signature: -1,
                          subscript: parseInt(rm[3], 10) });
        } else if (rm[2] === 'u' || rm[2] === 'U') {
            vectors.push({signature: 0,
                          subscript: parseInt(rm[3], 10) });
        } else throw new Error("Unknown basis: " + current);
    }

    let result = {vectors: [], sign: 1};

    // Bubble sort basis vectors, flipping sign each swap
    var squeeze, ii, swap, swapped;
    for (squeeze = 1; squeeze < vectors.length; ++squeeze) {
        swapped = false;
        for (ii = 0; ii < vectors.length - squeeze; ++ii)
            if ((vectors[ii].signature < vectors[ii + 1].signature) ||
                ((vectors[ii].signature === vectors[ii + 1].signature) &&
                 (vectors[ii].subscript > vectors[ii + 1].subscript))) {
                swap = vectors[ii];
                vectors[ii] = vectors[ii + 1];
                vectors[ii + 1] = swap;

                result.sign *= -1;
                swapped = true;
            }
        if (!swapped)
            break;
    };

    // Collapse adjacent basis vectors into their signature
    for (ii = 0; ii < vectors.length; ++ii) {
        if ((ii + 1 >= vectors.length) ||
            (vectors[ii].signature !== vectors[ii + 1].signature) ||
            (vectors[ii].subscript !== vectors[ii + 1].subscript))
            result.vectors.push(
                ((vectors[ii].signature > 0) ? 'o' :
                 ((vectors[ii].signature < 0) ? 'i' : 'u')) +
                vectors[ii].subscript);
        else result.sign *= vectors[ii++].signature;
    }
    result.label = result.vectors.reduce((a,c) => a + c, "");
    result.contract = result.vectors.length !== vectors.length;

    basisCache[basis] = result;
    return result;
}

/**
 * Converts a string to an object representation of a multi-vector */
function fromString(value) {
    let result = {};
    let remain = value;
    let termOp = '+';
    let rm;

    while ((rm = remain.match(termExp)) && rm[0].length) {
        let basis = canonicalBasis(rm[3]);

        if (!result[basis.label])
            result[basis.label] = 0.0;
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

/**
 * Aliases give alternate names to basis vectors that have common
 * interpretations.  The first three spatial dimensions are usually
 * referred to using x, y and z labels.  This breaks down for
 * four or more dimensions because we run out of alphabet, but this
 * mapping allows us to substitute these labels when desired. */
let aliases = {
    "scalar": "",
    "x": "o1",
    "y": "o2",
    "z": "o3",
    "t": "i1",
    "w": "u0"
};
let reverseAliases = Object.keys(aliases).reduce((a, c) => {
    a[aliases[c]] = c;
    return a;
}, {});

/**
 * Ensures that multi-vector has conventional aliases */
function polish(mv) {
    Object.keys(aliases).forEach(key => {
        mv[key] = mv[aliases[key]] || 0.0; });
}

function product(left, right, filter) {
    let result = {};

    Object.keys(left).forEach(keyA => {
        if (keyA.startsWith('_') || (keyA in aliases))
            return;
        let valueA = left[keyA];

        Object.keys(right).forEach(keyB => {
            if (keyB.startsWith('_') || (keyB in aliases))
                return;
            let valueB = right[keyB];
            let basis = canonicalBasis(keyA + keyB);

            if (!filter || filter(basis)) {
                if (!(basis.label in result))
                    result[basis.label] = 0.;
                result[basis.label] += basis.sign * valueA * valueB;
            }
        });
    });
    return result;
}

// Duals are important in Geometric Algebra because they're
// necessary for computing meet of a subspace (or the join
// when using a dual representation).  This implementation
// should be correct (?) but avoids relying on division by the
// pseudoscalar because in some cases (such as most
// formulations of Projective Geometric Algebra) one or more
// basis vectors square to zero, creating a degenerate metric.
function hodgestar(base, target, weight_fn) {
    let result = {};

    base.eachBasis((base_key, weight) => {
        let base_basis = canonicalBasis(base_key);
        target.eachBasis((key, value) => {
            let basis = canonicalBasis(key);
            let dualkey = base_basis.vectors.filter(vector => {
                return !basis.vectors.includes(vector);
            }).join('');
            let dualbasis = canonicalBasis(key + dualkey);

            if (!zeroish(value)) {
                if (!(dualkey in result))
                    result[dualkey] = 0.0;
                result[dualkey] += (
                    dualbasis.sign * weight_fn(weight, value));
            }
        });
    });
    return new Multivec(result);
}

/**
 * Represents a quantity in Geometric Algebra. */
class Multivec {
    constructor(value) {
        if (typeof(value) === "string")
            value = fromString(value);

        if (Array.isArray(value)) {
            value.forEach((current, index) => {
                if (!zeroish(current))
                    this["o" + (index + 1)] = current; }, this);
        } else if (typeof(value) === "number") {
            this[""] = value;
        } else if (value instanceof Multivec) {
            value.eachBasis(key => { this[key] = value[key]}, this);
        } else if (typeof(value) === "object") {
            Object.keys(value).forEach(key => {
                if (!isNaN(value[key]) && !zeroish(value[key])) {
                    let basis = canonicalBasis(key);
                    if (!(basis.label in this))
                        this[basis.label] = 0.;
                    this[basis.label] += basis.sign * value[key];
                }
            }, this);
        } else throw new TypeError(
            "Cannot construct multi-vector from type " +
            typeof(value) + ": " + value);

        Object.freeze(polish(this));
    }

    eachBasis(fn, context) {
        Object.keys(this).forEach(key => {
            if (!key.startsWith('_') && !(key in aliases))
                fn.call(context || this, key, this[key]);
        }, this);
    }

    /**
     * Creates a multivector from most plausible values.
     * In contrast to the constructor, this static method will
     * reuse the input value if possible.  That's useful because
     * a Multivec is meant to be immutable. */
    static create(value) {
        return (value instanceof Multivec) ?
               value : new Multivec(value);
    }

    /**
     * Return true if and only if the argument is close enough
     * to zero to be considered zero. */
    static zeroish(value) { return Multivec.create(value).isZeroish(); }

    /**
     * Returns a representation of the multi-vector */
    toString(config) {
        let result = "";
        let multiterm = false;

        this.eachBasis((key, value) => {
            let basis = canonicalBasis(key);
            let label = (config && config.noalias) ?
                        basis.label : basis.vectors.reduce((a, c) =>
                            a + (c in reverseAliases ?
                                 reverseAliases[c] : c), "");
            let fn = v => ((config && config.places) ?
                           Number(v.toFixed(config.places)) :
                           v).toString();

            if (result)
                multiterm = true;
            if (zeroish(value)) {
                // skip zero value terms
            } else if (!result && value >= 0) // first term
                result += ((!key || !zeroish(value - 1)) ?
                           fn(value) : '') + label;
            else if (!result) // negative first term
                result += ((!key || !zeroish(value + 1)) ?
                           fn(value) : '-') + label;
            else if (value >= 0) // non-negative term
                result += " + " + (
                    (label && zeroish(value - 1)) ?
                    "" : fn(value)) + label;
            else result += " - " + (
                (label && zeroish(value + 1)) ?
                "" : fn(-value)) + label;

        });

        if (config && config.parens && multiterm)
            result = "(" + result + ")";
        if (!result.length)
            result = "0";
        return result;
    }

    toJSON(config) {
        let result = {};
        this.eachBasis((key, value) => {
            let basis = canonicalBasis(key);
            let label = (config && config.noalias) ?
                        basis.label : basis.vectors.reduce((a, c) =>
                            a + (c in reverseAliases ?
                                 reverseAliases[c] : c), "");
            result[label] = value;            
        });
        return result;
    }

    /**
     * Returns true if and only if each argument represents a
     * multi-vector equivalent to this instance.
     *
     * @returns true if equal and false otherwise */
    equals() {
        let result = true;

        for (let ii = 0; result && (ii < arguments.length); ++ii) {
            let other = Multivec.create(arguments[ii]);
            var checks = {};

            this.eachBasis(key => { checks[key] = true; });
            other.eachBasis(key => { checks[key] = true; });
            Object.keys(checks).forEach(key => {
                if (!zeroish((this[key] || 0.) - (other[key] || 0.)))
                    result = false; }, this);
        }
        return result;
    }

    /**
     * Returns true if and only if this multivector has no terms
     * without coefficients that are close enough to zero. */
    isZeroish() {
        let result = true;
        this.eachBasis((key, value) => {
            if (!zeroish(value))
                result = false; });
        return result;
    }

    /**
     * Returns true if and only if the only significant terms in
     * this multivector have a grade equal to the first argument. */
    isKVector(k) {
        let result = true;
        this.eachBasis((key, value) => {
            if ((canonicalBasis(key).vectors.length !== k) &&
                !zeroish(value))
                result = false;
        });
        return result;
    }

    /**
     * Returns true if and only if the only significant term in
     * this multivector is the scalar term. */
    isScalar() { return this.isKVector(0); }

    /**
     * Returns true if and only if the only significant terms in
     * this multivector are single basis terms. */
    isVector() { return this.isKVector(1); }

    /**
     * Returns true if and only if the only significant terms in
     * this multivector are single basis terms. */
    isBiector() { return this.isKVector(2); }

    /**
     * Return the sum of this multivector and each argument. */
    add(other) {
        let result = {};
        this.eachBasis((key, value) => { result[key] = value; });

        for (let ii = 0; ii < arguments.length; ++ii) {
            other = Multivec.create(arguments[ii]);
            other.eachBasis((key, value) => {
                result[key] = (key in result) ?
                              (result[key] + value) : value;
            });
        }
        return new Multivec(result);
    }

    /**
     * Return this multivector minus each argument. */
    plus(other) { return this.add.apply(this, arguments); }

    /**
     * Return the additive inverse of this multivector. */
    negate() {
        let result = {};
        this.eachBasis((key, value) => { result[key] = -value; });
        return new Multivec(result);
    }

    /**
     * Return this multivector minus each argument. */
    subtract(other) {
        let result = this;
        for (let ii = 0; ii < arguments.length; ++ii)
            result = result.add(
                Multivec.create(arguments[ii]).negate());
        return result;
    }

    /**
     * Return this multivector minus each argument. */
    minus(other) { return this.subtract.apply(this, arguments); }

    /**
     * Return the product of this multivector (on the left) and each
     * argument (from the right). */
    multiply(other) {
        let result = this;
        for (let ii = 0; ii < arguments.length; ++ii)
            result = product(result, Multivec.create(arguments[ii]));
        return Multivec.create(result);
    }

    /**
     * Return the product of this multivector and each argument. */
    times(other) { return this.multiply.apply(this, arguments); }

    /**
     * Return the multiplicative inverse of this multivector or
     * throw an error if no inverse exists. */
    inverse() {
        let quad = this.quadrance();
        if (!quad.isScalar())
            throw new Error("Multivector has non-scalar quadrance " +
                            "and therefore no inverse: " +
                            this.toString());
        if (zeroish(quad.scalar))
            throw new Error("Multivector too close to zero to have " +
                            "an inverse: " + this.toString());
        return this.conjugate().times(1 / quad.scalar);
    }

    /**
     * Return the product of this multivector (on the left) and the
     * inverse of each argument (from the right). */
    divide(other) {
        let result = this;
        for (let ii = 0; ii < arguments.length; ++ii)
            result = result.multiply(
                Multivec.create(arguments[ii]).inverse());
        return result;
    }

    /**
     * Return the wedge product of this multivector (on the left) and
     * each argument (from the right).  This is equivalent to the
     * geometric product except that any contracting terms are
     * discarded.  Sometimes called the outer or exterior product. */
    wedge(other) {
        let result = this;
        for (let ii = 0; ii < arguments.length; ++ii)
            result = product(
                result, Multivec.create(arguments[ii]),
                basis => !basis.contract);
        return Multivec.create(result);
    }

    /**
     * Return the contraction of this multivector (on the left) and
     * each argument (from the right).  This is equivalent to the
     * geometric product except that only contracting terms are
     * included.  Sometimes called the inner or interior product. */
    contract(other) {
        let result = this;
        for (let ii = 0; ii < arguments.length; ++ii)
            result = product(
                result, Multivec.create(arguments[ii]),
                basis => basis.contract);
        return Multivec.create(result);
    }

    conjugate() {
        let result = {};
        this.eachBasis((key, value) => {
            result[canonicalBasis(
                key).vectors.slice().reverse().join('')] = value;
        });
        return new Multivec(result);
    }

    /**
     * Returns the product of this multivector and its conjugate. */
    quadrance() { return this.multiply(this.conjugate()); }

    /**
     * Returns the norm of this multivector, which exists only if the
     * quadrance is a non-negative scalar value.  If so the norm is the
     * square root of the quadrance. */
    norm() {
        // Multivec is meant to be immutable from the perspective
        // of any caller so the first time we're asked for the
        // norm we store it for future reference (unless it doesn't
        // actually exist).
        let quad = this.quadrance();
        if (!quad.isScalar())
            throw new Error("Multivector has non-scalar " +
                            " quadrance and therefore no norm: " +
                            this.toString());
        if (quad.scalar < 0)
            throw new Error("Multivector has negative quadrance " +
                            "and therefore no norm: " +
                            this.toString());
        return Math.sqrt(quad.scalar);
    }

    /**
     * Return a multivector with the same orientation but with a
     * norm of one.  This is possible only when the multivector is
     * invertable. */
    normalize() {
        let norm = this.norm();
        if (zeroish(norm))
            throw new Error("Multivector has effectively zero " +
                            "norm and therefore cannot be " +
                            "normalized: " + this.toString());
        return this.multiply(1 / norm);
    }

    dual(other) {
        return hodgestar(this, Multivec.create(other), (w, v) => v * w);
    }

    undual(other) {
        return hodgestar(this, Multivec.create(other), (w, v) => v / w);
    }

    regress(start) {
        let result = this.dual(start);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.wedge(this.dual(arguments[ii]));
        return this.undual(result);
    }

    static addValues(start) {
        let result = Multivec.create(
            arguments.length ? arguments[0] : 0);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.add(arguments[ii]);
        return result;
    }

    static multiplyValues(start) {
        let result = Multivec.create(
            arguments.length ? arguments[0] : 1);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.multiply(arguments[ii]);
        return result;
    }

    static wedgeValues(start) {
        let result = Multivec.create(
            arguments.length ? arguments[0] : 1);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.wedge(arguments[ii]);
        return result;
    }

    static contractValues(start) {
        let result = Multivec.create(
            arguments.length ? arguments[0] : 0);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.contract(arguments[ii]);
        return result;
    }

    // === Projective Geometric Algebra (PGA)

    static originPointPGA = Multivec.create("w");
    static pseudoScalarPGA = Multivec.create("xyzw");

    static createPointPGA(point)
    { return this.originPointPGA.plus(point); }

    // When called on a PGA point, returns its weight as a scalar
    weightPGA() { return this.w; }

    normalizePointPGA() { return this.divide(this.weightPGA); }

    static regressPGA(start) {
        return this.pseudoScalarPGA.regress.apply(
            this.pseudoScalarPGA, arguments);
    }

    // === Conformal Geometric Algebra (CGA)

    static originPointCGA = Multivec.create({'o0': 0.5, 'i0': 0.5});
    static infinityPointCGA = Multivec.create({'o0': -1,  'i0': 1});
    static pseudoScalarCGA = Multivec.create("xyzo0i0");

    static createPointCGA(point) {
        return this.originPointCGA.plus(this.infinityPointCGA.times(
            this.quadrance().scalar / 2));
    }

    // When called on a CGA point, returns its weight as a scalar
    weightCGA()
    { return this.infinityPointCGA.times(-1).contract(this).scalar; }

    normalizePointCGA() { return this.divide(this.weightCGA()); }

    static regressCGA(start) {
        let result = this.pseudoScalarCGA.dual(start);
        for (let ii = 1; ii < arguments.length; ++ii)
            result = result.wedge(
                this.pseudoScalarCGA.dual(arguments[ii]));
        return this.pseudoScalarCGA.undual(result);
    }

    // === Testing

    static test() {
        let config = {places: 3, parens: true};
        let products = [
            {vectors: ["3x + w", "3y + w"], ops: {wedge: 1}},
            {vectors: ["x + y + w", "w"], ops: {wedge: 1}},
            {vectors: ["9xy + 3xw - 3yw", "xw + yw"],
             ops: {dual: "xyw", regress: "xyw"}}
        ];

        products.forEach(product => {
            if (!product.ops || product.ops.geo)
                console.log(product.vectors.reduce((a,c) =>
                    a + (a ? " " : "") + "(" + c + ")", ""), "=",
                            product.vectors.reduce((a, c) => a.multiply(c),
                                                   Multivec.create(1))
                                   .toString(config));
            if (product.ops && product.ops.wedge)
                console.log(product.vectors.reduce((a,c) =>
                    a + (a ? " ^ " : "") + "(" + c + ")", ""), "=",
                            product.vectors.reduce((a, c) => a.wedge(c),
                                                   Multivec.create(1))
                                   .toString(config));
            if (product.ops && product.ops.dot)
                console.log(product.vectors.reduce((a,c) =>
                    a + (a ? " | " : "") + "(" + c + ")", ""), "=",
                            Multivec.contractValues.apply(
                                null, product.vectors).toString(config));
            if (product.ops && product.ops.dual)
                product.vectors.forEach(vector => {
                    console.log("Dual:", vector, "=>",
                                Multivec.create(product.ops.dual)
                                        .dual(vector).toString(config));
                });
            if (product.ops && product.ops.regress) {
                let ps = Multivec.create(product.ops.regress);
                console.log("Regress:", product.vectors.map(
                    vector => "(" + vector.toString() + ")")
                                               .join(" V "), "=>",
                            ps.regress.apply(ps, product.vectors)
                              .toString(config));
            }
        });
    }
}

export default Multivec;
