// Stonewars is a game of strategy and tactics created by Julian Gold
(function(stonewars) {
    'use strict';
    var gsize = 20;

    stonewars.app = {
        grid: grid.create({type: 'hex', orient: 'edge', size: gsize}),
        gcells: 20, gsize: gsize, zoom: 1,
        pos: { x: 0, y: 0 },
        center: { x: 0, y: 0 },
        mark: null, zbase: null,
        selected: null, downcell: null,

        resize: function(width, height) {
            this.center.x = width / 2;
            this.center.y = height / 2;
            this.zshift(1);
        },

        update: function(elapsed) {
        },

        isActive: function() { return true; },


        shift: function(x, y) {
            var shifted = { x: x / this.zoom, y: y / this.zoom };
            var tolerance = 0.8;
            var gedge = this.gsize * this.gcells;

            if (this.pos.x + shifted.x < -tolerance * gedge)
                shifted.x = -tolerance * gedge - this.pos.x;
            if (this.pos.x + shifted.x > tolerance * gedge)
                shifted.x = tolerance * gedge - this.pos.x;
            if (this.pos.y + shifted.y < -tolerance * gedge)
                shifted.y = -tolerance * gedge - this.pos.y;
            if (this.pos.y + shifted.y > tolerance * gedge)
                shifted.y = tolerance * gedge - this.pos.y;
            this.pos.x += shifted.x;
            this.pos.y += shifted.y;
        },

        zshift: function(factor) {
            var zoom = this.zoom * ((factor > 0.1) ? factor : 0.1);
            var screen = Math.min(this.center.x, this.center.y) * 2;

            if (this.gcells * this.gsize * zoom < screen * 0.5)
                zoom = screen * 0.5 / (this.gcells * this.gsize);
            if (this.gcells * zoom > screen)
                zoom = screen / (this.gcells);
            this.zoom = zoom;
        },

        draw: function(ctx, width, height, now) {
            var row, col;

            ctx.save();

            ctx.translate(this.center.x, this.center.y);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(this.pos.x, this.pos.y);

            // Draw the game board
            ctx.beginPath();
            for (row = this.gcells / -2; row < this.gcells / 2; ++row)
                for (col = this.gcells / -2;
                    col < this.gcells / 2; ++col) {
                    this.grid.draw(
                        ctx, this.grid.coordinate
                        ({row: row, col: col}));
                }
            ctx.strokeStype = 'black';
            ctx.stroke();

            if (this.selected) {
                ctx.beginPath();
                this.grid.draw(ctx, this.selected);
                ctx.fillStyle = 'rgba(192, 192, 0, 0.8)';
                ctx.fill();
            }

            ctx.restore();
        },

        findCell: function(x, y) {
            return this.grid.position(
                {x: (x - this.center.x) / this.zoom - this.pos.x,
                 y: (y - this.center.y) / this.zoom - this.pos.y });
        },

        mtdown: function(targets, event, redraw) {
            if (targets.current.length === 1) {
                this.mark = targets;
                this.downcell = this.findCell(targets.x, targets.y);
            } else if (!this.mark && targets.current.length == 2) {
                this.zbase =
                    ((targets.current[0].x - targets.current[1].x) *
                     (targets.current[0].x - targets.current[1].x) +
                     (targets.current[0].y - targets.current[1].y) *
                     (targets.current[0].y - targets.current[1].y));
            }
        },
        mtmove: function(targets, event, redraw) {
            var zlen;

            if (this.mark) {
                this.shift(targets.x - this.mark.x,
                           targets.y - this.mark.y);
                this.mark = targets;
            } else if (this.zbase) {
                zlen =
                    ((targets.current[0].x - targets.current[1].x) *
                        (targets.current[0].x - targets.current[1].x) +
                      (targets.current[0].y - targets.current[1].y) *
                        (targets.current[0].y - targets.current[1].y));
                this.zshift(zlen / this.zbase);
            }
        },
        mtup: function(targets, event, redraw) {
            var downcell;

            if (this.downcell) {
                downcell = this.findCell(targets.x, targets.y);
                if (downcell.row === this.downcell.row &&
                    downcell.col === this.downcell.col &&
                    downcell.row >= -this.gcells / 2 &&
                    downcell.row < this.gcells / 2 &&
                    downcell.col >= -this.gcells / 2 &&
                    downcell.col < this.gcells / 2)
                    this.selected = downcell;
            }
            this.downcell = null;
            this.mark = null;
            this.zbase = null;
        },
        mwheel: function(event, redraw) {
            this.zshift((event.deltaY > 0) ? 1.2 :
                        ((event.deltaY < 0) ? 0.8 : 1));
        },
    };
    
})(typeof exports === 'undefined'? this['stonewars'] = {}: exports);
