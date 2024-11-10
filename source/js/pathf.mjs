// pathf.js
// Copyright (C) 2014-2023 by Jeff Gold.
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

/**
 * Priority queue implementation based on an internal array.
 * An optional compare function determines the smallest
 * element, which can be fetched in O(log(n)) time.
 * An element can also be added in O(log(n)) time.
 * Note that by default this is a min heap.  To create a
 * max heap, invert the comparison function (make it return
 * positive when the second argument is larger). */
export class Heap {
    constructor(compare, elements) {
        [compare, elements].forEach((thing) => {
            if (typeof(thing) === "function")
                this.#compare = thing;
            else if (Array.isArray(thing))
                this.#contents = thing.slice(); });
        if (!this.#compare)
            this.#compare = Heap.cmp;

        if (!this.#contents)
            this.#contents = [];
        for (let ii = 0; ii < arguments.length; ii++)
            if ((typeof(arguments[ii]) !== "function") &&
                !Array.isArray(arguments[ii]))
                this.#contents.push(arguments[ii]);
        if (this.#contents.length > 0)
	    this.#heapify();
    }

    #contents = undefined;
    #compare = undefined;

    static cmp(a, b) { return a == b ? 0 : a > b ? 1 : -1; }

    // Correct heap property from specified index upward
    #fixup(index) {
        const parent = Math.ceil(index / 2) - 1;
        if (parent >= 0 &&
            this.#compare(this.#contents[parent],
                          this.#contents[index]) > 0) {
	    const temp = this.#contents[parent];
	    this.#contents[parent] = this.#contents[index];
	    this.#contents[index] = temp;
	    return this.#fixup(parent);
        }
    }

    // Correct heap property from specified index downward
    #fixdown(index) {
        const left  = 2 * index + 1;
        const right = 2 * index + 2;
        let smallest = index;

        if (left < this.#contents.length &&
            this.#compare(this.#contents[left],
                          this.#contents[smallest]) < 0)
	    smallest = left;

        if (right < this.#contents.length &&
            this.#compare(this.#contents[right],
                          this.#contents[smallest]) < 0)
	    smallest = right;

        if (index != smallest) {
	    const temp = this.#contents[smallest];
	    this.#contents[smallest] = this.#contents[index];
	    this.#contents[index] = temp;
	    return this.#fixdown(smallest);
        }
    };

    // Rearrange contents to have the heap property
    #heapify() {
        for (let index = Math.floor(this.#contents.length / 2) - 1;
             index >= 0; index--)
	    this.#fixdown(index);
    }

    size() { return this.#contents.length; }

    peek() { return this.#contents[0]; }

    pop() { // Remove and return least
        let value = undefined;
        if (this.#contents.length > 1) {
	    value = this.#contents[0];
	    this.#contents[0] = this.#contents.pop();
	    this.#fixdown(0);
        } else if (this.#contents.length > 0)
            value = this.#contents.pop();
        return value;
    }

    push(item) { // Insert an element
        this.#contents.push(item);
        this.#fixup(this.#contents.length - 1); 
        return item;
    }

    static test() {
        const heap = new Heap([7, 5, 4, 6]);
        const result = [];
        [2, 3, 9, 8, 1].forEach(value => { heap.push(value); });
        while (heap.size() > 0)
            console.log(result.push(heap.pop()));
        return result;
    }
}

/**
 * Abstract representation of a graph for the purpose of path finding.
 * A pathatble must override eachNeighbor and getNodeIndex.  It should
 * also override getHeuristic and possibly also getCost and isSameNode
 * to account for characteristics of the graph.  Note that leaving
 * pathHeuristic unmodified results in using Dijkstra's algorithm
 * instead of A* for path finding. */
export class Pathable {
    // Overriding these is required
    pathNeighbor(node, fn, context)
    { throw new Error("Must override Pathable.pathNeighbor"); }
    pathNodeIndex(node)
    { throw new Error("Must override Pathable.pathNodeIndex"); }

    // Consider overriding these
    pathSameNode(a, b) { return a === b; }
    pathCost(node, previous) { return 1; }
    pathHeuristic(node, goal) { return 0; } // Dijkstra's Algorithm

    // Returns the heuristic of the cheapest goal
    #getBest(node, goals) {
        let result = undefined;
        goals.forEach((goal) => {
            const current = this.pathHeuristic(node, goal);
            if (isNaN(result) || (current < result))
                result = current;
        }, this);
        return result;
    }

    // Builds a path back to (but not including) the start node
    static #unwind(found) {
        const result = [];
        while (found.previous) {
            result.unshift(found.node);
            found = found.previous;
        }
        return result;
    }

    /**
     * Builds a path from a start node to the closest of one or more
     * goal nodes using the A* path finding algorithm. See:
     *     http://en.wikipedia.org/wiki/A*_search_algorithm */
    createPath(start, goal) {
        let found = undefined;
        const goals = Array.isArray(goal) ? goal : [goal];
        const frontier = new Heap((a, b) => Heap.cmp(a.total, b.total));
        const visited = {};
        const bundle = {node: start, previous: null,
                        cost: 0, total: this.#getBest(start, goals)};

        visited[this.pathNodeIndex(start)] = bundle;
        frontier.push(bundle);

        while (!found && (frontier.size() > 0)) {
            const current = frontier.pop();

            if (goals.some((goal) =>
                this.pathSameNode(current.node, goal))) {
                found = current;
            } else this.pathNeighbor(current.node, (neighbor) => {
                const cost = current.cost + this.pathCost(
                    neighbor, current.node);
                const index = this.pathNodeIndex(neighbor);
                if (!(index in visited) ||
                    (visited[index].cost > cost)) {
                    visited[index] = {
                        node: neighbor, previous: current,
                        cost: cost, total: cost + this.#getBest(
                            neighbor, goals) };
                    frontier.push(visited[index]);
                }
            });
        }
        return found ? Pathable.#unwind(found) : found;
    }
}

export default { Heap, Pathable };
