// pqueue.js
// Copyright (C) 2017 by Jeff Gold.
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
// A simple priority queue implementation

(function() {
    'use strict';
    var pqueue = function(entries, cmp) {
        if (!(this instanceof pqueue))
            return new pqueue(entries, cmp);

        this.entries = entries.slice() || [];
        this.cmp = cmp || pqueue.min;

        for (var ii = (this.entries.length >> 1) - 1; ii >= 0; --ii)
            siftDown(this.entries, this.cmp, ii);
    };

    var siftDown = function(entries, cmp, position) {
        var half = entries.length >> 1;
        var item = entries[position];

        while (position < half) {
            var left = (position << 1) + 1;
            var right = left + 1;
            var best = entries[left];

            if (right < entries.length &&
                cmp(entries[right], best) < 0) {
                left = right;
                best = entries[right];
            }
            if (cmp(best, item) >= 0)
                break;

            entries[position] = best;
            position = left;
        }

        entries[position] = item;
    };

    var siftUp = function(entries, cmp, position) {
        var item = entries[position];

        while (position > 0) {
            var parent = (position - 1) >> 1;
            var current = entries[parent];
            if (cmp(item, current) >= 0)
                break;
            entries[position] = current;
            position = parent;
        }

        entries[position] = item;
    };

    pqueue.min = function(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    };
    pqueue.max = function(a, b) {
        return a > b ? -1 : a < b ? 1 : 0;
    };

    pqueue.prototype.push = function(item) {
        this.entries.push(item);
        siftUp(this.entries, this.cmp, this.entries.length - 1);
    };

    pqueue.prototype.pop = function () {
        var result = this.entries[0];
        if (this.entries.length > 0) {
            this.entries[0] = this.entries[this.entries.length - 1];
            this.entries.pop();
            if (this.entries.length > 0)
                siftDown(this.entries, this.cmp, 0);
        }
        return result;
    };

    pqueue.prototype.peek = function () {
        return this.entries[0];
    };

    pqueue.prototype.size = function () {
        return this.entries.length;
    };

    // This library exports only one function so the name of the
    // library itself is used.
    if (typeof exports === 'undefined') {
        window['pqueue'] = pqueue;
    } else { exports = pqueue; }
})();

if ((typeof require !== 'undefined') && (require.main === module)) {
    var ripple = require('./ripple.js');
    var pqueue = exports;
    var entries = ripple.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    var pq = pqueue(entries, pqueue.min);

    console.log(entries);
    while (pq.size())
        console.log(pq.pop());
}
