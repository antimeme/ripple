// Streya Struture Library
// Copyright (C) 2021-2022 by Jeff Gold.
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
// One unit is one meter in this design.
(function() {
    "use strict";
    if (typeof require === "function") {
        this.ripple   = require("../ripple/ripple.js");
        this.multivec = require("../ripple/multivec.js");
        this.grille   = require("../ripple/grille.js");
        this.pathf    = require("../ripple/pathf.js");
    }

    // Convert a node to a numeric index suitable for integer lookup
    var getIndex = function(node)
    { return ripple.pair(node.col, node.row); };

    // Compute the distance of each tile to outside the structure
    var computeDistances = function(structure, grid) {
        var distances = {};
        var unresolved = [];

        var computeDistance = function(node, grid, structure) {
            var distance = distances[getIndex(node)];
            grid.eachNeighbor(node, function(neighbor) {
                if (structure.getCell(neighbor)) {
                    var peer = distances[getIndex(neighbor)];
                    if (peer && !isNaN(peer) &&
                        (!distance || isNaN(distance) ||
                         (distance > peer)))
                        distance = peer + 1;
                } else distance = 1;
            }, this);
            grid.eachNeighbor(node, function(neighbor) {
                var peer = distances[getIndex(neighbor)];
                if (structure.getCell(neighbor) &&
                    peer && !isNaN(peer) &&
                    (peer > distance + 1)) {
                    distances[getIndex(neighbor)] = undefined;
                    unresolved.push(neighbor);
                }
            }, this);

            if (distance)
                distances[getIndex(node)] = distance;
            else unresolved.push(node);
        };

        structure.eachCell(function(
            contents, node, grid, structure) {
            computeDistance(node, grid, structure);
        }, this);
        while (unresolved.length)
            computeDistance(unresolved.shift(), grid, structure);
        return distances;
    };

    // Base class for the contents of a cell in a ship or building.
    // A cell knows whether it is obstructed.
    var Cell = {
        create: function(config)
        { return Object.create(this).init(config); },
        init: function(config) { return this; },

        isObstructed: false,

        draw: function(ctx, node, grid, structure) {
            ctx.beginPath();
            grid.draw(ctx, node);
            if (structure.__selectedRoom &&
                structure.__selectedRoom.containsNode(node))
                ctx.fillStyle = "teal";
            else ctx.fillStyle = "lightslategray";
            ctx.fill();
        }
    };

    // A superposition is a cell with contents that have not yet
    // been decided -- a place holder.
    var Superposition = Object.assign(Object.create(Cell), {
        init: function(config) {
            this.row = config && config.row || 0;
            this.col = config && config.col || 0;
            return this;
        },
    });

    var Hull = Object.assign(Object.create(Cell), {
        isObstructed: true,
        draw: function(ctx, node, grid) {
            ctx.beginPath();
            grid.draw(ctx, node);
            ctx.fillStyle = "dimgray";
            ctx.fill();
        }
    });

    var cellTypes = {
        bulkhead: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                ctx.beginPath();
                grid.draw(ctx, node);
                ctx.fillStyle = "gray";
                ctx.fill();
            }
        }),
        door: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                var radius = grid.getRadius() / 2;
                ctx.beginPath();
                ctx.moveTo(node.x - radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y - radius);
                ctx.fillStyle = "red";
                ctx.fill();
            }
        }),
        bedHead: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                var radius = grid.getRadius() / 2;
                ctx.beginPath();
                ctx.moveTo(node.x - radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y + radius);
                ctx.fillStyle = "red";
                ctx.fill();
            }
        }),
        bedFoot: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                var radius = grid.getRadius() / 2;
                ctx.beginPath();
                ctx.moveTo(node.x - radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y - radius);
                ctx.fillStyle = "red";
                ctx.fill();
            }
        }),
        dresser: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                var radius = grid.getRadius() / 2;
                ctx.beginPath();
                ctx.moveTo(node.x - radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y - radius);
                ctx.fillStyle = "green";
                ctx.fill();
            }
        }),
        desk: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
                var radius = grid.getRadius() / 2;
                ctx.beginPath();
                ctx.moveTo(node.x - radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y - radius);
                ctx.lineTo(node.x + radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y + radius);
                ctx.lineTo(node.x - radius, node.y - radius);
                ctx.fillStyle = "purple";
                ctx.fill();
            }
        }),
        floor: Object.assign(Object.create(Cell), {
            draw: function(ctx, node, grid) {
            }
        }),
    };

    var Room = {
        __index: 0,
        create: function(structure) {
            var result = Object.create(this);
            result.__structure = structure;
            result.__nodes = {};
            result.__cells = {};
            result.__index = this.__index++;
            return result;
        },
        getNodeCount: function() {
            return Object.keys(this.__cells).length;
        },
        addNode: function(node, level) {
            var index = getIndex(node);
            this.__nodes[index] = node;
            this.__cells[index] = true;
        },
        containsNode: function(node, level) {
            return this.__cells[getIndex(node)] || false;
        },
        eachNode: function(fn, context) {
            Object.keys(this.__cells).forEach(function(index) {
                var node = this.__nodes[index];
                fn.call(context, node, this, this.__structure);
            }, this);
        },
        setSelected: function() {
            this.__structure.__selectedRoom = this;
        }
    };

    // A structure is a building or a space ship.  It's a self
    // contained unit with some kind of functional purpose.
    // Structures exist within a grid of cells on one or more
    // levels, which can be traversed using special cell
    // entries like stairs or elevators.
    //
    // Accessing data in a structure requires nodes.  A node
    // must have integer row and col fields and may optionally
    // have a level field as well.
    var Structure = {
        create: function(config)
        { return Object.create(this).init(config); },

        init: function(config) {
            this.__grid = grille.createGrid({
                type: "square", diagonal: true, edge: 1 });
            this.__defaultLevel = 0;
            this.__cellData = {};
            this.__nodeData = {};
            this.__walls = {};
            this.__rooms = [];
            this.__roomMap = {};
            this.__selectedRoom = undefined;
            return this;
        },

        // Returns the contents at specified node, if any.
        getCell: function(node) {
            if (node && !isNaN(node.x) && !isNaN(node.y))
                this.__grid.markCell(node);
            if (!node || isNaN(node.row) || isNaN(node.col))
                throw new Error("first argument must have numeric " +
                                "row and col fields");
            var level = isNaN(node.level) ?
                        this.__defaultLevel : node.level;
            return (level in this.__cellData) ?
                   this.__cellData[level][getIndex(node)] : undefined;
        },

        // Replaces the contents at specified node with the value given.
        setCell: function(node, value) {
            if (node && !isNaN(node.x) && !isNaN(node.y))
                this.__grid.markCell(node);
            if (!node || isNaN(node.row) || isNaN(node.col))
                throw new Error("row and col must be numeric");
            var index = getIndex(node);

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
        },

        // Calls the supplied function for each cell in the structure.
        // The context argument is supplied as "this" variable.
        // Arguments are:
        //   - Contents of the current cell
        //   - Position of the cell (object with .row and .col)
        //   - Grid used by this structure
        //   - This structure itself
        eachCell: function(fn, context) {
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
                                  this.__grid.markCenter(
                                      this.__nodeData[level][key]),
                                  this.__grid, this);
                      }, this);
            return this;
        },

        getWall: function(nodeA, nodeB) {
            var level = this.__defaultLevel;
            if (!isNaN(nodeA.level) && !isNaN(nodeB.level) &&
                (nodeA.level !== nodeB.level))
                return undefined;
            else if (!isNaN(nodeA.level))
                level = nodeA.level;
            else if (!isNaN(nodeB.level))
                level = nodeB.level;

            var indexA = getIndex(nodeA);
            var indexB = getIndex(nodeB);
            var index = ripple.pair(Math.min(indexA, indexB),
                                    Math.max(indexA, indexB));

            return (level in this.__walls) ?
                   this.__walls[level][index] : undefined;
        },

        makeWall: function(nodeA, nodeB) {
            var level = this.__defaultLevel;
            if (!isNaN(nodeA.level) && !isNaN(nodeB.level) &&
                (nodeA.level !== nodeB.level))
                throw new Error("nodes are on different levels");
            else if (!isNaN(nodeA.level))
                level = nodeA.level;
            else if (!isNaN(nodeB.level))
                level = nodeB.level;

            var indexA = getIndex(nodeA);
            var indexB = getIndex(nodeB);
            var index = ripple.pair(Math.min(indexA, indexB),
                                    Math.max(indexA, indexB));

            if (!(level in this.__walls))
                this.__walls[level] = {};
            this.__walls[level][index] = {
                nodeA: nodeA, nodeB: nodeB, door: false,
                points: this.__grid.getPairPoints(nodeA, nodeB)
            };
            return this;
        },

        eachWall: function(fn, context) {
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
        },

        makeDoor: function(nodeA, nodeB) {
            var level = this.__defaultLevel;
            if (!isNaN(nodeA.level) && !isNaN(nodeB.level) &&
                (nodeA.level !== nodeB.level))
                throw new Error("nodes are on different levels");
            else if (!isNaN(nodeA.level))
                level = nodeA.level;
            else if (!isNaN(nodeB.level))
                level = nodeB.level;

            var indexA = getIndex(nodeA);
            var indexB = getIndex(nodeB);
            var index = ripple.pair(Math.min(indexA, indexB),
                                    Math.max(indexA, indexB));

            if (!(level in this.__walls))
                this.__walls[level] = {};
            this.__walls[level][index] = {
                nodeA: nodeA, nodeB: nodeB, door: true,
                points: this.__grid.getPairPoints(nodeA, nodeB)
            };
            return this;
        },

        // Calls the supplied function for each level in the structure.
        // The context argument is supplied as "this" variable.
        // Arguments are:
        //   - Numeric level
        //   - This structure itself
        eachLevel: function(fn, context) {
            var originalLevel = this.__defaultLevel;
            Object.keys(this.__cellData).forEach(function(level) {
                fn.call(context, level, this.setLevel(level)); }, this);
            this.__defaultLevel = originalLevel;
            return this;
        },

        setLevel: function(level)
        { this.__defaultLevel = level; return this; },

        getRoomCount: function() { return this.__rooms.length; },

        getRoom: function(node) {
            if (node && !isNaN(node.x) && !isNaN(node.y))
                this.__grid.markCell(node);
            if (!node || isNaN(node.row) || isNaN(node.col))
                throw new Error("row and column must be numeric");
            return this.__roomMap[getIndex(node)];
        },

        eachRoom: function(fn, context) {
            this.__rooms.forEach(function(room) {
                fn.call(context, room, this); });
        },

        /**
         * Mark a cell for inclusion in a ship without
         * resolving the contents of that cell.  Call
         * the resolve method once all unresolved cells
         * have been marked. */
        setCellUnresolved: function(node) {
            this.setCell(node, Superposition.create(node));
        },

        /* Convert all unresolved cells to some component.
         * This method does its best to create a workable structure
         * according to given rules. */
        resolve: function(level) {
            if (!isNaN(level))
                return this.eachLevel(function(level) {
                    this.resolve(level); }, this);

            var distances = computeDistances(this, this.__grid);

            // Create an exterior hull and sort interior nodes
            // by their distance to a hull tile.
            var nodes = [];
            this.eachCell(function(contents, node, grid) {
                if (!Superposition.isPrototypeOf(contents))
                    return;
                node.distance = distances[getIndex(node)];
                if (node.distance <= 1)
                    this.setCell(node, Hull.create());
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
                if (roomMap[getIndex(node)])
                    continue; // Node was taken by a previous room

                var desiredNodes = Math.floor(25 + 12 * Math.random());
                var room = Room.create(this);

                while ((room.getNodeCount() < desiredNodes)) {
                    // Consume the current node
                    room.addNode(node);
                    roomMap[getIndex(node)] = room;

                    // Each neighbor is a candidate for expansion
                    var candidates = [];
                    room.eachNode(function(node) {
                        this.__grid
                            .eachNeighbor(node, function(neighbor) {
                                if (!neighbor.diagonal &&
                                    !roomMap[getIndex(neighbor)] &&
                                    !room.containsNode(neighbor) &&
                                    Superposition.isPrototypeOf(
                                        this.getCell(neighbor))) {
                                    neighbor.distance =
                                        distances[getIndex(neighbor)];
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
                        this.__grid.eachNeighbor(candidate, function(
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
            rooms.forEach(function(room, index) {
                roomIndices[index] = room;
                room.eachNode(function(node)
                    { nodeRooms[getIndex(node)] = index; });
            });
            var roomPeers = [];
            rooms.forEach(function(room, index) {
                var boundaries = {};
                roomPeers.push(boundaries);

                room.eachNode(function(node) {
                    this.__grid.eachNeighbor(node, function(neighbor) {
                        if (room.containsNode(neighbor) ||
                            Hull.isPrototypeOf(this.getCell(neighbor)))
                            return;
                        var peer = nodeRooms[getIndex(neighbor)];
                        if (isNaN(peer))
                            return this.makeWall(node, neighbor);

                        if (!boundaries[peer])
                            boundaries[peer] = [];
                        boundaries[peer].push({ a: node, b: neighbor });
                    }, this);
                }, this);
            }, this);
            roomPeers.forEach(function(boundaries, index) {
                Object.keys(boundaries).forEach(function(peer) {
                    if (peer < index)
                        return;
                    var pairs = ripple.shuffle(boundaries[peer]);
                    var door = pairs.shift();
                    this.makeDoor(door.a, door.b);

                    pairs.forEach(function(pair) {
                        this.makeWall(pair.a, pair.b);
                    }, this);
                }, this);
            }, this);
        },

        draw: function(ctx, camera) {
            this.__grid.mapRectangle(
                camera.toWorldFromScreen({x: 0, y: 0}),
                camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height}),
                function(node, index, grid) {
                    var cell = this.getCell(node);
                    if (cell)
                        cell.draw(ctx, node, grid, this);
                }, this);
            this.__grid.mapRectangle(
                camera.toWorldFromScreen({x: 0, y: 0}),
                camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height}),
                function(node, index, grid) {
                    var currentRoom = this.getRoom(node);

                    grid.eachNeighbor(node, function(neighbor) {
                        var wall = this.getWall(node, neighbor);
                        if (wall && wall.points &&
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
        },

        toJSON: function() {
            return {}; // TODO
        },

    };

    // A building is a single structure inside a habitat.
    var Building = Object.assign(Object.create(Structure), {
        create: function(config)
        { return Object.create(this).init(config); },

        init: function(config) {
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
        },

        __createRandomLayout: function() {
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
        },

        drawOverview: function(ctx, grid, node) {
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
        },
    });

    // A district is a substantial section of a space station.
    // Districts contain buildings and other structures that have an
    // effect on the station and its population.  Districts have a
    // type which reflects the kind of infrastructure they contain.
    // This infrastructure confers advantages and disadvantages.
    var District = {
        create: function(config) {
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
        },

        eachBuilding: function(fn, context) {
            var result = fn ? this : [];
            this.__buildings.forEach(function(building, index) {
                if (fn)
                    fn.call(context, building, index);
                else result.push(building);
            });
            return result;
        },

        addBuilding: function(building) {
            building.eachCell(function(cell, node) {
                this.__cellMap[getIndex(node)] =
                    building.getCell(node);
            }, this);
            this.__buildings.push(building);
        },

        __rand: Math,

        __randomType: function(rand) {
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
        },

        // Returns an equivalent lot such that the start row and column
        // are no greater than the end row and column.
        __orderLot: function(lot) {
            return ((lot.start.row <= lot.end.row) &&
                    (lot.start.col <= lot.end.col)) ? lot : {
                        start: {
                            row: Math.min(lot.start.row, lot.end.row),
                            col: Math.min(lot.start.col, lot.end.col)
                        }, end: {
                            row: Math.max(lot.start.row, lot.end.row),
                            col: Math.max(lot.start.col, lot.end.col)
                    }};
        },

        __splitLot: function(lot) {
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
        },

        __createRandomBuilding: function(lot, p_split, p_used) {
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
        },

        cellCount: 255,

        drawBackground: function(ctx, districtGrid, node) {
            ctx.beginPath();
            districtGrid.draw(ctx, node);
            ctx.fillStyle = this.type.color;
            ctx.fill();
            ctx.strokeStyle = "rgb(64,64,160)";
            ctx.lineWidth = 1;
            ctx.lineCap = "square";
            ctx.stroke();
        },

        drawOverview: function(ctx, districtGrid, node) {
            this.eachBuilding(function(building) {
                building.drawOverview(ctx, districtGrid, node); });
        },

        // Draw the icon for this district.  Each district type has an
        // optional icon which helps to identify the district type
        // when zoomed out.
        drawIcon: function(ctx, districtGrid, node) {
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
        },

        draw: function(ctx, camera, cellGrid, center) {
            cellGrid.mapRectangle(
                camera.toWorldFromScreen({x: 0, y: 0}),
                camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height}),
                function(node, index, cGrid) {
                    var range = Math.floor((District.cellCount - 1) / 2);
                    var relative = {row: center.row - node.row,
                                    col: center.col - node.col};

                    if ((Math.abs(relative.row) > range) ||
                        (Math.abs(relative.col) > range))
                        return; // Only draw if in our district

                    var contents = this.__cellMap[getIndex(relative)];
                    if (!contents) {
                        ctx.beginPath();
                        cellGrid.draw(ctx, node);
                        ctx.fillStyle = this.type.color;
                        ctx.fill();
                    } else contents.draw(ctx, node, cellGrid);
                }, this);
        }
    };

    var Station = {
        create: function(config) {
            var result = Object.create(this);

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
            result.rules = config && config.rules;
            result.districtGrid = grille.createGrid({
                type: "square", edge: District.cellCount});
            result.cellGrid = grille.createGrid({
                type: "square", edge: 1});
            result.rows = Math.min((config && config.rows) ?
                                   config.rows : 6, 6);
            result.cols = (config && config.cols) ? config.cols : 6;
            result.districts = [];
            for (var rr = 0; rr < result.rows; ++rr)
                for (var cc = 0; cc < result.cols; ++cc)
                    result.districts.push(District.create(
                        { rules: result.rules, random: true,
                          row: rr, col: cc }));
            return result;
        },

        getDistrict: function(row, col) {
            row = row % this.rows;
            if (row < 0)
                row += this.rows;
            return ((row >= 0) && (row < this.rows) &&
                    (col >= 0) && (col < this.cols)) ?
                   this.districts[row * this.cols + col] : null; },

        eachDistrict: function(fn, context) {
            var result = fn ? undefined : [];
            this.districts.forEach(function(district) {
                if (fn)
                    fn.call(context ? context : this, district);
                else result.push(district);
            }, this);
            return result;
        },

        draw: function(ctx, camera) {
            var size = Math.min(camera.height, camera.width);
            var districtPixels = camera.scale * District.cellCount;

            this.districtGrid.mapRectangle(
                camera.toWorldFromScreen({x: 0, y: 0}),
                camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height}),
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
    };

    ripple.export("structure", {
        Cell:          Cell,
        Structure:     Structure,

        Building: Building,
        District: District,
        Station:  Station
    });
}).call(this);

if ((typeof require !== "undefined") && (require.main === module)) {}