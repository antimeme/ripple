// whiplash.js
// Copyright (C) 2016 by Simon Gold and Jeff Gold.
//
// Whiplash Paradox is a game about time travel
(function(whiplash) {
    "use strict";
    var data = { // TODO get this using AJAX instead
        walls: [
            {s: {x: 12, y: 12}, e: {x: 0, y: 15}},
            {s: {x: 0, y: 15}, e: {x: -12, y: 12}},
            {s: {x: -12, y: 12}, e: {x: -12, y: -12}},
            {s: {x: 0, y: -15}, e: {x:-12, y: -12}},
            {s: {x: 12, y: -12}, e: {x: 0, y: -15}},
        ]
    };

    var processWall = function(wall) {
        var result = {
            s: ripple.vector.convert(wall.s),
            e: ripple.vector.convert(wall.e)};
        result.q = wall.q ? ripple.vector.convert(wall.q) :
                   result.e.minus(result.s);
        result.sqlen = wall.sqlen ? wall.sqlen : result.q.sqlen();
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

        ctx.beginPath();
        state.walls.forEach(function(wall) {
            ctx.moveTo(wall.s.x, wall.s.y);
            ctx.lineTo(wall.e.x, wall.e.y);
        });
        ctx.lineWidth = 0.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'purple';
        ctx.stroke();
    };

    var drawVision = function(ctx, character, state, now) {
        var size = character.size;
        ctx.save();
        ctx.translate(character.position.x, character.position.y);
        ctx.rotate(character.direction);

        if (character.visionRange && character.visionArc &&
            character.visionColor) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, size * character.visionRange,
                   -character.visionArc, character.visionArc);
            ctx.fillStyle = character.visionColor;
            ctx.fill();
        }
        ctx.restore();
    }

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
    }

    var makePlayer = function(x, y, size) {
        return {
            last: new Date().getTime(),
            position: ripple.vector.create(x, y),
            direction: 0, size: size, speed: 0.009,
            control: { up: false, down: false,
                       left: false, right: false,
                       sleft: false, sright: false,
                       arrow: null,
                       clear: function() {
                           this.up = this.down =
                               this.left = this.right =
                                   this.sleft = this.sright = false;
                       }},
            headColor: 'orangered',
            bodyColor: 'orange',
            eyeColor: 'blue',
            blinkFreq: 4000, blinkLength: 250, blinkPhase: 0,
            update: function(state, now) {
                var steps = this.speed * (now - this.last);
                var rots = 0.005 * (now - this.last);
                var dirvec;

                if (this.control.arrow) {
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
                        this.position.x +=
                            Math.cos(this.direction) * steps;
                        this.position.y +=
                            Math.sin(this.direction) * steps;
                    }
                } else {
                    if (this.control.left && !this.control.right) {
                        this.direction -= rots;
                    } else if (!this.control.left &&
                               this.control.right) {
                        this.direction += rots;
                    }

                    if (this.control.up && !this.control.down) {
                        this.position.x +=
                            Math.cos(this.direction) * steps;
                        this.position.y +=
                            Math.sin(this.direction) * steps;
                    } else if (!this.control.up && this.control.down) {
                        this.position.x -=
                            Math.cos(this.direction) * steps * 0.75;
                        this.position.y -=
                            Math.sin(this.direction) * steps * 0.75;
                    }
                }
                this.last = now;
            },
            drawPre: function(ctx, state, now) {
                drawVision(ctx, this, state, now);
            },
            draw: function(ctx, state, now) {
                drawPerson(ctx, this, state, now);
            }
        };
    };

    var makeGuard = function(x, y, size) {
        return {
            last: new Date().getTime(),
            headColor: 'blue',
            bodyColor: 'darkgray',
            eyeColor: 'black',
            position: ripple.vector.create(x, y),
            direction: 0, size: size, speed: 0.008,
            blinkFreq: 1000, blinkLength: 100,
            blinkPhase: Math.random() * 1000,
            visionRange: 5, visionArc: Math.PI / 10,
            visionColor: 'rgba(255, 255, 255, 0.25)',
            update: function(state, now) {
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
                    this.position.x += direction.x * steps;
                    this.position.y += direction.y * steps;
                }
                this.last = now;
            },
            drawPre: function(ctx, state, now) {
                drawVision(ctx, this, state, now);
            },
            draw: function(ctx, state, now) {
                drawPerson(ctx, this, state, now);
            }
        };
    };

    whiplash.go = function($, container, viewport) {
        // State arrow can be either:
        //   {x, y} - unit vector indicating direction
        //   undefined - arrow in process of being set
        //   null - arrow not set
        var state = {
            height: 320, width: 320,
            zoom: { value: 50, min: 10, max: 150, reference: 0 },
            swipe: null, tap: null, mmove: null, arrow: null,
            characters: [],
            walls: data.walls.map(processWall),
            update: function(now) {
                var self = this;
                if (!now)
                    now = new Date().getTime();
	        self.characters.forEach(function(character) {
                    character.update(self, now);
                });
            }
        };
        state.characters.push(makeGuard(-5, -5, 1));
        //state.characters.push(makeGuard(5, -5, 1));
        //state.characters.push(makeGuard(-5, 5, 1));
        //state.characters.push(makeGuard(5, 5, 1));
	state.characters.push(state.player = makePlayer(0, 0, 1));

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
            mtdown: function(event, redraw) {
                state.tap = $.targets(event);
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
            mtmove: function(event, redraw) {
                var current, mmove, arrow, zoomref;
                if (state.tap) {
                    current = $.targets(event);
                    if (current.touches.length > 1) {
                        if (state.zoom.reference >
                            Math.min(state.height, state.width) / 100) {
                            zoomref = ripple.vector.create(
                                current.touches[0].x -
                                current.touches[1].x,
                                current.touches[0].y -
                                current.touches[1].y
                            ).sqlen();
                            zclamp(state, state.zoom.value *
                                Math.sqrt(zoomref /
                                    state.zoom.reference));
                            state.update();
                        }
                    } else {
                        mmove = ripple.vector.create(
                            current.x - state.tap.x,
                            current.y - state.tap.y);
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
            mtup: function(event, redraw) {
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
