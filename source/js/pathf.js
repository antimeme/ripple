// pathf.js
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
// Path finding routines
(function(exports) {
    "use strict";

    var Heap = function(compare) {
        // This is a priority queue implementation.  The smallest
        // element (defined by the optional compare function) can be
        // fetched in O(log(n)) time.  An element can be added in
        // O(log(n)) time.
        this.compare = compare || function(a, b)
        { return a == b ? 0 : a > b ? 1 : -1; };

        this.contents = new Array();
        for (var i = 1; i < arguments.length; i++)
            contents.push(arguments[i]);

        var fixup = function(heap, i) {
            var parent = Math.ceil(i / 2) - 1;
            if (parent >= 0 && heap.compare(heap.contents[parent],
                                            heap.contents[i]) > 0) {
	        var temp = heap.contents[parent];
	        heap.contents[parent] = heap.contents[i];
	        heap.contents[i] = temp;
	        fixup(heap, parent);
            }
        };

        var fixdown = function(heap, i) {
            var left = 2 * i + 1, right = 2 * i + 2, smallest;

            if (left < heap.contents.length &&
                heap.compare(heap.contents[left],
                             heap.contents[i]) < 0) {
	        smallest = left;
            } else smallest = i;
            
            if (right < heap.contents.length &&
                heap.compare(heap.contents[right],
                             heap.contents[smallest]) < 0)
	        smallest = right;

            if (i != smallest) {
	        var temp = heap.contents[smallest];
	        heap.contents[smallest] = heap.contents[i];
	        heap.contents[i] = temp;
	        fixdown(heap, smallest);
            }
        };

        this.heapify = function() {
            var i = Math.floor(this.contents.length / 2) - 1;
            for (; i >= 0; i--)
	        fixdown(this, i);
        };

        if (this.contents.length > 0)
	    this.heapify();

        this.size = function() { return this.contents.length; };
        this.peek = function() { return this.contents[0]; };

        this.pop = function() { // Remove and return least
            var value;
            if (this.contents.length > 1) {
	        value = this.contents[0];
	        this.contents[0] = this.contents.pop();
	        fixdown(this, 0);
            } else value = this.contents.pop();
            return value;
        };

        this.push = function(item) { // Insert an element
            this.contents.push(item);
            fixup(this, this.contents.length - 1);
            return item;
        };
        return this;
    };

    exports.astarsearch = function(start, goals, neighbors, heuristic,
                                   costfn, limit, stringify) {
        // An implementation of the A* path finding algorithm.  See
        //     http://en.wikaipedia.org/wiki/A*_search_algorithm
        //
        // @param start search begins from this node
        // @param goals list of goals at which the path can terminate
        // @param neighbors(node) returns a list of nodes which can
        //        be reached from the argument node
        // @param heuristic(node, cost, goal) returns an admissable
        //        estimate of the cost to reach given node, the cost
        //        to reach that node and a goal node.  Leaving this
        //        parameter undefined reduces this search to
        //        Dijkstra's algorithm.
        // @param costfn(node, prev) returns the cost of traveling
        //        from prev to node (default always returns one so all
        //        steps are equivalent)
        // @param limit ignore paths that cost more than this value
        //        (when undefined a path will be found if one exists)
        // @param stringify returns a string which uniquely identifies
        //        a node (defaults to JSON.stringify)
        if (!stringify)
            stringify = function(node) { return JSON.stringify(node); };
        if (!costfn) costfn = function(node, prev) { return 1; };
        if (!heuristic) // Degrade to Dijkstra's algorithm if necessary
            heuristic = function(node, cost, goal) { return cost; };
        var index;

        // Construct a goal set
        if (!goals || !goals.length)
            return null; // No path without at least one goal
        var goalset = {};
        for (index in goals)
            goalset[stringify(goals[index])] = goals[index];

        function mknode(value, prev) {
            var cost = prev ? prev.cost + costfn(prev.value, value) : 0;
            var g, h, hcost = null;
            for (g in goalset) {
                h = heuristic(value, cost, goalset[g]);
                if (!hcost || h < hcost)
                    hcost = h;
            }
            return {value: value, prev: prev, repr: stringify(value),
                    cost: cost, hcost: hcost };
        }

        var reachable = {}, explored = {};
        var openheap = new Heap(function(a, b) {
            return a.hcost == b.hcost ? 0 : a.hcost > b.hcost ? 1 : -1;
        });
        var start_node = openheap.push(mknode(start));
        reachable[start_node.repr] = start_node;

        while (openheap.size() > 0) {
            // Choose a node to explore
            var current = openheap.pop();

            // Build a path a goal has been reached
            if (current.repr in goalset) {
                var result = [];
                while (current.prev) {
                    result.unshift(current.value);
                    current = current.prev;
                }
                return result;
            }

            // Mark this node as explored
            delete reachable[current.repr];
            explored[current.repr] = current.cost;

            // Consider nodes reachable from here
            var neighborhood = neighbors(current.value);
            for (index in neighborhood) {
                var neighbor = mknode(neighborhood[index], current);
                if (limit && neighbor.cost > limit)
                    continue; // too expensive to consider
                if (neighbor.repr in explored &&
                    explored[neighbor.repr] <= neighbor.cost)
                    continue; // already found a cheaper path
                if ((neighbor.repr in reachable) && 
                    reachable[neighbor.repr].cost <= neighbor.cost)
                    continue; // about to consider a cheaper path
                reachable[neighbor.repr] = openheap.push(neighbor);
            }
        }

        // Ran out of nodes to consider without finding a path
        return null;
    };

})(typeof exports === 'undefined'? this['pathf'] = {}: exports);
