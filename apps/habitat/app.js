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

    // A district is a substantial section of a space station.
    // Districts contain buildings and other structures that have an
    // effect on the station and its population.  Districts have a
    // type which reflects the kind of infrastructure they contain.
    // This infrastructur confers advantages and disadvantages to
    // buildings and other structures.
    var District = {
        create: function(config) {
            var result = Object.create(this);
            result.row = (config && config.row) ? config.row : 0;
            result.col = (config && config.col) ? config.col : 0;
            result.grid = grid.create({type: "square", size: 1});

            // For now we randomly assign a district type
            var rand   = (config && config.random) ?
                         config.random : Math;
            var names = Object.keys(this.types);
            result.type = this.types[
                names[Math.floor(rand.random() * names.length)]];

            result.buildings = [];
            for (var ii = 0; ii < 4; ++ii)
                result.buildings.push(Math.random());
            return result;
        },

        cellCount: 255,
        types: {
            residential:  { color: "lightblue" },
            commercial:   { color: "orangered" },
            industrial:   { color: "gray"      },
            recreational: { color: "green"     }
        },

        draw: function(ctx, camera, grid, node) {
            ctx.beginPath();
            grid.draw(ctx, node);
            ctx.fillStyle = this.type.color;
            ctx.fill();

            // Drawing is different depending on the scale.
            var size = Math.min(camera.width, camera.height);
            if (camera.scale * District.cellCount > 15 * size) {
                // At this scale we'll show individual features of
                // characters and structures...
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
                    // TODO
                }, this);
            } else if (camera.scale * District.cellCount > 5 * size) {
                // TODO: draw building outlines only
                ctx.strokeStyle = "rgb(64,64,160)";
                ctx.lineWidth = 1;
                ctx.lineCap = "square";
                ctx.stroke();
            } else {
                ctx.strokeStyle = "rgb(64,64,160)";
                ctx.lineWidth = 5;
                ctx.lineCap = "square";
                ctx.stroke();
            }
        }
    };

    var Station = {
        create: function(config) {
            var result = Object.create(this);
            result.grid = grid.create({
                type: "square", size: District.cellCount});
            result.rows = (config && config.rows) ? config.rows : 8;
            result.cols = (config && config.cols) ? config.cols : 12;
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
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y,
                        station.zoomMin, station.zoomMax); },
        pinchStart: function(event, camera) {
            this._pinchScale = camera.scale; },
        pinchMove: function(event, camera) {
            camera.setScale(this._pinchScale * event.length,
                            station.zoomMin, station.zoomMax); },
        drag: function(event, camera) {
            camera.pan({
                x: (event.last.x - event.current.x) / camera.scale,
                y: (event.last.y - event.current.y) / camera.scale });
        },
        tap: function(event, camera, now) {
            var point = station.grid.markCell(
                camera.toWorldFromScreen(event.point));
            console.log("DEBUG-tap", camera.scale, camera.height); },
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
