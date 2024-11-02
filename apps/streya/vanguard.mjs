// vanguard.mjs
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
// An experimental implementation of a real-time game.
import Ripple   from "../ripple/ripple.mjs";
import Grid     from "../ripple/grid.mjs";
import Pathf    from "../ripple/pathf.mjs";
import Omnivore from "../ripple/omnivore.mjs";

/**
 * Given an object, choose one of its keys,  Without a second argument
 * all keys are equally likely to be chosen.  If provided the second
 * argument must be a function that accepts an object and a key and
 * returns a non-negative number to use as the weight for that key.
 * Keys are chosen with probability equal to their share of the total
 * weight.  So given keys "a" (weight 3) and "b" (weight 1) this
 * routine will choose "a" three quarters of the time. */
function chooseKey(object, getWeight = (o, k) => 1) {
    const choice = Math.random();
    let result = undefined;
    let total = 0;
    let used = 0;
    Object.keys(object).forEach(key =>
        { total += getWeight(object, key); });
    Object.keys(object).forEach(key => {
         const weight = getWeight(object, key);
        if (!result && (choice * total < used + weight)) {
            result = key;
        } else used += weight;
    });
    return result;
}

function createListItem(text) {
    const result = document.createElement("li");
    result.appendChild(document.createTextNode(text));
    return result;
}

class Radians {

    /**
     * Given a value in radians, returns an equivalent value that
     * is clamped between pi and minus pi. */
    static normalize(value) {
        while (value > Math.PI)
            value -= 2 * Math.PI;
        while (value <= -Math.PI)
            value += 2 * Math.PI;
        return value;
    }

    /**
     * Given start and end vectors or angles, returns the angle in
     * radians necessary to turn from the start to the end. */
    static difference(start, end) {
        let result = 0;
        if (!isNaN(start) && !isNaN(end)) {
            result = Radians.normalize(end - start);
        } else if (start && (typeof(start) === "object") &&
                   !isNaN(start.x) && !isNaN(start.y) &&
                   end && (typeof(end) === "object") &&
                   !isNaN(end.x) && !isNaN(end.y)) {
            const wedge = start.x * end.y - start.y * end.x;
            result = ((wedge > 0) ? 1 : -1) * Math.acos(
                (end.x * start.x + end.y * start.y) /
                Math.sqrt((start.x * start.x + start.y * start.y) *
                    (end.x * end.x + end.y * end.y)));
        } else throw new Error("invalid start or end: " +
                               JSON.stringify(start) + " :: " +
                               JSON.stringify(end));
        return result;
    }
}

function smootherStep(t)
{ return t * t * t * (6 * t * t - 15 * t + 10); }

class Race {
    constructor(racedef) {
        this._slots = racedef.slots ? racedef.slots : {};
        this._draw  = racedef.draw ? racedef.draw : [];
    }

    #finishStep(ctx, step, colors) {
        if (step.fill) {
            ctx.fillStyle = (colors && (step.fill in colors)) ?
                            colors[step.fill] : step.fill;
            ctx.fill();
        }
        if (step.stroke) {
            ctx.strokeStyle = (colors && (step.stroke in colors)) ?
                              colors[step.stroke] : step.stroke;
            ctx.stroke();
        }
    }

    drawTopDown(ctx, colors, now, phase) {
        // Drawing instructions consist of an array of step
        // objects.  Each must have an "op" field that describes
        // what to draw as well as parameters appropriate to that
        // operation.  In addition, there may be "period" and
        // "blink" fields to disable drawing on a periodic basis.
        // Period should be a positive number of milliseconds.  Blink
        // should be a number between zero and one that specifies how
        // much of the period should be omitted for drawing.

        this._draw.topDown.forEach(step => {
            if (!isNaN(step.period) && !isNaN(step.blink) &&
                (step.blink > Math.floor((
                    now + step.period * phase) %
                    step.period) / step.period)) {
            } else if ((step.op === "ellipse") &&
                       !isNaN(step.x)  && !isNaN(step.y) &&
                       !isNaN(step.rx) && !isNaN(step.ry)) {
                    ctx.beginPath();
                ctx.moveTo(step.x + step.rx, step.y);
                ctx.ellipse(step.x, step.y, step.rx, step.ry,
                            0, 0, 2 * Math.PI);
                this.#finishStep(ctx, step, colors);
            } else if ((step.op === "circle") && !isNaN(step.r) &&
                       !isNaN(step.x) && !isNaN(step.y)) {
                ctx.beginPath();
                ctx.moveTo(step.x + step.r, step.y);
                ctx.arc(step.x, step.y, step.r, 0, 2 * Math.PI);
                this.#finishStep(ctx, step, colors);
            }
        });
    }

    apply(character) {
        character._race = this;
        if (this._draw && this._draw.colors) {
            character._colors = Object.keys(
                this._draw.colors).reduce((colors, name) => {
                    const color = this._draw.colors[name];
                    if (typeof(color) === "string")
                        colors[name] = color;
                    else if (Array.isArray(color))
                        colors[name] = color[
                            Math.floor(Math.random() * color.length)];
                    else throw new TypeError(
                        "Unrecognized color type: " + typeof(color));
                    return colors;
                }, {});
        }
    }

    toJSON()
    { return { slots: this._slots, draw: this._draw }; }
}

class Character {
    constructor(config) {
        const period = 4500;
        this._cycle = {phase: Math.random() * period, period: period};

        this._position = {x: 0, y: 0};

        this._racename = (config && config.race) ?
                         config.race : undefined;
        if (!Character._races) {
            this._race = undefined;
        } else if (this._racename &&
                   (this._racename in Character._races)) {
            Character._races[this._racename].apply(this);
        } else if (!this._racename) {
            this._racename = chooseKey(Character._races, (o, k) =>
                isNaN(o[k].weight) ? 1 : o[k].weight);
            Character._races[this._racename].apply(this);
        } else this._race = undefined;
    }

    _spin = 0;
    _cycle; // state of idle animation

    _ship = undefined;
    _path = [];
    _pathStep = 0;
    _speed = 0.002;
    _angv  = 0.005;

    _colors = {base: "blue"};

    get position() { return this._position; }
    setPosition(position) { this._position = position; return this; }

    get ship() { return this._ship; }
    setShip(ship) {
        this._ship = ship;
        this._spin     = Math.random() * Math.PI * 2;
        this._spinGoal = Math.random() * Math.PI * 2;
        return this;
    }

    setPath(path) { this._path = path; return this; }

    pointAt(point) {
        this._spinGoal = Radians.difference({x: 0, y: 1}, {
            x: point.x - this._position.x,
            y: point.y - this._position.y });
        return this;
    }

    drawFace(ctx, now) {
        // TODO
    }

    drawTopDown(ctx, now) {
        ctx.save();
        ctx.translate(this._position.x, this._position.y);
        ctx.rotate(this._spin);
        if (!this._race) {
            const points = [
                {x: 0.45, y: 0.45}, {x: 0.45, y: -0.45},
                {x: -0.45, y: -0.45}, {x: -0.45, y: 0.45}];
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach(point => { ctx.lineTo(point.x, point.y); });
            ctx.closePath();

            ctx.fillStyle = this._colors.base;
            ctx.fill();
        } else this._race.drawTopDown(
            ctx, this._colors, now, this._cycle.phase);
        ctx.restore();
    }
    
    update(last, now) {
        const elapsed = isNaN(last) ? 0 : (now - last);

        if (this.ship && this._path && (this._path.length > 0)) {
            let distance = this._pathStep + this._speed * elapsed;
            let current = this.ship.grid.markCenter(this._position);
            let next = this.ship.grid.markCenter(this._path[0]);

            while (distance > 0) {
                let gap = Math.hypot(current.x - next.x,
                                     current.y - next.y);
                if (distance >= gap) {
                    distance -= gap;
                    current = this._path.shift();
                    if (this._path.length > 0) {
                        next = this.ship.grid.markCenter(this._path[0]);
                        this.pointAt(next);
                    } else {
                        this._path = [];
                        this._pathStep = 0;
                        distance = 0;
                    }
                } else {
                    const fraction = ((distance / gap) +
                                      smootherStep(distance / gap)) / 2;
                    current = {
                        row: current.row, col: current.col,
                        x: current.x + fraction * (next.x - current.x),
                        y: current.y + fraction * (next.y - current.y) };
                    this._pathStep = distance;
                    distance = 0;
                }
            }
            this._position = current;
        }

        if (this._spin != this._spinGoal) {
            const diff = Radians.difference(this._spin, this._spinGoal);
            const turn = this._angv * elapsed;
            if (turn > Math.abs(diff))
                this._spin = this._spinGoal;
            else this._spin += turn * (diff > 0 ? 1 : - 1);
        }
    }

    getCard() {
        const fieldset = document.createElement("fieldset");
        const contents = document.createElement("ul");
        const legend = document.createElement("legend");
        legend.appendChild(document.createTextNode(this.name));
        fieldset.appendChild(legend);
        fieldset.appendChild(contents);
        fieldset.classList.add("recruit");

        if (this.gender)
            contents.appendChild(createListItem(
                "Gender: " + this.gender));
        if (this.birthplace)
            contents.appendChild(createListItem(
                "Born: " + this.birthplace));
        if (this.culture)
            contents.appendChild(createListItem(
                "Culture: " + this.culture));
        contents.appendChild(document.createElement("hr"));
        this.background.forEach(
            b => { contents.appendChild(createListItem(b)) });

        return fieldset;
    }

    static createRecruit(setting) {
        const recruit = new Character();

        recruit.birthplace = chooseKey(setting.places);
        recruit.gender = chooseKey(
            {"Male": 1, "Female": 1}, (o, k) => o[k]);
        recruit.culture = chooseKey(
            setting.places[recruit.birthplace].population,
            (o, k) => o[k]);
        if (recruit.culture) {
            const namegen = Omnivore.createGrammar(
                setting.cultures[recruit.culture].namegen);
            recruit.name = namegen.generate(
                ((recruit.gender === "Male") ?
                 "fname_male" : "fname_female")) +
                           " " + namegen.generate("surname");
        }

        recruit.background = [];
        let current = chooseKey(setting.backgrounds, (o, k) =>
            o[k].recruit ? 1 : 0);
        while (current) {
            const previous = setting.backgrounds[current]?.previous;
            recruit.background.push(current);

            if (previous)
                current = chooseKey(previous);
            else current = undefined;
        }

        // :TODO: accumulate skills

        return recruit;
    }

    // Characters are driven by the setting, which is a JSON object
    // that must be loaded by calling `setup()` before calling the
    // constructor for the first time.
    static _races = {};
    static setup(setting) {
        for (const racename in setting.races)
            this._races[racename] = new Race(setting.races[racename]);
    }

    static app(setting) {
        Character.setup(setting);
        return {
            
        };
    }
}

/**
 * Convert a node with numeric row and col fields into a single
 * integer suitable for use as an object key. */
function getNodeIndex(node)
{ return Ripple.pair(node.col, node.row); };

// Compute the distance of each tile to outside the structure
var computeDistances = function(structure, grid) {
    var distances = {};
    var unresolved = [];

    var computeDistance = function(node, grid, structure) {
        var distance = distances[getNodeIndex(node)];
        grid.eachNeighbor(node, function(neighbor) {
            if (structure.getCell(neighbor)) {
                var peer = distances[getNodeIndex(neighbor)];
                if (peer && !isNaN(peer) &&
                    (!distance || isNaN(distance) ||
                     (distance > peer)))
                    distance = peer + 1;
            } else distance = 1;
        }, this);
        grid.eachNeighbor(node, function(neighbor) {
            var peer = distances[getNodeIndex(neighbor)];
            if (structure.getCell(neighbor) &&
                peer && !isNaN(peer) &&
                (peer > distance + 1)) {
                distances[getNodeIndex(neighbor)] = undefined;
                unresolved.push(neighbor);
            }
        }, this);

        if (distance)
            distances[getNodeIndex(node)] = distance;
        else unresolved.push(node);
    };

    structure.eachCell((contents, node, grid, structure) => {
        computeDistance(node, grid, structure);
    }, this);
    while (unresolved.length)
        computeDistance(unresolved.shift(), grid, structure);
    return distances;
};

// Base class for the contents of a cell in a ship or building.
// A cell knows whether it is obstructed.
class Cell {
    constructor(config) { this.init(config); }

    init(config) { }

    get isObstructed() { return false; }

    draw(ctx, node, grid, structure) {
        ctx.beginPath();
        grid.drawNode(ctx, node);
        if (structure.__selectedRoom &&
            structure.__selectedRoom.containsNode(node))
            ctx.fillStyle = "teal";
        else ctx.fillStyle = "lightslategray";
        ctx.fill();
    }
}

// A superposition is a cell with contents that have not yet
// been decided -- a place holder.
class Superposition extends Cell {
    init(config) {
        this.row = config && config.row || 0;
        this.col = config && config.col || 0;
    }
}

// A hull block separates a ship from the void.
class Hull extends Cell {
    get isObstructed() { return true; }
    draw(ctx, node, grid) {
        ctx.beginPath();
        grid.drawNode(ctx, node);
        ctx.fillStyle = "dimgray";
        ctx.fill();
    }

    // Hull blocks are relatively boring so a single instance can
    // be used for all of them.  This should be considered a
    // constant; anything that would change it (such as a hull
    // breach) should replace the instance.
    static instance = new Hull();
}

class Room {
    static __globalIndex = 0;
    constructor(structure) {
        this.__structure = structure;
        this.__nodes = {};
        this.__cells = {};
        this.__index = this.__globalIndex++;
    }
    getNodeCount() {
        return Object.keys(this.__cells).length;
    }
    addNode(node, level) {
        var index = getNodeIndex(node);
        this.__nodes[index] = node;
        this.__cells[index] = true;
    }
    containsNode(node, level) {
        return this.__cells[getNodeIndex(node)] || false;
    }
    eachNode(fn, context) {
        Object.keys(this.__cells).forEach(function(index) {
            var node = this.__nodes[index];
            fn.call(context, node, this, this.__structure);
        }, this);
    }
    setSelected() {
        this.__structure.__selectedRoom = this;
    }
}

/**
 * A structure is self contained unit with some kind of functional
 * purpose -- usually a building or a ship.  Structures exist within a
 * grid of cells on one or more levels, which can be traversed using
 * special cell entries like stairs or lifts.
 *
 * Accessing data in a structure requires nodes.  A node must have
 * integer row and col fields and may optionally have a level field as
 * well. */
class Structure extends Pathf.Pathable {
    constructor(config) { super(); this.init(config); }

    init(config) {
        this.#grid = Grid.create({
            type: "square", radius: 1,
            isometric: false, diagonal: true });
        this.__defaultLevel = 0;
        this.__cellData = {};
        this.__nodeData = {};
        this.__walls = {};
        this.__rooms = [];
        this.__roomMap = {};
        this.__selectedRoom = undefined;
    }

    #grid = undefined;
    get grid() { return this.#grid; }

    // Path finding
    pathNeighbor(node, fn, context) {
        const neighbors = this.grid.eachNeighbor(node);
        neighbors.forEach((neighbor, index) => {
            // Don't leave the ship or walk through walls
            const cell = this.getCell(neighbor);
            if (!cell || cell.isObstructed)
                return;
            const wall = this.getWall(node, neighbor);
            if (wall && !wall.door)
                return;
            fn.call(context, neighbor);
        });
    }
    pathNodeIndex(node) { return getNodeIndex(node); }
    pathSameNode(a, b) {
        if (this.pathDebug)
            this.pathDebug.push(a);
        return (a.row === b.row) && (a.col === b.col); }
    pathCost(node, previous)
    { return isNaN(node.cost) ? 1 : node.cost; }
    pathHeuristic(node, goal)
    { return Math.hypot(goal.row - node.row, goal.col - node.col); }
    pathDebug = undefined;

    // Returns the contents at specified node, if any.
    getCell(node) {
        if (node && !isNaN(node.x) && !isNaN(node.y))
            this.#grid.markCell(node);
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("first argument must have numeric " +
                            "row and col fields");
        var level = isNaN(node.level) ?
            this.__defaultLevel : node.level;
        return (level in this.__cellData) ?
            this.__cellData[level][getNodeIndex(node)] : undefined;
    }

    // Replaces the contents at specified node with the value given.
    setCell(node, value) {
        if (node && !isNaN(node.x) && !isNaN(node.y))
            this.#grid.markCell(node);
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("row and col must be numeric");
        var index = getNodeIndex(node);

        var level = isNaN(node.level) ?
            this.__defaultLevel : level;
        if (!(level in this.__cellData)) {
            this.__cellData[level] = {};
            this.__nodeData[level] = {};
        }

        if (typeof(value) === "undefined") {
            delete this.__nodeData[level][index];
            delete this.__cellData[level][index];
        } else {
            this.__nodeData[level][index] = node;
            this.__cellData[level][index] = value;
        }

        return this;
    }

    // Calls the supplied function for each cell in the structure.
    // The context argument is supplied as "this" variable.
    // Arguments are:
    //   - Contents of the current cell
    //   - Position of the cell (object with .row and .col)
    //   - Grid used by this structure
    //   - This structure itself
    eachCell(fn, context) {
        var level = this.__defaultLevel;
        if (!isNaN(arguments[0])) {
            level   = arguments[0];
            fn      = arguments[1];
            context = arguments[2];
        }

        if (level in this.__cellData)
            Object.keys(this.__nodeData[level])
            .forEach(function(key) {
                fn.call(context, this.__cellData[level][key],
                        this.#grid.markCenter(
                            this.__nodeData[level][key]),
                        this.#grid, this);
            }, this);
        return this;
    }

    __boundaryID(nodeA, nodeB) {
        if (((nodeA.row === nodeB.row) && (nodeA.col === nodeB.col)) ||
            (!isNaN(nodeA.level) && !isNaN(nodeB.level) &&
             (nodeA.level !== nodeB.level)))
            return undefined;
        const indexA = getNodeIndex(nodeA);
        const indexB = getNodeIndex(nodeB);
        return Ripple.pair(Math.min(indexA, indexB),
                           Math.max(indexA, indexB));
    }

    getWall(nodeA, nodeB) {
        const index = this.__boundaryID(nodeA, nodeB);
        const level = !isNaN(nodeA.level) ? nodeA.level :
                      !isNaN(nodeB.level) ? nodeB.level :
                      this.__defaultLevel;
        return (!isNaN(index) && this.#grid.isAdjacent(nodeA, nodeB) &&
                (level in this.__walls)) ?
               this.__walls[level][index] : undefined;
    }

    __boundarySweep(node, start, neighbors) {
        let step;

        for (step = 1; step < neighbors.length; ++step) {
            const current = (start + step) % neighbors.length;
            if (neighbors[current].diagonal)
                this.__boundaryCreate(node, neighbors[current]);
            else break;
        }
        for (step = 1; step < neighbors.length; ++step) {
            const current = ((start < step) ? neighbors.length : 0) +
                            start - step;
            if (neighbors[current].diagonal)
                this.__boundaryCreate(node, neighbors[current]);
            else break;
        }
    }

    __boundaryCreate(nodeA, nodeB) {
        const neighborsA = this.#grid.eachNeighbor(nodeA);
        const nnum = neighborsA.reduce((acc, neighbor, index) =>
            ((nodeB.row === neighbor.row) &&
             (nodeB.col === neighbor.col)) ? index : acc, -1);
        if (nnum < 0) {
            // Ignore request for wall between non-neighbors
        } else {
            if (!neighborsA[nnum].diagonal) {
                // Diagonal neighbors between the pair must have walls
                // to prevent navigating across corners.
                const neighborsB = this.#grid.eachNeighbor(nodeB);
                this.__boundarySweep(nodeB, neighborsB.reduce(
                    (acc, neighbor, index) =>
                        ((nodeA.row === neighbor.row) &&
                         (nodeA.col === neighbor.col)) ?
                        index : acc, -1), neighborsB);
                this.__boundarySweep(nodeA, nnum, neighborsA);
            }
            const index = this.__boundaryID(nodeA, nodeB);
            const level = !isNaN(nodeA.level) ? nodeA.level :
                          !isNaN(nodeB.level) ? nodeB.level :
                          this.__defaultLevel;

            if (!(level in this.__walls))
                this.__walls[level] = {};
            this.__walls[level][index] = {
                nodeA: nodeA, nodeB: nodeB, door: false,
                points: this.#grid.getPairPoints(nodeA, nodeB)
            };
        }
        return this;
    }

    makeWall(nodeA, nodeB)
    { return this.__boundaryCreate(nodeA, nodeB); }

    eachWall(fn, context) {
        var level = this.__defaultLevel;
        if (!isNaN(arguments[0])) {
            level   = arguments[0];
            fn      = arguments[1];
            context = arguments[2];
        }

        Object.keys(this.__walls).forEach(function(index) {
            var wall = this.__walls[level][index];
            fn.call(context, points, wall.nodeA, wall.nodeB);
        });
        return this;
    }

    makeDoor(nodeA, nodeB) {
        var level = this.__defaultLevel;
        if (!isNaN(nodeA.level) && !isNaN(nodeB.level) &&
            (nodeA.level !== nodeB.level))
            throw new Error("nodes are on different levels");
        else if (!isNaN(nodeA.level))
            level = nodeA.level;
        else if (!isNaN(nodeB.level))
            level = nodeB.level;

        var indexA = getNodeIndex(nodeA);
        var indexB = getNodeIndex(nodeB);
        var index = Ripple.pair(Math.min(indexA, indexB),
                                Math.max(indexA, indexB));

        if (!(level in this.__walls))
            this.__walls[level] = {};
        this.__walls[level][index] = {
            nodeA: nodeA, nodeB: nodeB, door: true,
            points: this.#grid.getPairPoints(nodeA, nodeB)
        };
        return this;
    }

    // Calls the supplied function for each level in the structure.
    // The context argument is supplied as "this" variable.
    // Arguments are:
    //   - Numeric level
    //   - This structure itself
    eachLevel(fn, context) {
        var originalLevel = this.__defaultLevel;
        Object.keys(this.__cellData).forEach(function(level) {
                fn.call(context, level, this.setLevel(level)); }, this);
        this.__defaultLevel = originalLevel;
        return this;
    }

    setLevel(level)
    { this.__defaultLevel = level; return this; }

    getRoomCount() { return this.__rooms.length; }

    getRoom(node) {
        if (node && !isNaN(node.x) && !isNaN(node.y))
            this.#grid.markCell(node);
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("row and column must be numeric");
        return this.__roomMap[getNodeIndex(node)];
    }

    eachRoom(fn, context) {
        this.__rooms.forEach(function(room) {
            fn.call(context, room, this); });
    }

    /**
     * Mark a cell for inclusion in a ship without
     * resolving the contents of that cell.  Call
     * the resolve method once all unresolved cells
     * have been marked. */
    setCellUnresolved(node) {
        this.setCell(node, new Superposition(node));
    }

    /**
     * Convert all unresolved cells to some component.
     * This method does its best to create a workable structure
     * according to given rules. */
    resolve(level) {
        if (isNaN(level))
            return this.eachLevel((level) => {
                this.resolve(level); });

        const distances = computeDistances(this, this.#grid);

        // Create an exterior hull and sort interior nodes
        // by their distance to a hull tile.

        var nodes = [];
        this.eachCell(function(contents, node, grid) {
            if (!(contents instanceof Superposition))
                return;
            node.distance = distances[getNodeIndex(node)];
            if (node.distance <= 1)
                this.setCell(node, Hull.instance);
            else nodes.push(node);
            }, this);
        nodes.sort(function(a, b) {
            var order = a.distance - b.distance;
            return order ? order : ((Math.random() > 0.5) ?
                                    1 : -1); });

        // Divide the structure up into rooms
        var roomMap = this.__roomMap;
        var rooms = [];

        while (nodes.length) { // Use all superposition nodes
            var node = nodes.shift();
            if (roomMap[getNodeIndex(node)])
                continue; // Node was taken by a previous room

            var desiredNodes = Math.floor(25 + 12 * Math.random());
            var room = new Room(this);

            while ((room.getNodeCount() < desiredNodes)) {
                // Consume the current node
                room.addNode(node);
                roomMap[getNodeIndex(node)] = room;

                // Each neighbor is a candidate for expansion
                var candidates = [];
                room.eachNode(function(node) {
                    this.#grid
                        .eachNeighbor(node, function(neighbor) {
                            if (!neighbor.diagonal &&
                                !roomMap[getNodeIndex(neighbor)] &&
                                !room.containsNode(neighbor) &&
                                this.getCell(neighbor) instanceof
                                Superposition) {
                                neighbor.distance =
                                    distances[getNodeIndex(neighbor)];
                                candidates.push(neighbor);
                            }
                        }, this);
                }, this);

                if (!candidates.length)
                    break;

                // Prefer neighbors with more existing connections
                // to the current room
                candidates.forEach(function(candidate) {
                    var connections = 0;
                    this.#grid.eachNeighbor(candidate, function(
                        neighbor) {
                        if (!neighbor.diagonal &&
                            room.containsNode(neighbor))
                            connections += 1; });
                    candidate.connections = connections; }, this);
                candidates.sort(function(a, b) {
                    // For candidates with the same number of
                    // connections, prefer lower distances
                    var value = b.connections - a.connections;
                    //if (!value)
                    //    value = a.distance - b.distance;
                    return value;
                });
                node = candidates.shift();
            }
            rooms.push(room);
        }
        this.__rooms = this.__rooms.concat(rooms);

        // Create walls and doors between rooms.
        var roomIndices = {};
        var nodeRooms = {};
        rooms.forEach((room, index) => {
            roomIndices[index] = room;
            room.eachNode(node =>
                { nodeRooms[getNodeIndex(node)] = index; });
        });
        var roomPeers = [];
        rooms.forEach((room, index) => {
            var boundaries = {};
            roomPeers.push(boundaries);

            room.eachNode(node => {
                this.#grid.eachNeighbor(node, neighbor => {
                    if (room.containsNode(neighbor) ||
                        (this.getCell(neighbor) instanceof Hull))
                        return;
                    if (neighbor.diagonal) {
                        this.makeWall(node, neighbor);
                        return;
                    }
                    var peer = nodeRooms[getNodeIndex(neighbor)];
                    if (!boundaries[peer])
                        boundaries[peer] = [];
                    boundaries[peer].push({
                        a: node, b: neighbor });
                });
            });
        });
        roomPeers.forEach((boundaries, index) => {
            Object.keys(boundaries).forEach(peer => {
                if (peer < index)
                    return;
                var pairs = Ripple.shuffle(boundaries[peer]);
                var door = pairs.shift();
                this.makeDoor(door.a, door.b);

                pairs.forEach(pair =>
                    { this.makeWall(pair.a, pair.b); });
            });
        });
    }

    draw(ctx, now, camera) {
        this.#grid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            function(node, index, grid) {
                var cell = this.getCell(node);
                if (cell)
                    cell.draw(ctx, node, grid, this);
            }, this);
        this.#grid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            function(node, index, grid) {
                var currentRoom = this.getRoom(node);

                grid.eachNeighbor(node, function(neighbor) {
                    var wall = this.getWall(node, neighbor);
                    if (wall && wall.door && wall.points &&
                        (wall.points.length == 1)) {
                        ctx.beginPath();
                        ctx.moveTo(wall.points[0].x + 2/20,
                                   wall.points[0].y);
                        ctx.arc(wall.points[0].x, wall.points[0].y,
                                2/20, 0, Math.PI * 2);
                        ctx.lineWidth = 2/20;
                        ctx.strokeStyle = "#333";
                        ctx.stroke();
                    } else if (wall && wall.points &&
                               (wall.points.length >= 2)) {
                        var p0 = wall.points[0];
                        var p1 = wall.points[1];

                        ctx.beginPath();
                        ctx.lineCap = "round";
                        ctx.lineWidth = 3/20;
                        if (wall.door) {
                            var perp = {
                                x: (p1.y - p0.y) / 20,
                                y: (p0.x - p1.x) / 20 };
                            var p01 = {
                                x: p0.x + (p1.x - p0.x) / 5,
                                y: p0.y + (p1.y - p0.y) / 5};
                            var p10 = {
                                x: p0.x + 4 * (p1.x - p0.x) / 5,
                                y: p0.y + 4 * (p1.y - p0.y) / 5};
                            ctx.moveTo(p0.x, p0.y);
                            ctx.lineTo(p01.x, p01.y);
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p10.x, p10.y);
                            ctx.strokeStyle = "dimgray";
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(p01.x, p01.y);
                            ctx.lineTo(p01.x + perp.x,
                                       p01.y + perp.y);
                            ctx.lineTo(p10.x + perp.x,
                                       p10.y + perp.y);
                            ctx.lineTo(p10.x - perp.x,
                                       p10.y - perp.y);
                            ctx.lineTo(p01.x - perp.x,
                                       p01.y - perp.y);
                            ctx.lineTo(p01.x, p01.y);
                            ctx.lineWidth = 2/20;
                            ctx.strokeStyle = "#333";
                            ctx.stroke();
                        } else {
                            ctx.moveTo(p0.x, p0.y);
                            ctx.lineTo(p1.x, p1.y);
                            ctx.strokeStyle = "dimgray";
                            ctx.stroke();
                        }
                    }
                }, this);
            }, this);
    }

    toJSON() {
        return {}; // TODO
    }

}

// A building is a single structure inside a habitat.
class Building extends Structure {
    create(config)
    { return Object.create(this).init(config); }

    init(config) {
        Structure.init.call(this, config);
        var rand = (config && config.rand) ? config.rand : Math;
        var lot = (config && config.lot) ? config.lot :
            {start: {row: -10, col: -10},
             end:   {row: 10, col: 10}};
        this.district = (config && config.district) ?
            config.district : null;
        this.start = {
            row: Math.min(lot.start.row, lot.end.row),
            col: Math.min(lot.start.col, lot.end.col) };
        this.end = {
            row: Math.max(lot.start.row, lot.end.row),
            col: Math.max(lot.start.col, lot.end.col) };
        if (Math.abs(this.start.row - this.end.row) > 10) {
            this.start.row += 1 + Math.floor(rand.random() * 3);
            this.end.row -= 1 + Math.floor(rand.random() * 3);
        }
        if (Math.abs(this.start.col - this.end.col) > 10) {
            this.start.col += 1 + Math.floor(rand.random() * 3);
            this.end.col -= 1 + Math.floor(rand.random() * 3);
        }

        var district = this.district;

        this.__cellEmpty = {
            draw: function(ctx, node, cellGrid) {
                ctx.beginPath();
                cellGrid.draw(ctx, node);
                ctx.fillStyle = district.type.buildingColor;
                ctx.fill();
            }
        };

        this.__cellWall = {
            draw: function(ctx, node, cellGrid) {
                ctx.beginPath();
                cellGrid.draw(ctx, node);
                ctx.fillStyle = district.type.wallColor;
                ctx.fill();
            }
        };

        this.__contents = {};
        if (config && config.randomize) {
            /* var row, col;
             * for (row = this.start.row; row <= this.end.row; ++row)
             *     for (col = this.start.col;
             *          col <= this.end.col; ++col)
             *         this.setCellUnresolved({row: row, col: col});
             * this.resolve(); */
            this.__createRandomLayout();
        }

        return this;
    }

    __createRandomLayout() {
        var buildingRowSize = this.end.row - this.start.row;
        var buildingColSize = this.end.col - this.start.col;
        var roomSize = (buildingRowSize >= 14) ? 5 : 4;
        var hallwaySize = (buildingRowSize >= 14) ? 4 : 3;

        var rowRooms = Math.floor(
            (buildingRowSize + hallwaySize) /
                (roomSize + hallwaySize));
        var colRooms = Math.floor(
            (buildingColSize + hallwaySize) /
                (roomSize + hallwaySize));

        var ii, jj, row, col;
        for (row = this.start.row; row <= this.end.row; ++row) {
            col = this.start.col;
            this.setCell({row: row, col: col}, this.__cellWall);

            col = this.end.col;
            this.setCell({row: row, col: col}, this.__cellWall);
        }
        for (col = this.start.col; col <= this.end.col; ++col) {
            row = this.start.row;
            this.setCell({row: row, col: col}, this.__cellWall);

            row = this.end.row;
            this.setCell({row: row, col: col}, this.__cellWall);
        }
    }

    drawOverview(ctx, grid, node) {
        ctx.beginPath();
        ctx.moveTo(node.x - this.start.col,
                   node.y - this.start.row);
        ctx.lineTo(node.x - this.end.col,
                   node.y - this.start.row);
        ctx.lineTo(node.x - this.end.col,
                   node.y - this.end.row);
        ctx.lineTo(node.x - this.start.col,
                   node.y - this.end.row);
        ctx.lineTo(node.x - this.start.col,
                   node.y - this.start.row);
        ctx.fillStyle = this.district ?
            this.district.type.buildingColor :
            "rgb(128, 128, 128)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.lineCap   = "square";
        ctx.strokeStyle = this.district ?
            this.district.type.wallColor :
            "rgb(192, 192, 240)";
            ctx.stroke();
    }
}

// A district is a substantial section of a space station.
// Districts contain buildings and other structures that have an
// effect on the station and its population.  Districts have a
// type which reflects the kind of infrastructure they contain.
// This infrastructure confers advantages and disadvantages.
class District {
    create(config) {
        var result = Object.create(this);
        result.rules = config && config.rules;
        result.rand = (config && config.rand) ? config.rand : Math;
        result.type = (config && config.type) ? config.type : null;
        result.__buildings = [];
        result.__vacantLots = [];
        result.__cellMap = {};

        var startingLot = {
            start: {row: -Math.floor((this.cellCount - 1) / 2),
                    col: -Math.floor((this.cellCount - 1) / 2)},
            end: {row: Math.floor((this.cellCount - 1) / 2),
                  col: Math.floor((this.cellCount - 1) / 2)}};
        if (config && config.random) {
            if (!result.type)
                result.type = result.__randomType(result.rand);
            result.__createRandomBuilding(
                startingLot, result.type.pSplit, result.type.pUsed);
        } else result.__vacantLots.push(startingLot);

        return result;
    }

    eachBuilding(fn, context) {
        var result = fn ? this : [];
        this.__buildings.forEach(function(building, index) {
            if (fn)
                fn.call(context, building, index);
            else result.push(building);
        });
        return result;
    }

    addBuilding(building) {
        building.eachCell(function(cell, node) {
            this.__cellMap[getNodeIndex(node)] =
                building.getCell(node);
        }, this);
        this.__buildings.push(building);
    }

    __rand = Math;

    __randomType(rand) {
        var entries = [];
        Object.keys(this.rules.districtTypes).forEach(
            function(name) {
                entries.push({
                    name: name,
                    weight: this.rules.districtTypes[name]
                        .randomWeight});
            }, this);
        var selected = undefined;
        var determinant = ((rand ? rand : Math).random() *
                           entries.reduce(function(accm, entry) {
                               return accm + entry.weight; }, 0));
        entries.forEach(function(entry) {
            if (!selected && (determinant < entry.weight))
                selected = entry.name;
            else determinant -= entry.weight;
        });
        return this.rules.districtTypes[selected];
    }

    // Returns an equivalent lot such that the start row and column
    // are no greater than the end row and column.
    __orderLot(lot) {
        return ((lot.start.row <= lot.end.row) &&
                (lot.start.col <= lot.end.col)) ? lot : {
                    start: {
                        row: Math.min(lot.start.row, lot.end.row),
                        col: Math.min(lot.start.col, lot.end.col)
                    }, end: {
                        row: Math.max(lot.start.row, lot.end.row),
                        col: Math.max(lot.start.col, lot.end.col)
                    }};
    }

    __splitLot(lot) {
        var width  = lot.end.col - lot.start.col;
        var height = lot.end.row - lot.start.row;
        var result = [{
            start: {row: lot.start.row, col: lot.start.col},
            end:   {row: lot.start.row +
                    Math.floor((height - 1) / 2),
                        col: lot.start.col +
                    Math.floor((width - 1)/ 2)}
        }, {
            start: {row: lot.start.row,
                    col: lot.end.col -
                             Math.floor((width - 1)/ 2)},
            end:   {row: lot.start.row +
                    Math.floor((height - 1) / 2),
                    col: lot.end.col}
        }, {
            start: {row: lot.end.row -
                    Math.floor((height - 1) / 2),
                    col: lot.start.col},
            end:   {row: lot.end.row,
                    col: lot.start.col +
                    Math.floor((width - 1)/ 2)}
        }, {
            start: {row: lot.end.row -
                             Math.floor((height - 1) / 2),
                    col: lot.end.col -
                    Math.floor((width - 1) / 2)},
            end:   {row: lot.end.row, col: lot.end.col}
        }];
        return result;
    }

    __createRandomBuilding(lot, p_split, p_used) {
        var result = null;
        var size = Math.min(
            Math.abs(lot.start.row - lot.end.row),
            Math.abs(lot.start.col - lot.end.col));

        if ((size > 128) ||
            ((size > 16) && (this.rand.random() < p_split))) {
            this.__splitLot(lot).forEach(function(lot) {
                this.__createRandomBuilding(
                    lot, p_split * p_split, p_used * p_used);
            }, this);
        } else if (this.rand.random() < p_used)
            result = Building.create({
                lot: lot, district: this, randomize: true});
        else this.__vacantLots.push(lot);

        if (result)
            this.addBuilding(result);
    }

    cellCount = 255;

    drawBackground(ctx, districtGrid, node) {
        ctx.beginPath();
        districtGrid.draw(ctx, node);
        ctx.fillStyle = this.type.color;
        ctx.fill();
        ctx.strokeStyle = "rgb(64,64,160)";
        ctx.lineWidth = 1;
        ctx.lineCap = "square";
        ctx.stroke();
    }

    drawOverview(ctx, districtGrid, node) {
        this.eachBuilding(function(building) {
            building.drawOverview(ctx, districtGrid, node); });
    }

    // Draw the icon for this district.  Each district type has an
    // optional icon which helps to identify the district type
    // when zoomed out.
    drawIcon(ctx, districtGrid, node) {
        if (this.type && this.type.icon &&
            Array.isArray(this.type.icon)) {
            var size = districtGrid.getEdge();
            var scale = isNaN(this.type.iconScale) ?
                1 : this.type.iconScale;
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.scale(size * scale, size * scale);
                ctx.beginPath();

            this.type.icon.forEach(function(element) {
                if (element.type === "polygon") {
                    var start = element.vertices[
                        element.vertices.length - 1]; 
                    ctx.moveTo(start.x, start.y);
                    element.vertices.forEach(function(vertex) {
                        ctx.lineTo(vertex.x, vertex.y);
                    });
                } else if (element.type === "circle") {
                    ctx.moveTo(element.x + element.radius,
                               element.y);
                    ctx.arc(element.x, element.y, element.radius,
                            0, 2 * Math.PI);
                }
            });

            ctx.fillStyle = this.type.iconColor;
            ctx.fill();
            ctx.lineWidth = 0.01;
            ctx.lineCap   = "square";
            ctx.strokeStyle = this.type.wallColor;
            ctx.stroke();
            ctx.restore();
        }
    }

    draw(ctx, camera, cellGrid, center) {
        cellGrid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            function(node, index, cGrid) {
                var range = Math.floor((District.cellCount - 1) / 2);
                var relative = {row: center.row - node.row,
                                col: center.col - node.col};

                if ((Math.abs(relative.row) > range) ||
                    (Math.abs(relative.col) > range))
                    return; // Only draw if in our district

                var contents = this.__cellMap[getNodeIndex(relative)];
                if (!contents) {
                    ctx.beginPath();
                    cellGrid.draw(ctx, node);
                    ctx.fillStyle = this.type.color;
                    ctx.fill();
                } else contents.draw(ctx, node, cellGrid);
            }, this);
    }
}

class Station {
    constructor(config) {
        // Artificial gravity is created by rotating a cylinder.
        // (https://en.wikipedia.org/wiki/Artificial_gravity).
        // Rotation at or less than two revolutions per minute
        // should limit inner ear problems.  This is a rotation
        // period of thirty seconds.  According to the same
        // source, the rotation period T = 2π(r/a)^1/2 where r is
        // the radius of the station and a is the acceleration.
        // Plugging in 9.8 for the acceleration and assuming each
        // district measures 255 meters on each side we get a
        // period of 28.59 seconds with six rows of districts.
        this.rules = config && config.rules;
        this.districtGrid = Grid.create({
            type: "square", edge: District.cellCount});
        this.cellGrid = Grid.create({
            type: "square", edge: 1});
        this.rows = Math.min((config && config.rows) ?
                               config.rows : 6, 6);
        this.cols = (config && config.cols) ? config.cols : 6;
        this.districts = [];
        for (var rr = 0; rr < this.rows; ++rr)
            for (var cc = 0; cc < this.cols; ++cc)
                this.districts.push(District.create(
                    { rules: this.rules, random: true,
                      row: rr, col: cc }));
    }

    getDistrict(row, col) {
        row = row % this.rows;
        if (row < 0)
            row += this.rows;
        return ((row >= 0) && (row < this.rows) &&
                (col >= 0) && (col < this.cols)) ?
            this.districts[row * this.cols + col] : null; }

    eachDistrict(fn, context) {
        var result = fn ? undefined : [];
        this.districts.forEach(function(district) {
            if (fn)
                fn.call(context ? context : this, district);
            else result.push(district);
        }, this);
        return result;
    }

    draw(ctx, camera) {
        var size = Math.min(camera.height, camera.width);
        var districtPixels = camera.scale * District.cellCount;

        this.districtGrid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            function(node, index, dGrid) {
                var district = this.getDistrict(node.row, node.col);
                if (!district) {
                } else if (size < districtPixels / 10) {
                    var center = this.cellGrid.markCenter({
                        row: Math.floor(
                            node.row * District.cellCount),
                        col: Math.floor(
                            node.col * District.cellCount)
                    });
                    district.draw(
                        ctx, camera, this.cellGrid, center);
                } else if (size < districtPixels * 3 / 2) {
                        district.drawBackground(
                            ctx, this.districtGrid, node);
                    district.drawOverview(
                        ctx, this.districtGrid, node);
                } else if (size < districtPixels * 3) {
                    district.drawBackground(
                        ctx, this.districtGrid, node);
                    ctx.save();
                        ctx.globalAlpha = 0.2;
                    district.drawOverview(
                        ctx, this.districtGrid, node);
                    ctx.restore();
                    district.drawIcon(ctx, this.districtGrid, node);
                } else {
                    district.drawBackground(
                        ctx, this.districtGrid, node);
                    district.drawIcon(ctx, this.districtGrid, node);
                }
            }, this);
    }
}

function createSampleShip() {
    const ship = new Structure();
    let row, col;

    for (row = -10; row <= 10; ++row)
        for (col = -10; col <= 10; ++col)
            ship.setCellUnresolved({row: row, col: col});
    for (row = -5; row <= 5; ++row)
        for (col = 10; col <= 15; ++col)
            ship.setCellUnresolved({row: row, col: col});
    ship.resolve();
    return ship;
};

class Panel {
    constructor() {
        const element = document.createElement("fieldset");
        const contents = document.createElement("div");
        const legend = document.createElement("legend");
        const title = document.createTextNode("Panel");
        const closeBTN = document.createElement("button");
        closeBTN.appendChild(document.createTextNode("X"));
        closeBTN.addEventListener("click", event =>
            { element.style.display = "none"; });
        legend.appendChild(closeBTN);
        legend.appendChild(title);
        document.body.appendChild(element);

        element.appendChild(legend);
        element.appendChild(contents);
        element.style.display = "none";
        element.classList.add("panel");

        this._element = element;
        this._contents = contents;
        this._title = title;
    }

    show() { this._element.style.display = "block"; }

    setTitle(text) { this._title.data = text; }

    get contents() { return this._contents; }

    resize(width, height) {
        const size = Math.min(width, height);
        const getPixels = value => Math.round(value) + "px";
        this._element.style.top = getPixels(size * 0.05);
        this._element.style.left = getPixels(size * 0.05);
        this._element.style.bottom = getPixels(0.05 * size);
        this._element.style.right = getPixels(0.05 * size);
        this._element.style.borderRadius = getPixels(size * 0.05);
        return this;
    }
}

class Vanguard {
    constructor(setting) {
        Character.setup(setting);

        this.#panel = new Panel();
        this.#setting = setting;
        this.#player = Character.createRecruit(this.#setting);
        this.#ship = createSampleShip();

        this.#player.setPosition(
            this.#ship.grid.markCell({x: 0, y: 0}));
        this.#player.setShip(this.#ship);
    }

    #setting;
    #player;
    #ship;
    #panel;

    #float = false;
    get active() { return true };
    get autofill() { return true };
    get autozoom() { return { min: 1, max: 20 } };
    autodrag(event) { this.#float = true; };

    resize(event, camera)
    { this.#panel.resize(camera.width, camera.height); }

    dblclick(event, camera) {
        this.#panel.contents.innerHTML = "";
        [0, 1, 2, 3].forEach(index => {
            this.#panel.contents.appendChild(
                Character.createRecruit(this.#setting).getCard()); });
        this.#panel.setTitle("Recruits");
        this.#panel.show();
    }

    #beginClick = undefined;

    mousedown(event, camera) {
        this.#beginClick = camera.getPoint(event);
        this.#player.pointAt(camera.toWorld(camera.getPoint(event)));
    }

    mouseup(event, camera) {
        const point = camera.getPoint(event);
        if (this.#beginClick &&
            (point.x - this.#beginClick.x) *
            (point.x - this.#beginClick.x) +
            (point.y - this.#beginClick.y) *
            (point.y - this.#beginClick.y) < 5 * 5) {
            const node = this.#ship.grid.markCell(
                camera.toWorld(this.#beginClick));
            const cell = this.#ship.getCell(node);
            if (cell && !cell.isObstructed) {
                this.#float = false;
                this.#ship.pathDebug = [];
                this.#player.setPath(this.#ship.createPath(
                    this.#player.position, node));
                this.debugListTime = new Date().getTime();
            }
        }
    }

    lastUpdate = undefined;

    update(now, camera) {
        this.#player.update(this.lastUpdate, now);
        if (!this.#float)
            camera.setPosition(this.#player.position);
        this.lastUpdate = now;
    }

    debugListTime;

    draw(ctx, camera) {
        this.#ship.draw(ctx, this.lastUpdate, camera);

        if (this.debugListTime && this.#ship.pathDebug) {
            this.#ship.pathDebug.forEach((node, index) => {
                const value = Math.floor(
                    127 + 128 * index / this.#ship.pathDebug.length);
                ctx.beginPath();
                if (this.lastUpdate > this.debugListTime + 100 * index)
                    this.#ship.grid.drawNode(
                        ctx, this.#ship.grid.markCenter(node));
                ctx.fillStyle = "rgba(" + value + "," + value + "," +
                                value + ", 0.5)";
                ctx.fill();
            });

            [this.#ship.pathDebug[0],
             this.#ship.pathDebug[this.#ship.pathDebug.length - 1]]
                .forEach((node, index) => {
                    this.#ship.grid.markCenter(node);
                    ctx.beginPath();
                    ctx.moveTo(node.x + 0.5, node.y);
                    ctx.arc(node.x, node.y, 0.5, 0, Math.PI * 2);
                    ctx.lineWidth = 0.1;
                    ctx.strokeStyle = index ? "#4d4" : "#44d";
                    ctx.stroke();
                });

            // Draw the planned path of the player
            ctx.beginPath();
            ctx.moveTo(this.#player._position.x,
                       this.#player._position.y);
            this.#player._path.forEach(step => {
                this.#ship.grid.markCenter(step);
                ctx.lineTo(step.x, step.y); });
            ctx.strokeStyle = "red";
            ctx.stroke();
        }

        this.#player.drawTopDown(ctx, this.lastUpdate);
    }

}

export default Vanguard;
