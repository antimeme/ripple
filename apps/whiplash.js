// whiplash.js
// Copyright (C) 2016 by Simon Gold and Jeff Gold.
//
// Whiplash Paradox is a game about time travel
(function(whiplash) {
    "use strict";
    var debug = !!window.params['debug'];
    var rotateworld = !!window.params['rotateworld'];
    var mazeType = window.params['mazeType'] || undefined;
    var mazeRings = ('mazeRings' in window.params) ?
                    Math.max(Math.min(parseInt(
                        window.params['mazeRings'],
                        10), 8), 1) : undefined;

    var processWall = function(wall) {
        var out = {
            s: ripple.vector.convert(wall.s),
            e: ripple.vector.convert(wall.e)};
        out.q = wall.q ? ripple.vector.convert(wall.q) :
                out.e.minus(out.s);
        out.sqlen = wall.sqlen ? wall.sqlen : out.q.sqlen();
        out.width = wall.width ? wall.width : 0.5;
        return out;
    };

    var processPillar = function(pillar) {
        var result = {
            p: ripple.vector.convert(pillar.p),
            r: pillar.r, color: pillar.color };
        return result;
    };

    var processChest = function(chest) {
        var result = {
            position: ripple.vector.create(
                chest.position.x, chest.position.y),
            direction: chest.direction,
            inventory: chest.inventory };
        return result;
    };

    var zclamp = function(state, zoom) {
        if (zoom < state.zoom.min)
            zoom = state.zoom.min;
        if (zoom > state.zoom.max)
            zoom = state.zoom.max;
        state.zoom.value = zoom;
    };

    var planners = {
        idle: function(state, now) { /* do nothing */ },
        guard: function(state, now) {
            // FIXME this doesn't work anymore?
            var destination = undefined;
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
                destination = ripple.vector.create(
                    this.position.x + direction.x * steps,
                    this.position.y + direction.y * steps);
            }
            this.last = now;
            return destination;
        }
    };

    var drawBackground = function(ctx, state, now) {
        var first = true;
        var lineWidth = undefined;

        ctx.lineCap = 'round';
        ctx.strokeStyle = 'purple';
        ctx.beginPath();
        (state.walls || []).forEach(function(wall) {
            if (typeof(lineWidth) !== 'undefined' &&
                lineWidth != wall.width) {
                ctx.stroke();
                ctx.beginPath();
            }
            ctx.lineWidth = lineWidth = wall.width;
            ctx.moveTo(wall.s.x, wall.s.y);
            ctx.lineTo(wall.e.x, wall.e.y);
        });
        ctx.stroke();

        (state.pillars || []).forEach(function(pillar) {
            ctx.beginPath();
            ctx.moveTo(pillar.p.x, pillar.p.y);
            ctx.arc(pillar.p.x, pillar.p.y, pillar.r, 0, 2 * Math.PI);
            ctx.fillStyle = pillar.color;
            ctx.fill();
        });
    };

    var drawChest = function(ctx, chest, state, now) {
        var x = Math.cos(Math.PI/5) * (chest.size || 1);
        var y = Math.sin(Math.PI/5) * (chest.size || 1);
        ctx.save();
        ctx.translate(chest.position.x, chest.position.y);
        ctx.rotate(chest.direction || 0);
        ctx.lineWidth = chest.size / 10;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(-x, y);
        ctx.lineTo(-x, -y);
        ctx.lineTo(x, -y);
        ctx.lineTo(x, y);

        ctx.moveTo(y, y);
        ctx.lineTo(y, -y);
        ctx.moveTo(-y, y);
        ctx.lineTo(-y, -y);

        ctx.fillStyle = chest.fillColor || 'brown';
        ctx.fill();
        ctx.strokeStyle = chest.strokeColor || 'black';
        ctx.stroke();
        ctx.restore();
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
    var makeCharacter = function(config, state) {
        var inventory = [];

        config.inventory && config.inventory.forEach(function(item) {
            if (!item && !item.type)
                return;
            inventory.push({
                type: item.type,
                weight: item.weight || 0,
                definition: (state && item.type in state.itemdefs) ?
                            state.itemdefs[item.type] : null});
        });

        return {
            position: config.position ?
                      ripple.vector.convert(config.position) :
                      ripple.vector.create(
                          config.x || 0, config.y || 0, config.z || 0),
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

            inventory: inventory,

            last: config.last || new Date().getTime(),

            update: config.update || function(state, now) {
                if (this.destination) {
                    this.position = this.destination;
                    this.destination = null;
                }
            },

            plan: (config.plan && config.plan in planners) ?
                  planners[config.plan] : planners.idle,

            drawPre: config.drawPre || function(ctx, state, now) {
                drawVision(ctx, this, state, now);
            },

            draw: config.draw || function(ctx, state, now) {
                drawPerson(ctx, this, state, now);
            }
        };
    };

    var makePlayer = function(config, state) {
        var result = makeCharacter(config, state);
        result.control = {
            up: false, down: false,
            left: false, right: false,
            sleft: false, sright: false, swipe: null,
            clear: function() {
                this.up = this.down =
                    this.left = this.right =
                        this.sleft = this.sright = false; }};

        result.plan = function(state, now, collide) {
            var destination = undefined;
            var steps = this.speed * (now - this.last);
            var rads = 0.005 * (now - this.last);
            var dirvec, needrads, swipe;

            if (!isNaN(collide)) {
                // This is how the system informs us of collisions
                // which indicates that we must update our plan
                this.control.swipe = null;
                this.destination =
                    this.position.interpolate(
                        this.destination, collide);
            } else if (this.control.swipe) {
                // Process swipe arrows
                dirvec = ripple.vector.create(
                    Math.cos(this.direction),
                    Math.sin(this.direction));
                needrads = Math.acos(
                    ripple.clamp(dirvec.dotp(
                        this.control.swipe), 1, -1));
                if (Math.abs(needrads) < 0.05) {
                    // too small a time slice to turn
                } else if (Math.abs(needrads) > rads) {
                    this.direction += (
                        (dirvec.x * this.control.swipe.y -
                         dirvec.y * this.control.swipe.x >= 0) ?
                        1 : -1) * rads;
                    dirvec = ripple.vector.create(
                        Math.cos(this.direction),
                        Math.sin(this.direction));
                    steps = 0;
                } else if (rads > 0.01) {
                    this.direction += needrads;
                    dirvec = ripple.vector.create(
                        Math.cos(this.direction),
                        Math.sin(this.direction));
                    steps *= (rads - Math.abs(needrads)) / rads;
                }

                if (steps > 0)
                    destination = ripple.vector.create(
                        this.position.x + dirvec.x * steps,
                        this.position.y + dirvec.y * steps);
            } else {
                // Process WASD and arrow keys
                if (this.control.left && !this.control.right)
                    this.direction -= rads;
                else if (!this.control.left && this.control.right)
                    this.direction += rads;

                if (this.control.up && !this.control.down)
                    destination = ripple.vector.create(
                        this.position.x +
                        Math.cos(this.direction) * steps,
                        this.position.y +
                        Math.sin(this.direction) * steps);
                else if (!this.control.up && this.control.down)
                    // Reverse at reduced speed
                    destination = ripple.vector.create(
                        this.position.x -
                        Math.cos(this.direction) * steps * 0.75,
                        this.position.y -
                        Math.sin(this.direction) * steps * 0.75);
            }
            this.last = now;
            return this.destination = destination;
        };
        return result;
    };

    var update = function(now) {
        // Called to advance the game state
        if (!now)
            now = new Date().getTime();
	this.characters.forEach(function(character) {
            character.destination = character.plan(this, now);
        }, this);

        // Only player can collide for now
        if (this.player.destination) {
            var collide = undefined;
            var updateCollide = function(current) {
                if (!isNaN(current) &&
                    (isNaN(collide) || current < collide))
                    collide = current;
            };

            this.walls.forEach(function(wall) {
                updateCollide(ripple.collideRadiusSegment(
                    this.player.position,
                    this.player.destination,
                    this.player.size, wall));
            }, this);

            this.pillars.forEach(function(pillar) {
                updateCollide(ripple.collideRadiusRadius(
                    this.player.position,
                    this.player.destination,
                    this.player.size,
                    pillar.p, pillar.p, pillar.r));
            }, this);

            this.chests.forEach(function(chest) {
                updateCollide(ripple.collideRadiusRadius(
                    this.player.position,
                    this.player.destination,
                    this.player.size,
                    chest.position, chest.position, chest.size));
            }, this);

            if (!isNaN(collide))
                this.player.plan(this, now, collide);
        }

        this.characters.forEach(function(character) {
            character.update(this, now);
        }, this);
    };

    var createButton = function(sheet, position, fn) {
        // Create a button backed by an image from a sprite sheet.
        // Page CSS controls the number of sprites on a sheet.
        // This routine wraps the function and forces a false
        // return so that events do not propagate
        return $('<button>')
            .addClass('image-button')
            .css({
                'background-image': sheet,
                'background-position': position,
            })
            .on('mousedown touchstart', function(event) {
                fn.call(this, arguments);
                return false; });
    };

    whiplash.go = function($, container, viewport, data) {
        // State arrow can be either:
        //   {x, y} - unit vector indicating direction
        //   undefined - arrow in process of being set
        //   null - arrow not set
        var state = {
            height: 320, width: 320,
            zoom: { value: 25, min: 18, max: 100, reference: 0 },
            tap: null, mmove: null, swipe: null,
            player: null, update: update,
            itemdefs: data.itemdefs ? data.itemdefs : {},

            draw: function(ctx, width, height, now, last) {
                var size;
                var lineWidth;
                lineWidth = Math.max(width, height) / 50;

                if (now - last < 1000)
                    this.update(now, last);

                ctx.save(); // use player perspective
                ctx.scale(this.zoom.value, this.zoom.value);
                ctx.translate(width / (2 * this.zoom.value),
                              height / (2 * this.zoom.value));
                if (rotateworld) {
                    if (height >= width) {
                        ctx.translate(
                            0, 0.4 * height / this.zoom.value);
                        ctx.rotate(-Math.PI / 2);
                    } else ctx.translate(
                        -0.4 * width / this.zoom.value, 0);
                    ctx.rotate(-this.player.direction);
                }
                ctx.translate(-this.player.position.x,
                              -this.player.position.y);
                ctx.lineWidth = lineWidth;

                this.characters.forEach(function(character) {
                    if (character.drawPre)
                        character.drawPre(ctx, this, now);
                });

                drawBackground(ctx, this, now);
                (this.chests || []).forEach(function(chest) {
                    drawChest(ctx, chest, this, now);
                }, this);

                this.characters.forEach(function(character) {
                    if (character.draw)
                        character.draw(ctx, this, now);
                }, this);

                this.characters.forEach(function(character) {
                    if (character.drawPost)
                        character.drawPost(ctx, this, now);
                }, this);

                ctx.restore();

                size = Math.min(this.height, this.width);
                if (debug) {
                    if (rotateworld)
                        ripple.vector.create(
                            this.height >= this.width ? 0 : 1,
                            this.height >= this.width ? -1 : 0)
                              .draw(ctx, {
                                  center: {x: width / 2, y: height / 2},
                                  length: size / 4, color: 'black'});
                    ripple.vector.create(
                        Math.cos(this.player.direction),
                        Math.sin(this.player.direction))
                          .draw(ctx, {
                              center: {x: width / 2, y: height / 2},
                              length: size / 4, color: 'red'});
                }
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.font = 'bold ' + Math.round(size / 20) + 'px sans';
                ctx.fillText('Whiplash Paradox',
                             this.width / 2, size / 50);
            },
            resize: function(width, height, $) {
                var size = Math.min(width, height);
                this.width = width;
                this.height = height;

                $('.image-button').css({
                    width: Math.floor(size / 11),
                    height: Math.floor(size / 11)
                });
                $('.slot-group').css({
                    width: Math.floor(size * 4 / 11),
                    height: Math.floor(size * 2 / 11)
                });
                $('.page').css({
                    'border-width': Math.floor(size / 100),
                    'border-radius': Math.floor(size / 25),
                    top: Math.floor(size / 50),
                    left: Math.floor(size / 50),
                    width: width - Math.floor(size / 20),
                    height: height - Math.floor(
                        size / 20 + size / 11)
                });
            },
            keydown: function(event, redraw) {
                // Recognize WASD and arrow keys
	        if (event.keyCode === 37 || event.keyCode === 65) {
		    this.player.control.left = true;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 38 ||
                           event.keyCode === 87) {
                    this.player.control.up = true;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 39 ||
                           event.keyCode === 68) {
		    this.player.control.right = true;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 40 ||
                           event.keyCode === 83) {
		    this.player.control.down = true;
                    this.player.control.swipe = null;
                    this.update();
                } else if (event.keyCode === 70) { // f
                    this.interact();
	        } else if (debug) console.log('down', event.keyCode);
                redraw();
            },
            keyup: function(event, redraw) {
                // Recognize WASD and arrow keys
	        if (event.keyCode === 37 || event.keyCode === 65) {
		    this.player.control.left = false;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 38 ||
                           event.keyCode === 87) {
                    this.player.control.up = false;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 39 ||
                           event.keyCode === 68) {
		    this.player.control.right = false;
                    this.player.control.swipe = null;
                    this.update();
	        } else if (event.keyCode === 40 ||
                           event.keyCode === 83) {
		    this.player.control.down = false;
                    this.player.control.swipe = null;
                    this.update();
                } else if (event.keyCode === 70) { // f
	        } else if (debug) console.log('up', event.keyCode);
                redraw();
            },
            mtdown: function(targets, event, redraw) {
                this.tap = targets;
                this.swipe = null;
                this.mmove = null;
                if (this.tap.touches.length > 1) {
                    this.zoom.reference =
                        ripple.vector.create(
                            this.tap.touches[0].x -
                            this.tap.touches[1].x,
                            this.tap.touches[0].y -
                            this.tap.touches[1].y
                        ).sqlen();
                } else this.swipe = undefined;
                redraw();
                return false;
            },
            mtmove: function(targets, event, redraw) {
                var mmove, swipe, zoomref;
                if (this.tap) {
                    targets = $.targets(event);
                    if (targets.touches.length > 1) {
                        if (this.zoom.reference >
                            Math.min(this.height, this.width) / 100) {
                            zoomref = ripple.vector.create(
                                targets.touches[0].x -
                                targets.touches[1].x,
                                targets.touches[0].y -
                                targets.touches[1].y
                            ).sqlen();
                            zclamp(this, this.zoom.value *
                                Math.sqrt(zoomref /
                                    this.zoom.reference));
                            this.update();
                        }
                    } else {
                        mmove = ripple.vector.create(
                            targets.x - this.tap.x,
                            targets.y - this.tap.y);
                        swipe = mmove.norm();
                        if ((typeof(this.swipe) === 'undefined') ||
                            (this.swipe && this.swipe.dotp(swipe) >
                                Math.cos(Math.PI / 3)))
                            this.swipe = swipe;
                        else this.swipe = null;
                        this.mmove = mmove;
                        this.update();
                    }
                }
                redraw();
                return false;
            },
            mtup: function(targets, event, redraw) {
                var worldvec = ripple.vector.create(
                    this.height >= this.width ? 0 : 1,
                    this.height >= this.width ? -1 : 0);
                if (this.swipe) {
                    if (rotateworld) {
                        this.player.control.swipe =
                            this.swipe.rotate(
                                worldvec,
                                ripple.vector.create(
                                    Math.cos(this.player.direction),
                                    Math.sin(this.player.direction))
                                      .plus(worldvec));
                    } else this.player.control.swipe = this.swipe;
                } else this.player.control.swipe = null;
                this.tap = null;
                this.swipe = null;
                this.mmove = null;
                this.update();
                redraw();
                return false;
            },
            mwheel: function(event, redraw) {
                if (event.deltaY)
                    zclamp(this, this.zoom.value *
                        (1 + (0.1 * (event.deltaY > 0 ? 1 : -1))));
                redraw();
                return false;
            },
            init: function($, container, viewport) {
                var sprites = 'url(images/whiplash-sprites.svg)';

                this.actionBar = $('<div>')
                    .addClass('bbar')
                    .css({ bottom: 0, left: 0 })
                    .appendTo(container)
                    .append(createButton(
                        sprites, '100% 0', function(event) {
                            state.interact(); }))
                    .append(createButton(
                        sprites, '25% 0', function(event) {
                            console.log('left-hand'); }))
                    .append(createButton(
                        sprites, '50% 0', function(event) {
                            console.log('right-hand'); }))
                    .append(createButton(
                        sprites, '0 0', function(event) {
                            state.inventory.toggle();
                            state.settings.hide(); }))
                    .append(createButton(
                        sprites, '75% 0', function(event) {
                            state.settings.toggle();
                            state.inventory.hide(); }));

                this.settings = $('<div>')
                    .addClass('page').hide()
                    .append('<h2>Settings</h2>')
                    .appendTo(container);
                this.inventory = $('<div>')
                    .addClass('page').hide()
                    .append('<h2>Inventory</h2>')
                    .appendTo(container);

                var other = $('<div>')
                    .addClass('page-pane')
                    .addClass('inventory-other')
                    .appendTo(this.inventory);
                var personal = $('<div>')
                    .addClass('page-pane')
                    .addClass('inventory-self')
                    .appendTo(this.inventory);

                $('<div>')
                    .append(createButton(
                        sprites, '25% 0', function(event) {
                            console.log('inv-left'); }))
                    .append(createButton(
                        sprites, '50% 0', function(event) {
                            console.log('inv-right'); }))
                    .append($('<div>')
                        .addClass('slot-group')
                        .append(createButton(
                            sprites, '75% 0', function(event) {
                                console.log('nothin');
                            }))
                        .append(createButton(
                            sprites, '75% 0', function(event) {
                                console.log('nothin');
                            }))
                        .append(createButton(
                            sprites, '75% 0', function(event) {
                                console.log('nothin');
                            }))
                        .append(createButton(
                            sprites, '75% 0', function(event) {
                                console.log('nothin');
                            }))
                        .append(createButton(
                            sprites, '75% 0', function(event) {
                                console.log('nothin');
                            })))
                    .appendTo(personal);

                // Let's create lots of test items for the
                // character inventory.  What fun!
                var makeThing = function(container, index) {
                    var value = index + 1;
                    container.append(
                        createButton(sprites, '75% 0', function(event) {
                            console.log('ping', value); }));
                }
                var index;
                for (index = 0; index < 150; ++index) {
                    makeThing(personal, index);
                    makeThing(other, index);
                }
            },
            stages: data.stages,
            chardefs: data.chardefs,
            setStage: function(stageName, config) {
                var g, stage;

                this.characters = [this.player];
                if (stageName && data.stages &&
                    stageName in data.stages)
                    stage = data.stages[stageName];
                else return;

                this.pillars = (stage.pillars || []).map(processPillar);
                this.walls = (stage.walls || []).map(processWall);
                this.chests = (stage.chests || []).map(processChest);
                if (stage.characters)
                    stage.characters.forEach(function(character) {
                        this.characters.push(makeCharacter(
                            ripple.mergeConfig(
                                character.position,
                                this.chardefs[character.type]), state));
                    }, this);
                if (stage.maze) {
                    if (mazeType)
                        stage.maze.type = mazeType;
                    if (mazeRings)
                        stage.maze.rings = mazeRings;
                    g = grid.create(stage.maze).createMaze(stage.maze);
                    g.walls.forEach(function(wall) {
                        this.walls.push(
                            processWall({s: wall.points[0],
                                         e: wall.points[1]}));
                    }, this);

                    g.nodes.forEach(function(node) {
                        if (node.ring === 0 && node.exits === 1) {
                            this.chests.push({
                                position: ripple.vector.create(
                                    node.x, node.y),
                                direction: Math.random() * 2 * Math.PI,
                                size: 1
                            });
                        }
                    }, this);
                }
            },
            interact: function() {
                if (state.inventory.is(':visible')) {
                    state.inventory.hide();
                } else {
                    var distance, angle;
                    var least = NaN;
                    var closest = null;
                    this.chests.forEach(function(chest) {
                        var cvec = chest.position.minus(this.player.position);
                        distance = cvec.sqlen();
                        if (isNaN(least) ||  distance < least) {
                            closest = chest;
                            least = distance;
                            angle = (cvec.dotp(ripple.vector.create(
                                Math.cos(this.player.direction),
                                Math.sin(this.player.direction))) /
                                cvec.length());
                        }
                    }, this);

                    if (!isNaN(least) && (least < 9) &&
                        (angle > Math.cos(Math.PI / 3))) {
                        // TODO something to connect inventory
                        state.inventory.show();
                    }
                }
            }
        };

	state.player = makePlayer(
            (data.chardefs && 'player' in data.chardefs) ?
            data.chardefs['player'] : {}, state);
        state.setStage(window.params['startStage'] || data.startStage);
        if (data.disableDebug)
            debug = false;
        ripple.app($, container, viewport, state);
    };
})(typeof exports === 'undefined'? this['whiplash'] = {}: exports);
