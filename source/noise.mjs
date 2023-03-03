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
// Any code here borrowed from someone else is credited and marked.
// Where applicable the original license is included and applies.

var noiseSquirrel5 = function(seed, px, py, pz, pt) {
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

    var mangledBits = Math.floor(px);
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
    return mangledBits;
};

var perlinSimplex3 = function(x, y, z) {
    // Adapted from chapter 2 of Ken Perlin's 2001 SIGGRAPH
    // Course Notes.
    var A = [];
    var T = [0x15,0x38,0x32,0x2c,0x0d,0x13,0x07,0x2a];
    var bi = function(N, B) { return N>>B & 1; };
    var b = function(i, j, k, B) {
        return T[bi(i,B)<<2 | bi(j,B)<<1 | bi(k,B)];
    };
    var shuffle = function(i, j, k) {
        return b(i,j,k,0) + b(j,k,i,1) + b(k,i,j,2) + b(i,j,k,3) +
            b(j,k,i,4) + b(k,i,j,5) + b(i,j,k,6) + b(j,k,i,7) ;
    }

    var K = function(a) {
        var s = (A[0]+A[1]+A[2])/6.;
        var x = u - A[0] + s,
            y = v - A[1] + s,
            z = w - A[2] + s,
            t = .6 - x * x - y * y - z * z;
        var h = shuffle(i + A[0], j + A[1], k + A[2]);
        A[a]++;
        if (t < 0)
            return 0;
        var b5 = h>>5 & 1,
            b4 = h>>4 & 1,
            b3 = h>>3 & 1,
            b2 = h>>2 & 1,
            b = h & 3;
        var p = b==1 ? x : b==2 ? y : z,
            q = b==1 ? y : b==2 ? z : x,
            r = b==1 ? z : b==2 ? x : y;
        p = (b5==b3 ? -p : p);
        q = (b5==b4 ? -q : q);
        r = (b5!=(b4^b3) ? -r : r);
        t *= t;
        return 8 * t * t * (p + (b==0 ? q+r : b2==0 ? q : r));
    }

    if (isNaN(x))
        x = 0;
    if (isNaN(y))
        y = 0;
    if (isNaN(z))
        z = 0;
    var i, j, k;
    var u, v, w;
    var s = (x + y + z)/3;

    i = Math.floor(x + s);
    j = Math.floor(y + s);
    k = Math.floor(z + s);
    s = (i + j + k)/6.;
    u = x - i + s;
    v = y - j + s;
    w = z - k + s;

    A[0]=A[1]=A[2]=0;
    var hi = u>=w ? u>=v ? 0 : 1 : v>=w ? 1 : 2;
    var lo = u< w ? u< v ? 0 : 1 : v< w ? 1 : 2;
    
    return K(hi) + K(3-hi-lo) + K(lo) + K(0);
};

/**
 * Returns binomial coefficient without explicit factorials */
function pascalTriangle(a, b) {
  var result = 1;
  for (var ii = 0; ii < b; ++ii)
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
    var coefficients = [];
    for (var n = 0; n <= order; ++n)
        coefficients.push(pascalTriangle(-order - 1, n) *
            pascalTriangle(2 * order + 1, order - n));
    return function(t) {
        var factor = Array(order).fill(0).reduce((a) => a * t, 1);
        return (t < 0) ? 0 : (t > 1) ? 1 :
               coefficients.reduce(function(a, c) {
                   factor *= t; return a + c * factor; }, 0);
    };
}
var smoothStep   = generalSmoothStep(1); // 3t^2 - 2t^3
var smootherStep = generalSmoothStep(2); // 6t^5 - 15t^4 + 10t^3

/**
 * Precomputed properties are required for each noise dimension.
 * These are created the first time they are needed and cached
 * for future use. */
var cacheNoise = {
    skewFactors: {},
    unskewFactors: {},

    /**
     * Convert a point in ordinary space to a skewed space where
     * simplex vertices match the vertices of a hypercube.  In
     * this skewed space it's easier to identify which simplex
     * within the hypercube contains the point.
     *
     * @param point an array with one entry per noise dimension
     * @returns an array representing the point in skewed space */
    getSkewed: function(point) {
        var displace = point.reduce((a, c) => a + c, 0);
        var n = point.length;

        if (isNaN(this.skewFactors[n]))
            this.skewFactors[n] = ((Math.sqrt(n + 1) - 1) / n);
        displace *= this.skewFactors[n];
        return point.map(v => v + displace);
    },

    /**
     * Convert a skewed point back to the original space for use in
     * additional calculations.
     *
     * @param point an array in the skewed space
     * @returns an array representing the point in original space */
    getUnskewed: function(point) {
        var displace = point.reduce((a, c) => a + c, 0);
        var n = point.length;

        if (isNaN(this.unskewFactors[n]))
            this.unskewFactors[n] = ((1 - 1 / Math.sqrt(n + 1)) / n);
        displace *= this.unskewFactors[n];
        return point.map(v => v - displace);
    },

};

function createNoiseSimplex(config) {
    const seed = (config && config.seed) ? config.seed : 0;
    let debugCount = 12;

    // Compute pseudo-random gradient vectors.  These are what makes
    // the noise noisy.
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
            let gradient = [(Math.random() > 0.5) ? 1 : -1];
            vertex.slice(1).forEach(function(coord) {
                let direction = Math.random() * Math.PI;
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
    let noiseSimplex = function() {
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
        let simplex = []; // Hypercube vertices in simplex
        let index;
        let selection = Array(n).fill(0);
        simplex.push(selection.slice());
        for (ii = 0; ii < n; ++ii) {
            index = undefined;
            for (jj = 0; jj < n; ++jj) {
                if (selection[jj])
                    continue;
                if (isNaN(index) || (delta[jj] > delta[index]))
                    index = jj;
            }
            if (!isNaN(index))
                selection[index] = 1;
            simplex.push(selection.slice());
        }

        // ## Kernel Summation
        let result = 0;
        let surflet = function(delta, gradient) {
            let result = 1;

            // Compute delta dot gradient
            result *= delta.reduce(
                (a, c, ii) => a + (c * gradient[ii]), 0);

            // Separable quintic falloff
            //result = result * delta.reduce(
            //    (a, c) => a * (1 - smootherStep(Math.abs(c))), 1);

            // Radial quintic falloff
            result *= (1 - smootherStep(Math.sqrt(
                delta.reduce((a, c) => a + (c * c), 0)) / 0.6));

            return result;
        };

        result = simplex.reduce(function(acc, selection, ii) {
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

        return (result * 5 + 1) / 2;
    };

    return noiseSimplex;
};

/**
 * Creates a rectangular canvas image of a given noise function. */
function drawNoise(ctx, startX, startY, width, height,
                   freq, fn, stats) {
    const data = new Uint8ClampedArray(4 * width * height);
    var max = undefined, min = undefined;

    for (var yy = 0; yy < height; ++yy)
        for (var xx = 0; xx < width; ++xx) {
            var index = 4 * (yy * width + xx);
            var value = fn(xx * freq, yy * freq);
            if (isNaN(min) || (value < min))
                min = value;
            if (isNaN(max) || (value > max))
                max = value;
            value = Math.min(255, Math.max(0, Math.floor(
                255.99 * value)));

            data[index + 0] = value;
            data[index + 1] = value;
            data[index + 2] = value;
            data[index + 3] = 255; /* opaque */
        }

    if (stats && typeof(stats) === "function")
        stats({min: min, max: max});
    ctx.putImageData(new ImageData(data, width, height),
                     startX, startY);
    return ctx;
}

export default function(config) {
    var result = undefined;

    // Choose a noise algorithm
    var algorithm = (config && config.algorithm) ?
        config.algorithm : undefined;
    var seed = (config && config.seed) ? config.seed : 0;
    if (algorithm === "squirrel") {
        result = function(x, y) {
            var seed = 100;
            var value = noiseSquirrel5(seed, x, y);
            return (value / (2 * (1 << 30)));
        }
    } else if (algorithm === "perlin") {
        result = function(x, y) {
            var value = perlinSimplex3(x, y);
            return (1 + (value / 0.32549)) / 2;
        }
    } else result = createNoiseSimplex(config);

    if (config && config.canvas &&
        config.canvas instanceof HTMLCanvasElement) {
        const canvas = config.canvas;
        const ctx = config.canvas.getContext("2d");
        const freq = (config && config.freq) ? config.freq : 0.05;
        drawNoise(ctx, 0, 0, canvas.width, canvas.height,
                  freq, result, (stats) =>
                      console.log("DEBUG", stats.min, stats.max));
    }

    return result;
};
