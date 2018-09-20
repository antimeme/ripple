// grid.js
// Copyright (C) 2013-2018 by Jeff Gold.
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
// Grid abstaction which performs calculations necessary to render and
// translate input for a two dimensional grid.  Several kinds of grid
// are supported and are listed in the grid.canonical array, each
// entry of which is itself an array.  The first element of each entry
// is a display name for the grid type.  The second, if present, is an
// options object which should be passed to the grid.create function
// to set up that kind of grid.  Use grid.create({type: entry[0]}) to
// create that grid if the second element is undefined.
//
// Here's an example:
//
//     var g = grid.create({type: "square"});
//     var points = g.points(grid.position({row: 2, col: 1}));
//
// This creates a square grid and collects the coordinates of the
// points which make up the cell in row 2 column 1, perhaps for use
// in rendering for display.
//
// Creating a new grid usually means overriding these in BaseGrid:
//
//     * _update: calculate any sized based grid properties
//     * _coordinate: fill in x and y position given row and col
//     * _position: fill in row and col given x and y position
//     * _neighbors: return a list of adjacent grid cells
//     * _pairpoints: fill in a pair of points defining the
//                    boundary between two neighbors
//     * points: return points in grid cell polygon
//
// Overriding _update is not required if the grid has no size-
// dependant state.  The coordinate, position and neighbors functions
// in BaseGrid will automatically adjust for the grid offset, so
// there's no need to account for this in the _coordinate, _position
// and _neighbors functions.  Because the input to the points function
// is expected to already have correct x and y coordinates there's no
// need to perform adjustments there either.
(function(grid) {
    "use strict";
    var _sqrt2 = Math.sqrt(2);
    var _sqrt3 = Math.sqrt(3);

    var magnitude = function() {
        var index;
        var result = 0;
        for (index = 0; index < arguments.length; ++index)
            if (arguments[index])
                result += arguments[index] * arguments[index];
        return Math.sqrt(result);
    }

    // BaseGrid serves a base class for other grids.  Although it
    // thinks like a SquareGrid for the most part, it returns an empty
    // list of points for each cell.
    var BaseGrid = function(options) {
        this._json = {
            type: null, width: options.width, height: options.height };
        this.size(options && options.size ? options.size : 100);
    };

    BaseGrid.prototype.toJSON = function() { return this._json; };
    BaseGrid.prototype._update = function() {};
    BaseGrid.prototype._offset_init = function(left, top) {
        if (!this._offset)
            this._offset = {left: left || 0, top: top || 0};
    };

    BaseGrid.prototype.size = function(value) {
        if (!isNaN(value) && (value > 0)) {
            this._json.size = this._size = value;
            this._update();
        }
        return this._size;
    };

    BaseGrid.prototype.offset = function(left, top) {
        this._offset_init();
        if (!isNaN(left))
            this._offset.left = left;
        if (!isNaN(top))
            this._offset.top = top;
        return {top: this._offset.top, left: this._offset.left};
    };

    BaseGrid.prototype.adjust = function(node, invert) {
        this._offset_init();
        if (!isNaN(node.x))
            node.x += (invert ? -1 : 1) * this._offset.left;
        if (!isNaN(node.y))
            node.y += (invert ? -1 : 1) * this._offset.top;
        return node;
    };

    BaseGrid.prototype.coordinate = function(node) {
        return this.adjust(this._coordinate(node));
    };

    BaseGrid.prototype._coordinate = function(node) {
        // Return a node with a cartesian coordinate (x and y) for the
        // center of the cell in the row and column specified within
        // node.  The return value will have the given row and column.
        var halfsize = this._size / 2;
        return {x: node.col * this._size + halfsize,
                y: node.row * this._size + halfsize,
                row: node.row, col: node.col};
    };

    BaseGrid.prototype.position = function(node) {
        return this.coordinate(
            this._position(this.adjust({x: node.x, y: node.y}, true)));
    };

    BaseGrid.prototype._position = function(node) {
        // Return a node with the row and column of the square in which
        // the cartesian coordinate (x and y) is contained.  The return
        // value will have an x and y value for the cell center.
        return {row: Math.floor(node.y / this._size),
                col: Math.floor(node.x / this._size)};
    };

    BaseGrid.prototype.adjacent = function(nodeA, nodeB) {
        return this._neighbors(nodeA).some(function(neigh) {
            return ((neigh.row === nodeB.row) &&
                    (neigh.col === nodeB.col));
        });
    };

    BaseGrid.prototype.neighbors = function(node, options) {
        // Return a list of neighboring nodes.  The following options
        // are recognized:
        //   coordinates: compute x and y position of each node iff true
        //   points: compute a pair of points which define the
        //           intersection
        var result = [];
        if (options && options.points)
            node = this.coordinate(node);
        this._neighbors(node).forEach(function(neigh) {
            if ((options && options.coordinates) ||
                (options && options.points))
                neigh = this.coordinate(neigh);
            if (options && options.points)
                neigh.points = this._pairpoints(node, neigh);
            if (isNaN(neigh.cost))
                neigh.cost = 1;
            result.push(neigh);
        }, this);
        return result;
    };

    BaseGrid.prototype._neighbors = function(node) {
        // Return a list of neighbors for the row and column specified
        // in the given node.
        return [{row: node.row, col: node.col + 1},
                {row: node.row, col: node.col - 1},
                {row: node.row + 1, col: node.col},
                {row: node.row - 1, col: node.col}];
    };

    BaseGrid.prototype._pairpoints = function(nodeA, nodeB) {
        var midpoint = {x: (nodeB.x - nodeA.x) / 2,
                        y: (nodeB.y - nodeA.y) / 2};
        var rotated = {x: (nodeA.y - nodeB.y) / 2,
                       y: (nodeB.x - nodeA.x) / 2};
        var factor = this._size / (2 * magnitude(rotated.x, rotated.y));
        var scaled = {x: rotated.x * factor, y: rotated.y * factor};
        return [{x: nodeA.x + midpoint.x + scaled.x,
                 y: nodeA.y + midpoint.y + scaled.y},
                {x: nodeA.x + midpoint.x - scaled.x,
                 y: nodeA.y + midpoint.y - scaled.y}];
    };

    BaseGrid.prototype.pairpoints = function(nodeA, nodeB) {
        return this.adjacent(nodeA, nodeB) ?
               this._pairpoints(this.coordinate(nodeA),
                                this.coordinate(nodeB)) : [];
    };

    BaseGrid.prototype.points = function(node) {
        // Returns a list of points which define a single grid cell.
        return [];
    };

    BaseGrid.prototype.draw = function(ctx, node) {
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
        var reference = this.position({x: 0, y: 0});
        this.offset(width / 2 - reference.x, height / 2 - reference.y);
        return this;
    };

    BaseGrid.prototype.map = function(width, height, fn) {
        // Apply a function to all cells reachable within a
        // rectangular region.
        // :FIXME: the boundaries aren't exactly right for all grids
        //    The solution is to support an fudge factor method that
        //    each grid type can override.
        this._offset_init();
        var start = this.position({x: 1 - this._size,
                                   y: 1 - this._size});
        var end = this.position({x: width + this._size - 1,
                                 y: height + this._size - 1});
        var row, col;
        for (col = start.col; col <= end.col + 1; col++) {
            for (row = start.row; row <= end.row + 1; row++)
                fn(this.coordinate({row: row, col: col}));
        }
        return this;
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

        start = this.coordinate({row: 0, col: 0});
        start.ring = (config && config.hasOwnProperty('rings')) ?
                     config.rings : 5;
        adding.push(start);

        while (adding.length > 0) {
            current = adding.pop();
            if (result.contains(current))
                continue;
            current.adjacent = [];
            current.exits = 0;

            this.neighbors(current, {coordinates: true}).forEach(
                function(node) {
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

    SquareGrid.prototype._coordinate = function(node) {
        // Return a node with a cartesian coordinate (x and y) for the
        // center of the square in the row and column specified within
        // node.  The return value will have the given row and column.
        return {x: node.col * this._size,
                y: node.row * this._size,
                row: node.row, col: node.col};
    };
    SquareGrid.prototype._position = function(node) {
        // Return a node with the row and column of the square in which
        // the cartesian coordinate (x and y) is contained.  The return
        // value will have an x and y value for the square center.
        var halfsize = this._size / 2;
        return {row: Math.floor((node.y + halfsize) / this._size),
                col: Math.floor((node.x + halfsize) / this._size)};
    };
    SquareGrid.prototype._neighbors = function(node) {
        // Return a list of neighbors for the row and column specified
        // in the given node.
        var halfsize = this._size / 2;
        var result = [{row: node.row, col: node.col + 1},
                      {row: node.row, col: node.col - 1},
                      {row: node.row + 1, col: node.col},
                      {row: node.row - 1, col: node.col}];
        if (this.diagonal)
            result = result.concat([
                {row: node.row + 1, col: node.col + 1, cost: _sqrt2},
                {row: node.row + 1, col: node.col - 1, cost: _sqrt2},
                {row: node.row - 1, col: node.col + 1, cost: _sqrt2},
                {row: node.row - 1, col: node.col - 1, cost: _sqrt2}]);
        return result;
    };
    SquareGrid.prototype._pairpoints = function(nodeA, nodeB) {
        // Diagonal neighbors need special treatment because the base
        // implemenation assumes two points
        return (((nodeA.row - nodeB.row) * (nodeA.row - nodeB.row) +
                  (nodeA.col - nodeB.col) * (nodeA.col - nodeB.col) > 1) ?
                [{x: nodeA.x + (nodeB.x - nodeA.x) / 2,
                  y: nodeA.y + (nodeB.y - nodeA.y) / 2}] :
                BaseGrid.prototype._pairpoints.call(this, nodeA, nodeB));
    };
    SquareGrid.prototype.points = function(node) {
        // Given a node with the coordinates for the center of a square,
        // return a set of coordinates for each of its vertices.
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
    TriangleGrid.prototype._coordinate = function(node) {
        // Return a node with a cartesian coordinate (x and y) for the
        // center of the triangle in the row and column specified
        // within node.  The return value will have the given row and
        // column as well.
        var offset = ((node.row + node.col) % 2) ?
                    -this.centerh : 0;
        return {x: node.col * this._size / 2,
                y: (node.row * this.rowh) + offset,
                row: node.row, col: node.col};
    };

    TriangleGrid.prototype._position = function(node) {
        // Return a node with the row and column of the hexagon in
        // which the cartesian coordinate (x and y) is contained.  The
        // return value will have an x and y value for the center of
        // the hexagon.
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
        return {row: row, col: col};
    };

    TriangleGrid.prototype._neighbors = function(node) {
        // Return a list of neighbors for the row and column specified
        // in the given node.
        return [{row: node.row, col: node.col + 1},
                {row: node.row, col: node.col - 1},
                {row: node.row +
                   (((node.row + node.col) % 2) ? -1 : 1 ), col: node.col}];
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

    RTriangleGrid.prototype._coordinate = function(node) {
        // Return a node with a cartesian coordinate (x and y) for the
        // center of the cell in the row and column specified in node.
        // The return value will have the row and column.
        var halfsize = this._size / 2;
        var fifth = this._size / 5;
        var x_sign = (node.col % 2) ? 1 : -1;
        var y_sign = x_sign *
        ((!this.regular && ((node.row < 0) ^ (node.col < 0))) ?
        -1 : 1);
        var x = Math.floor(node.col / 2) * this._size +
                halfsize + fifth * x_sign;
        var y = node.row * this._size + halfsize + fifth * y_sign;
        return {row: node.row, col: node.col, x: x, y: y};
    };

    RTriangleGrid.prototype._position = function(node) {
        // Return a node with the row and column of the cell which
        // contains cartesian coordinate (x and y).  The return value
        // will have an x and y value for the square center.
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
        return {row: row, col: col};
    };

    RTriangleGrid.prototype._neighbors = function(node) {
        // Return a list of neighbors for the row and column specified
        // in the given node.
        var rmod = node.col % 2 ?  1 : -1;
        var cmod = node.col % 2 ? -1 :  1;
        if (!this.regular) {
            rmod *= ((node.row < 0) ^ (node.col < 0)) ? -1 : 1;
            cmod *= ((node.row < 0) ^ (node.row + rmod < 0)) ? 0 : 1;
        }
        return [{row: node.row, col: node.col + 1},
                {row: node.row, col: node.col - 1},
                {row: node.row + rmod, col: node.col + cmod}];
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

    // Return a node with a cartesian coordinate (x and y) for the
    // center of the hexagon in the row and column specified within
    // node.  The return value will have the given row and column.
    HexGrid.prototype._coordinate = function(node) {
        // At the origin is the center of the 0, 0 hexagon.  Others
        // are tessellated around it in all directions.
        var result = {row: node.row, col: node.col};
        result[this.alpha] = (node[this.col] * this.hexw +
                              this.hexw / 2 *
            Math.abs(node[this.row] % 2));
        result[this.beta] = node[this.row] * this._size * 3 / 2;
        return result;
    };

    // Return a node with the row and column of the hexagon in
    // which the cartesian coordinate (x and y) is contained.  The
    // return value will have an x and y value for the hex center.
    HexGrid.prototype._position = function(node) {
        // Divide the space up into alpha and beta bands which
        // form a rectangular grid.  A hexagon spans two alpha
        // bands and three beta bands.  Four of the six bands
        // are simple but the last two have to be corrected if the
        // position crosses a diagonal boundary.
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
        var result = {};
        result[this.row] = row;
        result[this.col] = col;
        return result;
    };

    HexGrid.prototype._neighbors = function(node) {
        // Return a list of neighbors for the row and column specified
        // in the given node.
        var result = [
            {row: node.row + 1, col: node.col},
            {row: node.row - 1, col: node.col},
            {row: node.row, col: node.col + 1},
            {row: node.row, col: node.col - 1}];
        if (this.alpha == 'x') {
            result.push({row: node.row - 1, col: node.col +
                          ((node.row % 2) ? 1 : -1)});
            result.push({row: node.row + 1, col: node.col +
                          ((node.row % 2) ? 1 : -1)});
        } else {
            result.push({row: node.row + (node.col % 2 ? 1 : -1),
                         col: node.col - 1});
            result.push({row: node.row + (node.col % 2 ? 1 : -1),
                         col: node.col + 1});
        }
        return result;
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
        if (options && (options.height || options.width))
            result.center(options.width || 0, options.height || 0);
        return result;
    };

    grid.test = function(parent, viewport) {
        var self = document.createElement('canvas');
        (parent ? parent : document.body).appendChild(self);
        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.6)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
        var lineWidth = 0, lineFactor = 40;
        var numbers = false, combined = false;
        var instance;
        var tap, selected, drag, zooming, gesture, press = 0;

        if (!viewport)
            viewport = parent ? parent : window;

        var draw_id = 0;
        var draw = function() {
            if (!self.getContext) {
                alert('ERROR: canvas has no getContext');
                return;
            }
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
            ctx.clearRect(0, 0, width, height);

            // Create a grid
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.textAlign = 'center';
            ctx.font = 'bold ' + 12 + 'pt sans-serif';
            instance.map(width, height, function(node) {
                instance.draw(ctx, node); });
            ctx.fillStyle = style['background-color'];
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.stroke();
            if (combined)
                instance.map(width, height, function(node) {
                    ctx.fillStyle = color;
                    ctx.fillText(
                        ripple.pair(node.row, node.col),
                        node.x, node.y);
                });
            else if (numbers)
                instance.map(width, height, function(node) {
                    ctx.fillStyle = color;
                    ctx.fillText('(' + node.row + ', ' +
                                 node.col + ')', node.x, node.y);
                });

            if (selected) {
                // Coordinates of the selected square must be
                // updated in case the grid offsets have moved
                // since the last draw call.
                ctx.beginPath();
                instance.draw(ctx, instance.coordinate(selected));
                ctx.fillStyle = colorSelected;
                ctx.fill();

                neighbors = instance.neighbors(
                    selected, {coordinates: true, points: true});
                ctx.beginPath();
                neighbors.forEach(function(neighbor) {
                    instance.draw(ctx, neighbor); });
                ctx.fillStyle = colorNeighbor;
                ctx.fill();

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

                    ctx.strokeStyle = colors[index % colors.length];
                    ctx.stroke();
                });
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

                tap = undefined; selected = undefined;
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

        // Calculate square distance
        var sqdist = function(nodeA, nodeB) {
            return ((nodeB.x - nodeA.x) * (nodeB.x - nodeA.x) +
                    (nodeB.y - nodeA.y) * (nodeB.y - nodeA.y));
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
            var targets = ripple.getInputPoints(self, event);
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
                        diameter: Math.sqrt(sqdist(t0, t1)),
                        x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2,
                        size: instance.size(),
                        offset: instance.offset()};
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                tap = drag = targets;
                selected = instance.position(tap);

                // Show a menu on either double tap or long press.
                // There are some advantages to using a native double
                // click event on desktop platforms (for example, the
                // timing can be linked to operating system
                // accessibility) but here testing is what matters.
                var now = new Date().getTime();
                if (gesture && gesture.time > now &&
                    sqdist(tap, gesture) < 225) {
                    gesture = undefined;
                    menuate(tap);
                } else {
                    gesture = {time: now + 600, x: tap.x, y: tap.y};
                    press = setTimeout(function() { menuate(tap); },
                                       1000);
                }
            }

            redraw();
            return false;
        };
        self.addEventListener('mousedown', downEvent);
        self.addEventListener('touchstart', downEvent);
        var moveEvent = function(event) {
            if (drag) {
                animation.stop();
                tap = ripple.getInputPoints(self, event);
                var goff = instance.offset();
                instance.offset(goff.left + tap.x - drag.x,
                                goff.top + tap.y - drag.y);
                if ((sqdist(drag, tap) > 125) && press)
                    clearTimeout(press);
                redraw();
                drag = tap;
            }
            if (zooming) {
                animation.stop();
                var targets = ripple.getInputPoints(self, event);
                var factor;
                if (zooming.diameter && targets.targets.length == 2) {
                    var t0 = targets.targets[0];
                    var t1 = targets.targets[1];
                    var diameter = Math.sqrt(sqdist(t0, t1));
                    factor = diameter / zooming.diameter;
                }
                if (factor && factor > 0)
                    zoom(zooming.offset.left, zooming.offset.top,
                         zooming.size,
                         zooming.x, zooming.y, factor);
            }
            return false;
        };
        self.addEventListener('mousemove', moveEvent);
        self.addEventListener('touchmove', moveEvent);
        var upEvent = function(event) {
            drag = zooming = undefined;
            if (press) { clearTimeout(press); press = 0; }
            return false;
        };
        self.addEventListener('mouseleave', upEvent);
        self.addEventListener('mouseup', upEvent);
        self.addEventListener('touchend', upEvent);
    };

}).call(this, typeof exports === 'undefined' ?
        (this.grid = {}) : ((typeof module !== undefined) ?
                            (module.exports = exports) : exports));
