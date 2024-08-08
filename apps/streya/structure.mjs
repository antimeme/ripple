// structure.mjs
// Copyright (C) 2021-2024 by Jeff Gold.
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
// Classes for managing structures that characters might inhabit.
// This is primarily buildings within space stations and ships.
//
// One unit corresponds to one meter in this design.
import Ripple from "../ripple/ripple.mjs";
import Grid   from "../ripple/grid.mjs";
import Pathf  from "../ripple/pathf.mjs";

class Cell {
    constructor() {}

    get isObstructed() { return false; }
}

/**
 * Hull represents a boundary between a structure and the outside.
 * In most cases a single sentinel object should be used.  The
 * exception to this would be a hull that is damaged or otherwise
 * needs to store specific information. */
class Hull extends Cell {
    constructor() { }

    get isObstructed() { return false; }
    get isSentinel() { return true; }

    #sentinel = new Hull();
    static getSentinel() { return Hull.#sentinel; }
}

/**
 * A structure represents something characters might inhabit.
 * This is usually a building or a ship.  Rather than using a fixed
 * grid size this code reversibly pairs row and column numbers to
 * produce a positive integer cell identifier that is used as an
 * index into an object.
 *
 * <p>The following terms are important to understand when looking
 * at this code:</p><ul><li>
 *     node: object with integer row and col fields </li><li>
 *     node index: integer that uniquely identifies a cell </li><li>
 *     cell: object representing the contents of a single location
 * </li></ul> */
export class Structure {
    constructor(config) {
        this.#grid = Grid.create({
            type: "square", radius: 1,
            isometric: false, diagonal: true });
        this.#defaultLevel = 0;
        this.#cellData = {};
        this.#hullData = {};
    }

    #defaultLevel;
    #grid;

    // cellData contains the internal contents of the structure.
    // This is an object indexed first by level and then by a node
    // index.  So a cell on level 2 with row -3 and col 1 can
    // be retrieved as #cellData[2][Ripple.pair(1, -3)]
    #cellData;

    // hullData contains the boundary cells between the structure
    // and the outside.  This is organized just like cellData.
    #hullData;

    computeHull() {
        const newHullData = {};
        Object.keys(this.#cellData).forEach(level => {
            Object.keys(this.#cellData[level]).forEach(index => {
                const pair = Ripple.unpair(index);
                let node = { row: pair.y, col: pair.x, level: level };

                this.#grid.eachNeighbor(node, neighbor => {
                    neighbor.level = level;
                    if (!this.getCell(neighbor))
                        newHullData.#hullData[level][index] =
                            Hull.getSentinel();
                });
            });
        });
        this.#hullData = newHullData;
        return this;
    }

    getCell(node) {
        if (node && !isNaN(node.x) && !isNaN(node.y))
            node = this.#grid.getCell(node);
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("first argument must have numeric " +
                            "row and col fields");
        const index = Ripple.pair(node.col, node.row);
        const level = isNaN(node.level) ?
                      this.#defaultLevel : node.level;
        const contents = (level in this.#cellData) ?
                         this.#cellData[level][index] : undefined;
        return contents ? contents : (level in this.#hullData) ?
               this.#hullData[level][index] : undefined;
    }

    setCell(node, value) {
        if (node && !isNaN(node.x) && !isNaN(node.y))
            node = this.#grid.getCell(node);
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("first argument must have numeric " +
                            "row and col fields");
        const index = Ripple.pair(node.col, node.row);
        const level = isNaN(node.level) ?
                      this.#defaultLevel : node.level;
        if (!(level in this.#cellData))
            this.#cellData[level] = {};
        if (typeof(value) === "undefined")
            delete this.#cellData[level][index];
        else this.#cellData[level][index] = value;
        return this;
    }

    toJSON() {
        let cells = [];
        Object.keys(this.#cellData).forEach(level => {
            Object.keys(this.#cellData[level]).forEach(index => {
                const pair = Ripple.unpair(index);
                let cell = { row: pair.y, col: pair.x };
                if (level)
                    cell.level = level;
                cell.content = this.getCell(cell).toJSON();
                cells.push(cell);
            });
        });
        return {cells: cells};
    }

    draw(ctx, camera, now) {
        this.#grid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            (node, index, grid) => {
                var cell = this.getCell(node);
                if (cell)
                    cell.draw(ctx, node, grid, this);
        });
        // :TODO: draw walls between cells
        // :TODO: draw in order of decreasing row number
        // :TODO: 
    }
}

/**
 * A station is a rotating habitat which contains many structures.
 * Stations have cylindrical topology and represent a surface that
 * spins to create artificial gravity using centrifugal force.
 * Objects within the station are pressed against the surface due
 * to its rotation.  Stations usually have a reactor and docking
 * rings that are separate from the cylinder because these don't
 * need to rotate.  Special elevators accelerate passengers and
 * cargo that need to enter the habitat.
 *
 * <p>Here are some facts about artificial gravity created this way:
 * (https://en.wikipedia.org/wiki/Artificial_gravity).
 * Rotation at or less than two revolutions per minute should limit
 * inner ear problems for humans.  This means a rotation period of
 * at least thirty seconds.  According to the same source, the
 * rotation period T = 2π(r/a)^1/2 where r is the radius of the
 * station and a is the acceleration.  Plugging in 9.8 for
 * acceleration comparable to Earth gravity and assuming the
 * circumference of the cylinder contains six square districts
 * each with a side length of each with side length of 256 meters we
 * get a period of 31.38 seconds.  This means a station must have
 * at least six (possibly empty) districts along the axis that wraps
 * around in order to be comfortable.</p> */
export class Station {
    constructor(config) {
    }
}

export default Structure;
