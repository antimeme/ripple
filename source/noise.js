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

    // Randomize the order of an array in place, using an optional
    // random number generator
    var shuffle = function(elements, rand) {
        var ii, jj, swap;

        if (!rand || !rand.random)
            rand = Math;
        for (ii = elements.length; ii; --ii) { // swap at random
            jj = Math.floor(rand.random() * ii);
            swap = elements[ii - 1];
            elements[ii - 1] = elements[jj];
            elements[jj] = swap;
        }
        return elements;
    }

    noise.simplex = function() {
        // An implementation of Ken Perlin's Simplex Noise.
        //   https://mrl.cs.nyu.edu/~perlin/paper445.pdf
        // Call with coordinates of point in order.  For example,
        // call noiseSimplex(x, y) for two dimensional noise.
        var result = 0;
        var config, ii, jj, kk, start = 0;
        var finalFactor;
        var point = []; // Position for which to calculate noise
        var skews    = []; // Point skewed for simplex determination
        var center   = []; // Center of unskewed simplex
        var vertices = []; // Hypercube vertices in simplex

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
                    "noiseSimplex: argument " + ii + " (\"" +
                    arguments[ii] + "\") is not a number");
        var n = point.length;
        var radius = (config && config.radius) ? config.radius : 0.5;

        // Compute the skew factor for each dimension only once and
        // cache the result for future calls.
        if (!this.__cache)
            this.__cache = {
                skew: {}, unskew: {},
                G: {}, P: {},
                getGradient: function(n, vertex, skews) {
                    var modulo = this.P[n].length;
                    var index = 0, ii;
                    for (ii = 0; ii < vertex.length; ++ii) {
                        index = (index + Math.floor(skews[ii]) +
                                 vertex[ii]) % modulo;
                        if (index < 0)
                            index += modulo;
                        index = this.P[n][index];
                    }
                    return this.G[n][index % this.G[n].length];
                }
            };
        if (isNaN(this.__cache.skew[n]))
            this.__cache.skew[n] = ((Math.sqrt(n + 1) - 1) / n);
        if (isNaN(this.__cache.unskew[point.lengh]))
            this.__cache.unskew[n] = (
                (1 - 1 / (Math.sqrt(n + 1) + 1)) / n);

        // Create a vector pointing to each edge of a hypercube, since
        // these are the directions that produce the least distortion
        // in noise.  A hypercube has n * 2^(n-1) edges, so it's
        // important that we're caching the results.
        if (!this.__cache.G[n]) {
            var enumerateEdges = function(n) {
                var result = [];
                var entry, ii, jj, kk, overflow;

                for (ii = 0; ii < n; ++ii) {
                    entry = [];
                    for (jj = 0; jj < n; ++jj)
                        entry.push((ii === jj) ? 0 : 1);

                    var overflow = false;
                    while (!overflow) {
                        result.push(entry.slice());

                        overflow = true;
                        for (jj = 0; overflow && (jj < n); ++jj) {
                            if (!entry[jj])
                                continue;
                            if (entry[jj] > 0) {
                                entry[jj] = -1;
                                overflow = false;
                            } else entry[jj] = 1;
                        }
                    }
                }
                return result;

            };
            this.__cache.G[n] = enumerateEdges(n);
        }

        if (!this.__cache.P[n]) {
            this.__cache.P[n] = [];
            for (ii = 0; ii < 5 * this.__cache.G
                [n].length; ++ii) {
                this.__cache.P[n].push(ii);
            }
            shuffle(this.__cache.P[n]);
            // TODO: pseudo-random this using config
        }

        // ## Coordinate Skewing
        // Converts points in a regular simplex grid to a skewed grid
        // where the verticex lie on the corners of a hypercube.  This
        // makes it easier to determine which of the n-factorial
        // simplexes contains the point.
        var skewFactor = 0;
        var internals  = []; // Position within skewed simplex
        for (ii = 0; ii < n; ++ii)
            skewFactor += point[ii];
        skewFactor *= this.__cache.skew[n];
        for (ii = 0; ii < n; ++ii) {
            skews[ii] = point[ii] + skewFactor;
            internals[ii] = skews[ii] - Math.floor(skews[ii]);
        }

        // ## Simplical Subdivision
        // Select the simplex in a hypercube which contains the input
        // point.  This should run in n^2 time (where n is the number
        // of dimensions the point is in).
        var vertex = [];
        var index;
        for (ii = 0; ii < n; ++ii)
            vertex.push(0);
        vertices.push(vertex.slice());
        for (jj = 0; jj < n; ++jj) {
            index = undefined;
            for (ii = 0; ii < n; ++ii) {
                if (vertex[ii])
                    continue;
                if (isNaN(index) || (internals[ii] > internals[index]))
                    index = ii;
            }
            if (!isNaN(index))
                vertex[index] = 1;
            vertices.push(vertex.slice());
        }

        // An easing function which has zero derivative and second
        // derivative at both t=0 and t=1: 6t^5 - 15t^4 + 10t
        var fade = function(t) {
            return ((6 * t - 15) * t + 10) * t * t * t;
        };

        var lerp = function(a, b, t) {
            return a + (b - a) * t;
        };

        // ## Gradient Selection
        var gradient = []; // Pseudo random gradient
        var current;
        for (ii = 0; ii < n; ++ii)
            gradient.push(0);
        for (jj = 0; jj < vertices.length; ++jj) {
            current = this.__cache.getGradient(
                n, vertices[jj], skews);
            for (ii = 0; ii < n; ++ii) {
                gradient[ii] += fade(Math.abs(internals[ii])) * current[ii];
            }
            // TODO fix this -- use lerp!
        }

        // ## Kernel Summation
        var displacement; // Difference between point and center
        var dsquared = 0;
        var unskewFactor = 0;
        for (ii = 0; ii < n; ++ii)
            unskewFactor += skews[ii];
        unskewFactor *= this.__cache.unskew[n];
        for (ii = 0; ii < n; ++ii) {
            center.push(skews[ii] * unskewFactor);
            displacement = point[ii] - center[ii];
            dsquared += displacement * displacement;
            result += displacement * gradient[ii];
        }
        //finalFactor = Math.max(0, radius * radius - dsquared);
        //finalFactor *= finalFactor;
        //finalFactor *= finalFactor;
        //result *= finalFactor;
        return result;
    };

})(typeof exports === 'undefined' ? window['noise'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var noise = exports;
    var ii, jj, row;

    for (ii = 0; ii < 5; ++ii) {
        row = [];
        for (jj = 0; jj < 5; ++jj)
            row.push(noise.simplex(ii, jj).toFixed(5));
        console.log(row.join(" "));
    }
            
    console.log("Noise:", noise.simplex(2, 2, 1.5));
}
