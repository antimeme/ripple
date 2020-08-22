// Stonewars is a game of strategy and tactics created by Julian Gold
(function(stonewars) {
    'use strict';
    var gsize = 20;

    stonewars.app = function() { return {
        grid: grid.create({type: 'hex', orient: 'edge', size: gsize}),
        gcells: 20, gsize: gsize, zoom: 1,
        pos: { x: 0, y: 0 },
        center: { x: 0, y: 0 },
        mark: null, zbase: null,
        selected: null, downcell: null,

        isActive: function() { return true; },

        draw: function(ctx, camera, now) {
            var row, col;

            // Draw the game board
            ctx.beginPath();
            for (row = this.gcells / -2; row < this.gcells / 2; ++row)
                for (col = this.gcells / -2;
                    col < this.gcells / 2; ++col) {
                    this.grid.draw(
                        ctx, this.grid.markCenter(
                            {row: row, col: col}));
                }
            ctx.strokeStype = 'black';
            ctx.stroke();

            if (this.selected) {
                ctx.beginPath();
                this.grid.draw(ctx, this.selected);
                ctx.fillStyle = 'rgba(192, 192, 0, 0.8)';
                ctx.fill();
            }
        },

        findCell: function(x, y) {
            return this.grid.getCell(
                {x: (x - this.center.x) / this.zoom - this.pos.x,
                 y: (y - this.center.y) / this.zoom - this.pos.y });
        },

        drag: function(event, camera) {
            camera.pan({
                x: (event.last.x - event.current.x) / camera.scale,
                y: (event.last.y - event.current.y) / camera.scale });
        },
        wheel: function(event, camera) {
            var size = Math.min(camera.width, camera.height);
            camera.zoom(
                1 + (0.1 * (event.y > 0 ? 1 : -1)),
                this.gsize * this.grid.size() / size,
                size / this.grid.size());
        },
    }; };
    
})(typeof exports === 'undefined'? this['stonewars'] = {}: exports);
