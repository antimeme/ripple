// noise.js
// Copyright (C) 2022 by Jeff Gold.
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
(function(noise) {
    'use strict';

    noise.SquirrelNoise5 = function(seed, px, py, pz, pt) {
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
    
    noise.perlinSimplex3 = function(x, y, z) {
        // Adapted from chapter 2 of Ken Perlin's 2001 SIGGRAPH
        // Course Notes.  This is used as a referene to compare
        // against the less inscrutible version above.
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

    noise.simplex = function() {
        // An implementation of Ken Perlin's Simplex Noise.
        //   https://en.wikipedia.org/wiki/Simplex_noise
        // Call with coordinates of point in order.  For example,
        // call noise.simplex(x, y) for two dimensional noise.
        var config, ii, jj, kk, start = 0;
        var point = []; // Position for which to calculate noise

        // All arguments are expected to be numeric coordinates
        if ((typeof(arguments[0]) == "object") && arguments[0]) {
            config = arguments[0];
            start = 1;
        }
        if (!config || !config.point)
            for (ii = start; ii < arguments.length; ++ii)
                if (!isNaN(arguments[ii])) {
                    point.push(arguments[ii]);
                } else throw new Error(
                    "noise.simplex: argument " + ii + " (\"" +
                    arguments[ii] + "\") is not a number");
        var n = point.length;
        var radius = (config && config.radius) ? config.radius : 0.6;

        // Precomputed properties are required for each dimension.
        // These are created the first time they are needed and
        // cached for future use.
        if (!this.__cache)
            this.__cache = {
                skewFactors: {}, unskewFactors: {},
                G: {}, P: {},

                getSkewed: function(point) {
                    // Convert a point in ordinary space to a
                    // skewed space where simplex vertices match
                    // the vertices of a hypercube.  In this
                    // skewed space it's easier to identify which
                    // hypercube and eventually which simplex any
                    // given point belongs to.
                    var ii, factor = 0, n = point.length;

                    for (ii = 0; ii < n; ++ii)
                        factor += point[ii];
                    if (isNaN(this.skewFactors[n]))
                        this.skewFactors[n] = (
                            (Math.sqrt(n + 1) - 1) / n);
                    factor *= this.skewFactors[n];

                    var result = [];
                    for (ii = 0; ii < n; ++ii)
                        result.push(point[ii] + factor);
                    return result;
                },

                getUnskewed: function(point) {
                    // Convert a skewed point back to the original
                    // space for use in additional calculations.
                    var ii, factor = 0, n = point.length;

                    for (ii = 0; ii < n; ++ii)
                        factor += point[ii];
                    if (isNaN(this.unskewFactors[n]))
                        this.unskewFactors[n] = (
                            (1 - 1 / Math.sqrt(n + 1)) / n);
                    factor *= this.unskewFactors[n];

                    var result = [];
                    for (ii = 0; ii < n; ++ii)
                        result.push(point[ii] - factor);
                    return result;
                },

                getGradient: function(vertex) {
                    // Select a gradient vector which points to a
                    // hypercube edge -- and therefore does not
                    // point directly at any simplex vertex.
                    var ii, n = vertex.length;
                    var index = 0;

                    if (!this.P[n]) { // Populate cache if necessary
                        var P = [], limit = n * (1 << (n - 1));
                        var ii, jj, swap;

                        for (ii = 0; ii < limit; ++ii)
                            P.push(ii);
                        for (ii = P.length; ii > 0; --ii) {
                            // TODO: pseudo-random this
                            jj = Math.floor(Math.random() * ii);
                            swap = P[ii - 1];
                            P[ii - 1] = P[jj];
                            P[jj] = swap;
                        }
                        this.P[n] = P;
                    }

                    // Compute a pseudo-random index between
                    // zero and (n * 2^(n - 1)) - 1.
                    var modulo = this.P[n].length;
                    for (ii = 0; ii < vertex.length; ++ii)
                        index = this.P[n][(index + Math.floor(
                            vertex[ii])) % modulo];
                    if (index < 0)
                        index += modulo;

                    // Use index to select a hypercube edge
                    var result = [];
                    var usedbits = 0;
                    for (ii = 0; ii < n; ++ii)
                        result.push((ii !== Math.floor(
                            index / (1 << (n - 1)))) ?
                                    (((index % (1 << (n - 1))) &
                                      (1 << usedbits++)) ? -1 : 1) : 0);
                    return result;
                }
            };

        // ## Coordinate Skewing
        // Converts points in a regular simplex grid to a skewed grid
        // where the verticex lie on the corners of a hypercube.  This
        // makes it easier to determine which of the n-factorial
        // simplexes contains the point.
        var skewed = this.__cache.getSkewed(point);
        var position = []; // Position within skewed simplex
        for (ii = 0; ii < n; ++ii)
            position.push(skewed[ii] - Math.floor(skewed[ii]));

        // ## Simplical Subdivision
        // Select the simplex in a hypercube which contains the input
        // point.  This should run in n^2 time (where n is the number
        // of dimensions the point is in).
        var simplex = []; // Hypercube vertices in simplex
        var vertex = [];
        var index;
        for (ii = 0; ii < n; ++ii)
            vertex.push(0);
        simplex.push(vertex.slice());
        for (ii = 0; ii < n; ++ii) {
            index = undefined;
            for (jj = 0; jj < n; ++jj) {
                if (vertex[jj])
                    continue;
                if (isNaN(index) || (position[jj] > position[index]))
                    index = jj;
            }
            if (!isNaN(index))
                vertex[index] = 1;
            simplex.push(vertex.slice());
        }

        // Convert the abstract simplex into unskewed coordinates
        // so that we can interpolate based on displacement in
        // the steps that follow
        for (ii = 0; ii < simplex.length; ++ii) {
            for (jj = 0; jj < simplex[ii].length; ++jj)
                simplex[ii][jj] += Math.floor(skewed[jj]);
            simplex[ii] = this.__cache.getUnskewed(simplex[ii]);
        }
        
        // ## Gradient Selection
        var gradients = []; // Pseudo random gradients per vertex
        for (ii = 0; ii < simplex.length; ++ii)
            gradients.push(this.__cache.getGradient(simplex[ii]));
        //console.error("DEBUG", gradients);

        // ## Kernel Summation
        var result = 0;
        var displacement, dsquared, contribution, gdot;

        for (ii = 0; ii < simplex.length; ++ii) {
            dsquared = 0;
            displacement = [];
            for (jj = 0; jj < n; ++jj) {
                displacement[jj] = point[jj] - simplex[ii][jj];
                dsquared += displacement[jj] * displacement[jj];
            }

            contribution = radius - dsquared;
            gdot = 0;
            for (jj = 0; jj < displacement.length; ++jj)
                gdot += gradients[ii][jj] * displacement[jj];
            contribution *= contribution;
            contribution *= contribution;
            result += 12 * (1 << n) * contribution * gdot;
        }
        return result;
    };

})(typeof exports === 'undefined' ? window['noise'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var noise = exports;
    var createGrayNoisePPM = function(fn, width, height) {
        var ii, jj, min, max, now, last = Date.now();
        console.log("P3");
        console.log(width, " ", height);
        console.log("255");
        for (var jj = height; jj >= 0; --jj) {
            now = Date.now();
            if ((jj === height) || (now - last > 200 )) {
                console.error("Scanlines remaining:", jj);
                last = now;
            }
            for (var ii = 0; ii < width; ++ii) {
                var value = fn(ii, jj)
                if (isNaN(min) || (value < min))
                    min = value;
                if (isNaN(max) || (value > max))
                    max = value;
                value = Math.min(1, Math.max(0, value));
                console.log(Math.floor(255.999 * value),
                            Math.floor(255.999 * value),
                            Math.floor(255.999 * value));
            }
        }
        console.error("Done: min=" + min.toFixed(3) +
                      " max=" + max.toFixed(3) +
                      " diff=" + (max - min).toFixed(3));
    };

    var allowOptions = true;
    var actions = [];
    var freq = 0.01;
    var width = 640;
    var height = 480;
    var noisefn = function(x, y) {
        return (noise.simplex(
            x * freq, y * freq) * 2 / 2.946 + 0.915) / 2;
    };
    var noisefns = {
        perlin: function(x, y) {
            return (noise.perlinSimplex3(
                x * freq, y * freq, 1) * (2/0.58) + 1) / 2;
        }
    };
    process.argv.slice(2).forEach(function(argument) {
        if (allowOptions && (argument === "--")) {
            allowOptions = false;
        } else if (allowOptions && argument.startsWith("--")) {
            if (argument.startsWith("--freq=")) {
                freq = parseFloat(argument.slice("--freq=".length), 10);
                if (isNaN(freq) || (freq < 0))
                    throw new Error("Invalid width: " +
                                    argument.slice("--width=".length));
            } else if (argument.startsWith("--width=")) {
                width = parseInt(argument.slice("--width=".length), 10);
                if (isNaN(width) || (width < 0))
                    throw new Error("Invalid width: " +
                                    argument.slice("--width=".length));
            } else if (argument.startsWith("--height=")) {
                height = parseInt(
                    argument.slice("--height=".length), 10);
                if (isNaN(height) || (height < 0))
                    throw new Error("Invalid height: " +
                                    argument.slice("--height=".length));
            } else if (argument === "--perlin")
                noisefn = noisefns["perlin"];
            else if (argument.startsWith("--noise=")) {
                var fn_name = argument.slice("--noise=".length);
                if (fn_name in noisefns)
                    noisefn = noisefns[fn_name];
                else throw new Error(
                    "Unknown noise function: " + fn_name);
            } else throw new Error(
                "Unknown option: " + argument);
        } else actions.push(argument);
    });

    //createGrayNoisePPM(noisefn, width, height);
    for (var ii = 0; ii < 5; ++ii)
        console.error("ii=" + ii, noise.SquirrelNoise5(0, ii));
}
