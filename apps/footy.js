(function(exports) {
    "use strict";
    var nplayers = Math.max(2, Math.min(
        parseInt(window.params['nplayers'], 10) || 4, 12));
    var pfactor = Math.max(10, parseInt(
        window.params['pfactor'], 10) || (7 * nplayers));
    var activate = parseInt(window.params['activate'], 10) || 600;
    var margin = Math.max(3, parseFloat(
        window.params['margin']) || 20);

    var setup = function(index, object) {
        var self = $(object);
        var viewport = $(window);

        var player_update = function(elapsed) {
            var step, steplen, fraction;
            var distance = this.speed * elapsed;
            while (distance > 0) {
                step = this.steps.shift();
                if (step) {
                    steplen = Math.sqrt(
                        ((step.lpos - this.lpos) *
                         (step.lpos - this.lpos)) +
                            ((step.spos - this.spos) *
                             (step.spos - this.spos)));
                    fraction = Math.min(distance / steplen, 1);
                    this.lpos += (step.lpos - this.lpos) * fraction;
                    this.spos += (step.spos - this.spos) * fraction;
                    if (distance < steplen)
                        this.steps.unshift(step);
                    distance -= fraction * steplen;
                } else distance = 0;
            }
            return this;
        };

        var create_player = function(lpos, spos, options) {
            return {
                lpos: lpos, spos: spos,
                color: options && options.color ?
                    options.color : 'black',
                speed: options && options.speed ?
                    options.speed : 0.0005,
                steps: [], update: player_update };
        };

        // A field abstraction that can draw indepently of orientation.
        var field = {
            origin: {x: 0, y: 0},
            s: {x: 0, y: 0},
            l: {x: 0, y: 0},
            lmagnitude: 0, smagnitude: 0,

            position: function(x, y) {
                var vector = {x: x - this.origin.x,
                              y: y - this.origin.y};
                return {lpos: (vector.x * this.l.x +
                               vector.y * this.l.y) /
                        (this.lmagnitude * this.lmagnitude),
                        spos: (vector.x * this.s.x +
                               vector.y * this.s.y) /
                        (this.smagnitude * this.smagnitude)};
            },
            coord: function(lpos, spos) {
                var index;
                var result = [
                    this.origin.x + spos * this.s.x + lpos * this.l.x,
                    this.origin.y + spos * this.s.y + lpos * this.l.y];
                for (index = 2; index < arguments.length; ++index)
                    result.push(arguments[index]);
                return result;
            },
            size: function(width, height) {
                // Position the field of the field to make the best
                // use of available space
                var lside, sside, wide, mfactor, padding;
                if (width > height) {
                    lside = width; sside = height; wide = 1;
                } else { lside = height; sside = width; wide = 0; }

                mfactor = Math.max(0, (3 - 2 * (lside / sside)) / 6) +
                    (1 / margin);
                this.lmagnitude = sside * (3 - 6 * mfactor) / 2;
                this.smagnitude = sside * (1 - 2 * mfactor);
                padding = (2 * lside + (2 * mfactor - 3) * sside) / 4;

                this.origin = {
                    x: sside * mfactor + wide * padding +
                        this.smagnitude * !wide,
                    y: sside * mfactor + !wide * padding};
                this.s = { x: -this.smagnitude * !wide,
                           y: this.smagnitude * wide };
                this.l = { x: this.lmagnitude * wide,
                           y: this.lmagnitude * !wide };
                return this;
            },
            draw: function(ctx) {
                ctx.lineWidth = 5;
                ctx.lineCap = 'square';

                // Create turf
                ctx.beginPath();
                ctx.fillStyle = 'green';
                ctx.moveTo.apply(ctx, field.coord(0, 0));
                ctx.lineTo.apply(ctx, field.coord(1, 0));
                ctx.lineTo.apply(ctx, field.coord(1, 1));
                ctx.lineTo.apply(ctx, field.coord(0, 1));
                ctx.lineTo.apply(ctx, field.coord(0, 0));
                ctx.fill();

                // Mark red goal
                ctx.beginPath();
                ctx.strokeStyle = 'red';
                ctx.moveTo.apply(ctx, field.coord(0, 0.20));
                ctx.lineTo.apply(ctx, field.coord(0, 0.80));
                ctx.stroke();

                // Mark blue goal
                ctx.beginPath();
                ctx.strokeStyle = 'blue';
                ctx.moveTo.apply(ctx, field.coord(1, 0.20));
                ctx.lineTo.apply(ctx, field.coord(1, 0.80));
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = 'white';

                // Center Line
                ctx.arc.apply(ctx, field.coord(
                    0.5, 0.5, field.lmagnitude * 0.1, 0, 2 * Math.PI));
                ctx.moveTo.apply(ctx, field.coord(0.5, 0));
                ctx.lineTo.apply(ctx, field.coord(0.5, 1));

                // Bounding Line
                ctx.moveTo.apply(ctx, field.coord(0, 0));
                ctx.lineTo.apply(ctx, field.coord(1, 0));
                ctx.lineTo.apply(ctx, field.coord(1, 0.2));
                ctx.moveTo.apply(ctx, field.coord(1, 0.8));
                ctx.lineTo.apply(ctx, field.coord(1, 1));
                ctx.lineTo.apply(ctx, field.coord(0, 1));
                ctx.lineTo.apply(ctx, field.coord(0, 0.8));
                ctx.moveTo.apply(ctx, field.coord(0, 0.2));
                ctx.lineTo.apply(ctx, field.coord(0, 0));

                // Near Goal Box
                ctx.moveTo.apply(ctx, field.coord(0, 0.2));
                ctx.lineTo.apply(ctx, field.coord(0.18, 0.2));
                ctx.lineTo.apply(ctx, field.coord(0.18, 0.8));
                ctx.lineTo.apply(ctx, field.coord(0, 0.8));

                // Far Goal Box
                ctx.moveTo.apply(ctx, field.coord(1, 0.2));
                ctx.lineTo.apply(ctx, field.coord(0.82, 0.2));
                ctx.lineTo.apply(ctx, field.coord(0.82, 0.8));
                ctx.lineTo.apply(ctx, field.coord(1, 0.8));

                ctx.stroke();
                return this;
            }
        };
        var selected = undefined;
        var target = undefined;
        var players = [];
        var player_radius = 1; // relative to canvas

        for (var i = 0; i < nplayers; ++i) {
            var spos = (i + 1) / (nplayers + 1);
            players.push(create_player(0.25, spos, {color: 'red'}));
            players.push(create_player(0.75, spos, {color: 'blue'}));
        }

        var updated = new Date().getTime();
        var moving = false, still_moving;
        var last_tap = 0;
        var draw_id = 0;
        var draw = function() {
            var now = new Date().getTime();
            var index, player, step, stepi;
            draw_id = 0;

            if (self[0].getContext) {
                var width = self.width();
                var height = self.height();
                var ctx = self[0].getContext('2d');
                ctx.save();
                ctx.clearRect(0, 0, width, height);
                field.size(width, height).draw(ctx);

                player_radius = field.lmagnitude / pfactor;
                still_moving = false;
                for (index in players) {
                    player = players[index];
                    if (moving) {
                        if (player.steps.length) {
                            player.update(now - updated);
                            redraw();
                        }
                        if (player.steps.length)
                            still_moving = true;
                    }
                }
                moving = still_moving;
                updated = now;

                for (index in players) {
                    player = players[index];

                    if (player.steps.length) {
                        step = player.steps[player.steps.length - 1];
                        ctx.beginPath();
                        ctx.arc.apply(ctx, field.coord(
                            step.lpos, step.spos,
                            2 * player_radius / 3, 0, 2 * Math.PI));
                        ctx.moveTo.apply(ctx, field.coord(
                            player.lpos, player.spos));
                        for (stepi = 0; stepi < player.steps.length;
                             ++stepi) {
                            step = player.steps[stepi];
                            ctx.lineTo.apply(ctx, field.coord(
                                step.lpos, step.spos));
                        }
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.strokeStyle = 'rgba(64, 64, 64, 0.8)';
                        ctx.stroke();
                    }
                }
                if (target && selected) {
                    if (selected.steps.length)
                        step = selected.steps[
                            selected.steps.length - 1];
                    else step = selected;

                    ctx.beginPath();
                    ctx.arc.apply(ctx, field.coord(
                        target.lpos, target.spos,
                        player_radius, 0, 2 * Math.PI));
                    ctx.moveTo.apply(ctx, field.coord(
                        step.lpos, step.spos));
                    ctx.lineTo.apply(ctx, field.coord(
                        target.lpos, target.spos));
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = 'rgba(255, 255, 64, 0.8)';
                    ctx.stroke();
                }
                for (index in players) {
                    player = players[index];

                    ctx.beginPath();
                    ctx.arc.apply(ctx, field.coord(
                        player.lpos, player.spos, player_radius,
                        0, 2 * Math.PI));
                    ctx.fillStyle = (player == selected) ?
                        'purple' : player.color;
                    ctx.fill();
                }

                ctx.restore();
            }
        };
        var redraw = function() {
            if (!draw_id)
                draw_id = requestAnimationFrame(draw);
        };

        var resize = function(event) {
            // Consume enough space to fill the viewport.
            self.height(viewport.height());
            self.width(viewport.width());

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            self.attr("width", self.innerWidth());
            self.attr("height", self.innerHeight());

            redraw();
        };
        viewport.resize(resize);
        resize();

        // Process mouse and touch events
        self.on('mousedown touchstart', function(event) {
            var index;
            var player, step, coord, best, dsquared, clear;
            var point, now;
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else {
                point = $.targets(event);
                best = -1; selected = null;
                for (index in players) {
                    player = players[index];
                    coord = field.coord(player.lpos, player.spos);
                    dsquared =
                        ((point.x - coord[0]) *
                         (point.x - coord[0])) +
                        ((point.y - coord[1]) *
                         (point.y - coord[1]));
                    if (dsquared < 4 * player_radius * player_radius) {
                        if (best < 0 || dsquared < best) {
                            selected = player;
                            best = dsquared;
                            clear = true;
                        }
                    }

                    if (player.steps.length) {
                        step = player.steps[player.steps.length - 1];
                        coord = field.coord(step.lpos, step.spos);
                        dsquared =
                            ((point.x - coord[0]) *
                             (point.x - coord[0])) +
                            ((point.y - coord[1]) *
                             (point.y - coord[1]));
                        if (dsquared < 4 * player_radius *
                            player_radius) {
                            if (best < 0 || dsquared < best) {
                                selected = player;
                                best = dsquared;
                                clear = false;
                            }
                        }
                    }
                }

                if (selected) {
                    if (clear)
                        selected.steps = [];
                } else {
                    now = new Date().getTime();
                    if (activate > now - last_tap)
                        moving = !moving;
                    last_tap = now;
                }
                redraw();
            }
            return false;
        });
        self.on('mousemove touchmove', function(event) {
            var point, vec;
            if (selected) {
                point = $.targets(event);
                target = field.position(point.x, point.y);
                redraw();
            }
            return false;
        });
        self.on('mouseleave mouseup touchend', function(event) {
            if (selected) {
                if (target) {
                    selected.steps.push(target);
                    target = undefined;
                }
                selected = undefined;
                redraw();
            }
            return false;
        });

        $('body').on('keyup', self, function(event) {
            if (event.keyCode == 32) {
                moving = !moving;
                redraw();
            }
            return false;
        });
    };

    exports.setup = setup;
})(typeof exports === 'undefined'? this['footy'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    "use strict";
}
