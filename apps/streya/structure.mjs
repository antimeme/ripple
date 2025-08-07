// structure.mjs
// Copyright (C) 2021-2025 by Jeff Gold.
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
import { Inventory } from "./setting.mjs";

/**
 * Convert a node with numeric row and col fields into a single
 * integer suitable for use as an object key. */
function getNodeIndex(node)
{ return Ripple.pair(node.col, node.row); }

function getIndexNode(index) {
    const pair = Ripple.unpair(index);
    return { col: node.x, row: node.y };
}

export default class Structure {
    #name;
    #offset;
    #defaultLevel = 0;
    #cellData;
    #floorColor;

    constructor(structure, setting) {
        this.#name       = structure.name;
        this.#offset     = structure.offset;
        this.#floorColor = structure.floorColor;
        this.#cellData   = {};
        if (Array.isArray(structure.cellData))
            structure.cellData.forEach(node =>
                this.setCell(node, {
                    floorColor: node.floorColor,
                    inventory: new Inventory(
                        node.inventory, setting) }));
    }

    connect(setting) {
        Object.keys(this.#cellData).forEach(level =>
            Object.keys(this.#cellData[level]).forEach(index =>
                this.#cellData[level][index]
                    .inventory.connect(setting)));
    }

    toJSON() {
        const result = {};
        if (this.#offset)
            result.offset = this.#offset;
        if (this.#floorColor)
            result.floorColor = this.#floorColor;
        if (this.#cellData) {
            result.cellData = [];
            Object.keys(this.#cellData).forEach(level => {
                Object.keys(this.#cellData[level]).forEach(index => {
                    const cell = this.#cellData[level][index];
                    const node = getIndexNode(index);
                    if (cell.inventory && cell.inventory.length)
                        node.inventory = cell.inventory.toJSON();
                    if (cell.floorColor)
                        node.floorColor = cell.floorColor;
                    result.cellData.push(node);
                });
            });
        }
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }    

    get floorColor() { return this.#floorColor; }

    get offset() { return this.#offset; }

    /**
     * Retrieves the contents of a specified node. */
    getCell(node) {
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("first argument must have numeric " +
                            "row and col fields");
        const level = isNaN(node.level) ?
                      this.#defaultLevel : node.level;
        return (level in this.#cellData) ?
               this.#cellData[level][getNodeIndex(node)] : undefined;
    }

    /**
     * Replaces the contents at specified node with the value given. */
    setCell(node, value) {
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("row and col must be numeric");
        const index = getNodeIndex(node);
        const level = isNaN(node.level) ?
            this.#defaultLevel : level;

        if (!(level in this.#cellData))
            this.#cellData[level] = {};

        if (typeof(value) === "undefined")
            delete this.#cellData[level][index];
        else this.#cellData[level][index] = value;
        return this;
    }
}
