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
            return result;
        },
        draw: function(ctx, grid, node) {
            ctx.beginPath();
            ctx.moveTo(node.x + this.start.row,
                       node.y + this.start.col);
            ctx.lineTo(node.x + this.end.row,
                       node.y + this.start.col);
            ctx.lineTo(node.x + this.end.row,
                       node.y + this.end.col);
            ctx.lineTo(node.x + this.start.row,
                       node.y + this.end.col);
            ctx.lineTo(node.x + this.start.row,
                       node.y + this.start.col);
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
    // This infrastructur confers advantages and disadvantages to
    // buildings and other structures.
    var District = {
        create: function(config) {
            var result = Object.create(this);
            result.grid = grid.create({type: "square", size: 1});
            result.row  = (config && config.row) ? config.row : 0;
            result.col  = (config && config.col) ? config.col : 0;
            result.rand = (config && config.random) ?
                          config.random : Math;
            if (config && config.type) {
                result.type = config.type;
            } else {
                var names = Object.keys(this.types);
                var name  = names[Math.floor(
                    result.rand.random() * names.length)];
                result.type = this.types[name];
            }

            result.buildings = [];
            result.vacantLots = [];
            result.__createRandomBuilding({
                start: {row: -Math.floor((this.cellCount - 1) / 2),
                        col: -Math.floor((this.cellCount - 1) / 2)},
                end: {row: Math.floor((this.cellCount - 1) / 2),
                      col: Math.floor((this.cellCount - 1) / 2)}},
                                          result.type.pSplit,
                                          result.type.pUsed);
            return result;
        },

        __rand: Math,

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
                    lot: lot, district: this});
            else this.vacantLots.push(lot);

            if (result)
                this.buildings.push(result);
        },

        cellCount: 255,
        types: {
            residential:  {
                pSplit: 0.99, pUsed: 0.96,
                color:         "rgb(192, 192, 240)",
                iconColor:     "rgb(96, 96, 240)",
                buildingColor: "rgb(96, 96, 240)",
                wallColor:     "rgb(32, 32, 128)",
                drawIcon: function(ctx, grid, node) {
                    var size = grid.size();
                    var width = 1/5;
                    var height = 1/10;
                    var peak = 1/10;
                    var door = 1/50;

                    ctx.save();
                    ctx.translate(node.x, node.y);
                    ctx.scale(size, size);
                    ctx.beginPath();
                    ctx.moveTo(0, -peak);
                    ctx.lineTo(-width/2, -height/2);
                    ctx.lineTo(-width/2,  height/2);
                    ctx.lineTo(-door,  height/2);
                    ctx.lineTo(-door,  height/2 - 2 * door);
                    ctx.lineTo(+door,  height/2 - 2 * door);
                    ctx.lineTo(+door,  height/2);
                    ctx.lineTo( width/2,  height/2);
                    ctx.lineTo( width/2, -height/2);
                    ctx.lineTo(0, -peak);
                    ctx.fillStyle = this.iconColor;
                    ctx.fill();
                    ctx.lineWidth = 0.01;
                    ctx.lineCap   = "round";
                    ctx.strokeStyle = "rgb(128, 128, 128)";
                    ctx.stroke();
                    ctx.restore();
                }
            },
            commercial:   {
                pSplit: 0.98, pUsed: 0.90,
                color:         "rgb(240, 128, 64)",
                iconColor:     "rgb(192, 96, 64)",
                buildingColor: "rgb(192, 96, 64)",
                wallColor:     "rgb(172, 64, 32)",
                drawIcon: function(ctx, grid, node) {
                    var size = grid.size();
                    var width = 1/10;
                    var height = 1/20;
                    var wheel = 1/75;
                    var door = 1/50;

                    ctx.save();
                    ctx.translate(node.x, node.y);
                    ctx.scale(2 * size, 2 * size);
                    ctx.beginPath();
                    ctx.moveTo(-2 * width/3 + 2*wheel/3, -height);
                    ctx.arc(-2 * width/3, -height, 2*wheel/3,
                            0, Math.PI * 2);
                    ctx.moveTo(-2 * width/3, -height);
                    ctx.lineTo(-width/2, -height/2);
                    ctx.lineTo(-5 * width/12, height/2);
                    ctx.lineTo(5 * width/12, height/3);
                    ctx.lineTo(width/2, -height/2);
                    ctx.lineTo(-5 * width/12, -height/2);
                    ctx.moveTo(-width/3 + wheel, height);
                    ctx.arc(-width/3, height, wheel,
                            0, Math.PI * 2);
                    ctx.moveTo(width/3 + wheel, height);
                    ctx.arc(width/3, height, wheel,
                            0, Math.PI * 2);
                    ctx.fillStyle = this.iconColor;
                    ctx.fill();
                    ctx.lineWidth = 0.01;
                    ctx.lineCap   = "round";
                    ctx.strokeStyle = "rgb(128, 128, 128)";
                    ctx.stroke();
                    ctx.restore();
                }
            },
            industrial:   {
                pSplit: 0.98, pUsed: 0.96,
                color: "darkgray",
                iconColor: "gray",
                buildingColor: "gray",
                wallColor: "gray",
                drawIcon: function(ctx) {
                }
            },
            recreational: {
                pSplit: 0.98, pUsed: 0.96,
                color: "green",
                iconColor: "forestgreen",
                buildingColor: "forestgreen",
                wallColor: "darkgreen",
                drawIcon: function(ctx) {
                }
            }
        },

        draw: function(ctx, camera, grid, node) {
            ctx.beginPath();
            grid.draw(ctx, node);
            ctx.fillStyle = this.type.color;
            ctx.fill();
            ctx.strokeStyle = "rgb(64,64,160)";
            ctx.lineWidth = 1;
            ctx.lineCap = "square";
            ctx.stroke();

            // Drawing is different depending on the scale.
            var size = Math.min(camera.width, camera.height);
            if (camera.scale * District.cellCount > 15 * size) {
                // At this scale we'll show individual features of
                // characters and buildings
                var offset = Math.floor(District.cellCount / 2);
                this.grid.map({
                    start: {x: node.x - offset, y: node.y - offset},
                    end:   {x: node.x + offset, y: node.y + offset}
                }, function(node) {
                    ctx.beginPath();
                    this.grid.draw(ctx, node);
                    ctx.lineWidth = 0.05;
                    ctx.strokeStyle = "rgb(64,64,160)";
                    ctx.stroke();

                    // TODO: place detailed building stuff
                    // TODO: draw a character if one is in this cell
                }, this);
            } else if (camera.scale * District.cellCount > size/3) {
                // At this scale buildings should be rendered in
                // an abstract form.
                this.buildings.forEach(function(building) {
                    building.draw(ctx, grid, node);
                }, this);
            } else this.type.drawIcon(ctx, grid, node);
        }
    };

    var Station = {
        create: function(config) {
            var result = Object.create(this);
            result.grid = grid.create({
                type: "square", size: District.cellCount});
            result.rows = (config && config.rows) ? config.rows : 12;
            result.cols = (config && config.cols) ? config.cols : 6;
            result.districts = [];
            for (var rr = 0; rr < result.rows; ++rr)
                for (var cc = 0; cc < result.cols; ++cc)
                    result.districts.push(District.create(
                        { row: rr, col: cc }));
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

            this.grid.map({
                start: camera.toWorldFromScreen({x: 0, y: 0}),
                end:   camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height})
            }, function(node) {
                var district = this.getDistrict(node.row, node.col);
                if (district)
                    district.draw(ctx, camera, this.grid, node);
            }, this);
        }
    };

    var station = Station.create({});

    var stationMode = {
        zoomMin: function(camera) {
            return Math.min(camera.width, camera.height) / (
                District.cellCount * station.rows);
        },
        zoomMax: function(camera) {
            // A zoom value larger than this would make a single
            // character cell take up more than a third of the screen.
            // Getting that close serves no purpose other than to
            // confuse the user.
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
            var point = station.grid.markCell(
                camera.toWorldFromScreen(event.point));

            var buildingCount = 0;
            var vacantCount   = 0;
            station.eachDistrict(function(district) {
                buildingCount += district.buildings.length;
                vacantCount   += district.vacantLots.length;
            });
            console.log("DEBUG-tap", buildingCount, vacantCount); },
        draw: function(ctx, camera, now) {
            station.draw(ctx, camera, now); }
    };

    app.create = function(preloads) {
        return {
            modes: {station: stationMode},
            mode: "station"
        };
    };

}).call(this, typeof exports === 'undefined'?
        (this.app = {}) : ((typeof module !== undefined) ?
                           (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {}
