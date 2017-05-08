// whiplash.js
// Copyright (C) 2016 by Simon Gold and Jeff Gold.
//
// Whiplash Paradox is a game about time travel
(function(whiplash) {
    "use strict";

    var processWall = function(wall) {
        var result = {
            s: ripple.vector.convert(wall.s),
            e: ripple.vector.convert(wall.e)};
        result.q = wall.q ? ripple.vector.convert(wall.q) :
                   result.e.minus(result.s);
        result.sqlen = wall.sqlen ? wall.sqlen : result.q.sqlen();
        result.width = wall.width ? wall.width : 0.5;
        return result;
    };

    var zclamp = function(state, zoom) {
        if (zoom < state.zoom.min)
            zoom = state.zoom.min;
        if (zoom > state.zoom.max)
            zoom = state.zoom.max;
        state.zoom.value = zoom;
    };

    var drawBackground = function(ctx, state, now) {
        var first = true;
        var lineWidth = undefined;

        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.arc(10, 0, 1, 0, 2 * Math.PI);
        ctx.moveTo(-10, 0);
        ctx.arc(-10, 0, 1, 0, 2 * Math.PI);
        ctx.moveTo(0, 10);
        ctx.arc(0, 10, 1, 0, 2 * Math.PI);
        ctx.moveTo(0, -10);
        ctx.arc(0, -10, 1, 0, 2 * Math.PI);
        ctx.fillStyle = 'green';
        ctx.fill();

        ctx.lineCap = 'round';
        ctx.strokeStyle = 'purple';
        ctx.beginPath();
        state.walls.forEach(function(wall) {
            if (typeof(lineWidth) !== 'undefined' &&
                lineWidth != wall.width) {
                ctx.stroke();
                ctx.beginPath();
            }
            ctx.lineWidth = lineWidth = wall.width;
            ctx.moveTo(wall.s.x, wall.s.y);
            ctx.lineTo(wall.e.x, wall.e.y);

            if (first) {
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = 'green';
                first = false;
            }
        });
        ctx.stroke();
    };

    var drawVision = function(ctx, character, state, now) {
        var size;
        if (character.visionRange && character.visionArc &&
            character.visionColor) {
            size = character.size;
            ctx.save();
            ctx.translate(character.position.x, character.position.y);
            ctx.rotate(character.direction);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, size * character.visionRange,
                   -character.visionArc, character.visionArc);
            ctx.fillStyle = character.visionColor;
            ctx.fill();
            ctx.restore();
        }
    };

    var drawPerson = function(ctx, character, state, now) {
        var size = character.size;
        ctx.save();
        ctx.translate(character.position.x, character.position.y);
        ctx.rotate(character.direction);

        ctx.scale(0.8, 1);
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = character.bodyColor;
        ctx.fill();

        ctx.scale(1.25, 1);
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = character.headColor;
        ctx.fill();

        if (!character.blinkFreq || !character.blinkLength ||
            ((now + character.blinkPhase) % character.blinkFreq) >
            character.blinkLength) {
            ctx.beginPath();
            ctx.arc(size * 0.2, size * -0.2,
                    size * 0.1, 0, Math.PI * 2);
            ctx.fillStyle = character.eyeColor;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.arc(size * 0.2, size * 0.2,
                    size * 0.1, 0, Math.PI * 2);
            ctx.fillStyle = character.eyeColor;
            ctx.fill();
        }
        ctx.restore();
    };

    /**
     * A character is a representation of a humanoid create.
     * Characters have the following properties:
     *
     *   position: vector location
     *   direction: radians angle with x axis
     *   size: number radius
     *   speed: number movement rate
     *   destination: vector location of desired update move
     *
     *   headColor: color for head
     *   bodyColor: color for body
     *   eyeColor: color for eyes
     *   blinkFreq: milliseconds between blinks
     *   blinkLength: milliseconds duration
     *   blinkPhase: milliseconds start of blink cycle
     *   visionRange: meters radius of vision cone
     *   visionArc: radians angle of vision cone
     *   visionColor: color of vision cone
     */
    var makeCharacter = function(config) {
        return {
            position: ripple.vector.create(
                config.x || 0, config.y || 0),
            direction: config.direction || 0,
            size: config.size || 1,
            speed: config.speed || 0.005,
            destination: null,

            headColor: config.headColor || 'darkgray',
            bodyColor: config.bodyColor || 'black',
            eyeColor: config.eyeColor || 'white',
            blinkFreq: config.blinkFreq || 4000,
            blinkLength: config.blinkLength || 250,
            blinkPhase: config.blinkPhase || (Math.random() * 1000),
            visionRange: config.visionRange || 0,
            visionArc: config.visionArc || (Math.PI / 10),
            visionColor: config.visionColor ||
                         'rgba(255, 255, 255, 0.25)',

            last: config.last || new Date().getTime(),

            update: config.update || function(state, now) {
                if (this.destination) {
                    this.position = this.destination;
                    this.destination = null;
                }
            },

            plan: config.plan || function(state, now) {
                // idle
            },

            drawPre: config.drawPre || function(ctx, state, now) {
                drawVision(ctx, this, state, now);
            },

            draw: config.draw || function(ctx, state, now) {
                drawPerson(ctx, this, state, now);
            }
        };
    };

    var makePlayer = function(config) {
        var result = makeCharacter(config);
        result.control = {
            up: false, down: false,
            left: false, right: false,
            sleft: false, sright: false,
            arrow: null,
            clear: function() {
                this.up = this.down =
                    this.left = this.right =
                        this.sleft = this.sright = false; }};

        result.plan = function(state, now) {
            var steps = this.speed * (now - this.last);
            var rots = 0.005 * (now - this.last);
            var dirvec;

            if (this.control.arrow) {
                // Process swipe arrows
                dirvec = ripple.vector.create(
                    Math.cos(this.direction),
                    Math.sin(this.direction));
                if (this.control.arrow.dotp(dirvec) <
                    Math.cos(Math.PI / 10)) {
                    if (dirvec.x * this.control.arrow.y -
                        dirvec.y * this.control.arrow.x < 0)
                        this.direction -= rots;
                    else this.direction += rots;
                } else {
                    this.destination = riple.vector.create(
                        this.position.x +
                        Math.cos(this.direction) * steps,
                        this.position.y +
                        Math.sin(this.direction) * steps);
                }
            } else {
                // Process WASD and arrow keys
                if (this.control.left && !this.control.right) {
                    this.direction -= rots;
                } else if (!this.control.left &&
                           this.control.right) {
                    this.direction += rots;
                }

                if (this.control.up && !this.control.down) {
                    this.destination = ripple.vector.create(
                        this.position.x +
                        Math.cos(this.direction) * steps,
                        this.position.y +
                        Math.sin(this.direction) * steps);
                } else if (!this.control.up && this.control.down) {
                    // Reverse direction at reduced speed
                    this.destination = ripple.vector.create(
                        this.position.x -
                        Math.cos(this.direction) * steps * 0.75,
                        this.position.y -
                        Math.sin(this.direction) * steps * 0.75);
                }
            }
            this.last = now;
        };
        return result;
    };

    var makeGuard = function(config) {
        var result = makeCharacter(config);

        result.plan = function(state, now) {
            // FIXME this doesn't work anymore?
            var steps = this.speed * (now - this.last);
            var rots = 0.005 * (now - this.last);
            var pdir = ripple.vector.create(
                state.player.position.x - this.position.x,
                state.player.position.y - this.position.y).norm();
            var direction, target;

            if (pdir.dotp(ripple.vector.create(
                Math.cos(this.direction),
                Math.sin(this.direction))) <
                Math.cos(Math.PI / 10)) {
                if ((state.player.position.x - this.position.x) *
                    Math.sin(this.direction) -
                    (state.player.position.y - this.position.y) *
                    Math.cos(this.direction) < 0)
                    this.direction += rots;
                else this.direction -= rots;
            } else if (pdir.originalLength >
                this.size * this.visionRange) {
                direction = {
                    x: Math.cos(this.direction),
                    y: Math.sin(this.direction)};

                state.characters.forEach(function(current) {
                    if (current === this)
                        return;
                }, this);
                this.destination = ripple.vector.create(
                    this.position.x + direction.x * steps,
                    this.position.y + direction.y * steps);
            }
            this.last = now;
        };
        return result;
    };

    var update = function(now) {
        if (!now)
            now = new Date().getTime();
	this.characters.forEach(function(character) {
            character.plan(this, now);
        }, this);

        // Only player can collide with walls for now
        if (this.player.destination && this.walls.length > 0) {
            var wall = this.walls[0];
            var r = this.player.size;
            var s = this.player.position;
            var e = this.player.destination;
            var q = wall.q ? wall.q : wall.e.minus(wall.s);
            var sqlen = wall.sqlen ? wall.sqlen : q.sqlen();
            var metric =
                wall.s.minus(e).minus(
                    q.times(wall.s.minus(e).dotp(q) / sqlen) ).sqlen() -
                ((r + wall.width) * (r + wall.width));
            console.log(metric, ripple.collideRadiusSegment(
                s, e, r, wall));
        }

        this.characters.forEach(function(character) {
            character.update(this, now);
        }, this);
    };

    whiplash.go = function($, container, viewport, data) {
        // State arrow can be either:
        //   {x, y} - unit vector indicating direction
        //   undefined - arrow in process of being set
        //   null - arrow not set
        var state = {
            height: 320, width: 320,
            zoom: { value: 50, min: 10, max: 150, reference: 0 },
            swipe: null, tap: null, mmove: null, arrow: null,
            characters: [], player: null,
            walls: data.walls.map(processWall),
            update: update
        };

	state.characters.push(state.player = makePlayer(
            data.chartypes['player']));
        state.characters.push(makeGuard(ripple.mergeConfig(
            {x: -5, y: -5}, data.chartypes['guard'])));
        //state.characters.push(makeGuard(5, -5));
        //state.characters.push(makeGuard(-5, 5));
        //state.characters.push(makeGuard(5, 5));
        state.characters.push(makeCharacter({x: 5, y: 5}));

        ripple.app($, container, viewport, {
            draw: function(ctx, width, height, now, last) {
                var size;
                var lineWidth;
                lineWidth = Math.max(width, height) / 50;

                if (now - last < 1000)
                    state.update(now, last);

                ctx.save();
                ctx.scale(state.zoom.value, state.zoom.value)
                ctx.translate((width / (2 * state.zoom.value)) -
                              state.player.position.x,
                              (height / (2 * state.zoom.value)) -
                              state.player.position.y);
                ctx.lineWidth = lineWidth;

                state.characters.forEach(function(character) {
                    if (character.drawPre)
                        character.drawPre(ctx, state, now);
                });

                drawBackground(ctx, state, now);

                state.characters.forEach(function(character) {
                    if (character.draw)
                        character.draw(ctx, state, now);
                });

                state.characters.forEach(function(character) {
                    if (character.drawPost)
                        character.drawPost(ctx, state, now);
                });

                size = Math.min(state.height, state.width);

                ctx.restore();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.font = 'bold ' + Math.round(size / 20) + 'px sans';
                ctx.fillText('Whiplash Paradox',
                             state.width / 2, size / 50);

            },
            resize: function(width, height) {
                state.width = width;
                state.height = height;
            },
            keydown: function(event, redraw) {
                // Recognize WASD and arrow keys
	        if (event.keyCode == 37 || event.keyCode == 65) {
		    state.player.control.left = true;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 38 || event.keyCode == 87) {
                    state.player.control.up = true;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 39 || event.keyCode == 68) {
		    state.player.control.right = true;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 40 || event.keyCode == 83) {
		    state.player.control.down = true;
                    state.player.control.arrow = null;
                    state.update();
	        }
                redraw();
            },
            keyup: function(event, redraw) {
                // Recognize WASD and arrow keys
	        if (event.keyCode == 37 || event.keyCode == 65) {
		    state.player.control.left = false;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 38 || event.keyCode == 87) {
                    state.player.control.up = false;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 39 || event.keyCode == 68) {
		    state.player.control.right = false;
                    state.player.control.arrow = null;
                    state.update();
	        } else if (event.keyCode == 40 || event.keyCode == 83) {
		    state.player.control.down = false;
                    state.player.control.arrow = null;
                    state.update();
	        }
                redraw();
            },
            mtdown: function(targets, event, redraw) {
                state.tap = targets;
                state.arrow = null;
                state.mmove = null;
                if (state.tap.touches.length > 1) {
                    state.zoom.reference =
                        ripple.vector.create(
                            state.tap.touches[0].x -
                            state.tap.touches[1].x,
                            state.tap.touches[0].y -
                            state.tap.touches[1].y
                        ).sqlen();
                } else state.arrow = undefined;
                redraw();
                return false;
            },
            mtmove: function(targets, event, redraw) {
                var mmove, arrow, zoomref;
                if (state.tap) {
                    targets = $.targets(event);
                    if (targets.touches.length > 1) {
                        if (state.zoom.reference >
                            Math.min(state.height, state.width) / 100) {
                            zoomref = ripple.vector.create(
                                targets.touches[0].x -
                                targets.touches[1].x,
                                targets.touches[0].y -
                                targets.touches[1].y
                            ).sqlen();
                            zclamp(state, state.zoom.value *
                                Math.sqrt(zoomref /
                                    state.zoom.reference));
                            state.update();
                        }
                    } else {
                        mmove = ripple.vector.create(
                            targets.x - state.tap.x,
                            targets.y - state.tap.y);
                        arrow = mmove.norm();
                        if ((typeof(state.arrow) === 'undefined') ||
                            (state.arrow && state.arrow.dotp(arrow) >
                                Math.cos(Math.PI / 3)))
                            state.arrow = arrow;
                        else state.arrow = null;
                        state.mmove = mmove;
                        state.update();
                    }
                }
                redraw();
                return false;
            },
            mtup: function(targets, event, redraw) {
                var delta;
                var size;
                if (state.arrow) {
                    delta = ripple.vector.create(
                        state.tap.x - state.width / 2,
                        state.tap.y - state.height / 2);
                    size = Math.min(state.height, state.width);
                    if ((delta.dotp(delta) < size * size / 4) &&
                        (state.mmove.dotp(state.mmove) >
                            size * size / 144))
                        state.player.control.arrow = state.arrow;
                    else state.player.control.arrow = null;
                } else state.player.control.arrow = null;
                state.tap = null;
                state.arrow = null;
                state.mmove = null;
                state.update();
                redraw();
                return false;
            },
            mwheel: function(event, redraw) {
                zclamp(state, state.zoom.value *
                    (1 + (0.001 * event.deltaY)));
                redraw();
                return false;
            }
        });
    };
})(typeof exports === 'undefined'? this['whiplash'] = {}: exports);
