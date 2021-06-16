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
// similar cell size among different grid types.
//
//     var g = grille.createGrid({type: "hex", radius: 15});
//
// This creates a hexagonal grid with a radius of fifteen units.
//
// Often it is useful to know which grid cell corresponds to some
// point in two dimensional space.  For example, this is useful for
// determining which cell a mouse click landed on.  The markCell()
// method does this:
//
//     var cell = g.markCell({x: 202, y: 115});
//     console.log("row:", cell.row, "col:", cell.col);
//
// The markCenter method puts the x and y coordinates of the center
// of the grid cell, overwriting previous values if necessary:
//
//     var cell = g.markCenter({row: 1, col: 1});
//     console.log("x:", cell.x, "y:", cell.y);
//
// Both of these methods operate in place, which assumes mutable data.
// To avoid side effects, use g.getCenter(cell) or g.getCell(cell)
// instead.  The argument will not be modified in these cases.
//
// Every grid cell has a set of points that define a polygon.  Use
// the getPoints method to retreive these as an array.
//
// Each cell has neightbors, over which you can iterate:
//
//     g.eachNeighbor(cell, function(neighbor) {
//         console.log("row:", neighbor.row, "col:": neighbor.col); });
//
// Use the getPairPoints method to retrieve the line segment shared
// between two neighboring cells.  In some cases, such as diagonal
// neightbors in square grids, neighbors share only a single point.
// In both cases an array with the appropriate number of points will
// be returned.  Check the length.
//
// Iteration over all cells along a line segment is supported with the
// eachSegement() method:
//
//     g.eachSegment(cellStart, cellEnd, function(cell) {
//         console.log("row:", cell.row, "col:", cell.col); });
//
// Another option is to map over a rectangual area of cells.  The
// mapRectangle() method does this:
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
    var sqrt5 = Math.sqrt(5);
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
        { this._markCenter(checkCell(node)); return node; },

        // Given a node with row and col properties, set the x and y
        // coordinates of the center of that node in place.
        markCell: function(node)
        { this._markCell(checkCoordinates(node)); return node; },

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

        // Returns a set of points that make up a grid cell
        getPoints: function(node) {
            checkCell(node);
            if (isNaN(node.x) || isNaN(node.y))
                node = this.getCenter(node);
            return this._getPoints(node);
        },

        // Call a specified function on each neighbor of the
        // provided node.
        eachNeighbor: function(node, fn, context) {
            if (!fn)
                return this.eachNeighbor(node, function(node) {
                    this.push(node); }, []);
            checkCell(node);

            var index = 0;
            this._eachNeighbor(node, function(neighbor)
                { fn.call(context, neighbor, index++); });
            return context;
        },

        // Returns an array of neighbors of the provided node
        getNeighbors: function(node)
        { return this.eachNeighbor(node); },

        // Return truthy iff nodeA and nodeB are neighbors
        isAdjacent: function(nodeA, nodeB) {
            return this.eachNeighbor(nodeA).some(function(neigh) {
                return ((neigh.row === nodeB.row) &&
                        (neigh.col === nodeB.col)); });
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

        // Call a specified function for each cell in the line segment
        // between the start and end nodes.
        eachSegment: function(start, end, fn, context) {
            // Given a start and end with coordinates, call a function
            // for each cell in the line segment line between them.
            if (!fn)
                return this.eachSegment(start, end, function(node) {
                    this.push(node); }, []);

            start = this.getCell(start);
            end   = this.getCell(end);
            var current = this.getCenter(start);
            var visited = {};

            while ((current.row != end.row) ||
                   (current.col != end.col)) {
                var next = null;
                var id = ripple.pair(current.row, current.col);
                visited[id] = current;
                this.eachNeighbor(current, function(neigh) {
                    var points = this.getPairPoints(
                        current, this.markCenter(neigh));
                    if (next || (points.length < 2) ||
                        (visited[ripple.pair(neigh.row, neigh.col)]))
                        return;
                    var crossing = intersect2D(
                        start, end, points[0], points[1]);
                    if (crossing &&
                        between2D(points[0], points[1], crossing) &&
                        between2D(start, end, crossing))
                        visited[id] = next = this.markCenter(neigh);
                }, this);

                fn.call(context, current);
                if (!next)
                    break;
                current  = next;
            }
            fn.call(context, end);
            return context;
        },

        // Call a specified function once for each cell in the area
        // described by the config parameter.
        mapRectangle: function(start, end, fn, context) {
            if (!fn)
                return this.mapRectangle(start, end, function(node) {
                    this.push(node) }, []);
            checkCoordinates(start);
            checkCoordinates(end);
            var self    = this;
            var index   = 0;
            var queue   = [];
            var visited = {}; // ensure no repeat visits
            var visit   = function(node) {
                var id = ripple.pair(node.row, node.col);
                if (!visited[id]) {
                    visited[id] = node;
                    fn.call(context, self.markCenter(node),
                            index++, self);

                    self.eachNeighbor(node, function(neigh) {
                        var id = ripple.pair(neigh.row, neigh.col);
                        self.markCenter(neigh);
                        if (!visited[id] &&
                            (neigh.x >= start.x) &&
                            (neigh.x <= end.x) &&
                            (neigh.y >= start.y) &&
                            (neigh.y <= end.y))
                            queue.push(neigh);
                    });
                }
            };

            // Follow the rectangle marked by start and end
            this.eachSegment({x: start.x, y: start.y},
                             {x: start.x, y: end.y}, visit);
            this.eachSegment({x: start.x, y: end.y},
                             {x: end.x, y: end.y}, visit);
            this.eachSegment({x: end.x, y: end.y},
                             {x: end.x, y: start.y}, visit);
            this.eachSegment({x: end.x, y: start.y},
                             {x: start.x, y: start.y}, visit);
            while (queue.length > 0)
                visit(queue.shift());
            return context;
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

        // Removes the first level of grid adapter, if any
        getUnderlyingGrid: function()
        { return this._getUnderlyingGrid(); },

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
        _getPairPoints: function(nodeA, nodeB) {
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
        },
        _getUnderlyingGrid: function() { return this; },
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
        };

        result._markCell = function(node) {
            var halfedge = this._edge / 2;
            node.row = Math.floor((node.y + halfedge) / this._edge);
            node.col = Math.floor((node.x + halfedge) / this._edge);
        };

        result._eachNeighbor = function(node, fn) {
            // Neighbors are provided clockwise from the top
            fn({row: node.row - 1, col: node.col});
            if (this.diagonal)
                fn({row: node.row - 1,
                    col: node.col + 1, cost: sqrt2});
            fn({row: node.row, col: node.col + 1});
            if (this.diagonal)
                fn({row: node.row + 1,
                    col: node.col + 1, cost: sqrt2});
            fn({row: node.row + 1, col: node.col});
            if (this.diagonal)
                fn({row: node.row + 1,
                    col: node.col - 1, cost: sqrt2});
            fn({row: node.row, col: node.col - 1});
            if (this.diagonal)
                fn({row: node.row - 1,
                    col: node.col - 1, cost: sqrt2});
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
            this._hexw = sqrt3 * this._radius;
            this.point = (config && ("point" in config)) ?
                         config.point : false;
            if (this.point) {
                this._adjustCoords = function(node) { return node; };
                this._adjustCell   = function(node) { return node; };
            } else {
                this._adjustCoords = function(node) {
                    var swap = node.x;
                    node.x = node.y;
                    node.y = swap;
                    return node;
                };
                this._adjustCell = function(node) {
                    var swap = node.row;
                    node.row = node.col;
                    node.col = swap;
                    return node;
                };
            }
        };

        result._getRadius = function(edge)   { return edge; };
        result._getEdge   = function(radius) { return radius; };

        result._markCenter = function(node) {
            this._adjustCell(node);
            node.x = (node.col * this._hexw +
                      this._hexw / 2 * Math.abs(node.row % 2));
            node.y = node.row * this._radius * 3 / 2;
            this._adjustCoords(node);
            this._adjustCell(node);
        };

        result._markCell = function(node) {
            this._adjustCoords(node);
            var x_band = node.x * 2 / this._hexw;
            var y_band = node.y / (this._edge / 2);
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
            this._adjustCell(node);
            this._adjustCoords(node);
        };

        result._eachNeighbor = function(node, fn) {
            // Neighbors are provided clockwise from the top left.
            if (this.point && (node.row % 2)) {
                fn({row: node.row - 1, col: node.col + 1});
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row + 1, col: node.col + 1});
                fn({row: node.row + 1, col: node.col});
                fn({row: node.row,     col: node.col - 1});
                fn({row: node.row - 1, col: node.col});
            } else if (this.point && !(node.row % 2)) {
                fn({row: node.row - 1, col: node.col});
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row + 1, col: node.col});
                fn({row: node.row + 1, col: node.col - 1});
                fn({row: node.row,     col: node.col - 1});
                fn({row: node.row - 1, col: node.col - 1});
            } else if (node.col % 2) {
                fn({row: node.row - 1, col: node.col});
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row + 1, col: node.col + 1});
                fn({row: node.row + 1, col: node.col});
                fn({row: node.row + 1, col: node.col - 1});
                fn({row: node.row,     col: node.col - 1});
            } else {
                fn({row: node.row - 1, col: node.col});
                fn({row: node.row - 1, col: node.col + 1});
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row + 1, col: node.col});
                fn({row: node.row,     col: node.col - 1});
                fn({row: node.row - 1, col: node.col - 1});
            }
        };

        result._getPoints = function(node) {
            var p = this._adjustCoords;
            var perp     = this._hexw / 2;
            var halfedge = this._edge / 2;
            node = this._adjustCoords({x: node.x, y: node.y});

            return [p({x: node.x,        y: node.y - this._edge}),
                    p({x: node.x + perp, y: node.y - halfedge}),
                    p({x: node.x + perp, y: node.y + halfedge}),
                    p({x: node.x,        y: node.y + this._edge}),
                    p({x: node.x - perp, y: node.y + halfedge}),
                    p({x: node.x - perp, y: node.y - halfedge})];
        };

        return result;
    })();

    var TriangleGrid = (function() {
        var result = Object.create(BaseGrid);
        result._init = function(config) {
            this._rowh    = this._edge * sqrt3 / 2;
            this._centerh = this._edge * sqrt3 / 6;
        };

        result._getRadius = function(edge)
        { return edge * sqrt3 / 3; };
        result._getEdge = function(radius)
        { return radius * 3 / sqrt3; };

        result._markCenter = function(node) {
            node.x = node.col * this._edge / 2;
            node.y = node.row * this._rowh - ((
                (node.row + node.col) % 2) ? this._centerh : 0);
        };

        result._markCell = function(node) {
            var halfedge = this._edge / 2;
            var row = Math.floor((node.y + this._radius) / this._rowh);
            var col = Math.floor(node.x / halfedge);
            var xfrac = node.x / halfedge;
            var yfrac = (node.y + this._radius) / this._rowh;
            if ((row + col) % 2) {
                if ((yfrac - Math.ceil(yfrac)) +
                         (xfrac - Math.floor(xfrac)) > 0)
                    col += 1;
            } else if ((yfrac - Math.floor(yfrac)) -
                       (xfrac - Math.floor(xfrac)) < 0)
                col += 1;
            node.row = row;
            node.col = col;
        };

        result._eachNeighbor = function(node, fn) {
            if ((node.row + node.col) % 2) {
                fn({row: node.row - 1, col: node.col});
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row,     col: node.col - 1});
            } else {
                fn({row: node.row,     col: node.col + 1});
                fn({row: node.row + 1, col: node.col});
                fn({row: node.row,     col: node.col - 1});
            }
        };

        result._getPoints = function(node) {
            var direction = ((node.row + node.col) % 2) ? -1 : 1;
            return [{x: node.x, y: node.y - this._radius * direction},
                    {x: node.x + this._edge / 2,
                     y: node.y + this._centerh * direction},
                    {x: node.x - this._edge / 2,
                     y: node.y + this._centerh * direction}];
        };

        return result;
    })();

    var WedgeGrid = (function() {
        var result = Object.create(BaseGrid);

        result._init = function(config) {
            this.diamond = (config && ("diamond" in config)) ?
                           config.diamond : false;
        };

        result._getRadius = function(edge) { return edge / sqrt2; };

        result._getEdge = function(radius) { return radius * sqrt2; };

        result._markCenter = function(node) {
            var halfsize = this._edge / 2;
            var fifth = this._edge / 5;
            var x_sign = (node.col % 2) ? 1 : -1;
            var y_sign = x_sign * ((this.diamond && ((node.row < 0) ^
                (node.col < 0))) ? -1 : 1);
            node.x = Math.floor(node.col / 2) * this._edge +
                     halfsize + fifth * x_sign;
            node.y = node.row * this._edge + halfsize + fifth * y_sign;
        };

        result._markCell = function(node) {
            var halfsize = this._edge / 2;
            var xband = node.x / this._edge;
            var yband = node.y / this._edge;
            var row = Math.floor(yband);
            var col = Math.floor(xband) * 2;
            if (!this.diamond || !((row < 0) ^ (col < 0))) {
                if (Math.abs(xband - Math.floor(xband)) +
                    Math.abs(yband - Math.floor(yband)) > 1)
                    col += 1;
            } else if (Math.abs(xband - Math.floor(xband)) -
                       Math.abs(yband - Math.floor(yband)) > 0)
                col += 1;

            node.row = row;
            node.col = col;
        };

        result._eachNeighbor = function(node, fn) {
            var rmod = node.col % 2 ?  1 : -1;
            var cmod = node.col % 2 ? -1 :  1;
            if (this.diamond) {
                rmod *= ((node.row < 0) ^ (node.col < 0)) ? -1 : 1;
                cmod *= ((node.row < 0) ^ (node.row + rmod < 0)) ? 0 : 1;
            }
            fn.call(self, {row: node.row, col: node.col + 1});
            fn.call(self, {row: node.row, col: node.col - 1});
            fn.call(self, {row: node.row + rmod, col: node.col + cmod});
        };

        result._getPoints = function(node) {
            var halfsize = this._edge / 2;
            var fifth = this._edge / 5;
            var x_sign = (node.col % 2) ? 1 : -1;
            var y_sign = x_sign *
            ((this.diamond && ((node.row < 0) ^ (node.col < 0))) ?
            -1 : 1);
            var corner = Math.abs(node.col % 2) * this._edge;
            var x = node.x - (halfsize + x_sign * fifth);
            var y = node.y - (halfsize + y_sign * fifth);
            return (y_sign == x_sign) ? [
                {x: x + corner, y: y + corner},
                {x: x + this._edge, y: y},
                {x: x, y: y + this._edge}] : [
                    {x: x + this._edge * Math.abs(node.col % 2),
                     y: y + this._edge * Math.abs((node.col + 1) % 2)},
                    {x: x, y: y}, {x: x + this._edge, y: y + this._edge}];
        };

        result._getPairPoints = function(nodeA, nodeB) {
            var result = null;
            if ((nodeA.row !== nodeB.row) ||
                (nodeA.col + (nodeA.col % 2 ? -1 : 1) !== nodeB.col)) {
                var sign = (!this.diamond ||
                            ((nodeA.row < 0) === (nodeA.col < 0)));
                var points = this._getPoints(nodeA);
                result = [points[0], ((nodeA.row !== nodeB.row) ===
                    (nodeA.col % 2 ? !sign : sign)) ?
                        points[1] : points[2]];
            } else result = BaseGrid._getPairPoints.call(
                this, nodeA, nodeB);
            return result;
        };

        return result;
    })();

    var createAdapterGrid = function(underlying, toWorld, fromWorld) {
        var result = Object.create(underlying);

        result._getUnderlyingGrid = function() { return underlying; };

        result._markCenter = function(node) {
            underlying._markCenter(node);
            toWorld(node);
        };

        result._markCell = function(node) {
            fromWorld(node);
            underlying._markCell(node);
            toWorld(node);
        };

        result._getPoints = function(node) {
            var result;
            fromWorld(node);
            result = underlying._getPoints(node);
            result.forEach(toWorld);
            toWorld(node);
            return result;
        };

        result._getPairPoints = function(nodeA, nodeB) {
            var result;

            fromWorld(nodeA);
            fromWorld(nodeB);
            result = underlying._getPairPoints(nodeA, nodeB);
            result.forEach(toWorld);
            toWorld(nodeA);
            toWorld(nodeB);
            return result;
        };

        return result;
    };

    var adaptGridIsometric = function(underlying) {
        var toWorld = function(node) {
            var x = node.y - node.x;
            var y = (node.x + node.y) / 2;
            node.x = x;
            node.y = y;
        };

        var fromWorld = function(node) {
            var x = (2 * node.y - node.x) / 2;
            var y = (2 * node.y + node.x) / 2;
            node.x = x;
            node.y = y;
        };

        return createAdapterGrid(underlying, toWorld, fromWorld);
    };

    // Exposes grid types for use in user menus.  The first element of
    // each list is the grid name.  The second, if present, is the
    // option structure which creates that grid type.
    grille.canonical = [
        {name: "Square(strict)", type: "square"},
        {name: "Square(diagonal)", type: "square", diagonal: true},
        {name: "Hex(point)", type: "hex", point: true},
        {name: "Hex(edge)", type: "hex", point: false},
        {name: "Triangle", type: "triangle"},
        {name: "Wedge(regular)", type: "wedge"},
        {name: "Wedge(diamond)", type: "wedge", diamond: true},
        {name: "IsometricSquare", type: "square", isometric: true},
        {name: "IsometricHex", type: "hex", isometric: true},
        {name: "IsomemtricTriangle", type: "triangle", isometric: true},
    ];

    grille.createGrid = function(config) {
        var types = {
            "square":    SquareGrid,
            "hex":       HexGrid,
            "triangle":  TriangleGrid,
            "wedge":     WedgeGrid };
        var configType = (config && config.type) ?
                         config.type.toLowerCase() : undefined;
        var result = ((configType in types) ? types[configType] :
                      SquareGrid).create(config);
        if (config && config.isometric)
            result = adaptGridIsometric(result);
        return result;
    };

}).call(this, typeof exports === 'undefined' ?
        (this.grille = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
