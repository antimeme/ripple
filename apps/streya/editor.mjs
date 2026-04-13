// streya/editor.mjs
// Copyright (C) 2025 by Jeff Gold.
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
// Streya editor for ships and buildlings.
import Ripple   from "../ripple/ripple.mjs";
import Grid     from "../ripple/grid.mjs";
import Pathf    from "../ripple/pathf.mjs";
import Setting, { Structure } from "./setting.mjs";

/**
 * Convert a node with numeric row and col fields into a single
 * integer suitable for use as an object key. */
function getNodeIndex(node)
{ return Ripple.pair(node.col, node.row); }

function getIndexNode(index) {
    const pair = Ripple.unpair(index);
    return { col: node.x, row: node.y };
}

export default class Editor {
    constructor(setting, scenario) {
        
    }

    setStructure(structure) {
    }

    get active() { return true };
    get autofill() { return true };
    get autozoom() { return { min: 1, max: 20 } };
    autodrag(event) { };

    resize(event, camera) {  }

    dblclick(event, camera) {
    }

    mousedown(event, camera) {
        const point = camera.toWorld(camera.getPoint(event));
        console.log("BOOP", point);
    }

    mouseup(event, camera) {
    }

    usekeys = true;
    keydown(event, camera) {
    }

    #lastUpdate = undefined;

    update(now, camera) {
    }

    draw(ctx, camera) {
    }
}
