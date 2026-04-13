// pathf.js
// Copyright (C) 2014-2026 by Jeff Gold.
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
 * Priority queue implementation based on an internal array.  An
 * optional compare function determines the smallest element (min
 * heap), which can be fetched in O(log(n)) time.  An element can also
 * be added in O(log(n)) time.  Note that if the comparision function
 * returns positive when the first argument is larger this will be a
 * min heap.  On the other hand if it returns positive when the second
 * argument is larger it will be a max heap. */
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
}

/**
 * Create a path using the A* (A-star) algorithm.  This is a best-first
 * search guided by a heuristic that must never overestimate the cost
 * of reaching a goal from a given node.  This routine doesn't care what
 * a node actually is, so long as the required function do what they're
 * expected to do.
 *
 * Seven fields are looked for in the configuration object, of which
 * four are required (start, goal/goals, getNodeIndex, eachNeighbor).
 * the rest are optional but can improve results.
 *
 * start: node from which to begin search
 * goal: node the path should arrive at
 * goals: array of acceptable goal nodes (provide instead of goal)
 * limit: if provided, nodes that are more expensive to reach than this
 *     number are disregarded, which makes a path finding failure
 *     more likely but also less computationally expensive
 * getNodeIndex(node): provides a unique identifier for each node which
 *     can be used as an object index in JavaScript.
 * eachNeighbor(node, fn, context): calls a supplied function for each
 *     neighbor of a given node with the following arguments:
 *       neighbor: neighboring node
 *       cost: cost to reach this neighbor or undefined for 1
 *     Caller is responsible for excluding any nodes that should not be
 *     considered, for example because they are obstructed.
 * heuristic(node, goal): returns an estimated cost to travel from a
 *     given node to a destination.  This must never overestimate the
 *     cost.  In spacial graphs it is usually best to use the distance
 *     between the nodes.  If the heuristic underestimates costs the A*
 *     algorithm may examine more nodes than necessary but should still
 *     arrive at an optimal path.  If missing the heuristic is
 *     assumed to be zero in all caces, which causes A* to devolve into
 *     Dijkstra's algorithm. */
export function createPath(config) {
    if (!config)
        throw new Error("missing required configuration");
    else if (!config.start)
        throw new Error("missing configuration start node");
    else if (typeof config.getNodeIndex !== 'function')
        throw new Error("missing configuration getNodeIndex function");
    else if (typeof config.eachNeighbor !== 'function')
        throw new Error("missing configuration eachNeighbor function");
    else if (!Array.isArray(config.goals) && !config.goal)
        throw new Error("missing configuration goal node");

    const goals = Array.isArray(config?.goals) ?
                  config.goals : [config?.goal];

    function getBest(node, goals) {
        let result = undefined;
        goals.forEach((goal) => {
            const current = (typeof config.heuristic === "function") ?
                            config.heuristic(node, goal) : 0;
            if (isNaN(result) || (current < result))
                result = current;
        });
        return result;
    }

    let found = undefined;
    const frontier = new Heap((a, b) => Heap.cmp(a.est, b.est));
    const visited = {};

    /* Add a meta-node representing the start node to the frontier */
    frontier.push({ node: config.start, previous: null, cost: 0,
                    est: getBest(config.start, goals) });
    visited[config.getNodeIndex(config.start)] = frontier.peek();

    while (!found && (frontier.size() > 0)) {
        const current = frontier.pop();

        if (goals.some((goal) => config.getNodeIndex(current.node) ==
            config.getNodeIndex(goal))) {
            found = current;
        } else config.eachNeighbor(current.node, (neighbor, cost) => {
            const totalCost = current.cost + (isNaN(cost) ? 1 : cost);
            if (!isNaN(config.limit) && (totalCost > config.limit))
                return;

            const index = config.getNodeIndex(neighbor);
            if (!(index in visited) ||
                (visited[index].cost > totalCost)) {
                visited[index] = {
                    node: neighbor, previous: current, cost: totalCost,
                    est: totalCost + getBest(neighbor, goals) };
                frontier.push(visited[index]);
            }
        });
    }

    if (found) { /* convert meta-node to an array of nodes */
        const result = [];
        while (found.previous) {
            result.unshift(found.node);
            found = found.previous;
        }
        found = result;
    }
    return found;
}

/**
 * Considers all nodes reachable from a provided start node.  When
 * called with a function and an optional calling context, that
 * function is invoked for each reachable node.  Otherwise all
 * reachable nodes are collected into an array, which may be expensive.
 *
 * Five fields are looked for in the configuration object, of which
 * three are required (start, getNodeIndex, eachNeighbor).  The rest
 * are optional but can improve results.
 *
 * start: node from which to begin
 * limit: if provided, nodes that are more expensive to reach than this
 *     number are disregarded, which makes this operation less
 *     computationally expensive
 * getNodeIndex(node): provides a unique identifier for each node which
 *     can be used as an object index in JavaScript.
 * eachNeighbor(node, fn, context): calls a supplied function for each
 *     neighbor of a given node.  Caller is responsible for excluding
 *     any nodes that should not be considered, for example because they
 *     are obstructed. */
export function reachable(config, fn, context) {
    if (!config)
        throw new Error("missing required configuration");
    else if (!config.start)
        throw new Error("missing configuration start node");
    else if (typeof config.getNodeIndex !== 'function')
        throw new Error("missing configuration getNodeIndex function");
    else if (typeof config.eachNeighbor !== 'function')
        throw new Error("missing configuration eachNeighbor function");

    if (!fn)
        return reachable(config, node => this.push(node), []);

    const frontier = new Heap((a, b) => Heap.cmp(a.cost, b.cost));
    const visited = {};

    frontier.push({ node: start, previous: null, cost: 0 });
    visited[config.getNodeIndex(start)] = frontier.peek();

    while (frontier.size() > 0) {
        const current = frontier.pop();
        eachNeighbor(current.node, (neighbor, cost) => {
            const totalCost = current.cost + cost;
            if (isNaN(limit) || (totalCost <= limit)) {
                const index = config.getNodeIndex(neighbor);
                if (!(index in visited) ||
                    (visited[index].cost > totalCost)) {
                    visited[index] = {
                        node: neighbor, previous: current,
                        cost: totalCost };
                    frontier.push(visited[index]);
                }
            }
        });
    }

    Object.entries(visited).forEach(([index, visit]) =>
        fn.call(context, visit.node, visit.cost,
                visit.previous, index));
    return context;
}

export default { Heap, createPath, reachable };
