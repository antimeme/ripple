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

    noise.simplex = function() {
        // An implementation of Ken Perlin's Simplex Noise.
        //   https://mrl.cs.nyu.edu/~perlin/paper445.pdf
        // Call with coordinates of point in order.  For example,
        // call noiseSimplex(x, y) for two dimensional noise.
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
                    "noiseSimplex: argument " + ii + " (\"" +
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
                getGradient: function(n, vertex) {
                    var modulo = this.P[n].length;
                    var index = 0, ii;
                    for (ii = 0; ii < vertex.length; ++ii) {
                        index = (index + Math.floor(
                            vertex[ii])) % modulo;
                        if (index < 0)
                            index += modulo;
                        index = this.P[n][index];
                    }
                    return this.G[n][index % this.G[n].length];
                }
            };

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
            var swap;
            this.__cache.P[n] = [];
            for (ii = 0; ii < this.__cache.G[n].length; ++ii)
                this.__cache.P[n].push(ii);
            for (ii = this.__cache.P[n].length; ii; --ii) {
                jj = Math.floor(Math.random() * ii);
                swap = this.__cache.P[n][ii - 1];
                this.__cache.P[n][ii - 1] = this.__cache.P[n][jj];
                this.__cache.P[n][jj] = swap;
            }
            // TODO: pseudo-random this using config
        }

        // ## Coordinate Skewing
        // Converts points in a regular simplex grid to a skewed grid
        // where the verticex lie on the corners of a hypercube.  This
        // makes it easier to determine which of the n-factorial
        // simplexes contains the point.
        var skewed    = this.__cache.getSkewed(point);
        var internals = []; // Position within skewed simplex
        for (ii = 0; ii < n; ++ii)
            internals.push(skewed[ii] - Math.floor(skewed[ii]));

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
            gradients.push(this.__cache.getGradient(n, simplex[ii]));

        // ## Kernel Summation
        var result = 0;
        var displacement, dsquared, contribution, gdot;
        result = 0;
        for (ii = 0; ii < simplex.length; ++ii) {
            dsquared = 0;
            displacement = [];
            for (jj = 0; jj < n; ++jj) {
                displacement[jj] = point[jj] - simplex[ii][jj];
                dsquared += displacement[jj] * displacement[jj];
            }
            //console.log("DEBUG-simplex", simplex[ii]);
            //console.log("DEBUG-displace", displacement);
            //console.log("DEBUG-dsquared", dsquared);

            contribution = radius - dsquared;
            gdot = 0;
            for (jj = 0; jj < displacement.length; ++jj)
                gdot += gradients[ii][jj] * displacement[jj];
            contribution *= contribution;
            contribution *= contribution;
            result += 12 * (1 << n) * contribution * gdot;
        }
        //console.log("DEBUG-point", point, result);
        return result;
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
    }

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
            if ((jj === height) || (now - last > 125)) {
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
        console.error("Done:", min, max, (max - min));
    };

    var allowOptions = true;
    var actions = [];
    var freq = 0.01;
    var width = 400;
    var height = 225;
    var noisefn = function(x, y) {
        return noise.simplex(x, y, 1);
    };
    var noisefns = {
        perlin: function(x, y) {
            return (3.9 * noise.perlinSimplex3(
                x * freq, y * freq, 1) + 1.1) / 2;
        }
    };
    process.argv.slice(2).forEach(function(argument) {
        if (allowOptions && (argument === "--")) {
            allowOptions = false;
        } else if (allowOptions && argument.startsWith("--")) {
            if (argument.startsWith("--width=")) {
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

    createGrayNoisePPM(noisefn, width, height);

}
