// grid.js
// Copyright (C) 2013-2019 by Jeff Gold.
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
// An abstraction that represents a variety of two dimensional grids.
//
// Supported grid types are listed in an array named grid.canonical.
// Each entry in this array is an object which can be used as the
// input ot grid.create to get this kind of grid.  The name property
// can be used to describe that entry.
//
// Here's an example:
//
//     var g = grid.create({type: "square"});
//     var points = g.points(grid.markCenter({row: 2, col: 1}));
//
// This creates a square grid and collects the coordinates of the
// vertices which make up the cell in row 2 column 1, perhaps for use
// in rendering for display.
//
// Creating a new grid usually means overriding these in BaseGrid:
//
//     * _update: calculate any sized based grid properties
//     * _markCenter: fill in x and y position given row and col
//     * _markCell:   fill in row and col given x and y position
//     * _eachNeighbor: call function for each adjacent cell
//     * _pairpoints: fill in a pair of points defining the
//                    boundary between two neighbors
//     * points: return points in grid cell polygon
//
// Overriding _update is not required if the grid has no size-
// dependant state.  The markCenter, position and neighbors functions
// in BaseGrid will automatically adjust for the grid offset, so
// there's no need to account for this in the _markCenter, _markCell
// and _eachNeighbor functions.  Because the input to the points function
// is expected to already have correct x and y coordinates there's no
// need to perform adjustments there either.
(function(grid) {
    "use strict";
    var _sqrt2 = Math.sqrt(2);
    var _sqrt3 = Math.sqrt(3);

    var epsilon = 0.000001;
    var zeroish = function(value) {
        return (value < epsilon) && (value > -epsilon);
    };

    // Return the sum of the square of each argument
    var sumSquares = function() {
        var result = 0;
        var index;
        for (index = 0; index < arguments.length; ++index)
            if (!isNaN(arguments[index]))
                result += arguments[index] * arguments[index];
        return result;
    };

    // Return the square root of the sum of the squares of each argument
    var sumSquaresRoot = function() {
        return Math.sqrt(sumSquares.apply(null, arguments));
    };

    // Given a pair of points for each of two lines, returns the point
    // at which the two lines intersect.  Euclidian space is assumed so
    // If the lines have the same slope they either don't intersect or
    // are the same line.
    var intersect2D = function(s, e, p, q) {
        var result;
        var denominator = ((e.y - s.y) * (p.x - q.x) -
                           (p.y - q.y) * (e.x - s.x));
        if (!zeroish(denominator)) {
            var x = (((s.x * (e.y - s.y) * (p.x - q.x)) -
                      (q.x * (p.y - q.y) * (e.x - s.x)) -
                      (s.y - q.y) * (e.x - s.x) * (p.x - q.x)) /
                denominator);
            return { x: x,
                     y: zeroish(e.x - s.x) ?
                        ((p.y - q.y) * (x - q.x) / (p.x - q.x)) + q.y :
                        ((e.y - s.y) * (x - s.x) / (e.x - s.x)) + s.y};
        }
        return result;
    };

    // Given two points that make up a line segment return true iff
    // a third point lies between them.
    var between2D = function(s, e, p) {
        var dotSegP = ((e.x - s.x) * (p.x - s.x) + (
            e.y - s.y) * (p.y - s.y));
        return ((dotSegP >= 0) &&
                (dotSegP <= sumSquares(e.x - s.x, e.y - s.y)));
    };

    // BaseGrid serves a base class for other grids.  Although it
    // thinks like a SquareGrid for the most part, it returns an empty
    // list of points for each cell.
    var BaseGrid = function(options) {
        if (!(this instanceof BaseGrid))
            return new BaseGrid(options);

        if (!options)
            options = {};
        this.type = options.type || 'square';
        this._offset = { left: 0, top: 0 };
        this._json = { type: this.type };
        this.size((options && options.size) ? options.size : 100);
        if (!isNaN(options.width) && !isNaN(options.height))
            this.center(options.width, options.height);
    };

    BaseGrid.prototype.toJSON = function() { return this._json; };
    BaseGrid.prototype._update = function() {};

    BaseGrid.prototype.size = function(value) {
        if (!isNaN(value) && (value > 0)) {
            this._json.size = this._size = value;
            this._update();
        }
        return this._size;
    };

    BaseGrid.prototype.offset = function(left, top) {
        // Return an object with the top and left offset coordinates
        // of this grid, optionally after setting these from parameters.
        if (!isNaN(left))
            this._offset.left = left;
        if (!isNaN(top))
            this._offset.top = top;
        return this._offset;
    };

    BaseGrid.prototype._applyOffset = function(node, invert) {
        if (!isNaN(node.x))
            node.x += (invert ? -1 : 1) * this._offset.left;
        if (!isNaN(node.y))
            node.y += (invert ? -1 : 1) * this._offset.top;
        return node;
    };

    BaseGrid.prototype.markCenter = function(node) {
        // Given a node with numeric row and column properties,
        // calculuate x and y coordinates of the center of the node.
        return this._applyOffset(this._markCenter(node));
    };
    BaseGrid.prototype.getCenter = function(node) {
        return this.markCenter({row: node.row, col: node.col});
    };

    BaseGrid.prototype._markCenter = function(node) {
        // Default implementation replaced by specific grids
        var halfsize = this._size / 2;
        node.x = node.col * this._size + halfsize;
        node.y = node.row * this._size + halfsize;
        return node;
    };

    BaseGrid.prototype.markCell = function(node) {
        // Given a node with numeric x and y properties, calculuate
        // row and column properties for the cell at those coordinates.
        var point = this._markCell(this._applyOffset(
            {x: node.x, y: node.y}, true));
        node.row = point.row;
        node.col = point.col;
        return node;
    };
    BaseGrid.prototype.getCell = function(node) {
        return this.markCell({x: node.x, y: node.y});
    };

    BaseGrid.prototype._markCell = function(node) {
        // Default implementation replaced by specific grids
        node.row = Math.floor(node.y / this._size);
        node.col = Math.floor(node.x / this._size);
        return node;
    };

    BaseGrid.prototype.adjacent = function(nodeA, nodeB) {
        return this.eachNeighbor(nodeA).some(function(neigh) {
            return ((neigh.row === nodeB.row) &&
                    (neigh.col === nodeB.col));
        });
    };

    BaseGrid.prototype.eachNeighbor = function(
        node, options, fn, context) {
        // Iterate over a node's neighbor nodes
        if (!fn)
            return this.eachNeighbor(
                node, options, function(neighbor) {
                    this.push(neighbor); }, []);

        if (options && options.points)
            node = this.markCenter({row: node.row, col: node.col});
        var index = 0;
        this._eachNeighbor(node, function(neighbor) {
            if (options) {
                if (options.mark || options.points)
                    this.markCenter(neighbor);
                if (options.points)
                    neighbor.points = this._pairpoints(node, neighbor);
            }
            if (isNaN(neighbor.cost))
                neighbor.cost = 1;
            fn.call(context, neighbor, index++);
        }, this);
        return context || this;
    };
    BaseGrid.prototype.neighbors = BaseGrid.prototype.eachNeighbor;

    BaseGrid.prototype._eachNeighbor = function(node, fn, self) {
        // Call a function for each neighbor of the grid cell specified
        fn.call(self, {row: node.row, col: node.col + 1});
        fn.call(self, {row: node.row, col: node.col - 1});
        fn.call(self, {row: node.row + 1, col: node.col});
        fn.call(self, {row: node.row - 1, col: node.col});
        return this;
    };

    BaseGrid.prototype._pairpoints = function(nodeA, nodeB) {
        var midpoint = {x: (nodeB.x - nodeA.x) / 2,
                        y: (nodeB.y - nodeA.y) / 2};
        var rotated = {x: (nodeA.y - nodeB.y) / 2,
                       y: (nodeB.x - nodeA.x) / 2};
        var factor = this._size / (2 * sumSquaresRoot(
            rotated.x, rotated.y));
        var scaled = {x: rotated.x * factor, y: rotated.y * factor};
        return [{x: nodeA.x + midpoint.x + scaled.x,
                 y: nodeA.y + midpoint.y + scaled.y},
                {x: nodeA.x + midpoint.x - scaled.x,
                 y: nodeA.y + midpoint.y - scaled.y}];
    };

    BaseGrid.prototype.pairpoints = function(nodeA, nodeB) {
        return this.adjacent(nodeA, nodeB) ?
               this._pairpoints(this.getCenter(nodeA),
                                this.getCenter(nodeB)) : [];
    };

    BaseGrid.prototype.points = function(node) {
        // Returns a list of points which define a single grid cell.
        return [];
    };

    BaseGrid.prototype.draw = function(ctx, node) {
        // Creates a path through the points of a grid cell.  Caller
        // is responsible for setting up drawing properties.
        var last, points = this.points(node);
        if (points.length > 0) {
            last = points[points.length - 1];
            ctx.moveTo(last.x, last.y);
            for (var index in points)
                ctx.lineTo(points[index].x,
                           points[index].y);
        } else if (points.length === 1) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.arc(points[0].x, points[0].y,
                    this.size() / 2, 0, 2 * Math.PI);
        }
    };

    BaseGrid.prototype.center = function(width, height) {
        // Adjusts the grid offset such that cell {row: 0, col: 0} is
        // in the center of a rectangular region.
        this.offset(0, 0);
        var reference = this.markCenter(this.markCell({x: 0, y: 0}));
        this.offset(width / 2 - reference.x, height / 2 - reference.y);
        return this;
    };

    BaseGrid.prototype.map = function(options, fn, context) {
        // Apply a function to a set of cells.  The options parameter
        // controls which cells are selected.  Passing an options
        // value like {start: {x: 40, y: 50}, end: {x: 240, y: 350}}
        // will call the function for all cells that could possibly
        // intersect that rectangle.  A simpler way to specify a
        // rectangle is to use {width: 360, height: 240} which starts
        // the rectangle at coordinate (0, 0).
        var start, end, radius, index = 0;
        var self = this;
        var visited = {}; // ensure one visit per node

        var visit = function(node) {
            var id = ripple.pair(node.row, node.col);
            if (!visited[id]) {
                fn.call(context, self.markCenter(
                    {row: node.row, col: node.col}), index++);
                visited[id] = true;
            }
        };

        if ((typeof(options.start) === 'object') &&
            !isNaN(options.width) && !isNaN(options.height)) {
            start = this.markCell(
                {x: options.start.x, y: options.start.y});
            end = this.markCell({x: start.x + options.width,
                                 y: start.y + options.height});
        } else if (!isNaN(options.width) && !isNaN(options.height)) {
            start = this.markCell({x: 0, y: 0});
            end = this.markCell({x: options.width, y: options.height});
        } else if ((typeof(options.start) === 'object') &&
                   (typeof(options.end) === 'object')) {
            start = this.markCell(
                {x: options.start.x, y: options.start.y});
            end = this.markCell(
                {x: options.end.x, y: options.end.y});
        } else if ((typeof(options.start) === 'object') &&
                   !isNaN(options.radius) && (options.radius > 0)) {
            start = this.markCell(
                {x: options.start.x, y: options.start.y});
            radius = options.radius;
        } else throw "Options are invalid";

        if (start && end) {
            // Follow the rectangle marked by start and end
            this.eachSegment({x: start.x, y: start.y},
                             {x: start.x, y: end.y}, visit);
            this.eachSegment({x: start.x, y: end.y},
                             {x: end.x, y: end.y}, visit);
            this.eachSegment({x: end.x, y: end.y},
                             {x: end.x, y: start.y}, visit);
            this.eachSegment({x: end.x, y: start.y},
                             {x: start.x, y: start.y}, visit);

            // Ensure that cells inside the rectangle are included
            for (var row = Math.min(start.row, end.row);
                row <= Math.max(start.row, end.row); ++row)
                for (var col = Math.min(start.col, end.col);
                    col <= Math.max(start.col, end.col); ++col)
                    visit({row: row, col: col});
        } else if (start && radius) {
            var current, id, queue = [this.markCenter({
                row: start.row, col: start.col})];

            while (queue.length > 0) {
                current = queue.pop();
                id = ripple.pair(current.row, current.col);
                console.log("DEBUG-map", id, Object.keys(visited));

                if (!visited[id] &&
                    (sumSquares(radius) >= sumSquares(
                        current.x - start.x, current.y - start.y))) {
                    visit(current);
                    this.eachNeighbor(current, {mark: true}, function(
                        neighbor) { queue.push(neighbor); });
                } else visited[id] = true;
            }
        }
        return this;
    };

    BaseGrid.prototype.eachSegment = function(start, end, fn, self) {
        // Given a start and end with coordinates, call a function for
        // each cell in the line segment line between them.
        // WARNING: this has a bug that only seems to manifest on
        // the right triangle grids.  Sometimes it works but other
        // times it stops part way through.
        if (!fn)
            return this.eachSegment(start, end, function(node) {
                this.push(node); }, []);

        var previous = null;
        var current = this.markCell({x: start.x, y: start.y});
        end = this.markCell({x: end.x, y: end.y});

        while ((current.row != end.row) || (current.col != end.col)) {
            var step = null;
            this.eachNeighbor(current, {points: true}, function(
                neighbor) {
                if (!neighbor.points || (neighbor.points.length < 2) ||
                    (previous &&
                     (previous.row == neighbor.row) &&
                     (previous.col == neighbor.col)))
                    return;
                var crossing = intersect2D(
                    start, end, neighbor.points[0], neighbor.points[1]);
                if (crossing && between2D(
                    neighbor.points[0], neighbor.points[1], crossing) &&
                    between2D(start, end, crossing)) {
                    step = neighbor;
                }
            });

            fn.call(self, current);
            if (step) {
                previous = current;
                current = step;
            } else break;
        }
        fn.call(self, end);
        return self || this;
    };

    BaseGrid.prototype.createMaze = function(config) {
        // Create a maze using the Growing Tree Algorithm
        // http://weblog.jamisbuck.org/2011/1/27/
        //        maze-generation-growing-tree-algorithm
        // Configuration settings
        //   config.random: random number generator
        //   config.choose: function that chooses from an array
        //   config.rings: number of concentric rings to include
        var self = this;
        var canonicalizeNode = function(node) {
            return node.row + '/' + node.col; };
        var canonicalizePair = function(nodeA, nodeB) {
            var a, b;

            if ((nodeA.row < nodeB.row) ||
                ((nodeA.row === nodeB.row) &&
                 (nodeA.col < nodeB.col))) {
                a = nodeA; b = nodeB;
            } else { a = nodeB; b = nodeA; }
            return canonicalizeNode(a) + ':' + canonicalizeNode(b);
        };
        var contain = {};
        var considering = {};
        var walls = {};
        var addWall = function(nodeA, nodeB) {
            walls[canonicalizePair(nodeA, nodeB)] =
                {points: self._pairpoints(nodeA, nodeB)};
        };

        // Maze variables
        var index, label, unvisited, visited = {};
        var random = (config && config.random) ? config.random : Math;
        var choose = (config && config.choose) ? config.choose :
                     function(elements) {
                         return Math.floor(random.random() *
                             elements.length); };
        var addMaze = function(node) {
            visited[canonicalizeNode(node)] = true;
            adding.push(node);
        };
        var inMaze = function(node) {
            return visited[canonicalizeNode(node)] || false; };
        var addExit = function(node) {
            node.exits = (node.exits ? node.exits : 0) + 1; };

        var adding = [], current, start;
        var result = {
            nodes: [], walls: [], portals: [],
            contains: function(node) {
                return contain[canonicalizeNode(node)] || null; }};

        start = this.markCenter({row: 0, col: 0});
        start.ring = (config && config.hasOwnProperty('rings')) ?
                     config.rings : 5;
        adding.push(start);

        while (adding.length > 0) {
            current = adding.pop();
            if (result.contains(current))
                continue;
            current.adjacent = [];
            current.exits = 0;

            this.eachNeighbor(current, {mark: true}, function(node) {
                    index = canonicalizeNode(node);
                    if (index in contain) {
                        current.adjacent.push(contain[index]);
                    } else {
                        if (index in considering) {
                            node = considering[index];
                        } else considering[index] = node;

                        current.adjacent.push(node);
                        addWall(current, node);
                        if (current.ring > 0) {
                            node.ring = Math.max(
                                node.ring || 0, current.ring - 1);
                            adding.push(node);
                        }
                    }
                }, this);

            contain[canonicalizeNode(current)] = current;
            result.nodes.push(current);
        }

        // Construct the maze by removing walls
        // (Reuse the adding array since it was emptied above)
        addMaze(result.nodes[Math.floor(
            random.random() * result.nodes.length)]);
        while (adding.length > 0) {
            index = choose(adding);
            current = adding[index];
            unvisited = [];

            current.adjacent.forEach(function(node) {
                if (result.contains(node) && !inMaze(node))
                    unvisited.push(node);
            });

            if (unvisited.length > 0) {
                ripple.shuffle(unvisited);
                label = canonicalizePair(current, unvisited[0]);
                result.portals.push(walls[label]);
                delete walls[label];
                addMaze(unvisited[0]);
                addExit(unvisited[0]);
                addExit(current);
            } else adding.splice(index, 1);
        }

        Object.keys(walls).forEach(function(key) {
            result.walls.push(walls[key]); });
        return result;
    };

    // SquareGrid represents a mapping between cartesian coordinates
    // and a continuous grid of squares.  The size parameter to the
    // constuctor represents the length of a square edge.
    var SquareGrid = function(options) {
        BaseGrid.call(this, options);
        this._json.diagonal = this.diagonal =
            (options && options.diagonal ? options.diagonal : false);
    };
    SquareGrid.prototype = Object.create(BaseGrid.prototype);

    SquareGrid.prototype._markCenter = function(node) {
        // Given a node with numeric row and column properties,
        // calculuate x and y coordinates of the center of the node.
        node.x = node.col * this._size;
        node.y = node.row * this._size;
        return node;
    };
    SquareGrid.prototype._markCell = function(node) {
        // Given a node with numeric x and y properties, calculuate
        // row and column properties for the cell at those coordinates.
        var halfsize = this._size / 2;
        node.row = Math.floor((node.y + halfsize) / this._size);
        node.col = Math.floor((node.x + halfsize) / this._size);
        return node;
    };
    SquareGrid.prototype._eachNeighbor = function(node, fn, self) {
        // Call a function for each neighbor of the grid cell specified
        fn.call(self, {row: node.row, col: node.col + 1});
        fn.call(self, {row: node.row, col: node.col - 1});
        fn.call(self, {row: node.row + 1, col: node.col});
        fn.call(self, {row: node.row - 1, col: node.col});
        if (this.diagonal) {
            fn.call(self, {row: node.row + 1,
                           col: node.col + 1, cost: _sqrt2});
            fn.call(self, {row: node.row + 1,
                           col: node.col - 1, cost: _sqrt2});
            fn.call(self, {row: node.row - 1,
                           col: node.col + 1, cost: _sqrt2});
            fn.call(self, {row: node.row - 1,
                           col: node.col - 1, cost: _sqrt2});
        }
        return this;
    };
    SquareGrid.prototype._pairpoints = function(nodeA, nodeB) {
        // Diagonal neighbors need special treatment
        if ((nodeA.row - nodeB.row) && (nodeA.col - nodeB.col))
            return [{x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                     y: nodeA.y + (nodeB.y - nodeA.y) / 2}];
        return BaseGrid.prototype._pairpoints.call(this, nodeA, nodeB);
    };
    SquareGrid.prototype.points = function(node) {
        var halfsize = this._size / 2;
        return [{x: node.x - halfsize, y: node.y - halfsize},
                {x: node.x + halfsize, y: node.y - halfsize},
                {x: node.x + halfsize, y: node.y + halfsize},
                {x: node.x - halfsize, y: node.y + halfsize}];
    };

    // TriangleGrid represents a mapping between cartesian coordinates
    // and a continuous grid of equalateral triangles.  The size
    // parameter to the constuctor is the length of a triangle edge.
    var TriangleGrid = function(options) {
        BaseGrid.call(this, options); };
    TriangleGrid.prototype = Object.create(BaseGrid.prototype);

    TriangleGrid.prototype._update = function() {
        var ssqrt3 = this._size * _sqrt3;
        this.rowh = ssqrt3 / 2;
        this.radius = ssqrt3 / 3;
        this.centerh = ssqrt3 / 6;
    };
    TriangleGrid.prototype._markCenter = function(node) {
        // Given a node with numeric row and column properties,
        // calculuate x and y coordinates of the center of the node.
        node.x = node.col * this._size / 2;
        node.y = (node.row * this.rowh) + ((
            (node.row + node.col) % 2) ? -this.centerh : 0);
        return node;
    };

    TriangleGrid.prototype._markCell = function(node) {
        // Given a node with numeric x and y properties, calculuate
        // row and column properties for the cell at those coordinates.
        var halfsize = this._size / 2;
        var row = Math.floor((node.y + this.radius) / this.rowh);
        var col = Math.floor(node.x / halfsize);
        var xfrac = node.x / halfsize;
        var yfrac = (node.y + this.radius) / this.rowh;
        if ((row + col) % 2) {
            if ((yfrac - Math.ceil(yfrac)) +
                      (xfrac - Math.floor(xfrac)) > 0)
                col += 1;
        } else if ((yfrac - Math.floor(yfrac)) -
                   (xfrac - Math.floor(xfrac)) < 0)
            col += 1;

        node.row = row;
        node.col = col;
        return node;
    };

    TriangleGrid.prototype._eachNeighbor = function(node, fn, self) {
        // Call a function for each neighbor of the grid cell specified
        fn.call(self, {row: node.row, col: node.col + 1});
        fn.call(self, {row: node.row, col: node.col - 1});
        fn.call(self, {row: node.row + (((node.row + node.col) % 2) ?
                                       -1 : 1 ), col: node.col});
        return this;
    };

    TriangleGrid.prototype.points = function(node) {
        // Given a node with the coordinates for the center of a hexagon,
        // return a set of coordinates for each of its vertices.
        var direction = ((node.row + node.col) % 2) ? 1 : -1;
        return [{x: node.x, y: node.y + this.radius * direction},
                {x: node.x + this._size / 2,
                 y: node.y + this.centerh * -direction},
                {x: node.x - this._size / 2,
                 y: node.y + this.centerh * -direction}];
    };

    // RTriangleGrid represents a mapping between cartesian
    // coordinates and a continuous grid of right isosoles triangles
    // (meaning one of the angles is ninety degrees and the others are
    // fourty-five degrees).  The size parameter to the constuctor
    // represents the length of a triangle edge.
    var RTriangleGrid = function(options) {
        BaseGrid.call(this, options);
        this._json.regular = this.regular =
            (options && options.regular);
    };
    RTriangleGrid.prototype = Object.create(BaseGrid.prototype);

    RTriangleGrid.prototype._markCenter = function(node) {
        // Given a node with numeric row and column properties,
        // calculuate x and y coordinates of the center of the node.
        var halfsize = this._size / 2;
        var fifth = this._size / 5;
        var x_sign = (node.col % 2) ? 1 : -1;
        var y_sign = x_sign * ((!this.regular && ((node.row < 0) ^
            (node.col < 0))) ? -1 : 1);
        node.x = Math.floor(node.col / 2) * this._size +
                 halfsize + fifth * x_sign;
        node.y = node.row * this._size + halfsize + fifth * y_sign;
        return node;
    };

    RTriangleGrid.prototype._markCell = function(node) {
        // Given a node with numeric x and y properties, calculuate
        // row and column properties for the cell at those coordinates.
        var halfsize = this._size / 2;
        var xband = node.x / this._size;
        var yband = node.y / this._size;
        var row = Math.floor(yband);
        var col = Math.floor(xband) * 2;
        if (this.regular || !((row < 0) ^ (col < 0))) {
            if (Math.abs(xband - Math.floor(xband)) +
                Math.abs(yband - Math.floor(yband)) > 1)
                col += 1;
        } else if (Math.abs(xband - Math.floor(xband)) -
                   Math.abs(yband - Math.floor(yband)) > 0)
            col += 1;

        node.row = row;
        node.col = col;
        return node;
    };

    RTriangleGrid.prototype._eachNeighbor = function(node, fn, self) {
        // Call a function for each neighbor of the grid cell specified
        var rmod = node.col % 2 ?  1 : -1;
        var cmod = node.col % 2 ? -1 :  1;
        if (!this.regular) {
            rmod *= ((node.row < 0) ^ (node.col < 0)) ? -1 : 1;
            cmod *= ((node.row < 0) ^ (node.row + rmod < 0)) ? 0 : 1;
        }
        fn.call(self, {row: node.row, col: node.col + 1});
        fn.call(self, {row: node.row, col: node.col - 1});
        fn.call(self, {row: node.row + rmod, col: node.col + cmod});
        return this;
    };

    RTriangleGrid.prototype._pairpoints = function(nodeA, nodeB) {
        if ((nodeA.row !== nodeB.row) ||
            (nodeA.col + (nodeA.col % 2 ? -1 : 1) !== nodeB.col)) {
            var sign = (this.regular || ((nodeA.row < 0) ===
                (nodeA.col < 0)));
            var points = this.points(nodeA);
            return [points[0], ((nodeA.row !== nodeB.row) ===
                (nodeA.col % 2 ? !sign : sign)) ?
                    points[1] : points[2]];
        }
        return BaseGrid.prototype._pairpoints.call(this, nodeA, nodeB);
    };

    RTriangleGrid.prototype.points = function(node) {
        // Given a node with the coordinates for the center of a square,
        // return a set of coordinates for each of its vertices.
        var halfsize = this._size / 2;
        var fifth = this._size / 5;
        var x_sign = (node.col % 2) ? 1 : -1;
        var y_sign = x_sign *
        ((!this.regular && ((node.row < 0) ^ (node.col < 0))) ?
        -1 : 1);
        var corner = Math.abs(node.col % 2) * this._size;
        var x = node.x - (halfsize + x_sign * fifth);
        var y = node.y - (halfsize + y_sign * fifth);
        return (y_sign == x_sign) ? [
            {x: x + corner, y: y + corner},
            {x: x + this._size, y: y},
            {x: x, y: y + this._size}] : [
                {x: x + this._size * Math.abs(node.col % 2),
                 y: y + this._size * Math.abs((node.col + 1) % 2)},
                {x: x, y: y}, {x: x + this._size, y: y + this._size}];
    };

    // HexGrid represents a mapping between cartesian coordinates and
    // a continuous grid of hexagons.  The size parameter to the
    // constuctor represents the length of a hexagon edge, which is
    // also the length from the center of a hexagon to any vertex.  A
    // hexagon grid can have two orientations, referred to here as
    // point up and edge up, depending on whether the top of a hexagon
    // is a point or an edge.  Pass either "edge" or "point" (the
    // default) as a property of options to control the result.
    var HexGrid = function(options) {
        BaseGrid.call(this, options);
        this._json.orient = (options && options.orient) ?
                            options.orient : "point";
        if (this._json.orient == "point") {
            this.alpha = "x";
            this.beta  = "y";
            this.row   = "row";
            this.col   = "col";
        } else { // "edge"
            this.alpha = "y";
            this.beta  = "x";
            this.row   = "col";
            this.col   = "row";
        }
    };
    HexGrid.prototype = Object.create(BaseGrid.prototype);

    HexGrid.prototype._update = function() {
        this.hexw = _sqrt3 * this._size;
    };

    HexGrid.prototype._markCenter = function(node) {
        // Given a node with numeric row and column properties,
        // calculuate x and y coordinates of the center of the node.
        node[this.alpha] = (node[this.col] * this.hexw +
                            this.hexw / 2 * Math.abs(
                                node[this.row] % 2));
        node[this.beta] = node[this.row] * this._size * 3 / 2;
        return node;
    };

    HexGrid.prototype._markCell = function(node) {
        // Given a node with numeric x and y properties, calculuate
        // row and column properties for the cell at those coordinates.
        var halfsize = this._size / 2;
        var alpha_band = node[this.alpha] * 2 / this.hexw;
        var beta_band  = node[this.beta] / halfsize;
        var row = Math.floor((beta_band + 1) / 3);
        var col = Math.floor((alpha_band + (row % 2 ? 0 : 1)) / 2);

        if ((Math.floor(beta_band) + 2) % 3 === 0) {
            var alpha_fraction = ((alpha_band % 1) + 1) % 1;
            var beta_fraction = ((beta_band % 1) + 1) % 1;
            if (Math.floor(alpha_band + (row % 2 ? 0 : 1)) % 2) {
                if (alpha_fraction + beta_fraction > 1)
                    col += (++row % 2) ? 0 : 1;
            } else if (beta_fraction > alpha_fraction)
                col -= (++row % 2) ? 1 : 0;
        }

        node[this.row] = row;
        node[this.col] = col;
        return node;
    };

    HexGrid.prototype._eachNeighbor = function(node, fn, self) {
        // Call a function for each neighbor of the grid cell specified
        fn.call(self, {row: node.row + 1, col: node.col});
        fn.call(self, {row: node.row - 1, col: node.col});
        fn.call(self, {row: node.row, col: node.col + 1});
        fn.call(self, {row: node.row, col: node.col - 1});
        if (this.alpha == 'x') {
            fn.call(self, {row: node.row - 1,
                           col: node.col + ((node.row % 2) ? 1 : -1)});
            fn.call(self, {row: node.row + 1,
                           col: node.col + ((node.row % 2) ? 1 : -1)});
        } else {
            fn.call(self, {row: node.row + (node.col % 2 ? 1 : -1),
                           col: node.col - 1});
            fn.call(self, {row: node.row + (node.col % 2 ? 1 : -1),
                           col: node.col + 1});
        }
        return this;
    };

    HexGrid.prototype.points = function(node) {
        // Given a node with the coordinates for the center of a
        // hexagon, return a set of coordinates for each vertex.
        var self = this, p = function(a, b) {
            var result = {};
            result[self.alpha] = a;
            result[self.beta]  = b;
            return result;
        };
        var perp = this.hexw / 2;
        var halfsize = this._size / 2;
        return [p(node[this.alpha], node[this.beta] - this._size),
                p(node[this.alpha] + perp, node[this.beta] - halfsize),
                p(node[this.alpha] + perp, node[this.beta] + halfsize),
                p(node[this.alpha], node[this.beta] + this._size),
                p(node[this.alpha] - perp, node[this.beta] + halfsize),
                p(node[this.alpha] - perp, node[this.beta] - halfsize)];
    };

    // Maps names to grid objects
    var types = {
        square: SquareGrid, hex: HexGrid, hexagon: HexGrid,
        triangle: TriangleGrid, rtriangle: RTriangleGrid
    };

    // Exposes grid types for use in user menus.  The first element of
    // each list is the grid name.  The second, if present, is the
    // option structure which creates that grid type.
    grid.canonical = [
        {name: "Square(strict)", type: "square"},
        {name: "Square(diagonal)", type: "square", diagonal: true},
        {name: "Hex(point)", type: "hex", orient: "point"},
        {name: "Hex(edge)", type: "hex", orient: "edge"},
        {name: "Triangle", type: "triangle"},
        {name: "Right(regular)", type: "rtriangle", regular: true},
        {name: "Right(diamond)", type: "rtriangle", regular: false}];

    // Create a new grid based on an options object.  The type field
    // of the options is a string which gets translated to a grid type
    // if possible.  If width and height fields are present these are
    // used to center the (0, 0) grid cell.  Other options are passed
    // through to the grid itself.
    grid.create = function(options) {
        var result;
        if (options && options.type &&
            types[options.type.toLowerCase()])
            result = new types[options.type.toLowerCase()](options);
        else result = new SquareGrid(options);
        return result;
    };

    grid.test = function(parent, viewport) {
        var self = document.createElement('canvas');
        (parent ? parent : document.body).appendChild(self);
        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.6)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
        var colorRadius   = 'rgba(128, 128, 128, 0.2)';
        var colorLine     = 'rgba(128, 128, 224, 0.5)';
        var colorSegment  = 'rgba(128, 128, 224, 0.5)';
        var colorOccupied = 'rgba(128, 192, 128, 0.5)';
        var lineWidth = 0, lineFactor = 40;
        var numbers = false, combined = false;
        var instance;
        var tap, selected, when, previous;
        var drag, zooming, gesture, press = 0;

        if (!viewport)
            viewport = parent ? parent : window;

        var draw_id = 0;
        var draw = function() {
            if (!self.getContext)
                throw 'ERROR: canvas has no getContext';
            var ctx = self.getContext('2d');
            var width = self.clientWidth;
            var height = self.clientHeight;
            var style = getComputedStyle(self);
            var color = (style.color === 'transparent') ?
                        'white' : style.color;
            var points, last, index;
            var neighbors, vector, radius;

            if (!instance) {
                instance = grid.create({width: width, height: height});
                lineWidth = instance.size() / lineFactor;
            }

            ctx.save();

            // Clear to black to make holes in map obvious
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);

            // Create a grid
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.textAlign = 'center';
            ctx.font = 'bold ' + 12 + 'pt sans-serif';
            instance.map({width: width, height: height},
                         function(node) { instance.draw(ctx, node); });
            ctx.fillStyle = style['background-color'];
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.stroke();
            if (combined)
                instance.map({width: width, height: height},
                             function(node) {
                                 ctx.fillStyle = color;
                                 ctx.fillText(
                                     ripple.pair(node.row, node.col),
                                     node.x, node.y);
                             });
            else if (numbers)
                instance.map(
                    {width: width, height: height},
                    function(node) {
                        ctx.fillStyle = color;
                        ctx.fillText('(' + node.row + ', ' +
                                     node.col + ')', node.x, node.y);
                    });

            if (selected) {
                ctx.beginPath();
                instance.map(
                    {start: selected, radius: instance.size()},
                    function(node) { instance.draw(ctx, node); });
                ctx.fillStyle = colorRadius;
                ctx.fill();

                // Coordinates of the selected square must be
                // updated in case the grid offsets have moved
                // since the last draw call.
                ctx.beginPath();
                instance.draw(ctx, instance.getCenter(selected));
                ctx.fillStyle = colorSelected;
                ctx.fill();

                // Show the cells adjacent to the selected cell.
                neighbors = instance.neighbors(
                    selected, {points: true});
                ctx.beginPath();
                neighbors.forEach(function(neighbor) {
                    instance.draw(ctx, neighbor); });
                ctx.fillStyle = colorNeighbor;
                ctx.fill();

                // Show the boundaries between cells using a different
                // color for each adjacent cell.
                var colors = [
                        'red', 'green', 'blue', 'cyan', 'magenta',
                        'yellow', 'black', 'white'];
                neighbors.forEach(function(neighbor, index) {
                    var points = neighbor.points;

                    ctx.beginPath();
                    if (points.length > 1) {
                        vector = {x: points[1].x - points[0].x,
                                  y: points[1].y - points[0].y};
                        ctx.moveTo(points[0].x + 0.25 * vector.x,
                                   points[0].y + 0.25 * vector.y);
                        ctx.lineTo(points[0].x + 0.75 * vector.x,
                                   points[0].y + 0.75 * vector.y);
                    } else if (points.length === 1) {
                        radius = lineWidth * 5;
                        ctx.moveTo(points[0].x + radius,
                                   points[0].y);
                        ctx.arc(points[0].x, points[0].y,
                                radius, 0, 2 * Math.PI);
                    }
                    ctx.moveTo(neighbor.x + lineWidth * 2,
                               neighbor.y);
                    ctx.arc(neighbor.x, neighbor.y,
                            lineWidth * 2, 0, 2 * Math.PI);

                    ctx.lineWidth = lineWidth;
                    ctx.strokeStyle = colors[index % colors.length];
                    ctx.stroke();
                });

                if (previous) {
                    ctx.beginPath();
                    instance.eachSegment(
                        previous, selected, function(node) {
                            instance.draw(
                                ctx, instance.markCenter(node)); });
                    ctx.fillStyle = colorLine;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(previous.x, previous.y);
                    ctx.lineTo(selected.x, selected.y);
                    ctx.lineWidth = 2 * lineWidth;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = colorSegment;
                    ctx.stroke();
                }
            }

            if (tap) {
                var targets = tap.targets || [tap];
                for (index = 0; index < targets.length; ++index) {
                    ctx.beginPath();
                    ctx.arc(targets[index].x,
                            targets[index].y,
                            20, 0, 2 * Math.PI);
                    ctx.fillStyle = colorTapOuter;
                    ctx.fill();
                }

                if (targets.length > 1) {
                    ctx.beginPath();
                    instance.eachSegment(
                        targets[0], targets[1], function(node) {
                            instance.draw(
                                ctx, instance.getCenter(node)); });
                    ctx.fillStyle = colorLine;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(targets[0].x, targets[0].y);
                    ctx.lineTo(targets[1].x, targets[1].y);
                    ctx.lineWidth = 2 * lineWidth;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = colorSegment;
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(tap.x, tap.y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = colorTapInner;
                ctx.fill();
            }

            ctx.restore();
            draw_id = 0;
        };
        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        viewport.addEventListener('resize', function(event) {
            // Consume enough space to fill the viewport.
            self.height = viewport.innerHeight || viewport.clientHeight;
            self.width = viewport.innerWidth || viewport.clientWidth;

            zooming = drag = undefined;
            redraw();
        });
        viewport.dispatchEvent(new Event('resize'));

        var animation = new (function() {
            var id, current, start, stop, limit = 60000;
            var choose = function(size) {
                return Math.floor(size * Math.random());
            };

            this.start = function() {
                var now = new Date().getTime();
                if (!current)
                    current = now;
                do {
                    if (!stop) {
                        var offset = instance.offset();
                        var angle = 2 * Math.PI * Math.random();
                        var magnitude = 100 + choose(50);

                        if (now - current > limit)
                            current = now - limit;
                        start = {left: offset.left, top: offset.top,
                                 time: current};
                        stop = {left: offset.left + magnitude *
                            Math.cos(angle),
                                top:  offset.top  + magnitude *
                            Math.sin(angle),
                                time: current + choose(5000) + 2500};
                    }
                    var portion = Math.min(1.0, (now - start.time) /
                        (stop.time - start.time));
                    instance.offset(
                        Math.floor(start.left + portion *
                            (stop.left - start.left)),
                        Math.floor(start.top + portion *
                            (stop.top - start.top)));
                    if (stop.time < now) {
                        current = stop.time;
                        stop = undefined;
                    }
                } while (!stop);
                draw();
                var a = this;
                id = requestAnimationFrame(function() { a.start(); });
            };
            this.stop = function() {
                if (id)
                    cancelAnimationFrame(id);
                id = 0;
                current = undefined;
                stop = undefined;
            };
            this.toggle = function() {
                if (!id)
                    this.start();
                else this.stop();
            };
        })();

        // Populate menu with available grid types
        var menu = ripple.hide(ripple.createElement(
            'ul', {'class': 'menu'}));
        self.parentElement.appendChild(menu);
        grid.canonical.forEach(function (entry) {
            var options = JSON.stringify(entry);
            menu.appendChild(ripple.createElement(
                'li', {
                    data: {'grid-type': entry.name,
                           'grid-options': options}},
                entry.name));
        });
        menu.appendChild(document.createElement('hr'));
        menu.appendChild(ripple.createElement(
            'li', {data: {action: "animation"}}, 'Toggle Animation'));
        menu.appendChild(ripple.createElement(
            'li', {data: {action: "numbers"}}, 'Toggle Numbers'));
        menu.appendChild(ripple.createElement(
            'li', {data: {action: "colors"}}, 'Swap Colors'));
        menu.appendChild(ripple.createElement(
            'li', {data: {action: "full-screen"}}, 'Full Screen'));
        menu.addEventListener('click',function(event) {
            if (event.target.tagName.toLowerCase() !== 'li')
                return false;
            ripple.hide(menu);
            var gridType = event.target.getAttribute('data-grid-type');
            if (gridType) {
                var options = JSON.parse(decodeURIComponent(
                    event.target.getAttribute('data-grid-options')));
                if (!options)
                    options = {type: gridType};
                options.width  = self.clientWidth;
                options.height = self.clientHeight;
                instance = grid.create(options);
                lineWidth = instance.size() / lineFactor;

                tap = undefined;
                selected = undefined;
                previous = undefined;
                redraw();
            }

            switch (event.target.getAttribute('data-action')) {
                case 'full-screen': {
                    ripple.toggleFullscreen(self.parentElement);
                } break;
                case 'animation': {
                    animation.toggle();
                } break;
                case 'numbers': {
                    if (combined) {
                        numbers = combined = false;
                    } else if (numbers)
                        combined = true;
                    else numbers = true;
                    redraw();
                } break;
                case 'colors': {
                    var style = getComputedStyle(self);
                    var swap = style.color;
                    self.style.color = style['background-color'];
                    self.style['background-color'] = swap;
                    redraw();
                } break;
            }
        });

        // Show grid menu at event location
        var menuate = function(tap) {
            menu.style.top = 10 + 'px';
            menu.style.left = 25 + 'px';
            ripple.show(menu);
            drag = undefined;
        };

        var zoom = function(left, top, size, x, y, factor) {
            if (factor && factor > 0) {
                var screenSize = Math.min(
                    self.clientWidth, self.clientHeight);
                if ((size * factor > (screenSize / 50)) &&
                    (size * factor < screenSize)) {
                    instance.offset((left - x) * factor + x,
                                    (top - y)  * factor + y);
                    instance.size(size * factor);
                    lineWidth = instance.size() / lineFactor;
                }
                redraw();
            }
        };

        // Process mouse and touch events on grid itself
        ripple.addWheelListener(self, function(event) {
            var offset = instance.offset();
            var x, y;
            if (tap) {
                x = tap.x; y = tap.y;
            } else {
                x = self.clientWidth / 2;
                y = self.clientHeight / 2;
            }
            zoom(offset.left, offset.top, instance.size(), x, y,
                 1 + 0.1 * event.deltaY);
        });
        var downEvent = function(event) {
            var targets = ripple.getInputPoints(event, self);
            ripple.hide(menu);
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else if (targets.targets && targets.targets.length > 1) {
                tap = targets;
                if (targets.targets.length == 2) {
                    var t0 = targets.targets[0];
                    var t1 = targets.targets[1];
                    zooming = {
                        diameter: sumSquaresRoot(
                            t1.x - t0.x, t1.y - t0.y),
                        x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2,
                        size: instance.size(),
                        offset: instance.offset()};
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                var now = Date.now();
                tap = drag = targets;
                if (when && now < when + 1000)
                    previous = selected;
                else previous = undefined;
                when = now;
                selected = instance.markCell(tap);
                if (tap.targets && tap.targets.length > 1)
                    selected.range = [
                        instance.markCell(tap.targets[0]),
                        instance.markCell(tap.targets[1])];

                // Show a menu on either double tap or long press.
                // There are some advantages to using a native double
                // click event on desktop platforms (for example, the
                // timing can be linked to operating system
                // accessibility) but here testing is what matters.
                var now = new Date().getTime();
                if (gesture && gesture.time > now &&
                    sumSquares(gesture.x - tap.x,
                               gesture.y - tap.y) < 225) {
                    gesture = undefined;
                    menuate(tap);
                } else {
                    gesture = {time: now + 600, x: tap.x, y: tap.y};
                    press = setTimeout(function() { menuate(tap); },
                                       1000);
                }
            }

            redraw();
            if (event.preventDefault)
                event.preventDefault();
            return false;
        };
        self.addEventListener('mousedown', downEvent);
        self.addEventListener('touchstart', downEvent);
        var moveEvent = function(event) {
            if (drag) {
                animation.stop();
                tap = ripple.getInputPoints(event, self);
                var goff = instance.offset();
                instance.offset(goff.left + tap.x - drag.x,
                                goff.top + tap.y - drag.y);
                if ((sumSquares(tap.x - drag.x,
                                tap.y - drag.y) > 125) && press)
                    clearTimeout(press);
                redraw();
                drag = tap;
            }
            if (zooming) {
                animation.stop();
                var targets = ripple.getInputPoints(event, self);
                var factor;
                if (zooming.diameter && targets.targets.length == 2) {
                    var t0 = targets.targets[0];
                    var t1 = targets.targets[1];
                    var diameter = sumSquaresRoot(
                        t1.x - t0.x, t1.y - t0.y);
                    factor = diameter / zooming.diameter;
                }
                if (factor && factor > 0)
                    zoom(zooming.offset.left, zooming.offset.top,
                         zooming.size,
                         zooming.x, zooming.y, factor);
            }

            if (event.preventDefault)
                event.preventDefault();
            return false;
        };
        self.addEventListener('mousemove', moveEvent);
        self.addEventListener('touchmove', moveEvent);
        var upEvent = function(event) {
            drag = zooming = undefined;
            if (press) { clearTimeout(press); press = 0; }

            if (event.preventDefault)
                event.preventDefault();
            return false;
        };
        self.addEventListener('mouseleave', upEvent);
        self.addEventListener('mouseup', upEvent);
        self.addEventListener('touchend', upEvent);
    };

}).call(this, typeof exports === 'undefined' ?
        (this.grid = {}) : ((typeof module !== undefined) ?
                            (module.exports = exports) : exports));
