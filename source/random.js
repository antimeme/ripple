// random.js
// Copyright (C) 2011-2014 by Jeff Gold.
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

    // Performs a 32-bit multiplication modulo 2^32, approximating the
    // unsigned type in C.  Javascript integers are stored as floating
    // point value, which means they have 53 bits of precision.
    function multiply_uint32(a, b) {
        var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
        var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
        var high = ((ah * bl) + (al * bh)) & 0xffff;
        return (((high << 16) + (al * bl)) & 0xffffffff) >>> 0;
    }

    var int32 = function () {
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

    exports.random = function(seed) {
        var self = {int32: int32};
        var mti = 0;
        self.mt = new Array();
        self.mt[mti] = seed & RRAND_MAXIMUM;
        for (mti = 1; mti < RRAND_N; mti++) {
            self.mt[mti] = multiply_uint32(
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
    var result = 0;
    var r = exports.random(5489);
    var i;

    var check_state = [
        0x00001571, 0x4d98ee96, 0xaf25f095, 0xafd9ba96, 0x6fcbd068,
        0x2cd06a72, 0x384f0100, 0x85b46507, 0x295e8801, 0x0d1b316e
    ];
    for (i = 0; i < check_state.length; i++) {
        console.log("r.mt[" + i + "] = " + r.mt[i].toString(16) +
                    (r.mt[i] === check_state[i] ?
                     "" : " (expected " +
                     check_state[i].toString(16) + ")"));
        if (r.mt[i] != check_state[i])
            result = 1;
    }

    var check_uint32 = [
        0xd091bb5c, 0x22ae9ef6, 0xe7e1faee, 0xd5c31f79, 0x2082352c,
        0xf807b7df, 0xe9d30005, 0x3895afe1, 0xa1e24bba, 0x4ee4092b
    ];
    for (i = 0; i < check_uint32.length; i++) {
        var value = r.int32();
        console.log("random: " + value.toString(16) +
                    (value === check_uint32[i] ?
                     "" : " (expected " +
                     check_uint32[i].toString(16) + ")"));
        if (value != check_uint32[i])
            result = 1;
    }
    process.exit(result);
}
