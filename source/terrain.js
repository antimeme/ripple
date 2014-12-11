// terrain.js
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
// Methods of generating pseudo-random terrain data.
(function(exports) {
    "use strict";

    /**
     * An attempt at a sane display rounding for floating point
     * Inspiration: http://stackoverflow.com/a/661757 */
    var toFixed = function(value, precision) {
        // 
        var power = Math.pow(10, precision || 0);
        return (Math.round(value * power) / power).
            toFixed(precision || 0);
    };

    /**
     * Display a terrain on the console for debugging */
    var print = function() {
        var x, y;
        for (y = 0; y < this.max; ++y) {
            var line = "";
            for (x = 0; x < this.max; ++x)
                line += toFixed(this.get(x, y), 2) + " ";
            console.log(line);
        }
    };

    /**
     * Retreives a co-ordinate value.  This permits a single
     * dimension array to be used as a square grid. */
    var get = function(x, y) {
        if (x < 0 || x > this.max || y < 0 || y > this.max) return -1;
        return this.map[x + this.size * y];
    };

    /**
     * Sets a co-ordinate value.  This permits a single
     * dimension array to be used as a square grid. */
    var set = function(x, y, value) {
        this.map[x + this.size * y] = value;
    };

    var average = function(values) {
        var valid = values.filter(function(v) { return v !== -1; });
        return valid.reduce(
            function(sum, v) { return sum + v; }, 0) / valid.length;
    };

    var square = function(x, y, size, offset) {
        var ave = average([
            this.get(x - size, y - size), // upper left
            this.get(x + size, y - size), // upper right
            this.get(x + size, y + size), // lower right
            this.get(x - size, y + size)  // lower left
        ]);
        this.set(x, y, ave + offset);
    };

    var diamond = function(x, y, size, offset) {
        var ave = average([
            this.get(x, y - size), // top
            this.get(x + size, y), // right
            this.get(x, y + size), // bottom
            this.get(x - size, y)  // left
        ]);
        this.set(x, y, ave + offset);
    };

    var divide = function(size) {
        if (size < 2)
            return;
        var x, y, half = size / 2;
        var scale = this.roughness * size;

        for (y = half; y < this.max; y += size) {
            for (x = half; x < this.max; x += size) {
                square.call(this, x, y, half, this.r.random() *
                            scale * 2 - scale);
            }
        }
        for (y = 0; y <= this.max; y += half) {
            for (x = (y + half) % size; x <= this.max; x += size) {
                diamond.call(this, x, y, half, this.r.random() *
                             scale * 2 - scale);
            }
        }
        divide.call(this, size / 2);
    };

    exports.create = function(settings) {
        var self = {
            get: get, set: set, print: print,
            roughness: (settings && settings.roughness) ?
                settings.roughness : 0.75,
            r: (settings && settings.random) ?
                settings.random : Math
        };
        var detail = (settings && settings.detail) ?
            settings.detail : 3;
        self.size = Math.pow(2, detail) + 1;
        self.max = self.size - 1;
        self.map = new Float32Array(self.size * self.size);

        self.set(0, 0, self.max);
        self.set(self.max, 0, self.max / 2);
        self.set(self.max, self.max, 0);
        self.set(0, self.max, self.max / 2);

        divide.call(self, self.max);
        return self;
    };

})(typeof exports === 'undefined'? this['terrain'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var random = require('./random.js');
    var opt = require('node-getopt').create([
        ['s', 'seed=NUMBER', 'starting value for pseudo-random numbers']
    ]).bindHelp().parseSystem();
    //console.info(opt);

    var terrain = exports.create({
        detail: 3, roughness: 0.75,
        random: opt.options.seed &&
            random.random(parseInt(opt.options.seed, 10)) });
    terrain.print();
}
