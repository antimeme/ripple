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
(function(grille) {
    "use strict";
    var sqrt2 = Math.sqrt(2);
    var sqrt3 = Math.sqrt(3);
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
            // them must be present or the grid itself is invalid.

            if (config && !isNaN(config.radius))
                result._radius = config.radius;
            else if (result._edge)
                result._radius = result._getRadius(result._edge);
            else if (config && !isNaN(config.edge))
                result._radius = result._getRadius(config.edge);

            if (config && !isNaN(config.edge))
                result._edge = config.edge;
            else if (result._radius)
                result._edge = result._getEdge(result._radius);
            else if (config && !isNaN(config.radius))
                result._edge = result._getEdge(config.radius);

            if (!result._radius || !result.edge)
                throw new Error("Invalid grid size: " + result._radius);
            return result._init(config);
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
            var visited = {}; // ensure one visit per node
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
            } else throw "Configuration is invalid";

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
            this._eachNeighbor(node, config, fn, context);
            return context;
        },

        // Returns an array of neighbors of the provided node
        getNeighbors: function(node)
        { return this.eachNeighbor(node); },

        // Returns a set of points that make up a grid cell
        getPoints: function(node) {
            checkCell(node);
            return this._getPoints(node);
        },

        // Returns a set of points that make up a grid cell
        getPairPoints: function(nodeA, nodeB) {
            checkCell(nodeA);
            checkCell(nodeB);
            return this._getPairPoints(nodeA, nodeB);
        },

        // Draws a grid cell on a canvas
        draw: function(ctx) {
            var points = this.getPoints(node);
            if (points.length > 1) {
                var last = points[points.length - 1];
                ctx.moveTo(last.x, last.y);
                for (var index in points)
                    ctx.lineTo(points[index].x,
                               points[index].y);
            } else if (points.length === 1) {
                ctx.moveTo(points[0].x + this.getRadius() / 2,
                           points[0].y);
                ctx.arc(points[0].x, points[0].y,
                        this.getRadius() / 2, 0, 2 * Math.PI);
            }
        },

        createMaze: function(config) {
            throw new Error("Not yet implemented"); // FIXME
        },

        // Every grid should override most of these
        _init:      function(config) { return this; },
        _getRadius: function(edge) { return edge; },
        _getEdge:   function(radius) { return radius; },
        _markCenter: function(node)
        { throw new Error("BaseGrid markCenter is not valid"); },
        _markCell: function(node)
        { throw new Error("BaseGrid markCell is not valid"); },
        _eachNeighbor: function(node, fn, context)
        { throw new Error("BaseGrid eachNeighbor is not valid"); },
        _getPoints: function(node)
        { throw new Error("BaseGrid getPoints is not valid"); },
        _getPairPoints: function(nodeA, nodeB)
        { throw new Error("BaseGrid getPairPoints is not valid"); },
    };

    var SquareGrid = (function() {
        var result = Object.create(BaseGrid);

        result._init = function(config) {
            this._diagonal = (config && config.diagonal) ?
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

        result._eachNeighbor = function(node, fn, context) {
            fn.call(context, {row: node.row, col: node.col + 1});
            fn.call(context, {row: node.row, col: node.col - 1});
            fn.call(context, {row: node.row + 1, col: node.col});
            fn.call(context, {row: node.row - 1, col: node.col});
            if (this.diagonal) {
                fn.call(context, {row: node.row + 1,
                                  col: node.col + 1, cost: sqrt2});
                fn.call(context, {row: node.row + 1,
                                  col: node.col - 1, cost: sqrt2});
                fn.call(context, {row: node.row - 1,
                                  col: node.col + 1, cost: sqrt2});
                fn.call(context, {row: node.row - 1,
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
            if ((nodeA.row - nodeB.row) && (nodeA.col - nodeB.col)) {
                result.push({x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                             y: nodeA.y + (nodeB.y - nodeA.y) / 2});
            } else {
                var midpoint = {x: (nodeB.x - nodeA.x) / 2,
                                y: (nodeB.y - nodeA.y) / 2};
                var rotated = {x: (nodeA.y - nodeB.y) / 2,
                               y: (nodeB.x - nodeA.x) / 2};
                var factor = this._edge / (2 * sumSquaresRoot(
                    rotated.x, rotated.y));
                var scaled = {x: rotated.x * factor,
                              y: rotated.y * factor};
                result.push({x: nodeA.x + midpoint.x + scaled.x,
                             y: nodeA.y + midpoint.y + scaled.y});
                result.push({x: nodeA.x + midpoint.x - scaled.x,
                             y: nodeA.y + midpoint.y - scaled.y});
            }
            return result;
        };
        return result;
    })();

    var HexGrid = (function() {
        var result = Object.create(BaseGrid);

        return result;
    })();

    var TriangleGrid = (function() {
        var result = Object.create(BaseGrid);
        return result;
    })();

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
