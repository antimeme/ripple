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
// This is primarily buildings (within space stations) and ships.
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

    // Base class for the contents of a cell in a ship or building.
    // A cell knows whether it is obstructed.
    var Cell = {
        create: function(config) {
            var result = Object.create(this);
            result.init(config);
            return result;
        },
        init: function(config) {
            this.__notifyList = [];
        },
        subclass: function(subclass) {
            var result = Object.create(this);
            Object.keys(subclass).forEach(function(key)
                { result[key] = subclass[key]; });
            return result;
        },
        isObstructed: function() { return false; },
        notify: function() {
            this.__notifyList.forEach(
                function(notify) { notify(this); }, this);
        },
        draw: function(ctx, node, grid, structure) {
            ctx.beginPath();
            grid.draw(ctx, node);
            ctx.fillStyle = "lightslategray";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(node.x, node.y, grid.getRadius() / 2,
                    0, 2 * Math.PI);
            if (structure.__selectedRoom &&
                structure.__selectedRoom.containsCell(
                    node.row, node.col))
                ctx.fillStyle = "maroon";
            else ctx.fillStyle = "midnightblue";
            ctx.fill();
        }
    };

    var Superposition = Cell.subclass({
        init: function(config) {
            this.row = config && config.row || 0;
            this.col = config && config.col || 0;
        },
    });

    var Hull = Cell.subclass({
        isObstructed: function() { return true; },
        draw: function(ctx, node, grid) {
            ctx.beginPath();
            grid.draw(ctx, node);
            ctx.fillStyle = "dimgray";
            ctx.fill();
        }
    });

    var cellTypes = {
        bulkhead: Cell.subclass({
            draw: function(ctx, node, grid) {
                ctx.beginPath();
                grid.draw(ctx, node);
                ctx.fillStyle = "gray";
                ctx.fill();
            }
        }),
        door: Cell.subclass({
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
        bedHead: Cell.subclass({
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
        bedFoot: Cell.subclass({
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
        dresser: Cell.subclass({
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
        desk: Cell.subclass({
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
        floor: Cell.subclass({
            draw: function(ctx, node, grid) {
            }
        }),
    };

    var Room = {
        create: function(structure) {
            var result = Object.create(this);
            result.__structure = structure;
            result.__cells = {};
            return result;
        },
        getCellCount: function() {
            return Object.keys(this.__cells).length;
        },
        addCell: function(row, col, level) {
            var index = ripple.pair(row, col);
            this.__cells[index] = true;
        },
        containsCell: function(row, col, level) {
            var index = ripple.pair(row, col);
            return this.__cells[index];
        },
        eachCell: function(fn, context) {
            Object.keys(this.__cells).forEach(function(index) {
                var node = ripple.unpair(index);
                node.row = node.x;
                node.col = node.y;
                var cell = this.__structure.getCell(
                    node.row, node.col);
                fn.call(context, cell, node, this);
            }, this);
        },
        setSelected: function() {
            this.__structure.__selectedRoom = this;
        }
    };

    var Structure = {
        create: function(config) {
            var result = Object.create(this);
            var gridConfig = undefined;
            var cellData = {};
            if (config) {
            } else gridConfig = {
                type: "square", diagonal: true, edge: 1};

            result.__grid = grille.createGrid(gridConfig);
            result.__cellData = cellData;
            result.__defaultLevel = 0;
            result.__rooms = [];
            result.__selectedRoom = undefined;
            return result;
        },

        getCell: function(row, col, level) {
            if (isNaN(row) || isNaN(col))
                throw new Error("row and column must be numeric");
            level = isNaN(level) ? this.__defaultLevel : level;
            return (level in this.__cellData) ?
                   this.__cellData[level][
                       ripple.pair(row, col)] : undefined;
        },

        setCell: function(value, row, col, level) {
            if (isNaN(row) || isNaN(col))
                throw new Error("row and column must be numeric");
            var index = ripple.pair(row, col);

            level = isNaN(level) ? this.__defaultLevel : level;
            if (!(level in this.__cellData))
                this.__cellData[level] = {};

            if (typeof(value) === "undefined")
                delete this.__cellData[level][index];
            else this.__cellData[level][index] = value;

            return this;
        },

        eachCell: function(fn, context) {
            var level = this.__defaultLevel;

            if (level in this.__cellData)
                Object.keys(this.__cellData[
                    this.__defaultLevel]).forEach(function(key) {
                        var node = ripple.unpair(key);
                        node.row = node.x;
                        node.col = node.y;
                        fn.call(context, this.__cellData[level][key],
                                this.__grid.markCenter(node),
                                this.__grid);
                    }, this);
        },

        eachLevel: function(fn, context) {
            Object.keys(this.__cellData).forEach(function(level) {
                fn.call(context, level, this); }, this);
        },

        setLevel: function(level) {
            this.__defaultLevel = level;
            return this;
        },

        getRoomCount: function() { return this.__rooms.length; },

        eachRoom: function(fn, context) {
            this.__rooms.forEach(function(room) {
                fn.call(context, room, this);
            });
        },

        /**
         * Mark a cell for inclusion in a ship without
         * resolving the contents of that cell.  Call
         * the resolve method once all unresolved cells
         * have been marked. */
        setCellUnresolved: function(row, col, level) {
            this.setCell(Superposition.create({
                row: row, col: col}), row, col, level);
        },

        /* Convert all unresolved cells to some ship component.
         * This method does its best to create a workable ship. */
        resolve: function() {
            // Convert tiles that border the void to hull
            var unresolved = [];
            this.eachCell(function(cell, node, grid) {
                if (Superposition.isPrototypeOf(cell)) {
                    var isHull = false;
                    grid.eachNeighbor(node, function(neighbor) {
                        var cell = this.getCell(
                            neighbor.row, neighbor.col);
                        if (typeof(cell) == "undefined")
                            isHull = true;
                    }, this);
                    if (!isHull)
                        unresolved.push(cell);
                    else return this.setCell(
                        Hull.create(), node.row, node.col);
                }
            }, this);
            ripple.shuffle(unresolved);

            var roomDesired = 36;
            var resolved = {};
            while (unresolved.length > 0) {
                var room = Room.create(this);
                var candidates = [unresolved.pop()];
                while ((candidates.length > 0) &&
                       (room.getCellCount() < roomDesired)) {
                    var current = candidates.shift();
                    var index = ripple.pair(current.row, current.col);
                    if (resolved[index])
                        continue;

                    var cell = this.getCell(current.row, current.col);
                    if (cell && Superposition.isPrototypeOf(cell)) {
                        room.addCell(current.row, current.col);
                        resolved[index] = true;
                        this.__grid.eachNeighbor(
                            current, function(neighbor) {
                                candidates.push(neighbor); });
                    }
                }

                if (room.getCellCount() > 0) {
                    this.__rooms.push(room);

                    room.eachCell(function(cell, node) {
                        this.__grid.eachNeighbor(
                            node, function(neighbor) {
                                var index = ripple.pair(
                                    neighbor.row, neighbor.col);
                                if (room.containsCell(
                                    neighbor.row, neighbor.col) ||
                                    resolved[index])
                                    return;

                                var cell = this.getCell(
                                    neighbor.row, neighbor.col);
                                if (cell &&
                                    Superposition.isPrototypeOf(cell)) {
                                    resolved[index] = true;
                                    this.setCell(
                                        cellTypes["bulkhead"],
                                        neighbor.row, neighbor.col);
                                }
                            }, this);
                    }, this);
                }
            }
        },

        draw: function(ctx, camera) {
            this.__grid.mapRectangle(
                camera.toWorldFromScreen({x: 0, y: 0}),
                camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height}),
                function(node, index, grid) {
                    var cell = this.getCell(node.row, node.col);
                    if (cell)
                        cell.draw(ctx, node, grid, this);
                }, this);
        },

        toJSON: function() {
            return {};
        },

    };

    // A building is a single structure inside a habitat.
    var Building = {
        create: function(config) {
            var result = Object.create(this);
            var rand = (config && config.rand) ? config.rand : Math;
            var lot = (config && config.lot) ? config.lot :
                      {start: {row: -10, col: -10},
                       end:   {row: 10, col: 10}};
            result.district = (config && config.district) ?
                              config.district : null;
            result.start = {
                row: Math.min(lot.start.row, lot.end.row),
                col: Math.min(lot.start.col, lot.end.col) };
            result.end = {
                row: Math.max(lot.start.row, lot.end.row),
                col: Math.max(lot.start.col, lot.end.col) };
            if (Math.abs(result.start.row - result.end.row) > 10) {
                result.start.row += 1 + Math.floor(rand.random() * 3);
                result.end.row -= 1 + Math.floor(rand.random() * 3);
            }
            if (Math.abs(result.start.col - result.end.col) > 10) {
                result.start.col += 1 + Math.floor(rand.random() * 3);
                result.end.col -= 1 + Math.floor(rand.random() * 3);
            }

            result.__cellEmpty = {
                draw: function(ctx, cellGrid, node) {
                    ctx.beginPath();
                    cellGrid.draw(ctx, node);
                    ctx.fillStyle = result.district.type.buildingColor;
                    ctx.fill();
                }
            };

            result.__cellWall = {
                draw: function(ctx, cellGrid, node) {
                    ctx.beginPath();
                    cellGrid.draw(ctx, node);
                    ctx.fillStyle = result.district.type.wallColor;
                    ctx.fill();
                }
            };

            result.__contents = {};
            if (config && config.randomize)
                result.__createRandomLayout();

            return result;
        },

        __setCell: function(row, col, value) {
            this.__contents[ripple.pair(row, col)] =
                this.__cellWall;
            return value;
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
                this.__setCell(row, col, this.__cellWall);

                col = this.end.col;
                this.__setCell(row, col, this.__cellWall);
            }
            for (col = this.start.col; col <= this.end.col; ++col) {
                row = this.start.row;
                this.__setCell(row, col, this.__cellWall);

                row = this.end.row;
                this.__setCell(row, col, this.__cellWall);
            }

            for (ii = 0; ii < rowRooms - 1; ++ii) {
                for (jj = 0; jj < buildingColSize; ++jj) {
                    row = this.start.row + ii * (roomSize + hallwaySize);
                    col = this.start.col + jj;

                    row += roomSize + 1;
                    this.__setCell(row, col, this.__cellWall);

                    row += hallwaySize - 1;
                    this.__setCell(row, col, this.__cellWall);
                }
            }
            for (jj = 0; jj < colRooms - 1; ++jj) {
                for (ii = 0; ii < buildingRowSize; ++ii) {
                    row = this.start.row + ii;
                    col = this.start.col + jj * (roomSize + hallwaySize);

                    col += roomSize + 1;
                    this.__setCell(row, col, this.__cellWall);

                    col += hallwaySize - 1;
                    this.__setCell(row, col, this.__cellWall);
                }
            }
        },

        eachCell: function(fn, context) {
            var result = fn ? this : [];
            var row, col;
            for (row = this.start.row; row <= this.end.row; ++row) {
                for (col = this.start.col; col <= this.end.col; ++col) {
                    var node = {row: row, col: col};
                    if (fn)
                        fn.call(context, node);
                    else result.push(node);
                }
            }
            return result;
        },

        getContents: function(node) {
            var result = null;
            if ((node.row >= this.start.row) ||
                (node.row <= this.end.row) ||
                (node.col >= this.start.col) ||
                (node.col <= this.end.col)) {
                var index = ripple.pair(node.row, node.col);
                if (index in this.__contents)
                    result = this.__contents[index];
                else result = this.__cellEmpty;
            }
            return result;
        },

        draw: function(ctx, grid, node) {
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
    };

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
            building.eachCell(function(cell) {
                this.__cellMap[ripple.pair(
                    cell.row, cell.col)] = building.getContents(cell);
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
                building.draw(ctx, districtGrid, node); });
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

                    var contents = this.__cellMap[ripple.pair(
                        relative.row, relative.col)];
                    if (!contents) {
                        ctx.beginPath();
                        cellGrid.draw(ctx, node);
                        ctx.fillStyle = this.type.color;
                        ctx.fill();
                    } else contents.draw(ctx, cellGrid, node);
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
        Superposition: Superposition,

        Building: Building,
        District: District,
        Station:  Station
    });
}).call(this);

if ((typeof require !== "undefined") && (require.main === module)) {}
