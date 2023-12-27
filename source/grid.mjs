// grid.mjs
// Copyright (C) 2013-2023 by Jeff Gold.
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
// Create a grid by calling the Grid.create method:
//
//     import Grid from "ripple/grid.mjs";
//     const g = Grid.create({type: "square", edge: 20});
//
// This creates a square grid with an edge length of twenty units.
// Instead, you could specify a radius.  This should give a more
// similar cell size among different grid types.
//
//     const g = Grid.create({type: "hex", radius: 15});
//
// This creates a hexagonal grid with a radius of fifteen units.
//
// Often it is useful to know which grid cell corresponds to some
// point in two dimensional space.  For example, this is useful for
// determining which cell a mouse click landed on.  The markCell()
// method does this:
//
//     const cell = g.markCell({x: 202, y: 115});
//     console.log("row:", cell.row, "col:", cell.col);
//
// The markCenter method puts the x and y coordinates of the center
// of the grid cell, overwriting any previous values:
//
//     const cell = g.markCenter({row: 3, col: 5});
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
//     g.eachNeighbor(cell, neighbor => {
//         console.log("row:", neighbor.row, "col:": neighbor.col); });
//
// Use the getPairPoints method to retrieve the line segment shared
// between two neighboring cells.  In some cases, such as diagonal
// neighbors in square grids, neighbors share only a single point.
// In both cases an array with the appropriate number of points will
// be returned.  Check the length.
//
// Iteration over all cells along a line segment is supported with the
// eachSegement() method:
//
//     g.eachSegment(cellStart, cellEnd,
//         cell => {console.log("row:", cell.row, "col:", cell.col);});
//
// Another option is to map over a rectangual area of cells.  The
// mapRectangle() method does this:
//
//     g.mapRectangle(
//         {x: 22, y: -144}, {x: 405, y: 255},
//         cell => {console.log("row:", cell.row, "col:", cell.col);});
//
// Note that the grid does not support offsets.  You will need to use
// some other method of transforming coordinates as necessary.
import { zeroish, pair, unpair } from "./ripple.mjs";
const sqrt2 = Math.sqrt(2);
const sqrt3 = Math.sqrt(3);
const sqrt5 = Math.sqrt(5);

/**
 * Return the sum of the square of each argument */
function sumSquares() {
    let result = 0;
    for (let index = 0; index < arguments.length; ++index)
        if (!isNaN(arguments[index]))
            result += arguments[index] * arguments[index];
    return result;
}

/**
 * Given a pair of lines each described by a pair of points, returns
 * the point at which the lines intersect.  Euclidian space is assumed
 * so If the lines have the same slope they either don't intersect or
 * are the same line. */
function intersect2D(s, e, p, q) {
    let result = undefined;
    const denominator = ((e.y - s.y) * (p.x - q.x) -
                         (p.y - q.y) * (e.x - s.x));
    if (!zeroish(denominator)) {
        const x = (((s.x * (e.y - s.y) * (p.x - q.x)) -
                    (q.x * (p.y - q.y) * (e.x - s.x)) -
                    (s.y - q.y) * (e.x - s.x) * (p.x - q.x)) /
            denominator);
        result = { x: x,
                   y: zeroish(e.x - s.x) ?
                    ((p.y - q.y) * (x - q.x) / (p.x - q.x)) + q.y :
                    ((e.y - s.y) * (x - s.x) / (e.x - s.x)) + s.y};
    }
    return result;
}

/**
 * Given two points that make up a line segment return true iff
 * a third point lies between them. */
function between2D(start, end, point) {
    const dotSegP = ((end.x - start.x) * (point.x - start.x) + (
        end.y - start.y) * (point.y - start.y));
    return ((dotSegP >= 0) &&
            (dotSegP <= sumSquares(end.x - start.x, end.y - start.y)));
}

/**
 * Throws an error if the node does not contain numeric "row"
 * and "col" attributes */
function checkCell(node) {
    if (!node || isNaN(node.row) || isNaN(node.col))
        throw new Error("Node does not contain row and col: " + node);
    return node;
}

/**
 * Throws an error if the node does not contain numeric "x"
 * and "y" attributes */
function checkCoordinates(node) {
    if (!node || isNaN(node.x) || isNaN(node.y))
        throw new Error("Node does not contain x and y: " + node);
    return node;
}

class BaseGrid {
    /**
     * Every grid has an edge length and a radius.  The meaning
     * of these depends on the grid type but at least one of
     * them must be specified. */
    constructor(config) {
        this._setup(config);
        if (config && !isNaN(config.radius)) {
            this._radius = config.radius;
            this._edge   = this._findEdge(this._radius);
        } else if (config && !isNaN(config.edge)) {
            this._radius = this._findRadius(config.edge);
            this._edge   = config.edge;
        } else throw new Error(
            "Must specify grid size using either radius or edge");
        this._init(config);
    }

    // A concrete grid MUST override these
    _findRadius(edge)
    { throw new Error("BaseGrid findRadius is not valid"); }
    _findEdge(radius)
    { throw new Error("BaseGrid findEdge is not valid"); }
    _markCenter(node)
    { throw new Error("BaseGrid markCenter is not valid"); }
    _markCell(node)
    { throw new Error("BaseGrid markCell is not valid"); }
    _getNeighbors(node)
    { throw new Error("BaseGrid getNeighbors is not valid"); }
    _getPoints(node)
    { throw new Error("BaseGrid getPoints is not valid"); }

    // A concrete grid should consider overriding these
    _setup(config) {} // before BaseGrid configuration
    _init(config) {}  // after BaseGrid configuration
    _getPairPoints(nodeA, nodeB) {
        const midpoint = {x: (nodeB.x - nodeA.x) / 2,
                          y: (nodeB.y - nodeA.y) / 2};
        const rotated = {x: (nodeA.y - nodeB.y) / 2,
                         y: (nodeB.x - nodeA.x) / 2};
        const factor = this._edge / (2 * Math.sqrt(
            sumSquares(rotated.x, rotated.y)));
        const scaled = {x: rotated.x * factor,
                        y: rotated.y * factor};
        return [{x: nodeA.x + midpoint.x + scaled.x,
                 y: nodeA.y + midpoint.y + scaled.y},
                {x: nodeA.x + midpoint.x - scaled.x,
                 y: nodeA.y + midpoint.y - scaled.y}];
    }

    // Guarantees a node with cell data from coordinates
    _checkNodePoint(node) {
        if (!node || isNaN(node.x) || isNaN(node.y))
            throw new Error("Node has no coordinates: " + node);
        const result = {row: node.row, col: node.col,
                        x: node.x, y: node.y, z: node.z};
        if (isNaN(result.row) || isNaN(result.col))
            this._markCell(result);
        return result;
    }

    // Guarantees a node with cell data
    _checkNodeCell(node) {
        let result = undefined;
        if (!node) {
            throw new Error("Node is not valid: " + node);
        } else if (!isNaN(node.row) && !isNaN(node.col)) {
            result = {row: node.row, col: node.col};
        } else if (!isNaN(node.x) && !isNaN(node.y)) {
            result = {x: node.x, y: node.y, z: node.z};
            this._markCell(result);
        } else throw new Error("Node has no data: " + node);
        return result;
    }

    // Guarantees a node with both cell and coordinate data
    _checkNodeCenter(node) {
        const result = this._checkNodeCell(node);
        this._markCenter(result);
        return result;
    }

    /**
     * Returns the radius of a single cell */
    getRadius() { return this._radius; }

    /**
     * Returns the length of a cell edge */
    getEdge() { return this._edge; }

    /**
     * Return an identifier for a node with row and col properties */
    getID(node) { checkCell(node); return pair(node.row, node.col); }

    /**
     * Set the value of the "id" property on node to an identifier
     * useful for storing in an object without conflicting with
     * other possible nodes. */
    markID(node) { node.id = this.getID(node); return node; }

    /**
     * Given a node with row and col properties, set the x and y
     * coordinates of the center of that node in place */
    markCenter(node)
    { this._markCenter(checkCell(node)); return node; }

    /**
     * Given a node with x and y properties, set the row and col
     * properties of the cell the coordinates fall within */
    markCell(node)
    { this._markCell(checkCoordinates(node)); return node; }

    /**
     * Given a node with row and col properties, return a new node
     * with the same row and col but with x and y set to the
     * coordinates of the center of the node */
    getCenter(node)
    { return this.markCenter({row: node.row, col: node.col}); }

    /**
     * Given a node with coordinates, return a new node with the same
     * row and col but with x and y set to the coordinates of the
     * center of the node */
    getCell(node)
    { return this.markCell({x: node.x, y: node.y, z: node.z}); }

    /**
     * Returns a set of points that make up a grid cell.  Provided
     * node must either have row and column attributes (in which case
     * any provided coordinates are ignored) or have coordinates
     * (which need not be the center of a cell) */
    getPoints(node) {
        if (isNaN(node.row) || isNaN(node.col))
            node = this.getCell(checkCoordinates(node));
        return this._getPoints(this.getCenter(node));
    }

    /**
     * Call a specified function on each neighbor of the provided node.
     * Arguments to the function are the current neighbor for
     * consideration, the zero-based index of the neighbor, the
     * original node for which neighbors are being iterated and
     * the grid over which this is happening:
     *
     *     fn(neighbor, index, grid, node)
     *
     * Each neighbors has the following properties:
     *
     *     row: integer position within grid
     *     col: integer position within grid
     *     diagonal: truthy for vertex neighbors
     *     cost: number representing relative distance
     *
     * A truthy return from the provided function will terminate the
     * process so the function won't be called again. */
    eachNeighbor(node, fn, context) {
        if (!fn)
            return this._getNeighbors(node);

        const base = this._checkNodeCell(node);
        const neighbors = this._getNeighbors(base);
        let done = false;
        neighbors.forEach((neighbor, index) => {
            if (done)
                return;
            if (fn.call(context, neighbor, index, this, node))
                done = true;
        });
        return context;
    }

    /**
     * Return truthy iff nodeA and nodeB are neighbors */
    isAdjacent(nodeA, nodeB) {
        nodeB = this._checkNodeCell(nodeB);
        return this._getNeighbors(nodeA).some(neighbor =>
            ((neighbor.row === nodeB.row) &&
             (neighbor.col === nodeB.col)));
    }

    /**
     * Returns a set of points that make up a grid cell */
    getPairPoints(nodeA, nodeB) {
        return this._getPairPoints(
            this._checkNodeCenter(nodeA),
            this._checkNodeCenter(nodeB));
    }

    /**
     * Given start and end nodes with coordinates, call a function
     * for each cell that contains any portion of the line segment
     * formed by those coordinates.  A truthy return from the
     * provided function will terminate the process so the function
     * won't be called again. */
    eachSegment(start, end, fn, context) {
        if (!fn)
            return this.eachSegment(start, end, node =>
                { this.push(node); }, []);

        const visited = {};
        const end_node = this.getCell(end);
        let current = this.getCell(start);
        let index = 0;

        do {
            this.markID(current);
            if (fn.call(context, current, index++, this, start, end))
                return context;
            visited[current.id] = current;

            let next = null;
            this._getNeighbors(current).forEach(neighbor => {
                if (next || visited[this.getID(neighbor)])
                    return;
                const points = this.getPairPoints(current, neighbor);
                if (points.length < 2)
                    return;

                const crossing = intersect2D(
                    start, end, points[0], points[1]);
                if (crossing &&
                    between2D(points[0], points[1], crossing) &&
                    between2D(start, end, crossing))
                    next = neighbor;
            });
            current = next;
        } while (current && ((current.row !== end_node.row) ||
                             (current.col !== end_node.col)));
        return context;
    }

    /**
     * Given start and end nodes with coordinates, call a function
     * for each cell that overlaps with the rectangle described
     * by those coordinates */
    mapRectangle(start, end, fn, context) {
        if (!fn)
            return this.mapRectangle(start, end, node =>
                { this.push(node) }, []);
        checkCoordinates(start);
        checkCoordinates(end);
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        const queue   = [];
        const visited = {}; // ensure no repeat visits
        let   index   = 0;
        const self    = this;
        function visit(node) {
            self.markID(node);
            if (visited[node.id])
                return;
            self._markCenter(node);
            if (fn.call(context, node, index++, self, start, end))
                index = -1;
            visited[node.id] = node;

            self._getNeighbors(node).forEach(neighbor => {
                self._markCenter(self.markID(neighbor));
                if (!visited[neighbor.id] &&
                    (neighbor.x >= minX) && (neighbor.x <= maxX) &&
                    (neighbor.y >= minY) && (neighbor.y <= maxY)) {
                    queue.push(neighbor);
                }
            });
        }

        // Follow the rectangle marked by start and end
        if (index >= 0)
            this.eachSegment({x: start.x, y: start.y},
                             {x: start.x, y: end.y}, visit);
        if (index >= 0)
            this.eachSegment({x: start.x, y: end.y},
                             {x: end.x, y: end.y}, visit);
        if (index >= 0)
            this.eachSegment({x: end.x, y: end.y},
                             {x: end.x, y: start.y}, visit);
        if (index >= 0)
            this.eachSegment({x: end.x, y: start.y},
                             {x: start.x, y: start.y}, visit);
        while ((index >= 0) && (queue.length > 0))
            visit(queue.shift());
        return context;
    }

    /**
     * Given a node with coordinates, return the neighboring
     * node that shares the edge closest to those coordinates */
    getEdgeNeighbor(node) {
        const start = this._checkNodePoint(node);

        const neighbor = this._getEdgeNeighbor(start);
        this._markCenter(start);
        this._markCenter(neighbor);
        neighbor.edge = this._getPairPoints(start, neighbor);
        neighbor.peer = start;
        start.peer = neighbor;
        start.edge = neighbor.edge;
        return neighbor;
    }
    _getEdgeNeighbor(node) {
        const self   = this;
        let best     = undefined;
        let shortest = undefined;
        this._getNeighbors(node).forEach(neighbor => {
            self._markCenter(neighbor);
            const dSquared = sumSquares(
                neighbor.x - node.x, neighbor.y - node.y);
            if (!best || (dSquared < shortest))
                best = neighbor, shortest = dSquared;
        });
        return best;
    }

    /**
     * Given an HTML Canvas 2D context and a node, follow the shape of
     * the cell.  Note that this does not stroke or fill with any
     * color and that calling this without doing one or both of those
     * afterward will not render anything. */
    drawNode(ctx, node) {
        const points = this.getPoints(node);
        // Any sensible grid will provide at least three points
        // for any cell.  A test is done here to support drawing
        // a base grid for debugging purposes.
        if (points.length > 1) {
            points.forEach((point, index) => {
                if (!index)
                    ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
        } else if (points.length === 1) {
            const radius = this.getRadius();
            ctx.moveTo(points[0].x + radius / 2,
                       points[0].y);
            ctx.arc(points[0].x, points[0].y,
                    radius / 2, 0, 2 * Math.PI);
        }
    }

    /**
     * Removes the first level of grid adapter, if any */
    getUnderlyingGrid() { return this._getUnderlyingGrid(); }
    _getUnderlyingGrid() { return this; }
}

class SquareGrid extends BaseGrid {
    constructor(config) { super(config); }
    _init(config) {
        this.diagonal = (config && config.diagonal) ?
                        config.diagonal : false;
    }

    _findRadius(edge) { return edge / sqrt2; }
    _findEdge(radius) { return radius * sqrt2; }

    _markCenter(node) {
        node.x = node.col * this._edge;
        node.y = node.row * this._edge;
    }
    _markCell(node) {
        const halfedge = this._edge / 2;
        node.row = Math.floor((node.y + halfedge) / this._edge);
        node.col = Math.floor((node.x + halfedge) / this._edge);
    }

    _getNeighbors(node) {
        // Neighbors are provided clockwise from the top
        const result = [];
        result.push({row: node.row - 1, col: node.col, cost: 1});
        if (this.diagonal)
            result.push({row: node.row - 1, col: node.col + 1,
                         cost: sqrt2, diagonal: true});
        result.push({row: node.row, col: node.col + 1, cost: 1});
        if (this.diagonal)
            result.push({row: node.row + 1, col: node.col + 1,
                         cost: sqrt2, diagonal: true});
        result.push({row: node.row + 1, col: node.col, cost: 1});
        if (this.diagonal)
            result.push({row: node.row + 1, col: node.col - 1,
                         cost: sqrt2, diagonal: true});
        result.push({row: node.row, col: node.col - 1, cost: 1});
        if (this.diagonal)
            result.push({row: node.row - 1, col: node.col - 1,
                         cost: sqrt2, diagonal: true});
        return result;
    }

    _getPoints(node) {
        const halfedge = this._edge / 2;
        return [{x: node.x - halfedge, y: node.y - halfedge},
                {x: node.x + halfedge, y: node.y - halfedge},
                {x: node.x + halfedge, y: node.y + halfedge},
                {x: node.x - halfedge, y: node.y + halfedge}];
    }

    _getPairPoints(nodeA, nodeB) {
        const result = [];
        const halfedge = this._edge / 2;
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
    }
}

class HexGrid extends BaseGrid {
    constructor(config) { super(config); }
    _init(config) {
        this._hexw = sqrt3 * this._radius;
        this.point = (config && ("point" in config)) ?
                     config.point : false;
        if (this.point) {
            this._adjustCoords = node => node;
            this._adjustCell   = node => node;
        } else {
            this._adjustCoords = node => {
                const swap = node.x;
                node.x = node.y;
                node.y = swap;
                return node;
            };
            this._adjustCell = node => {
                const swap = node.row;
                node.row = node.col;
                node.col = swap;
                return node;
            };
        }
    }

    _findRadius(edge) { return edge; }
    _findEdge(radius) { return radius; }

    _markCenter(node) {
        this._adjustCell(node);
        node.x = (node.col * this._hexw +
                  this._hexw / 2 * Math.abs(node.row % 2));
        node.y = node.row * this._radius * 3 / 2;
        this._adjustCoords(node);
        this._adjustCell(node);
    }
    _markCell(node) {
        this._adjustCoords(node);
        const x_band = node.x * 2 / this._hexw;
        const y_band = node.y / (this._edge / 2);
        let row = Math.floor((y_band + 1) / 3);
        let col = Math.floor((x_band + (row % 2 ? 0 : 1)) / 2);

        if ((Math.floor(y_band) + 2) % 3 === 0) {
            const x_fraction = ((x_band % 1) + 1) % 1;
            const y_fraction = ((y_band % 1) + 1) % 1;
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
    }

    _getNeighbors(node) {
        // Neighbors are provided clockwise from the top left.
        const result = [];
        if (this.point && (node.row % 2)) {
            result.push({row: node.row - 1, col: node.col + 1});
            result.push({row: node.row,     col: node.col + 1});
            result.push({row: node.row + 1, col: node.col + 1});
            result.push({row: node.row + 1, col: node.col});
            result.push({row: node.row,     col: node.col - 1});
            result.push({row: node.row - 1, col: node.col});
        } else if (this.point && !(node.row % 2)) {
            result.push({row: node.row - 1, col: node.col});
            result.push({row: node.row,     col: node.col + 1});
            result.push({row: node.row + 1, col: node.col});
            result.push({row: node.row + 1, col: node.col - 1});
            result.push({row: node.row,     col: node.col - 1});
            result.push({row: node.row - 1, col: node.col - 1});
        } else if (node.col % 2) {
            result.push({row: node.row - 1, col: node.col});
            result.push({row: node.row,     col: node.col + 1});
            result.push({row: node.row + 1, col: node.col + 1});
            result.push({row: node.row + 1, col: node.col});
            result.push({row: node.row + 1, col: node.col - 1});
            result.push({row: node.row,     col: node.col - 1});
        } else {
            result.push({row: node.row - 1, col: node.col});
            result.push({row: node.row - 1, col: node.col + 1});
            result.push({row: node.row,     col: node.col + 1});
            result.push({row: node.row + 1, col: node.col});
            result.push({row: node.row,     col: node.col - 1});
            result.push({row: node.row - 1, col: node.col - 1});
        }
        result.forEach(neighbor => { neighbor.cost = 1; });
        return result;
    }

    _getPoints(node) {
        const p = this._adjustCoords;
        const perp     = this._hexw / 2;
        const halfedge = this._edge / 2;
        node = this._adjustCoords({x: node.x, y: node.y});

        return [p({x: node.x,        y: node.y - this._edge}),
                p({x: node.x + perp, y: node.y - halfedge}),
                p({x: node.x + perp, y: node.y + halfedge}),
                p({x: node.x,        y: node.y + this._edge}),
                p({x: node.x - perp, y: node.y + halfedge}),
                p({x: node.x - perp, y: node.y - halfedge})];
    }
}

class TriangleGrid extends BaseGrid {
    constructor(config) { super(config); }
    _init(config) {
        this.diagonal = (config && config.diagonal) ?
                        config.diagonal : false;
        this._rowh    = this._edge * sqrt3 / 2;
        this._centerh = this._edge * sqrt3 / 6;
    }

    _findRadius(edge) { return edge * sqrt3 / 3; }
    _findEdge(radius) { return radius * 3 / sqrt3; }

    _markCenter(node) {
        node.x = node.col * this._edge / 2;
        node.y = node.row * this._rowh - ((
            (node.row + node.col) % 2) ? this._centerh : 0);
    }
    _markCell(node) {
        const halfedge = this._edge / 2;
        const row = Math.floor((node.y + this._radius) / this._rowh);
        let   col = Math.floor(node.x / halfedge);
        const xfrac = node.x / halfedge;
        const yfrac = (node.y + this._radius) / this._rowh;
        if ((row + col) % 2) {
            if ((yfrac - Math.ceil(yfrac)) +
                            (xfrac - Math.floor(xfrac)) > 0)
                col += 1;
        } else if ((yfrac - Math.floor(yfrac)) -
                   (xfrac - Math.floor(xfrac)) < 0)
            col += 1;
        node.row = row;
        node.col = col;
    }

    _getNeighbors(node) {
        const result = [];
        if ((node.row + node.col) % 2) {
            result.push({row: node.row - 1, col: node.col});
            if (this.diagonal) {
                result.push({row: node.row - 1, col: node.col + 1,
                             diagonal: true});
                result.push({row: node.row - 1, col: node.col + 2,
                             diagonal: true});
                result.push({row: node.row,     col: node.col + 2,
                             diagonal: true});
            }
            result.push({row: node.row, col: node.col + 1});
            if (this.diagonal) {
                result.push({row: node.row + 1, col: node.col + 1,
                             diagonal: true});
                result.push({row: node.row + 1, col: node.col,
                             diagonal: true});
                result.push({row: node.row + 1, col: node.col - 1,
                             diagonal: true});
            }
            result.push({row: node.row, col: node.col - 1});
            if (this.diagonal) {
                result.push({row: node.row, col: node.col - 2,
                             diagonal: true});
                result.push({row: node.row - 1, col: node.col - 2,
                             diagonal: true});
                result.push({row: node.row - 1, col: node.col - 1,
                             diagonal: true});
            }
        } else {
            result.push({row: node.row, col: node.col + 1});
            if (this.diagonal) {
                result.push({row: node.row,     col: node.col + 2});
                result.push({row: node.row + 1, col: node.col + 2});
                result.push({row: node.row + 1, col: node.col + 1});
            }
            result.push({row: node.row + 1, col: node.col});
            if (this.diagonal) {
                result.push({row: node.row + 1, col: node.col - 1});
                result.push({row: node.row + 1, col: node.col - 2});
                result.push({row: node.row,     col: node.col - 2});
            }
            result.push({row: node.row, col: node.col - 1});
            if (this.diagonal) {
                result.push({row: node.row - 1, col: node.col - 1});
                result.push({row: node.row - 1, col: node.col});
                result.push({row: node.row - 1, col: node.col + 1});
            }
        }
        return result;
    }

    _getPairPoints(nodeA, nodeB) {
        if ((Math.abs(nodeA.row - nodeB.row) +
             Math.abs(nodeA.col - nodeB.col) > 1) ||
            ((nodeA.col === nodeB.col) &&
             (nodeB.row === nodeA.row + ((nodeA.row + nodeA.col) % 2 ?
                                         1 : -1)))) {
            let result = undefined;
            let best = undefined;
            this._getPoints(nodeA).forEach(point => {
                const current =
                    ((nodeB.x - point.x) * (nodeB.x - point.x) +
                     (nodeB.y - point.y) * (nodeB.y - point.y));
                if (isNaN(best) || (best > current)) {
                    result = point;
                    best = current;
                }
            });
            return [result];
        } else return super._getPairPoints(nodeA, nodeB);
    }

    _getPoints(node) {
        const direction = ((node.row + node.col) % 2) ? -1 : 1;
        return [{x: node.x, y: node.y - this._radius * direction},
                {x: node.x + this._edge / 2,
                 y: node.y + this._centerh * direction},
                {x: node.x - this._edge / 2,
                 y: node.y + this._centerh * direction}];
    }
}

class WedgeGrid extends BaseGrid {
    constructor(config) { super(config); }
    _init(config) {
        this.diamond = (config && ("diamond" in config)) ?
                       config.diamond : false;
    }

    _findRadius(edge) { return edge / sqrt2; }
    _findEdge(radius) { return radius * sqrt2; }

    _markCenter(node) {
        const halfsize = this._edge / 2;
        const fifth = this._edge / 5;
        const x_sign = (node.col % 2) ? 1 : -1;
        const y_sign = x_sign * ((this.diamond && ((node.row < 0) ^
            (node.col < 0))) ? -1 : 1);
        node.x = Math.floor(node.col / 2) * this._edge +
                 halfsize + fifth * x_sign;
        node.y = node.row * this._edge + halfsize + fifth * y_sign;
    }

    _markCell(node) {
        const halfsize = this._edge / 2;
        const xband = node.x / this._edge;
        const yband = node.y / this._edge;
        const row = Math.floor(yband);
        let   col = Math.floor(xband) * 2;
        if (!this.diamond || !((row < 0) ^ (col < 0))) {
            if (Math.abs(xband - Math.floor(xband)) +
                Math.abs(yband - Math.floor(yband)) > 1)
                col += 1;
        } else if (Math.abs(xband - Math.floor(xband)) -
                   Math.abs(yband - Math.floor(yband)) > 0)
            col += 1;

        node.row = row;
        node.col = col;
    }

    _getNeighbors(node) {
        const result = [];
        let rmod = node.col % 2 ?  1 : -1;
        let cmod = node.col % 2 ? -1 :  1;
        if (this.diamond) {
            rmod *= ((node.row < 0) ^ (node.col < 0)) ? -1 : 1;
            cmod *= ((node.row < 0) ^ (node.row + rmod < 0)) ? 0 : 1;
        }
        result.push({row: node.row, col: node.col + 1});
        result.push({row: node.row, col: node.col - 1});
        result.push({row: node.row + rmod, col: node.col + cmod});
        return result;
    }

    _getPoints(node) {
        const halfsize = this._edge / 2;
        const fifth = this._edge / 5;
        const x_sign = (node.col % 2) ? 1 : -1;
        const y_sign = x_sign *
        ((this.diamond && ((node.row < 0) ^ (node.col < 0))) ?
        -1 : 1);
        const corner = Math.abs(node.col % 2) * this._edge;
        const x = node.x - (halfsize + x_sign * fifth);
        const y = node.y - (halfsize + y_sign * fifth);
        return (y_sign == x_sign) ? [
            {x: x + corner, y: y + corner},
            {x: x + this._edge, y: y},
            {x: x, y: y + this._edge}] : [
                {x: x + this._edge * Math.abs(node.col % 2),
                 y: y + this._edge * Math.abs((node.col + 1) % 2)},
                {x: x, y: y}, {x: x + this._edge, y: y + this._edge}];
    }

    _getPairPoints(nodeA, nodeB) {
        let result = null;
        if ((nodeA.row !== nodeB.row) ||
            (nodeA.col + (nodeA.col % 2 ? -1 : 1) !== nodeB.col)) {
            const sign = (!this.diamond ||
                          ((nodeA.row < 0) === (nodeA.col < 0)));
            const points = this._getPoints(nodeA);
            result = [points[0], ((nodeA.row !== nodeB.row) ===
                (nodeA.col % 2 ? !sign : sign)) ?
                      points[1] : points[2]];
        } else {
            const midpoint = {x: (nodeB.x - nodeA.x) / 2,
                              y: (nodeB.y - nodeA.y) / 2};
            const rotated = {x: (nodeA.y - nodeB.y) / 2,
                             y: (nodeB.x - nodeA.x) / 2};
            const factor = sqrt2 * this._edge / (2 * Math.sqrt(
                sumSquares(rotated.x, rotated.y)));
            const scaled = {x: rotated.x * factor,
                            y: rotated.y * factor};
            result = [{x: nodeA.x + midpoint.x + scaled.x,
                       y: nodeA.y + midpoint.y + scaled.y},
                      {x: nodeA.x + midpoint.x - scaled.x,
                       y: nodeA.y + midpoint.y - scaled.y}];
        }
        return result;
    }
}

class AdapterGrid extends BaseGrid {
    constructor(underlying, toWorld, fromWorld)
    { super({
        radius: underlying.getRadius(),
        underlying, toWorld, fromWorld }); }
    _setup(config) {
        this.underlying = config.underlying;
        this.toWorld    = config.toWorld;
        this.fromWorld  = config.fromWorld;
    }
    _getUnderlyingGrid() { return this.underlying; }
    _findRadius(edge) { return this.underlying._findRadius(edge); }
    _findEdge(radius) { return this.underlying._findEdge(radius); }
    _markCenter(node) {
        this.underlying._markCenter(node);
        this.toWorld(node);
    }
    _markCell(node) {
        this.fromWorld(node);
        this.underlying._markCell(node);
        this.toWorld(node);
    }

    _getNeighbors(node)
    { return this.underlying._getNeighbors(node); }

    _getPoints(node) {
        this.fromWorld(node);
        const result = this.underlying._getPoints(node);
        result.forEach(this.toWorld);
        this.toWorld(node);
        return result;
    }

    _getPairPoints(nodeA, nodeB) {
        this.fromWorld(nodeA);
        this.fromWorld(nodeB);
        const result = this.underlying._getPairPoints(nodeA, nodeB);
        result.forEach(this.toWorld);
        this.toWorld(nodeA);
        this.toWorld(nodeB);
        return result;
    };

    _getEdgeNeighbor(node) {
        this.fromWorld(node);
        const result = this.underlying._getEdgeNeighbor(node);
        this.toWorld(node);
        this.toWorld(result);
        return result;
    }
}

function adaptGridIsometric(underlying) {
    return new AdapterGrid(underlying, node => {
        const x = node.x - node.y;
        const y = (node.x + node.y) / 2;
        node.x = x;
        node.y = y;
    }, node => {
        const x = (2 * node.y + node.x) / 2;
        const y = (2 * node.y - node.x) / 2;
        node.x = x;
        node.y = y;
    });
}

function adaptGridPerspective(underlying, focalLength,
                              distance) {
    const counter = 0;
    const position = {x: 0, y: 0, z: -10};
    const cx = {x: 1, y:    0, z:   0};
    const cy = {x: 0, y:  3/5, z: 4/5};
    const cz = {x: 0, y: -4/5, z: 3/5};

    function dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    };
    function add(a, b) {
        const result = {x: 0, y: 0, z: 0};
        for (const ii = 0; ii < arguments.length; ++ii) {
            result.x += arguments[ii].x;
            result.y += arguments[ii].y;
            result.z += arguments[ii].z;
        }
        return result;
    };
    function scale(a, v) {
        const result = {x: v.x, y: v.y, z: v.z};
        result.x *= a;
        result.y *= a;
        result.z *= a;
        return result;
    };

    return new AdapterGrid(underlying, node => {
        const d = add(position, cz,
                      scale(node.x, cx),
                      scale(node.y, cy))
        if (zeroish(d.z))
            throw new Error("Camera orientation is screwy");
        const factor = position.z / d.z;
        if ((++counter % 1000) === 0)
            console.log("DEBUG", node.x, node.y, "->",
                        position.x - factor * d.x,
                        position.y - factor * d.y);
        node.x = position.x - factor * d.x;
        node.y = position.y - factor * d.y;
    }, node => {
        const q = {x: node.x, y: node.y, z: 0};
        const denominator = dot(q, cz);
        if (zeroish(denominator))
            throw new Error("Camera orientation is screwy");
        node.x = dot(q, cx) / denominator;
        node.y = dot(q, cy) / denominator;
    });
}

function adaptGridRotate(underlying, radians) {
    const cosFactor = Math.cos(radians);
    const sinFactor = Math.sin(radians);

    return new AdapterGrid(underlying, node => {
        const x = node.x * cosFactor - node.y * sinFactor;
        const y = node.y * cosFactor + node.x * sinFactor;
        node.x = x;
        node.y = y;
    }, node => {
        const x = node.x * cosFactor + node.y * sinFactor;
        const y = node.y * cosFactor - node.x * sinFactor;
        node.x = x;
        node.y = y;
    });
}

export default {
    // Exposes grid types for use in user menus.  The first element of
    // each list is the grid name.  The second, if present, is the
    // option structure which creates that grid type.
    canonical: [
        {name: "Square(strict)", type: "square"},
        {name: "Square(diagonal)", type: "square", diagonal: true},
        {name: "Hex(point)", type: "hex", point: true},
        {name: "Hex(edge)", type: "hex", point: false},
        {name: "Triangle(strict)", type: "triangle"},
        {name: "Triangle(diagonal)", type: "triangle", diagonal: true},
        {name: "Wedge(regular)", type: "wedge"},
        {name: "Wedge(diamond)", type: "wedge", diamond: true},
    ],

    create: config => {
        const types = {
            "square":    SquareGrid,
            "hex":       HexGrid,
            "triangle":  TriangleGrid,
            "wedge":     WedgeGrid };
        const configType = (config && config.type) ?
                           config.type.toLowerCase() : undefined;
        let result = new ((configType in types) ? types[configType] :
                            SquareGrid)(config);
        if (config && !isNaN(config.rotate))
            result = adaptGridRotate(result, config.rotate);
        if (config && config.isometric)
            result = adaptGridIsometric(result);
        if (config && config.perspective)
            result = adaptGridPerspective(result, 2, 5);
        return result;
    }
};
