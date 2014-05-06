(function(exports) {

    var Heap = function(contents, compare) {
        // This is a priority queue implementation.  The smallest
        // element (defined by the optional compare function) can be
        // fetched in O(log(n)) time.  An element can be added in
        // O(log(n)) time.
        this.compare = compare ||  function(a, b) {
            return a == b ? 0 : a > b ? 1 : -1;
        };
        this.contents = contents || new Array();

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

        if (this.contents)
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
    }

    exports.astarsearch = function(start, goals, neighbors, heuristic,
                                   costfn, limit, stringify) {
        // An implementation of the A* path finding algorithm.  See
        //     http://en.wikaipedia.org/wiki/A*_search_algorithm
        //
        // @param start search begins from this node
        // @param goals list of goals at which the path can terminate
        // @param neighbors accepts a node and returns a list of others
        //                  which can be reached from it
        // @param heuristic must return an admissable estimate of the
        //                  cost given a node, the cost to reach that
        //                  node and a goal node.  Leaving this
        //                  parameter undefined reduces this search to
        //                  Dijkstra's algorithm.
        // @param costfn given a two adjacent nodes returns the cost
        //               to travel from the first to the second.
        //               Leaving this parameter undefined results in a
        //               cost of one for all transitions, which may be
        //               reasonable.
        // @param limit maximum cost for an acceptable path.  Leaving
        //              this parameter undefined means a path will be
        //              found if one exists.
        // @param stringify convert a node to a string which must
        //                  uniquely identify nodes -- this is
        //                  important when nodes might have more than
        //                  one JSON representation
        if (!stringify)
            stringify = function(node) { return JSON.stringify(node); };
        if (!costfn) costfn = function(node, prev) { return 1; };
        if (!heuristic) // Degrade to Dijkstra's algorithm if necessary
            heuristic = function(node, cost, goal) { return cost; };

        if (!goals || !goals.length)
            return null; // No path without at least one goal
        var goalset = {};
        for (var i in goals)
            goalset[stringify(goals[i])] = goals[i];

        function mknode(value, prev) {
            var node_cost = (prev) ? prev.cost + costfn(
                prev.value, value) : 0;
            return {value: value, prev: prev, repr: stringify(value),
                    cost: node_cost, hcost: Math.min.apply(
                        null, jQuery.map(goals, function(g) {
                            return heuristic(
                                value, node_cost, g); })) };
        }

        var openset = {}, closedset = {};
        var openheap = new Heap(null, function(a, b) {
            return a.hcost == b.hcost ? 0 : a.hcost > b.hcost ? 1 : -1;
        });
        var start_node = openheap.push(mknode(start));
        openset[start_node.repr] = start_node;

        while (openheap.size()) {
            var current = openheap.pop();
            delete openset[current.repr];

            if (current.repr in goalset) { // a path has been found
                var result = [];
                var poo = "";
                for (key in goalset)
                    poo += key + ", ";
                while (current.prev) {
                    result.unshift(current.value);
                    current = current.prev;
                }
                return result;
            }

            closedset[current.repr] = current.cost;
            var neighborhood = neighbors(current.value);
            for (var i in neighborhood) {
                var neighbor = mknode(neighborhood[i], current);
                if (limit && neighbor.cost > limit)
                    continue;
                if (neighbor.repr in closedset &&
                    closedset[neighbor.repr] <= neighbor.cost)
                    continue;
                if ((neighbor.repr in openset) && 
                    openset[neighbor.repr].cost <= neighbor.cost)
                    continue;
                openset[neighbor.repr] = openheap.push(neighbor);
            }
        }
        return null;
    }

})(typeof exports === 'undefined'? this['pathf'] = {}: exports);
