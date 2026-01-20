// ripple.mjs
// Copyright (C) 2014-2025 by Jeff Gold.
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
// A collection of useful routines that don't fit anywhere else.

/**
 * Given an object, choose one of its keys,  Without a second argument
 * all keys are equally likely to be chosen.  If provided the second
 * argument must be a function that accepts an object and a key and
 * returns a non-negative number to use as the weight for that key.
 * Keys are chosen with probability equal to their share of the total
 * weight.  So given keys "a" (weight 3) and "b" (weight 1) this
 * routine will choose "a" three quarters of the time. */
export function chooseKey(object, getWeight = (obj, key) => 1) {
    let choice = Object.keys(object).reduce((acc, key) =>
        acc + getWeight(object, key), 0) * Math.random();
    return Object.keys(object).reduce((acc, key) => {
        choice -= getWeight(object, key);
        return (typeof acc !== "undefined") ? acc :
               (choice <= 0) ? key : acc;
    }, undefined);
}

const epsilon = 1 / (1 << 20); // approximately one in a million
export function zeroish(value) { return Math.abs(value) < epsilon; }

const pairFunctions = {
    cantor: {
        // Represents a reversable transformation from a pair of
        // positive integers to a single positive integer.
        //   http://www.math.drexel.edu/~tolya/cantorpairing.pdf
        pair: function(x, y) {
            return (x + y) * (x + y + 1) / 2 + y;
        },
        unpair: function(z) {
            const w = Math.floor((Math.sqrt(8 * z + 1) - 1) / 2);
            const t = (w * w + w) / 2;
            const y = z - t;
            return {x: w - y, y: y};
        }
    },
    szudzik: {
        // Represents a reversable transformation from a pair of
        // positive integers to a single positive integer.
        //   http://szudzik.com/ElegantPairing.pdf
        pair: function(x, y) {
            return (x >= y) ? x * x + x + y :  y * y + x; },
        unpair: function(z) {
            const rz = Math.floor(Math.sqrt(z));
            return ((z - rz * rz < rz) ?
                    {x: z - rz * rz, y: rz } :
                    {x: rz, y: z - rz * rz - rz});
        }
    }
}

export function pair(x, y, method) {
    const m = (method && method in pairFunctions) ?
              pairFunctions[method] : pairFunctions.szudzik;
    const nx = (x >= 0) ? (2 * x) : -(2 * x + 1);
    const ny = (y >= 0) ? (2 * y) : -(2 * y + 1);
    return m.pair(nx, ny);
}

export function unpair(z, pair, method) {
    const m = (method && method in pairFunctions) ?
              pairFunctions[method] : pairFunctions.szudzik;
    const result = m.unpair(z);
    return {x: ((result.x % 2) ? -(result.x + 1) : result.x) / 2,
            y: ((result.y % 2) ? -(result.y + 1) : result.y) / 2};
}

/**
 * Randomize the order of an array in place, using an optional
 * random number generator.
 * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle */
export function shuffle(elements, rand) {
    if (!rand || !rand.random)
        rand = Math;
    for (let ii = elements.length; ii; --ii) { // swap at random
        const jj = Math.floor(rand.random() * ii);
        const swap = elements[ii - 1];
        elements[ii - 1] = elements[jj];
        elements[jj] = swap;
    }
    return elements;
}

function metricPrefix(amount) {
    return (amount >= 1e30)  ? {name: "quetta", symbol: "Q",  e:  30} :
           (amount >= 1e27)  ? {name:  "ronna", symbol: "R",  e:  27} :
           (amount >= 1e24)  ? {name:  "yotta", symbol: "Y",  e:  24} :
           (amount >= 1e21)  ? {name:  "zetta", symbol: "Z",  e:  21} :
           (amount >= 1e18)  ? {name:    "exa", symbol: "E",  e:  18} :
           (amount >= 1e15)  ? {name:   "peta", symbol: "P",  e:  15} :
           (amount >= 1e12)  ? {name:   "tera", symbol: "T",  e:  12} :
           (amount >= 1e9)   ? {name:   "giga", symbol: "G",  e:   9} :
           (amount >= 1e6)   ? {name:   "mega", symbol: "M",  e:   6} :
           (amount >= 1e3)   ? {name:   "kilo", symbol: "k",  e:   3} :
           (amount >= 1e2)   ? {name:  "hecto", symbol: "h",  e:   2} :
           (amount >= 1e1)   ? {name:   "deka", symbol: "da", e:   1} :
           (amount >= 1e0)   ? {name:       "", symbol:  "",  e:   0} :
           (amount >= 1e-1)  ? {name:   "deci", symbol: "d",  e:  -1} :
           (amount >= 1e-2)  ? {name:  "centi", symbol: "c",  e:  -2} :
           (amount >= 1e-3)  ? {name:  "milli", symbol: "m",  e:  -3} :
           (amount >= 1e-6)  ? {
               name: "micro", symbol: "\u00b5", e: -6} :
           (amount >= 1e-9)  ? {name:   "nano", symbol: "n",  e:  -9} :
           (amount >= 1e-12) ? {name:   "pico", symbol: "p",  e: -12} :
           (amount >= 1e-15) ? {name:  "femto", symbol: "f",  e: -15} :
           (amount >= 1e-18) ? {name:   "atto", symbol: "a",  e: -18} :
           (amount >= 1e-21) ? {name:  "zepto", symbol: "z",  e: -21} :
           (amount >= 1e-24) ? {name:  "yocto", symbol: "y",  e: -24} :
           (amount >= 1e-27) ? {name:  "ronto", symbol: "r",  e: -27} :
           {name: "quecto", symbol: "q", e: -30};
}

/**
 * Create a string represention of a number using a unit with a
 * metric prefix. */
export function displayMetric(value, unit, digits) {
    const details = metricPrefix(value);
    const exp = (details.e % 3) ? 0 : details.e;
    const suffix = (details.e % 3) ? unit : (details.symbol + unit);
    let number = (value / (10 ** exp)).toString();

    if (!isNaN(digits)) {
        const parts = number.split(".");
        if ((parts.length === 2) && (parts[1].length > digits))
            number = (value / (10 ** exp)).toFixed(digits);
    }
    return number + " " + suffix;
}

/**
 * Calls fn for each permutation of the elements array, providing a
 * single permutation and a count of how many previous calls have been
 * made.  The permutation provided is not valid after the function
 * call, so copy it with Array.prototype.slice() if necessary.  A
 * truthy return from the function will terminate the process.
 *
 * Providing no function will cause this function to return an array
 * containing all possible permutations.  Note that there are
 * n-factorial possible permutations for n elements so this will be
 * impractical for inputs with more than about ten elements.
 *
 * This routine implements Heap's Algorithm:
 *   https://en.wikipedia.org/wiki/Heap%27s_algorithm */
export function eachPermutation(elements, fn, context) {
    if (!fn)
        return eachPermutation(elements, permutation =>
            { this.push(permutation.slice()); }, []);
    const current  = elements.slice();
    let count = 0;
    if (fn.call(context, current, count++))
        return context;

    const counters = new Array(elements.length).fill(0);
    let ii = 1;
    while (ii < elements.length) {
        if (counters[ii] < ii) {
            const index = (ii % 2) ? counters[ii] : 0;
            const swap = current[index];
            current[index] = current[ii];
            current[ii] = swap;

            if (fn.call(context, current, count++))
                break;
            counters[ii] += 1;
            ii = 1;
        } else counters[ii++] = 0;
    }
    return context;
}

/**
 * Calls a specified function after the page has completely loaded and
 * an array of URLs are fetched using an XMLHttpRequest (AJAX). */
export function preloadURLs(urls, fn, errfn) {
    const loaded = {};

    if (typeof(urls) === "string")
        urls = [urls];
    else if (!Array.isArray(urls))
        urls = [];

    let count = 0;
    function next(url, content) {
        ++count;
        if (url)
            loaded[url] = content;
        if (count === urls.length + 1)
            fn(loaded);
    }

    urls.forEach((url) => {
        const request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.addEventListener("load", event => {
            if (request.status === 200) {
                next(url, JSON.parse(request.responseText));
            } else if (typeof(errfn) === "function") {
                errfn(event, url, request);
            } else console.error("preload failed (" +
                                 request.status + "):", url);
        });
        request.addEventListener("error", event => {
            if (typeof(errfn) === "function")
                errfn(event, url, request);
            else console.error("preload failed (" +
                               request.status + "):", url);
        });
        request.send();
    });
    document.addEventListener("DOMContentLoaded", () => { next() });
}

if ((typeof process !== "undefined") &&
    process.release?.name === "node") {
  //const { describe, it } = await import('node:test');
  //const assert = await import('node:assert');
}

export default {
    zeroish, pair, unpair, displayMetric,
    chooseKey, shuffle, eachPermutation,
    preloadURLs
};
