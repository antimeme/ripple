// noise.js
// Copyright (C) 2022-2023 by Jeff Gold.
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
// A collection of tools for creating pseudo-random noise.
//
// Code borrowed from someone else is credited and the original license
// is included where applicable.

function noiseSquirrel5(seed, px, py, pz, pt) {
    // Squirrel Eiserloh's raw noise function
    // https://twitter.com/SquirrelTweets/status/1421251894274625536
    //
    // This code is made available under the Creative Commons
    // attribution 3.0 license (CC-BY-3.0 US):
    // Attribution in source code comments (even
    // closed-source/commercial code) is sufficient.
    // License summary and text available at:
    // https://creativecommons.org/licenses/by/3.0/us/
    if (isNaN(seed))
        throw new Error("Seed must be numeric: " + seed);
    if (isNaN(px))
        throw new Error("Position x must be numeric: " + px);

    let mangledBits = Math.floor(px);
    if (!isNaN(py))
        mangledBits += 198491317 * Math.floor(py);
    if (!isNaN(pz))
        mangledBits += 6542989 * Math.floor(pz);
    if (!isNaN(pt))
        mangledBits += 357239 * Math.floor(pt);

    const SQ5_BIT_NOISE1 = 0xd2a80a3f;
    // 11010010101010000000101000111111
    const SQ5_BIT_NOISE2 = 0xa884f197;
    // 10101000100001001111000110010111
    const SQ5_BIT_NOISE3 = 0x6C736F4B;
    // 01101100011100110110111101001011
    const SQ5_BIT_NOISE4 = 0xB79F3ABB;
    // 10110111100111110011101010111011
    const SQ5_BIT_NOISE5 = 0x1b56c4f5;
    // 00011011010101101100010011110101
    mangledBits *= SQ5_BIT_NOISE1;
    mangledBits += Math.floor(seed);
    mangledBits ^= (mangledBits >> 9);
    mangledBits += SQ5_BIT_NOISE2;
    mangledBits ^= (mangledBits >> 11);
    mangledBits *= SQ5_BIT_NOISE3;
    mangledBits ^= (mangledBits >> 13);
    mangledBits += SQ5_BIT_NOISE4;
    mangledBits ^= (mangledBits >> 15);
    mangledBits *= SQ5_BIT_NOISE5;
    mangledBits ^= (mangledBits >> 17);
    mangledBits >>>= 0; // convert to 32-bit signed integer
    return mangledBits;
};

function perlinSimplex3(x, y, z) {
    // Adapted from chapter 2 of Ken Perlin's 2001 SIGGRAPH
    // Course Notes.
    let A = [];
    let T = [0x15,0x38,0x32,0x2c,0x0d,0x13,0x07,0x2a];
    let bi = function(N, B) { return N>>B & 1; };
    let b = function(i, j, k, B) {
        return T[bi(i,B)<<2 | bi(j,B)<<1 | bi(k,B)];
    };
    let shuffle = function(i, j, k) {
        return b(i, j, k, 0) + b(j, k, i, 1) + b(k, i, j, 2) +
               b(i, j, k, 3) + b(j, k, i, 4) + b(k, i, j, 5) +
               b(i, j, k, 6) + b(j, k, i, 7) ;
    }

    let K = function(a) {
        let s = (A[0] + A[1] + A[2]) / 6.;
        let x = u - A[0] + s,
            y = v - A[1] + s,
            z = w - A[2] + s,
            t = .6 - x * x - y * y - z * z;
        let h = shuffle(i + A[0], j + A[1], k + A[2]);
        A[a]++;
        if (t < 0)
            return 0;
        let b5 = h>>5 & 1,
            b4 = h>>4 & 1,
            b3 = h>>3 & 1,
            b2 = h>>2 & 1,
            b = h & 3;
        let p = b == 1 ? x : b == 2 ? y : z,
            q = b == 1 ? y : b == 2 ? z : x,
            r = b == 1 ? z : b == 2 ? x : y;
        p = (b5 == b3 ? -p : p);
        q = (b5 == b4 ? -q : q);
        r = (b5 != (b4 ^ b3) ? -r : r);
        t *= t;
        return 8 * t * t * (p + (b == 0 ? q + r : b2 == 0 ? q : r));
    }

    x = isNaN(x) ? 0 : x;
    y = isNaN(y) ? 0 : y;
    z = isNaN(z) ? 0 : z;
    let i, j, k;
    let u, v, w;
    let s = (x + y + z) / 3;

    i = Math.floor(x + s);
    j = Math.floor(y + s);
    k = Math.floor(z + s);
    s = (i + j + k) / 6.;
    u = x - i + s;
    v = y - j + s;
    w = z - k + s;

    A[0] = A[1] = A[2] = 0;
    let hi = u >= w ? u >= v ? 0 : 1 : v >= w ? 1 : 2;
    let lo = u <  w ? u <  v ? 0 : 1 : v <  w ? 1 : 2;
    
    return K(hi) + K(3 - hi - lo) + K(lo) + K(0);
};

/**
 * Returns binomial coefficient without explicit factorials */
function pascalTriangle(a, b) {
  let result = 1;
  for (let ii = 0; ii < b; ++ii)
    result *= (a - ii) / (ii + 1);
  return result;
}

/**
 * Creates a version of the smoothstep function with a configurable
 * degree of continuity.  Providing 0 gives a linear transition with
 * a discontinuous derivative.  Providing 1 gives a cubic equation
 * with a continuous derivative but a discontinous second derivative,
 * which is to say acceleration.  Each additional step adds another
 * continuous derivative.
 *
 * This is adapted from https://en.wikipedia.org/wiki/Smoothstep
 * but should perform much better because coefficients are computed
 * in advance rather than on each call. */
function generalSmoothStep(order) {
    let coefficients = [];
    for (let n = 0; n <= order; ++n)
        coefficients.push(pascalTriangle(-order - 1, n) *
            pascalTriangle(2 * order + 1, order - n));
    return function(t) {
        let factor = Array(order).fill(0).reduce((a) => a * t, 1);
        return (t < 0) ? 0 : (t > 1) ? 1 :
               coefficients.reduce(function(a, c) {
                   factor *= t; return a + c * factor; }, 0);
    };
}
let smoothStep   = generalSmoothStep(1); // 3t^2 - 2t^3
let smootherStep = generalSmoothStep(2); // 6t^5 - 15t^4 + 10t^3

/**
 * Precomputed properties are required for each noise dimension.
 * These are created the first time they are needed and cached
 * for future use. */
let cacheNoise = {

    /**
     * Compute and cache the height of an n dimensional simplex */
    getSimplexHeight: function(n) {
        if (!(n in this.__simplexHeights))
            this.__simplexHeights[n] = Math.sqrt((n + 1) / (2 * n));
        return this.__simplexHeights[n];
    },
    __simplexHeights: {},

    getSimplexEdge: function(n) {
        if (!(n in this.__simplexEdges))
            this.__simplexEdges[n] = Math.sqrt(
                this.getUnskewed(Array(n).fill(1))
                    .reduce((a, c) => a + c * c, 1));
        return this.__simplexEdges[n];
    },
    __simplexEdges: {},

    /**
     * Convert a point in ordinary space to a skewed space where
     * simplex vertices match the vertices of a hypercube.  In
     * this skewed space it's easier to identify which simplex
     * within the hypercube contains the point.
     *
     * @param point an array with one entry per noise dimension
     * @returns an array representing the point in skewed space */
    getSkewed: function(point) {
        let n = point.length;

        if (!(n in this.__skewFactors))
            this.__skewFactors[n] = ((Math.sqrt(n + 1) - 1) / n);
        let displace = point.reduce((a, c) =>
            a + c, 0) * this.__skewFactors[n];
        return point.map(v => v + displace);
    },
    __skewFactors: {},

    /**
     * Convert a skewed point back to the original space for use in
     * additional calculations.
     *
     * @param point an array in the skewed space
     * @returns an array representing the point in original space */
    getUnskewed: function(point) {
        let n = point.length;

        if (!(n in this.__unskewFactors))
            this.__unskewFactors[n] = ((1 - 1 / Math.sqrt(n + 1)) / n);
        let displace = point.reduce((a, c) =>
            a + c, 0) * this.__unskewFactors[n];
        return point.map(v => v - displace);
    },
    __unskewFactors: {},

};

function createNoiseSimplex(config) {
    const separable = (config && config.separable) ? 1 : 0;

    // As we get farther from simplex vertices the influence should
    // fall off gradually.  This is how that gets done.
    function falloff(t) { return 1 - smootherStep(Math.abs(t)); }

    // Generate pseudo-random numbers for use in setting gradient
    // vector directions.
    let seed = ((config && config.seed) ? parseInt(config.seed) : 0) ||
               Math.floor(Math.random() * 1024);
    let random = function(vertex, index) {
        return vertex.reduce(
            (a, c) => noiseSquirrel5(a, c),
            noiseSquirrel5(seed, index)) / (2 * (1 << 30));
    }

    // Compute pseudo-random gradient vectors given a vertex with one
    // integer coordinate for each dimension.
    let gradientLattice = {};
    function getGradient(vertex) {
        let result;
        let lattice = gradientLattice;

        vertex.slice(0, -1).forEach(function(coord) {
            if (!(coord in lattice))
                lattice[coord] = {};
            lattice = lattice[coord];
        });

        let coord = vertex.slice(-1)[0];
        if (!(coord in lattice)) {
            let gradient = [(random(vertex, 0) > 0.5) ? 1 : -1];
            vertex.slice(1).forEach(function(coord, ii) {
                let direction = random(vertex, ii) * Math.PI;
                let sin = Math.sin(direction);
                gradient = gradient.map(c => c * sin);
                gradient.push(Math.cos(direction));
            });
            lattice[coord] = gradient;
        }
        result = lattice[coord];
        return result;
    };

    /*
     * An implementation of Ken Perlin's Simplex Noise in an
     * arbitrary number of dimensions.  Reference:.
     *   https://en.wikipedia.org/wiki/Simplex_noise        
     * Call with coordinates of point in order.  For example,
     * call noiseSimplex(x, y) for two dimensional noise. */
    function noiseSimplex() {
        let point = []; // Position for which to calculate noise
        let ii, jj;
        for (ii = 0; ii < arguments.length; ++ii)
            if (!isNaN(arguments[ii])) {
                point.push(arguments[ii]);
            } else throw new Error(
                "argument " + ii + " (\"" + arguments[ii] +
                "\") is not a number");
        const n = point.length;

        // ## Coordinate Skewing
        // Converts points in a regular simplex grid to a skewed grid
        // where all verticex lie on the corners of a hypercube.  This
        // makes it easier to determine which of the n-factorial
        // simplices contains the point.
        let skewed = cacheNoise.getSkewed(point);
        let delta = skewed.map(c => c - Math.floor(c));

        // ## Simplical Subdivision
        // Select the simplex within a hypercube which contains the
        // input point.  This should run in O(n^2) time and create
        // n + 1 vertices (where n is the number of dimensions).
        let selection = Array(n).fill(0);
        let simplex = [selection.slice()].concat(
            Array(n).fill(selection).map(function(_) {
                let index = undefined;

                selection.forEach(function(coord, ii) {
                    if (!coord && (isNaN(index) ||
                                   (delta[ii] > delta[index])))
                        index = ii; });
                if (!isNaN(index))
                    selection[index] = 1;
                return selection.slice();
            }) );

        // ## Kernel Summation
        const influence = cacheNoise.getSimplexEdge(n);
        let surflet = function(delta, gradient) {
            let result = delta.reduce( // this is a dot product
                (a, c, ii) => a + (c * gradient[ii]), 0);

            if (separable)
                result *= delta.reduce((a, c) => a * falloff(c), 1);
            else result *= falloff(Math.sqrt(
                delta.reduce((a, c) => a + (c * c), 0)) * influence);

            return result;
        };

        return simplex.reduce(function(acc, selection, ii) {
            // We must compute the difference between the point and
            // the vertex in the original space, but we'll choose
            // a gradient in the skewed space because there each
            // simplex vertex has integer coeficients
            const vertex = selection.map(
                (c, jj) => Math.floor(skewed[jj]) + c);
            return acc + surflet(
                cacheNoise.getUnskewed(vertex).map(
                    (c, jj) => point[jj] - c),
                getGradient(vertex));
        }, 0);
    };

    return noiseSimplex;
};

/**
 * Repeats a given noise function with half the amplitude and
 * twice the frequency for each octave to create finer details. */
function applyOctaves(fn, config) {
    const octaves    = (config && config.octaves) ?
                       parseInt(config.octaves) :  1;
    const amplitude  = (config && config.amplitude) ?
                       parseFloat(config.amplitude) : 1;
    const bias       = (config && config.bias) ?
                       parseFloat(config.bias) : 0.5;
    const wavelength = (config && config.wavelength) ?
                       parseFloat(config.wavelength) : 20;
    const frequency = 1/wavelength;

    return function() {
        let value = 0, ii;
        let amp   = amplitude;
        let freq  = frequency;

        for (ii = 0; ii < octaves; ++ii) {
            value += amp * fn.apply(this, Array.prototype.map.call(
                arguments, coord => coord * freq));
            amp  *= 0.5;
            freq *= 2;
        }
        return value + bias;
    };
}

function drawGrid(ctx, width, height, size) {
    for (let ii = 0; ii <= (width / size); ++ii) {
        ctx.moveTo(ii * size, 0);
        ctx.lineTo(ii * size, height);
    }
    for (let ii = 0; ii <= (height / size); ++ii) {
        ctx.moveTo(0, ii * size, 0);
        ctx.lineTo(width, ii * size);
    }
    return ctx;
}

function drawSimplexLattice(ctx, width, height, size) {
    for (let ii = 0; ii <= (width / size); ++ii) {
        for (let jj = 0; jj <= (height / size); ++jj) {
            let node = cacheNoise.getUnskewed([ii * size, jj * size]);
            ctx.moveTo(node[0] + size / 25, node[1]);
            ctx.arc(node[0], node[1], size / 25, 0, 2 * Math.PI);
        }
    }
    return ctx;
}

function parseColorWeight(config, name, base) {
    let result = isNaN(base) ? 1 : base;
    if (config && name in config) {
        let value = parseFloat(config[name]);
        if (isNaN(value) || (value < 0) || (value > 256)) {
        } else if ((value > 1) && (value <= 256))
            result = value / 256;
        else result = value;
    }
    return result;
};

/**
 * Creates a rectangular canvas image of a given noise function. */
function drawNoise(ctx, fn, config) {
    const red    = parseColorWeight(config, "red", 0.5);
    const green  = parseColorWeight(config, "green", 0.5);
    const blue   = parseColorWeight(config, "blue", 1);
    const startX = (config && config.startX) ?
                   parseInt(config.startX) : 0
    const startY = (config && config.startY) ?
                   parseInt(config.startY) : 0
    const width  = (config && config.width) ?
                   parseInt(config.width) : 320;
    const height = (config && config.height) ?
                   parseInt(config.height) : 240;
    const stats  = (config && config.stats) ?
                   config.stats : function() {};
    const wavelength = (config && config.wavelength) ?
                       parseFloat(config.wavelength) : 20;
    const freq   = 1; //25 / Math.min(width, height);
    const data   = new Uint8ClampedArray(4 * width * height);
    let max = undefined, min = undefined;

    for (let yy = 0; yy < height; ++yy)
        for (let xx = 0; xx < width; ++xx) {
            let index = 4 * (yy * width + xx);
            let value = fn(xx * freq, yy * freq);

            min = (isNaN(min) || (value < min)) ? value : min;
            max = (isNaN(max) || (value > max)) ? value : max;

            data[index + 0] = Math.min(255, Math.max(0, Math.floor(
                255.99 * red * value)));
            data[index + 1] = Math.min(255, Math.max(0, Math.floor(
                255.99 * green * value)));
            data[index + 2] = Math.min(255, Math.max(0, Math.floor(
                255.99 * blue * value)));
            data[index + 3] = 255; /* opaque */
        }

    if (stats && typeof(stats) === "function")
        stats({min: min, max: max});
    ctx.putImageData(new ImageData(data, width, height),
                     startX, startY);
    return ctx;
}

export default function(config) {
    let result = undefined;

    // Choose a noise algorithm
    let algorithm = (config && config.algorithm) ?
        config.algorithm : undefined;
    let seed = (config && config.seed) ? config.seed : 0;
    if (algorithm === "squirrel") {
        result = function(x, y, z, t) {
            let seed = 100;
            let value = noiseSquirrel5(seed, x, y, z, t);
            return (value / (2 * (1 << 30)));
        }
    } else if (algorithm === "perlin") {
        result = function(x, y) {
            let value = perlinSimplex3(x, y);
            return (1 + (value / 0.32549)) / 2;
        }
    } else result = createNoiseSimplex(config);

    result = applyOctaves(result, config);

    if (config && config.canvas &&
        config.canvas instanceof HTMLCanvasElement) {
        const canvas = config.canvas;
        const ctx = config.canvas.getContext("2d");
        drawNoise(ctx, result, Object.assign(config, {
            width: canvas.width,
            height: canvas.height}));
    }

    return result;
};
