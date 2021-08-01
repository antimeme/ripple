// Habitat App
// Copyright (C) 2021 by Jeff Gold.  All rights reserved.
// Habitat is a science fiction video game for web browsers.  Players
// control a rotating space station with space for habitation.  The
// game takes place in the Kuiper Belt around 2220 CE and confines
// itself to scientifically plausible technologies.
(function(app) {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("./ripple/ripple.js");
        this.fascia   = require("./ripple/fascia.js");
        this.multivec = require("./ripple/multivec.js");
        this.grid     = require("./ripple/grid.js");
        this.pathf    = require("./ripple/pathf.js");
    }
    var rules = undefined;
    var station;


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
                    result.type = this.__randomType(result.rand);
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
            Object.keys(rules.districtTypes).forEach(function(name) {
                entries.push({
                    name: name,
                    weight: rules.districtTypes[name].randomWeight});
            });
            var selected = undefined;
            var determinant = ((rand ? rand : Math).random() *
                entries.reduce(function(accm, entry) {
                    return accm + entry.weight; }, 0));
            entries.forEach(function(entry) {
                if (!selected && (determinant < entry.weight))
                    selected = entry.name;
                else determinant -= entry.weight;
            });
            return rules.districtTypes[selected];
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
                var size = districtGrid.size();
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
            cellGrid.map({
                start: camera.toWorldFromScreen({x: 0, y: 0}),
                end:   camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height})
            }, function(node, index, cGrid) {
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
            result.districtGrid = grid.create({
                type: "square", size: District.cellCount});
            result.cellGrid = grid.create({type: "square", size: 1});
            result.rows = Math.min((config && config.rows) ?
                                   config.rows : 6, 6);
            result.cols = (config && config.cols) ? config.cols : 6;
            result.districts = [];
            for (var rr = 0; rr < result.rows; ++rr)
                for (var cc = 0; cc < result.cols; ++cc)
                    result.districts.push(District.create(
                        { random: true, row: rr, col: cc }));
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

            this.districtGrid.map({
                start: camera.toWorldFromScreen({x: 0, y: 0}),
                end:   camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height})
            }, function(node, index, dGrid) {
                var district = this.getDistrict(node.row, node.col);
                if (!district) {
                } else if (size < districtPixels / 10) {
                    var center = this.cellGrid.markCenter({
                        row: Math.floor(node.row * District.cellCount),
                        col: Math.floor(node.col * District.cellCount)
                    });
                    district.draw(ctx, camera, this.cellGrid, center);
                } else if (size < districtPixels * 3 / 2) {
                    district.drawBackground(ctx, this.districtGrid, node);
                    district.drawOverview(ctx, this.districtGrid, node);
                } else if (size < districtPixels * 3) {
                    district.drawBackground(ctx, this.districtGrid, node);
                    ctx.save();
                    ctx.globalAlpha = 0.2;
                    district.drawOverview(ctx, this.districtGrid, node);
                    ctx.restore();
                    district.drawIcon(ctx, this.districtGrid, node);
                } else {
                    district.drawBackground(ctx, this.districtGrid, node);
                    district.drawIcon(ctx, this.districtGrid, node);
                }
            }, this);
        }
    };

    var stationMode = {
        zoomMin: function(camera) {
            // A zoom value smaller than this would show one or more
            // rows more than once, since the cylinder wraps around.
            return Math.min(camera.width, camera.height) / (
                District.cellCount * station.rows);
        },
        zoomMax: function(camera) {
            // A zoom value larger than this would make a single
            // character cell take up more than a third of the screen
            // along its shortest dimension.  Getting that close
            // serves no purpose other than to confuse the user.
            return 1/3 * Math.min(camera.width, camera.height);
        },
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y,
                        this.zoomMin(camera), this.zoomMax(camera)); },
        pinchStart: function(event, camera) {
            this._pinchScale = camera.scale; },
        pinchMove: function(event, camera) {
            camera.setScale(this._pinchScale * event.length,
                            this.zoomMin(camera),
                            this.zoomMax(camera)); },
        drag: function(event, camera) {
            camera.pan({
                x: (event.last.x - event.current.x) / camera.scale,
                y: (event.last.y - event.current.y) / camera.scale });
        },
        tap: function(event, camera, now) {
            var point = station.cellGrid.markCell(
                camera.toWorldFromScreen(event.point));

            console.log("DEBUG-tap", point); },
        draw: function(ctx, camera, now) {
            station.draw(ctx, camera, now); }
    };

    var buildingMode = {
        resize: function(camera) {
            camera.setScale();
        },
        zoomMin: function(camera) {
        },
        zoomMax: function(camera) {
        },
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y,
                        this.zoomMin(camera), this.zoomMax(camera)); },
        pinchStart: function(event, camera) {
            this._pinchScale = camera.scale; },
        pinchMove: function(event, camera) {
            camera.setScale(this._pinchScale * event.length,
                            this.zoomMin(camera),
                            this.zoomMax(camera)); },
        tap: function(event, camera, now) { },
        draw: function(ctx, camera, now) { }
    };

    app.create = function(preloads) {
        rules = preloads["app.json"];
        station = Station.create({});
        return {
            modes: {
                station:  stationMode,
                building: buildingMode},
            mode: "station"
        };
    };

}).call(this, typeof exports === 'undefined'?
        (this.app = {}) : ((typeof module !== undefined) ?
                           (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {}
