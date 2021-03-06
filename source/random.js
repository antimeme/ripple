// random.js
// Copyright (C) 2011-2018 by Jeff Gold.
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
// Mersenne Twister implementation.  For algorithm details:
//     http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
(function (exports) {
    "use strict";
    var RRAND_N = 624;
    var RRAND_M = 397;
    var RRAND_MATRIX_A   = 0x9908B0DF;
    var RRAND_UPPER_MASK = 0x80000000;
    var RRAND_LOWER_MASK = 0x7FFFFFFF;
    var RRAND_MAXIMUM    = 0xFFFFFFFF;
    var RRAND_TAOCP2P106 = 1812433253;
    var RRAND_TEMPER_B   = 0x9D2C5680;
    var RRAND_TEMPER_C   = 0xEFC60000;

    var int32 = function() {
        // This is the heart of the Mersenne Twister implementation
        var current;
        var mag01 = [ 0, RRAND_MATRIX_A ];
        if (this.mti >= RRAND_N) {
            var ii;
            for (ii = 0; ii < RRAND_N - RRAND_M; ii++) {
                current = ((this.mt[ii] & RRAND_UPPER_MASK) |
                           (this.mt[ii + 1] & RRAND_LOWER_MASK)) >>> 0;
                this.mt[ii] = (this.mt[ii + RRAND_M] ^
                               (current >>> 1) ^
                               mag01[current & 1]) >>> 0;
            }
            for (; ii < RRAND_N - 1; ii++) {
                current = ((this.mt[ii] & RRAND_UPPER_MASK) |
                           (this.mt[ii + 1] & RRAND_LOWER_MASK)) >>> 0;
                this.mt[ii] = (this.mt[ii + RRAND_M - RRAND_N] ^
                               (current >>> 1) ^
                               mag01[current & 1]) >>> 0;
            }
            current = ((this.mt[RRAND_N - 1] & RRAND_UPPER_MASK) |
                       (this.mt[0] & RRAND_LOWER_MASK)) >>> 0;
            this.mt[RRAND_N - 1] = (this.mt[RRAND_M - 1] ^
                                    (current >>> 1) ^
                                    mag01[current & 1]) >>> 0;
            this.mti = 0;
        }
        current = this.mt[this.mti];
        ++this.mti;
        current = (current ^ (current >>> 11)) >>> 0;
        current = (current ^ (current << 7)  & RRAND_TEMPER_B) >>> 0;
        current = (current ^ (current << 15) & RRAND_TEMPER_C) >>> 0;
        current = (current ^ (current >>> 18)) >>> 0;
        return current;
    };

    // Returns a number between zero inclusive and one exclusive.
    // This works like Math.random() but since a seed can be provided
    // this can generate predictable sequences.
    var random = function()
    { return this.int32() * (1.0 / 4294967295.0); };

    exports.random = function(seed) {
        var self = {int32: int32, random: random};
        var mti = 0;

        // Default is a moderately unpredictable seed.  This is NOT
        // good enough for cryptographic purposes.
        if (typeof seed === 'undefined')
            seed = new Date().getTime();

        self.mt = new Array();
        self.mt[mti] = seed & RRAND_MAXIMUM;
        for (mti = 1; mti < RRAND_N; mti++) {
            self.mt[mti] = Math.imul(
                RRAND_TAOCP2P106,
                (self.mt[mti - 1] ^
                 (self.mt[mti - 1] >>> 30))) + mti;
            self.mt[mti] = ((self.mt[mti] & RRAND_MAXIMUM) >>> 0);
        }
        self.mti = mti;
        return self;
    };

})(typeof exports === 'undefined'? this['random'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var result = 0, check_seed = 5489;
    var ii, r = exports.random(check_seed);

    var check_state = [
        0x00001571, 0x4d98ee96, 0xaf25f095, 0xafd9ba96, 0x6fcbd068,
        0x2cd06a72, 0x384f0100, 0x85b46507, 0x295e8801, 0x0d1b316e
    ];
    for (ii = 0; ii < check_state.length; ++ii) {
        console.log("r.mt[" + ii + "] = " + r.mt[ii].toString(16) +
                    (r.mt[ii] === check_state[ii] ? "" : " (expected " +
                     check_state[i].toString(16) + ")"));
        if (r.mt[ii] != check_state[ii])
            result = 1;
    }

    var check_uint32 = [
        0xd091bb5c, 0x22ae9ef6, 0xe7e1faee, 0xd5c31f79, 0x2082352c,
        0xf807b7df, 0xe9d30005, 0x3895afe1, 0xa1e24bba, 0x4ee4092b
    ];
    for (ii = 0; ii < check_uint32.length; ++ii) {
        var value = r.int32();
        console.log("random: " + value.toString(16) +
                    (value === check_uint32[ii] ?
                     " (decimal " + value.toString() + ")" :
                     " (expected " +
                     check_uint32[ii].toString(16) + ")"));
        if (value != check_uint32[ii])
            result = 1;
    }

    r = exports.random(check_seed);
    for (ii = 0; ii < 10; ++ii)
        console.log('double: ' + r.random().toFixed(16));
    process.exit(result);
}
