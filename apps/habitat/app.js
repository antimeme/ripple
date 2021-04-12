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

    var createStation = function(config) {
        if (!(this instanceof createStation))
            return new createStation(config);
        this.rows = (config && config.rows) ? config.rows : 5;
        this.cols = (config && config.cols) ? config.cols : 5;
    };
    createStation.prototype.getDistrict = function(row, col) {
        
    };

    var station = createStation({});

    var stationMode = {
        grid: grid.create({type: "square", size: 100}),
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y); },
        drag: function(event, camera) {
            camera.pan({
                x: (event.last.x - event.current.x) /
                camera.scale,
                y: (event.last.y - event.current.y) /
                camera.scale }); },
        draw: function(ctx, camera, now) {
            var size = Math.min(camera.height, camera.width);

            this.grid.map({
                start: camera.toWorldFromScreen({x: 0, y: 0}),
                end:   camera.toWorldFromScreen(
                    {x: camera.width, y: camera.height})
            }, function(node) {
                if ((node.row < 0) || (node.row > 10) ||
                    (node.col < 0) || (node.col > 10))
                    return;

                var colors = ["blue", "red", "green",
                              "cyan", "magenta", "yellow"];

                ctx.beginPath();
                this.grid.draw(ctx, this.grid.markCenter(node));
                ctx.fillStyle = colors[(node.col + node.row) %
                    colors.length];
                ctx.fill();
                ctx.strokeStyle = "rgb(64,64,160)";
                ctx.lineWidth = 5;
                ctx.stroke();
            }, this);
        }
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
