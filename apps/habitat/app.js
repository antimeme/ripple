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

    var station = createStation({});

    var stationMode = {
        grid: grid.create({type: "square", size: 100}),
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y); },
        draw: function(ctx, camera, now) {
            var size = Math.min(camera.height, camera.width);

            this.grid.map({
                start: {x: -camera.width / 4, y: -camera.height / 4},
                end: {x: camera.width / 4, y: camera.height / 4}
            }, function(node) {
                ctx.beginPath();
                this.grid.draw(ctx, this.grid.markCenter(node));
                ctx.fillStyle = "rgb(128,128,192)";
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
