// Howitzer is a turn-based strategy game about armored conflict.
(function(app) {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("./ripple/ripple.js");
        this.fascia   = require("./ripple/fascia.js");
        this.multivec = require("./ripple/multivec.js");
        this.grid     = require("./ripple/grid.js");
        this.pathf    = require("./ripple/pathf.js");
    }

    var regionMode = {
        grid: grid.create({type: "hex", size: 100}),
        
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y); },
        draw: function(ctx, camera, now) {
            var size = Math.min(camera.height, camera.width);
            var count = 0;

            this.grid.map({
                start: {x: -camera.width / 2, y: -camera.height / 2},
                end: {x: camera.width / 2, y: camera.height / 2}
            }, function(node) {
                ctx.beginPath();
                this.grid.draw(ctx, this.grid.markCenter(node));
                ctx.fillStyle = "rgb(128,128,192)";
                ctx.fill();
                ctx.strokeStyle = "rgb(64,64,160)";
                ctx.lineWidth = 5;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-camera.width / 2, -camera.height / 2);
                ctx.lineTo(camera.width / 2, -camera.height / 2);
                ctx.lineTo(camera.width / 2, camera.height / 2);
                ctx.lineTo(-camera.width / 2, camera.height / 2);
                ctx.lineTo(-camera.width / 2, -camera.height / 2);
                ctx.lineWidth = 5;
                ctx.lineCap = "square";
                ctx.strokeStyle = "rgb(192,32,32)";
                ctx.stroke();

                ctx.font = "50px sans";
                ctx.fillStyle = "rgb(192,32,32)";
                ctx.fillText("" + ++count, node.x, node.y);
            }, this);
        }
    };

    app.create = function(preloads) {
        return {
            modes: {region: regionMode},
            mode: "region"
        };
    };

}).call(this, typeof exports === 'undefined'?
        (this.app = {}) : ((typeof module !== undefined) ?
                           (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {}
