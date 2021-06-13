// grille.js
// Copyright (C) 2013-2021 by Jeff Gold.
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
// Create a grid by calling the grille.createGrid method:
//
//     var g = grile.createGrid({type: "square", edge: 20});
//
// This creates a square grid with an edge length of twenty units.
// Instead, you could specify a radius.  This should give a more
// uniform size among different grid types.
//
//     var g = grille.createGrid({type: "hex", radius: 15});
//
// This creates a hexagonal grid with a radius of fifteen units.
// The markCenter method puts the x and y coordinates of the center
// of the grid cell.
//
// Once a grid has been created you can use a row and column to find
// the coordinates of the center of the cell:
//
//     var cell = g.markCenter({row: 1, col: 1});
//     console.log("x:", cell.x, "y:", cell.y);
//
// Often it is useful to identify which grid cell a coordinate pair
// falls within.  For example, this is useful for converting mouse
// clicks to a cell.
//
//     var cell = g.markCell({x: 202, y: 115});
//     console.log("row:", cell.row, "col:", cell.col);
//
// Both of these methods operate in place, which assumes mutable data.
// To avoid side effects, use g.getCenter(cell) or g.getCell(cell)
// instead.  The argument will not be modified in these cases.
//
// Every grid cell has a set of points that define the polygon.  Use
// the getPoints method to retreive these as an array.
//
// Each cell has neightbors, over which you can iterate:
//
//     g.eachNeighbor(cell, null, function(neighbor) {
//         console.log("row:", neighbor.row, "col:": neighbor.col); });
//
// Use the getPairPoints method to retrieve the line segment shared
// between two neighboring cells.  In some cases, such as diagonal
// neightbors in square grids, neighbors share only a single point.
//
// Iteration over all cells along a line segment is supported with the
// eachSegement method:
//
//     g.eachSegment(cellStart, cellEnd, function(cell) {
//         console.log("row:", cell.row, "col:", cell.col); });
//
// Another advanced option is to map over a rectangual or circular
// area of cells.  The map method does this:
//
//     g.map({start: {x: 22, y: -144}, end: {x: 405, y: 255}},
//           function(cell) {
//               console.log("row:", cell.row, "col:", cell.col ); });
//
// Note that the grid does not support offsets.  You will need to use
// some other method of transforming coordinates as necessary.
(function(grille) {
    "use strict";
    var sqrt2 = Math.sqrt(2);
    var sqrt3 = Math.sqrt(3);
    var epsilon = 1 / (1 << 20); // approximately one in a million
    var zeroish = function(value)
    { return (value < epsilon) && (value > -epsilon); };

    // Return the sum of the square of each argument
    var sumSquares = function() {
        var result = 0;
        var index;
        for (index = 0; index < arguments.length; ++index)
            if (!isNaN(arguments[index]))
                result += arguments[index] * arguments[index];
        return result;
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

    // Throws an error if the node does not contain a numeric "row"
    // and "col" attributes.
    var checkCell = function(node) {
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error(
                "Node does not contain row and col: " + node);
        return node;
    };

    var checkCoordinates = function(node) {
        if (!node || isNaN(node.x) || isNaN(node.y))
            throw new Error(
                "Node does not contain x and y: " + node);
        return node;
    };

    var BaseGrid = {
        create: function(config) {
            var result = Object.create(this);
            // Every grid has an edge length and a radius.  The meaning
            // of these depends on the grid type but at least one of
            // them must be specified.

            if (config && !isNaN(config.radius))
                result._radius = config.radius;
            else if (config && !isNaN(config.edge))
                result._radius = result._getRadius(config.edge);
            else if (result._edge)
                result._radius = result._getRadius(result._edge);

            if (config && !isNaN(config.edge))
                result._edge = config.edge;
            else if (config && !isNaN(config.radius))
                result._edge = result._getEdge(config.radius);
            else if (result._radius)
                result._edge = result._getEdge(result._radius);

            if (isNaN(result._radius) || isNaN(result._edge))
                throw new Error("Must specify grid size (radius: \"" +
                                result._radius + "\", edge: \"" +
                                result._edge + "\")");
            result._init(config);
            return result;
        },

        // Returns the radius of a single cell
        getRadius: function() { return this._radius; },

        // Returns the length of a cell edge
        getEdge: function() { return this._edge; },

        // Given a node with row and col properties, set the x and y
        // coordinates of the center of that node in place.
        markCenter: function(node)
        { return this._markCenter(checkCell(node)); },

        // Given a node with row and col properties, set the x and y
        // coordinates of the center of that node in place.
        markCell: function(node)
        { return this._markCell(checkCoordinates(node)); },

        // Given a node with row and col properties, return a new node
        // with the same row and col but with x and y set to the
        // coordinates of the center of the node.
        getCenter: function(node)
        { return this.markCenter({row: node.row, col: node.col}); },

        // Given a node with row and col properties, return a new node
        // with the same row and col but with x and y set to the
        // coordinates of the center of the node.
        getCell: function(node)
        { return this.markCell({x: node.x, y: node.y}); },

        // Return truthy iff nodeA and nodeB are neighbors
        isAdjacent: function(nodeA, nodeB) {
            return this.eachNeighbor(nodeA).some(function(neigh) {
                return ((neigh.row === nodeB.row) &&
                        (neigh.col === nodeB.col)); });
        },

        // Call a specified function for each cell in the line segment
        // between the start and end nodes.
        eachSegment: function(start, end, fn, context) {
            // Given a start and end with coordinates, call a function
            // for each cell in the line segment line between them.
            // WARNING: this has a bug that only seems to manifest on
            // the right triangle grids.  Sometimes it works but other
            // times it stops part way through.
            if (!fn)
                return this.eachSegment(start, end, function(node) {
                    this.push(node); }, []);

            var previous = null;
            var current = this.markCell({x: start.x, y: start.y});
            end = this.markCell({x: end.x, y: end.y});

            while ((current.row != end.row) ||
                   (current.col != end.col)) {
                var step = null;
                this.eachNeighbor(current, {points: true}, function(
                    neighbor) {
                    if (!neighbor.points ||
                        (neighbor.points.length < 2) ||
                        (previous &&
                         (previous.row == neighbor.row) &&
                         (previous.col == neighbor.col)))
                        return;
                    var crossing = intersect2D(
                        start, end, neighbor.points[0],
                        neighbor.points[1]);
                    if (crossing && between2D(
                        neighbor.points[0], neighbor.points[1],
                        crossing) &&
                        between2D(start, end, crossing))
                        step = neighbor;
                });

                fn.call(context, current);
                if (step) {
                    previous = current;
                    current = step;
                } else break;
            }
            fn.call(context, end);
            return context;
        },

        // Call a specified function once for each cell in the area
        // described by the config parameter.
        map: function(config, fn, context) {
            if (!fn)
                return this.map(config, function(node) {
                    this.push(node) }, []);
            var start, end, radius, index = 0;
            var self = this;
            var visited = {}; // ensure at most one visit per node
            var visit = function(node) {
                var id = ripple.pair(node.row, node.col);
                if (!visited[id]) {
                    fn.call(context, self.markCenter(
                        {row: node.row, col: node.col}), index++, self);
                    visited[id] = true;
                }
            };

            if ((typeof(config.start) === 'object') &&
                !isNaN(config.width) && !isNaN(config.height)) {
                start = this.markCell(
                    {x: config.start.x, y: config.start.y});
                end = this.markCell({x: start.x + config.width,
                                     y: start.y + config.height});
            } else if (!isNaN(config.width) && !isNaN(config.height)) {
                start = this.markCell({x: 0, y: 0});
                end = this.markCell({x: config.width, y: config.height});
            } else if ((typeof(config.start) === 'object') &&
                       (typeof(config.end) === 'object')) {
                start = this.markCell(
                    {x: config.start.x, y: config.start.y});
                end = this.markCell(
                    {x: config.end.x, y: config.end.y});
            } else if ((typeof(config.start) === 'object') &&
                       !isNaN(config.radius) && (config.radius > 0)) {
                start = this.markCell(
                    {x: config.start.x, y: config.start.y});
                radius = config.radius;
            } else throw Error("Configuration is invalid");

            if (start && end) {
                // Ensure that cells inside the rectangle are included
                for (var row = Math.min(start.row, end.row);
                    row <= Math.max(start.row, end.row); ++row)
                    for (var col = Math.min(start.col, end.col);
                        col <= Math.max(start.col, end.col); ++col)
                        visit({row: row, col: col});

                // Follow the rectangle marked by start and end
                this.eachSegment({x: start.x, y: start.y},
                                 {x: start.x, y: end.y}, visit);
                this.eachSegment({x: start.x, y: end.y},
                                 {x: end.x, y: end.y}, visit);
                this.eachSegment({x: end.x, y: end.y},
                                 {x: end.x, y: start.y}, visit);
                this.eachSegment({x: end.x, y: start.y},
                                 {x: start.x, y: start.y}, visit);

            } else if (start && radius) {
                var current, id, queue = [this.markCenter({
                    row: start.row, col: start.col})];

                while (queue.length > 0) {
                    current = queue.pop();
                    id = ripple.pair(current.row, current.col);

                    if (!visited[id] &&
                        (sumSquares(radius) >= sumSquares(
                            current.x - start.x,
                            current.y - start.y))) {
                        visit(current);
                        this.eachNeighbor(current, {mark: true},
                                          function(neighbor)
                            { queue.push(neighbor); });
                    } else visited[id] = true;
                }
            }
            return context;
        },

        // Call a specified function on each neighbor of the
        // provided node.
        eachNeighbor: function(node, config, fn, context) {
            checkCell(node);
            if (!fn)
                return this.eachNeighbor(node, config, function(node) {
                    this.push(node); }, []);
            var self = this;
            var index = 0;
            this._eachNeighbor(node, function(neighbor) {
                if (config && (config.center || config.points))
                    neighbor = self.getCenter(neighbor);
                if (config && config.points)
                    neighbor.points = self.getPairPoints(
                        node, neighbor);
                fn.call(context, neighbor, index++);
            });
            return context;
        },

        // Returns an array of neighbors of the provided node
        getNeighbors: function(node)
        { return this.eachNeighbor(node); },

        // Returns a set of points that make up a grid cell
        getPoints: function(node) {
            checkCell(node);
            if (isNaN(node.x) || isNaN(node.y))
                node = this.getCenter(node);
            return this._getPoints(node);
        },

        // Returns a set of points that make up a grid cell
        getPairPoints: function(nodeA, nodeB) {
            checkCell(nodeA);
            if (isNaN(nodeA.x) || isNaN(nodeA.y))
                nodeA = this.getCenter(nodeA);
            checkCell(nodeB);
            if (isNaN(nodeB.x) || isNaN(nodeB.y))
                nodeB = this.getCenter(nodeB);
            return this._getPairPoints(nodeA, nodeB);
        },

        // Draws a grid cell on a canvas
        draw: function(ctx, node) {
            var points = this.getPoints(node);
            if (points.length > 1) {
                var last = points[points.length - 1];
                ctx.moveTo(last.x, last.y);
                for (var index in points)
                    ctx.lineTo(points[index].x,
                               points[index].y);
            } else if (points.length === 1) {
                var radius = this.getRadius();
                ctx.moveTo(points[0].x + radius / 2,
                           points[0].y);
                ctx.arc(points[0].x, points[0].y,
                        radius / 2, 0, 2 * Math.PI);
            }
        },

        createMaze: function(config) {
            throw new Error("Not yet implemented"); // FIXME
        },

        // Every grid should override most of these
        _init:       function(config) { return this; },
        _getRadius:  function(edge)   { return edge; },
        _getEdge:    function(radius) { return radius; },
        _markCenter: function(node)
        { throw new Error("BaseGrid markCenter is not valid"); },
        _markCell:   function(node)
        { throw new Error("BaseGrid markCell is not valid"); },
        _eachNeighbor:  function(node, fn)
        { throw new Error("BaseGrid eachNeighbor is not valid"); },
        _getPoints:     function(node)
        { throw new Error("BaseGrid getPoints is not valid"); },
        _getPairPoints: function(nodeA, nodeB)
        { throw new Error("BaseGrid getPairPoints is not valid"); },
    };

    var SquareGrid = (function() {
        var result = Object.create(BaseGrid);

        result._init = function(config) {
            this.diagonal = (config && config.diagonal) ?
                            config.diagonal : false;
        };

        result._getRadius = function(edge) { return edge / sqrt2; };

        result._getEdge = function(radius) { return radius * sqrt2; };

        result._markCenter = function(node) {
            node.x = node.col * this._edge;
            node.y = node.row * this._edge;
            return node;
        };

        result._markCell = function(node) {
            var halfedge = this._edge / 2;
            node.row = Math.floor((node.y + halfedge) / this._edge);
            node.col = Math.floor((node.x + halfedge) / this._edge);
            return node;
        };

        result._eachNeighbor = function(node, fn) {
            fn({row: node.row - 1, col: node.col});
            fn({row: node.row, col: node.col + 1});
            fn({row: node.row + 1, col: node.col});
            fn({row: node.row, col: node.col - 1});
            if (this.diagonal) {
                fn({row: node.row + 1,
                    col: node.col + 1, cost: sqrt2});
                fn({row: node.row + 1,
                    col: node.col - 1, cost: sqrt2});
                fn({row: node.row - 1,
                    col: node.col + 1, cost: sqrt2});
                fn({row: node.row - 1,
                    col: node.col - 1, cost: sqrt2});
            }
        };

        result._getPoints = function(node) {
            var halfedge = this._edge / 2;
            return [{x: node.x - halfedge, y: node.y - halfedge},
                    {x: node.x + halfedge, y: node.y - halfedge},
                    {x: node.x + halfedge, y: node.y + halfedge},
                    {x: node.x - halfedge, y: node.y + halfedge}];
        };

        result._getPairPoints = function(nodeA, nodeB) {
            var result = [];
            var halfedge = this._edge / 2;
            if ((nodeA.row - nodeB.row) && (nodeA.col - nodeB.col)) {
                // Diagonal neightbors get a single point
                result.push({x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                             y: nodeA.y + (nodeB.y - nodeA.y) / 2});
            } else if (nodeA.row - nodeB.row) {
                result.push({x: nodeA.x - halfedge,
                             y: nodeA.y + (nodeB.y - nodeA.y) / 2});
                result.push({x: nodeA.x + halfedge,
                             y: nodeA.y + (nodeB.y - nodeA.y) / 2});
            } else if (nodeA.col - nodeB.col) {
                result.push({x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                             y: nodeA.y - halfedge});
                result.push({x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                             y: nodeA.y + halfedge});
            } else throw Error("getPairPoints called on same node");
            return result;
        };

        return result;
    })();

    var HexGrid = (function() {
        var result = Object.create(BaseGrid);

        result._init = function(config) {
            this.point = (config && ("point" in config)) ?
                         config.point : false;
            this._hexw = sqrt3 * this._radius;
        };

        result._getRadius = function(edge)   { return edge; };
        result._getEdge   = function(radius) { return radius; };

        result._markCenter = function(node) {
            if (!this.point)
                node = {row: node.col, col: node.row};
            node.x = (node.col * this._hexw +
                      this._hexw / 2 * Math.abs(node.row % 2));
            node.y = node.row * this._radius * 3 / 2;
            return node;
        };

        result._markCell = function(node) {
            if (!this.point)
                node = {row: node.col, col: node.row};
            var halfedge = this._edge / 2;
            var x_band = node.x * 2 / this._hexw;
            var y_band  = node.y / halfedge;
            var row = Math.floor((y_band + 1) / 3);
            var col = Math.floor((x_band + (row % 2 ? 0 : 1)) / 2);

            if ((Math.floor(y_band) + 2) % 3 === 0) {
                var x_fraction = ((x_band % 1) + 1) % 1;
                var y_fraction = ((y_band % 1) + 1) % 1;
                if (Math.floor(x_band + (row % 2 ? 0 : 1)) % 2) {
                    if (x_fraction + y_fraction > 1)
                        col += (++row % 2) ? 0 : 1;
                } else if (y_fraction > x_fraction)
                    col -= (++row % 2) ? 1 : 0;
            }

            node.row = row;
            node.col = col;
            return node;
        };

        result._eachNeighbor = function(node, fn) {
            fn({row: node.row + 1, col: node.col});
            fn({row: node.row - 1, col: node.col});
            fn({row: node.row, col: node.col + 1});
            fn({row: node.row, col: node.col - 1});
            if (this.point) {
                fn({row: node.row - 1,
                    col: node.col + ((node.row % 2) ? 1 : -1)});
                fn({row: node.row + 1,
                    col: node.col + ((node.row % 2) ? 1 : -1)});
            } else {
                fn({row: node.row + (node.col % 2 ? 1 : -1),
                    col: node.col - 1});
                fn({row: node.row + (node.col % 2 ? 1 : -1),
                    col: node.col + 1});
            }
        };

        result._getPoints = function(node) {
            var p = (this.point) ?
                    function(x, y) { return {x: x, y: y}; } :
                    function(y, x) { return {x: x, y: y}; };
            var perp     = this._hexw / 2;
            var halfedge = this._edge / 2;
            return [p(node.x, node.y - this._edge),
                    p(node.x + perp, node.y - halfedge),
                    p(node.x + perp, node.y + halfedge),
                    p(node.x, node.y + this._edge),
                    p(node.x - perp, node.y + halfedge),
                    p(node.x - perp, node.y - halfedge)];
        };

        result._getPairPoints = function(nodeA, nodeB) {
            var midpoint = {x: (nodeB.x - nodeA.x) / 2,
                            y: (nodeB.y - nodeA.y) / 2};
            var rotated = {x: (nodeA.y - nodeB.y) / 2,
                           y: (nodeB.x - nodeA.x) / 2};
            var factor = this._edge / (2 * Math.sqrt(sumSquares(
                rotated.x, rotated.y)));
            var scaled = {x: rotated.x * factor, y: rotated.y * factor};
            return [{x: nodeA.x + midpoint.x + scaled.x,
                     y: nodeA.y + midpoint.y + scaled.y},
                    {x: nodeA.x + midpoint.x - scaled.x,
                     y: nodeA.y + midpoint.y - scaled.y}];
        };

        return result;
    })();

    var TriangleGrid = (function() {
        var result = Object.create(BaseGrid);
        result._init = function(config) { };
        result._getRadius = function(edge)   { return edge; };
        result._getEdge = function(radius) { return radius; };
        result._markCenter = function(node)
        { throw new Error("TriangleGrid markCenter is not valid"); };
        result._markCell = function(node)
        { throw new Error("TriangleGrid markCell is not valid"); };
        result._eachNeighbor = function(node, fn)
        { throw new Error("TriangleGrid eachNeighbor is not valid"); };
        result._getPoints = function(node)
        { throw new Error("TriangleGrid getPoints is not valid"); };
        result._getPairPoints = function(nodeA, nodeB)
        { throw new Error("TriangleGrid getPairPoints is not valid"); };
        return result;
    })();

    var WedgeGrid = (function() {
        var result = Object.create(BaseGrid);
        result._init = function(config) { };
        result._getRadius = function(edge)   { return edge; };
        result._getEdge = function(radius) { return radius; };
        result._markCenter = function(node)
        { throw new Error("WedgeGrid markCenter is not valid"); };
        result._markCell = function(node)
        { throw new Error("WedgeGrid markCell is not valid"); };
        result._eachNeighbor = function(node, fn)
        { throw new Error("WedgeGrid eachNeighbor is not valid"); };
        result._getPoints = function(node)
        { throw new Error("WedgeGrid getPoints is not valid"); };
        result._getPairPoints = function(nodeA, nodeB)
        { throw new Error("WedgeGrid getPairPoints is not valid"); };
        return result;
    })();

    var IsometricGrid = (function() {
        var result = Object.create(BaseGrid);
        result._init = function(config) { };
        result._getRadius = function(edge)   { return edge; };
        result._getEdge = function(radius) { return radius; };
        result._markCenter = function(node)
        { throw new Error("IsometricGrid markCenter is not valid"); };
        result._markCell = function(node)
        { throw new Error("IsometricGrid markCell is not valid"); };
        result._eachNeighbor = function(node, fn)
        { throw new Error("IsometricGrid eachNeighbor is not valid"); };
        result._getPoints = function(node)
        { throw new Error("IsometricGrid getPoints is not valid"); };
        result._getPairPoints = function(nodeA, nodeB)
        { throw new Error("IsometricGrid getPairPoints is not valid"); };
        return result;
    })();

    // Exposes grid types for use in user menus.  The first element of
    // each list is the grid name.  The second, if present, is the
    // option structure which creates that grid type.
    grille.canonical = [
        {name: "Square(strict)", type: "square"},
        {name: "Square(diagonal)", type: "square", diagonal: true},
        {name: "Hex(point)", type: "hex", point: true},
        {name: "Hex(edge)", type: "hex", point: false},
        {name: "Triangle", type: "triangle"}];

    grille.createGrid = function(config) {
        var types = {
            "square":   SquareGrid,
            "hex":      HexGrid,
            "triangle": TriangleGrid };
        var configType = (config && config.type) ?
                         config.type.toLowerCase() : undefined;
        return ((configType in types) ? types[configType] :
                SquareGrid).create(config);
    };

}).call(this, typeof exports === 'undefined' ?
        (this.grille = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
