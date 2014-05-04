// ripple.js
// Copyright (C) 2014 by Jeff Gold.
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

(function(exports) {

    // http://www.math.drexel.edu/~tolya/cantorpairing.pdf
    exports.cantor_pair = function(x, y) {
        return (x + y) * (x + y + 1) / 2 + y; };
    exports.cantor_unpair = function(z) {
        var w = Math.floor((Math.sqrt(8 * z + 1) - 1) / 2);
        var t = (w * w + w) / 2;
        var y = z - t;
        return {x: w - y, y: y};
    };

    // http://szudzik.com/ElegantPairing.pdf
    exports.szudzik_pair = function(x, y) {
        return (x >= y) ? x * x + x + y :  y * y + x; };
    exports.szudzik_unpair = function(z) {
        var rz = Math.floor(Math.sqrt(z));
        return ((z - rz * rz < rz) ?
                {x: z - rz * rz, y: rz } :
                {x: rz, y: z - rz * rz - rz});
    };

    exports.pair = function(x, y) {
        var nx = (x >= 0) ? 2 * x : -2 * x - 1;
        var ny = (y >= 0) ? 2 * y : -2 * y - 1;
        return exports.szudzik_pair(nx, ny);
    };
    exports.unpair = function(z) {
        var result = exports.szudzik_unpair(z);
        if (result.x % 2)
            result.x = -result.x + 1;
        if (result.y % 2)
            result.y = -result.y + 1;
        result.x /= 2;
        result.y /= 2;
        return result;
    };

    // Simplistic Lisp implementation
    var read = function(code) {
        states = {
            
        }
        for (var i = 0; i < code.length; ++i) {

        }
    };
    var eval = function(value, env) {
        return 'BOO';
    };

    exports.eval = eval;
})(typeof exports === 'undefined'? this['ripple'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var ripple = exports;
    var tests = [
        ['2'], ['+'], ['foo'], ['foo', {'foo': 7}],
        ['(+ 7 5)'], ['(* 2, (+ (sqrt 16) 4))'],
        ['(sqr 7)', {'sqr': function(x) { return x * x; }}],
    ];
    for (var index = 0; index < tests.length; ++index)
        console.log(JSON.stringify(tests[index]) + ' -> ' +
                    ripple.eval.apply(ripple.eval, tests[index]));

    var p = ripple.pair(2, 2);
    var d = ripple.unpair(p);
    console.log(p + ' -> ' + d.x + ', ' + d.y);

    for (var z = 0; z < 1000; ++z) {
        var p = ripple.szudzik_unpair(z);
        var zz = ripple.szudzik_pair(p.x, p.y);
        if (z != zz)
            console.log("FAIL: " + z + " != " + zz);
        else if (!(z && z % 100))
            console.log(p.x + ", " + p.y + " <=> " + z);
    }
};
