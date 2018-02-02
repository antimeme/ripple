// whiplash.js
// Copyright (C) 2016-2018 by Jeff Gold.
//
// Whiplash Paradox is a game about time travel
// TODO click to target move
// TODO click to access inventory
// TODO event to register punch

(function(whiplash) {
    'use strict';

    var fetchParam = function(name) {
        return (typeof window !== 'undefined') ?
               window.params[name] : process.env[name];
    };

    var profiling = false;
    var debug = !!fetchParam('debug');
    var rotateworld = !!fetchParam('rotateworld');
    var mazeType = fetchParam('mazeType') || undefined;
    var mazeRings = Math.max(Math.min(parseInt(
        fetchParam('mazeRings'), 10), 8), 1);

    var squareSize = undefined;
    var setSquareSize = function(thing, size) {
        if (!isNaN(size))
            squareSize = size;
        if (!isNaN(squareSize))
            thing.css({
                width: Math.floor(squareSize / 11),
                height: Math.floor(squareSize / 11) });
        return thing;
    };

    var createInventory = function($, state, container, player) {
        if (!(this instanceof createInventory))
            return new createInventory($, state, container, player);
        this.state = state;
        this.player = player;
        this.other = null;

        var give = function(event) {
            var selected = this.playerPane.find('.selected');
            if (selected.size()) {
                var chosen = {};
                var updated = [];
                selected.each(function(index, item) {
                    var value = $(item).data('index');
                    if (!isNaN(value))
                        chosen[parseInt(value, 10)] = true; });
                this.player.inventory.forEach(function(item, index) {
                    if (index in chosen)
                        this.other.inventory.push(item);
                    else updated.push(item);
                }, this);
                this.player.inventory = updated;
                this.populate(this.other);
            } else this.playerPane.find('button').addClass('selected');
        };

        var take = function(event) {
            var selected = this.otherPane.find('.selected');
            if (selected.size()) {
                var chosen = {};
                var updated = [];
                selected.each(function(index, item) {
                    var value = $(item).data('index');
                    if (!isNaN(value))
                        chosen[parseInt(value, 10)] = true; });
                this.other.inventory.forEach(function(item, index) {
                    if (index in chosen)
                        this.player.inventory.push(item);
                    else updated.push(item);
                }, this);
                this.other.inventory = updated;
                this.populate(this.other);
            } else this.otherPane.find('button').addClass('selected');
        };

        this.pane = $('<div>')
            .addClass('page').addClass('inventory').hide()
            .appendTo(container);
        this.header = $('<div>')
            .addClass('inventory-header')
            .append($('<div>')
                .addClass('bbar')
                .append(state.createButton('close', function(event) {
                    state.inventory.hide();
                }, this)
                             .addClass('close'))
                .append(state.createButton('take', take, this)
                             .addClass('give-and-take'))
                .append(state.createButton('give', give, this)
                             .addClass('give-and-take')))
            .appendTo(this.pane);
        this.playerPane = $('<div>')
            .addClass('page-pane')
            .addClass('inventory-personal')
            .appendTo(this.pane);
        this.otherPane = $('<div>')
            .addClass('page-pane')
            .addClass('inventory-other')
            .appendTo(this.pane);
        this.footer = $('<div>')
            .addClass('inventory-footer')
            .appendTo(this.pane);
        this.populate();
    };
    createInventory.prototype.show = function() { this.pane.show(); };
    createInventory.prototype.hide = function() { this.pane.hide(); };
    createInventory.prototype.toggle = function() {
        this.pane.toggle(); };
    createInventory.prototype.isVisible = function() {
        return this.pane.is(':visible'); };
    createInventory.prototype.addItem = function(item, index, isOther) {
        var icon = item.icon;

        if (!icon) {
            var itemdef = this.state.itemdefs[item.type];
            if (itemdef)
                icon = itemdef.icon;
        }
        (isOther ? this.otherPane : this.playerPane).append(
            this.state.createButton(icon, function(event) {
                jQuery(event[0].target)
                    .toggleClass('selected');
            }, this)
                .prop('title', item.toString())
                .data('index', index));
    };
    createInventory.prototype.populate = function(other) {
        this.playerPane.empty();
        if (this.player)
            this.player.inventory.forEach(function(item, index) {
                this.addItem(item, index, false);
            }, this);

        this.otherPane.empty();
        this.other = other;
        if (this.other) {
            this.other.inventory.forEach(function(item, index) {
                this.addItem(item, index, true);
            }, this);
            jQuery('.give-and-take').show();
        } else jQuery('.give-and-take').hide();
        setSquareSize(jQuery('.image-button'));
    };

    var createWall = function(wall) {
        var out = {
            s: multivec(wall.s),
            e: multivec(wall.e)};
        out.q = wall.q ? multivec(wall.q) :
                out.e.subtract(out.s);
        out.normSquared = wall.normSquared ? wall.normSquared :
                          out.q.normSquared();
        out.width = wall.width ? wall.width : 0.5;
        return out;
    };

    var createPillar = function(pillar) {
        var result = {
            p: multivec(pillar.p),
            r: pillar.r, color: pillar.color };
        return result;
    };

    var createChest = function(chest) {
        var result = {
            position: multivec([
                chest.position.x, chest.position.y]),
            direction: chest.direction,
            inventory: chest.inventory || [],
            size: chest.size || 1,
            accessible: false,
            checkAccessible: function(player) {
                var cvec = this.position.subtract(player.position);
                var sqdist = cvec.normSquared();
                if (sqdist < 9) {
                    var angle = (cvec.inner(multivec(
                        [Math.cos(player.direction),
                         Math.sin(player.direction)])) /
                        cvec.norm());
                    this.accessible = (angle > Math.cos(Math.PI / 3));
                } else this.accessible = false;
                return sqdist;
            }
        };
        return result;
    };

    var randomLoot = function(chest) {
        var items = [
            "knife",
            "gun",
            "tonfa",
            "keycard",
            "tablet",
            "flashlight",
            "apple",
            "cookie"];
        var result = [
            {'type': items[Math.floor(
                Math.random() * items.length)]},
            {'type': items[Math.floor(
                Math.random() * items.length)]}];
        return result;
    };

    var planners = {
        idle: function(state, now) { /* do nothing */ },
        guard: function(state, now) {
            // FIXME this doesn't work anymore?
            var destination = undefined;
            var steps = this.speed * (now - this.last);
            var rots = 0.005 * (now - this.last);
            var pdir = multivec([
                state.player.position.x - this.position.x,
                state.player.position.y - this.position.y]).normalize();
            var direction, target;

            if (pdir.dotp(multivec([
                Math.cos(this.direction),
                Math.sin(this.direction)])) <
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
                destination = multivec([
                    this.position.x + direction.x * steps,
                    this.position.y + direction.y * steps]);
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
        var x = Math.cos(Math.PI/5) * chest.size;
        var y = Math.sin(Math.PI/5) * chest.size;
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
        ctx.strokeStyle = chest.accessible ? 'white' :
                          (chest.strokeColor || 'black');
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
        var fraction;
        ctx.save();
        ctx.translate(character.position.x, character.position.y);
        ctx.rotate(character.direction);

        if (character.punchDuration && character.punchLeft &&
            now < character.punchLeft +
            character.punchDuration * 2000) {
            fraction = ((now - character.punchLeft) /
                (character.punchDuration * 1000));
            if (fraction > 1)
                fraction = 2 - fraction;

            ctx.beginPath();
            ctx.moveTo(0, size * -2 / 3);
            ctx.lineTo(fraction * size * 3 / 2, size * -2 / 3);
            ctx.lineWidth = size / 2;
            ctx.strokeStyle = character.bodyColor;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fraction * size * 3 / 2, size * -2 / 3);
            ctx.arc(fraction * size * 3 / 2, size * -2 / 3,
                    size / 4, 0, Math.PI * 2);
            ctx.fillStyle = character.headColor;
            ctx.fill();
        }

        if (character.punchDuration && character.punchRight &&
            now < character.punchRight +
            character.punchDuration * 2000) {
            fraction = ((now - character.punchRight) /
                (character.punchDuration * 1000));
            if (fraction > 1)
                fraction = 2 - fraction;

            ctx.beginPath();
            ctx.moveTo(0, size * 2 / 3);
            ctx.lineTo(fraction * size * 3 / 2, size * 2 / 3);
            ctx.lineWidth = size / 2;
            ctx.strokeStyle = character.bodyColor;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fraction * size * 3 / 2, size * 2 / 3);
            ctx.arc(fraction * size * 3 / 2, size * 2 / 3,
                    size / 4, 0, Math.PI * 2);
            ctx.fillStyle = character.headColor;
            ctx.fill();
        }

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
                      multivec(config.position) :
                      multivec([
                          config.x || 0, config.y || 0, config.z || 0]),
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
            punchDuration: 0.3,

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

            replan: function() {
                // This is how the system informs us of collisions
                // which indicates that we must update our plan
                this.control.swipe = null;
                this.destination =
                    this.position.add(
                        this.destination.multiply(collide));
            },

            drawPre: config.drawPre || function(ctx, state, now) {
                drawVision(ctx, this, state, now);
            },

            draw: config.draw || function(ctx, state, now) {
                drawPerson(ctx, this, state, now);
            }
        };
    };

    var playerControl = function(player) {
        if (!(this instanceof playerControl))
            return new playerControl(player);
        this.player = player;
        this.clear(false);
    };

    playerControl.prototype.clear = function(keep) {
        if (!keep)
            this.up = this.down = this.left = this.right =
                this.sleft = this.sright = false;
        this.arrow = null;
        this.target = null;
        this.dir = null;
        this.turn = null;
    };

    playerControl.prototype.setTarget = function(target) {
        this.clear();
        this.target = target;
        this.turn = multivec(target).minus(
            this.player.position).normalize();
    };

    playerControl.prototype.setArrow = function(turn, start, end) {
        this.clear();
        if (end)
            this.arrow = multivec(end).minus(start);
        else this.arrow = multivec(start);
        this.arrow = this.arrow.normalize();
        this.turn = turn ? this.arrow : null;
    };

    playerControl.prototype.setLook = function(look) {
        this.clear();
        this.turn = multivec(look).minus(
            this.player.position).normalize();
        this.target = this.player.position;
    };

    var makePlayer = function(config, state) {
        var result = makeCharacter(config, state);
        result.control = playerControl(result);

        result.replan = function(state, now, collide, destination) {
            this.control.clear(true);
            return this.position.add(
                destination.minus(this.position).multiply(collide));
        };

        result.plan = function(state, now) {
            var result = undefined;
            var steps = this.speed * (now - this.last);
            var rads = 0.005 * (now - this.last);
            var dirvec, signrads, needrads, swipe;

            dirvec = multivec({theta: this.direction});
            if (this.control.turn) {
                // Work out how much turning is necessary to face
                // the designated target
                signrads = (dirvec.times({o2o1: 1}).dot(
                    this.control.turn).scalar < 0) ? 1 : -1;
                needrads = Math.acos(ripple.clamp(dirvec.dot(
                    this.control.turn).scalar, 1, -1));

                // Do as much turning as we can in the time available
                // and use extra time to take steps
                if (needrads < 0.05) {
                    // Close enough for now
                } else if (needrads > rads) {
                    this.direction += signrads * rads;
                    steps = 0;
                } else {
                    this.direction += signrads * needrads;
                    dirvec = multivec({theta: this.direction});
                    steps *= (rads - needrads) / rads;
                }
            }

            if (this.control.target) {
                if (this.control.target.minus(this.position)
                        .normSquared() < 0.01)
                    this.control.clear();
                else result = this.position.plus(dirvec.times(steps));
            } else if (this.control.arrow) {
                result = this.position.plus(
                    this.control.arrow.times(steps));
            } else { // implement keyboard controls
                if (this.control.left && !this.control.right)
                    this.direction -= rads;
                else if (!this.control.left && this.control.right)
                    this.direction += rads;

                if (this.control.sleft && !this.control.sright)
                    result = (result ? result : this.position).plus(
                        multivec({r: steps * 0.75,
                                  theta: this.direction -
                                         Math.PI / 2}));
                else if (this.control.sright && !this.control.sleft)
                    result = (result ? result : this.position).plus(
                        multivec({r: steps * 0.75,
                                  theta: this.direction +
                                         Math.PI / 2}));

                if (this.control.up && !this.control.down)
                    result = (result ? result : this.position).plus(
                        multivec({r: steps, theta: this.direction}));
                else if (!this.control.up && this.control.down)
                    result = (result ? result : this.position).minus(
                        multivec({r: steps * 0.75,
                                  theta: this.direction}));
            }
            this.last = now;
            return result;
        };
        return result;
    };

    var update = function(now) {
        // Called to advance the game state
        if (isNaN(now))
            now = new Date().getTime();
	this.characters.forEach(function(character) {
            character.destination = character.plan(this, now); }, this);

        // Only player can collide for now
        if (this.player.destination) {
            var collide = undefined;
            var updateCollide = function(current) {
                if (!isNaN(current) &&
                    (isNaN(collide) || current < collide))
                    collide = current;
            };

            this.walls.forEach(function(wall) {
                updateCollide(multivec.collideRadiusSegment(
                    this.player.position,
                    this.player.destination,
                    this.player.size, wall));
            }, this);

            this.pillars.forEach(function(pillar) {
                updateCollide(multivec.collideRadiusRadius(
                    this.player.position,
                    this.player.destination,
                    this.player.size,
                    pillar.p, pillar.p, pillar.r));
            }, this);

            this.chests.forEach(function(chest) {
                updateCollide(multivec.collideRadiusRadius(
                    this.player.position,
                    this.player.destination,
                    this.player.size,
                    chest.position, chest.position, chest.size));
            }, this);

            if (!isNaN(collide))
                this.player.destination = this.player.replan(
                    this, now, collide, this.player.destination);
        }

        this.characters.forEach(function(character) {
            character.update(this, now); }, this);

        this.chests.forEach(function(chest) {
            chest.checkAccessible(this.player); }, this);
    };

    whiplash.go = function($, container, viewport, data) {
        // State arrow can be either:
        //   {x, y} - unit vector indicating direction
        //   undefined - arrow in process of being set
        //   null - arrow not set
        var state = {
            height: 320, width: 320,
            zoom: {
                value: 25, min: 10, max: 100, reference: 0,
                change: function(value) {
                    value *= this.value;
                    if (value < this.min)
                        value = this.min;
                    if (value > this.max)
                        value = this.max;
                    this.value = value;
                    return this;
                }},
            tap: null, mmove: null,
            player: null, update: update,
            itemdefs: data.itemdefs ? data.itemdefs : {},
            images: data.images.files, icons: data.images.icons,
            createButton: function(config, fn, context) {
                // This routine wraps the function and forces a false
                // return so that events do not propagate
                var imgdef, image, position, backsize;
                var tempconfig = config;

                // Configuration can be an object, a string reference
                // to the icon set or undefined for default
                if (!config)
                    config = this.icons['default'];
                else if (typeof config === 'string')
                    config = this.icons[config];

                imgdef = this.images[config.image || 'default'];
                image = 'url(' + imgdef.url + ')';
                backsize = (
                    (imgdef.size * imgdef.cols) + '% ' +
                     (imgdef.size * imgdef.rows) + '%');
                position = (
                    Math.floor(100 * config.col /
                        (imgdef.cols - 1)) + '% ' + 
                    Math.floor(100 * config.row /
                        (imgdef.rows - 1)) + '%');
                return $('<button>')
                    .addClass('image-button')
                    .css({
                        'background-image': image,
                        'background-position': position,
                        'background-size': backsize })
                    .on('mousedown touchstart', function(event) {
                        fn.call(context, arguments);
                        return false; });
            },

            init: function($, container, viewport) {
                $('<div>') // Left Action Bar
                    .addClass('bbar')
                    .css({ bottom: 0, left: 0 })
                    .appendTo(container)
                    .append(this.createButton(
                        'lhand', this.handLeft, this))
                    .append(this.createButton(
                        'rhand', this.handRight, this));

                $('<div>') // Create action bar
                    .addClass('bbar')
                    .css({ bottom: 0, right: 0 })
                    .appendTo(container)
                    .append(this.createButton(
                        'settings', function(event) {
                            state.settings.toggle();
                            state.inventory.hide(); }))
                    .append(this.createButton(
                        'interact', function(event) {
                            state.interact(); }));

                this.settings = $('<div>')
                    .addClass('page').addClass('settings').hide()
                    .append('<h2>Settings</h2>')
                    .appendTo(container);
                this.inventory = createInventory(
                    $, this, container, this.player);
            },
            resize: function(width, height, $) {
                var size = Math.min(width, height);
                this.width = width;
                this.height = height;

                setSquareSize($('.image-button'), size);
                $('.page').css({
                    'border-width': Math.floor(size / 100),
                    'border-radius': Math.floor(size / 25),
                    top: Math.floor(size / 50),
                    left: Math.floor(size / 50),
                    width: width - Math.floor(size / 20),
                    height: height - Math.floor(
                        size / 20 + size / 11)
                });

                $('.inventory-header').css({
                    height: Math.floor(size * 2 / 11) });
                $('.inventory-footer').css({
                    height: Math.floor(size * 2 / 11) });
                $('.slot-group').css({
                    width: Math.floor(size * 4 / 11),
                    height: Math.floor(size * 2 / 11) });
            },
            draw: function(ctx, width, height, now, last) {
                var size;
                var lineWidth;
                lineWidth = Math.max(width, height) / 50;

                this.update(now, last);
                ctx.save(); // transform to world space
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

                ctx.restore(); // return to screen space

                size = Math.min(this.height, this.width);
                if (debug) {
                    if (rotateworld)
                        multivec((this.height >= this.width) ?
                                 [0, -1] : [1, 0])
                        .draw(ctx, {
                            center: {x: width / 2, y: height / 2},
                            length: size / 4, color: 'black'});
                    multivec({theta: this.player.direction})
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
            keydown: function(event, redraw) {
                redraw();
                this.update();
                if (event.key === '+' || event.key === '=') {
                    this.zoom.change(1.1);
                } else if (event.key === '-') {
                    this.zoom.change(0.9);
                } else if (event.keyCode === 37 /* left */ ||
                           event.keyCode === 65 /* a */) {
                    this.player.control.clear(true);
		    this.player.control.left = true;
	        } else if (event.keyCode === 38 /* up */ ||
                           event.keyCode === 87 /* w */) {
                    this.player.control.clear(true);
                    this.player.control.up = true;
	        } else if (event.keyCode === 39 /* right */ ||
                           event.keyCode === 68 /* d */) {
                    this.player.control.clear(true);
		    this.player.control.right = true;
	        } else if (event.keyCode === 40 /* down */ ||
                           event.keyCode === 83 /* s */) {
                    this.player.control.clear(true);
		    this.player.control.down = true;
                } else if (event.keyCode === 81 /* q */) {
                    this.player.control.clear(true);
		    this.player.control.sleft = true;
                } else if (event.keyCode === 69 /* e */) {
                    this.player.control.clear(true);
		    this.player.control.sright = true;
	        } else if (event.keyCode === 90 /* z */) {
                    this.handRight();
	        } else if (event.keyCode === 67 /* c */) {
                    this.handLeft();
                } else if (event.keyCode === 73 /* i */ ||
                           event.keyCode === 192 /* tilde */) {
                    this.interact();
                } else if (event.keyCode === 80 /* p */) {
                    if (debug) {
                        if (profiling)
                            console.profileEnd();
                        else console.profile();
                        profiling = !profiling;
                    }
	        } else if (debug) console.log('down', event.keyCode);
            },
            keyup: function(event, redraw) {
                redraw();
                this.update();
	        if (event.keyCode === 37 || event.keyCode === 65) {
                    this.player.control.clear(true);
		    this.player.control.left = false;
	        } else if (event.keyCode === 38 ||
                           event.keyCode === 87) {
                    this.player.control.clear(true);
                    this.player.control.up = false;
	        } else if (event.keyCode === 39 ||
                           event.keyCode === 68) {
                    this.player.control.clear(true);
		    this.player.control.right = false;
	        } else if (event.keyCode === 40 ||
                           event.keyCode === 83) {
                    this.player.control.clear(true);
		    this.player.control.down = false;
                } else if (event.keyCode === 81 /* q */) {
                    this.player.control.clear(true);
		    this.player.control.sleft = false;
                } else if (event.keyCode === 69 /* e */) {
                    this.player.control.clear(true);
		    this.player.control.sright = false;
	        } else if (event.keyCode === 90 /* z */) {
	        } else if (event.keyCode === 67 /* c */) {
                } else if (event.keyCode === 70 /* i */ ||
                           event.keyCode === 192 /* tilde */) {
                } else if (event.keyCode === 80 /* p */) {
	        } else if (debug) console.log('up', event.keyCode);
            },

            // Converts a screen coordinate to world space
            toWorldSpace: function(point) {
                return multivec(point)
                    .subtract([this.width / 2, this.height / 2])
                    .divide(this.zoom.value)
                    .add(this.player.position);
            },

            tap: function(touch) {
                var tapped = this.toWorldSpace(touch);
                var sqdist, angle;
                var least = NaN;
                var closest = null;
                this.chests.forEach(function(chest) {
                    sqdist = chest.checkAccessible(this.player);
                    if (chest.accessible &&
                        (isNaN(least) || sqdist < least)) {
                        closest = chest;
                        least = sqdist;
                    }
                }, this);

                if (closest &&
                    tapped.minus(closest.position).normSquared() < 9) {
                    state.inventory.populate(closest);
                    state.inventory.show();
                } else this.player.control.setTarget(tapped);
            },

            doubleTap: function(touch) {
                this.player.control.setArrow(
                    true, this.player.position,
                    this.toWorldSpace(touch));
            },

            drag: function(start, drag, current) {
                this.player.control.setLook(this.toWorldSpace(current));
            },

            flick: function(start, end) {
                var swipe = multivec(end).minus(start);
                if (rotateworld) {
                    swipe = swipe.rotate(
                        multivec((this.height >= this.width) ?
                                 [0, -1] : [1, 0]),
                        multivec({theta: this.player.direction}));
                }
                this.player.control.setArrow(false, swipe);

                this.touches = null;
                this.update();
                return false;
            },

            mwheel: function(event, redraw) {
                if (event.deltaY)
                    this.zoom.change(
                        1 + (0.1 * (event.deltaY > 0 ? 1 : -1)));
                console.log('zoom', this.zoom.value); // DEBUG
                redraw();
                return false;
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

                this.pillars = (stage.pillars || []).map(createPillar);
                this.walls = (stage.walls || []).map(createWall);
                this.chests = (stage.chests || []).map(createChest);
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
                            createWall({s: wall.points[0],
                                        e: wall.points[1]}));
                    }, this);

                    g.nodes.forEach(function(node) {
                        if (node.ring === 0 && node.exits === 1) {
                            this.chests.push(createChest({
                                position: { x: node.x, y: node.y },
                                direction: Math.random() * 2 * Math.PI,
                                inventory: randomLoot()
                            }));
                        }
                    }, this);
                }
            },
            interact: function() {
                if (state.inventory.isVisible()) {
                    state.inventory.hide();
                } else if (state.settings.is(':visible')) {
                    state.settings.hide();
                } else {
                    var sqdist, angle;
                    var least = NaN;
                    var closest = null;
                    this.chests.forEach(function(chest) {
                        sqdist = chest.checkAccessible(this.player);
                        if (chest.accessible &&
                            (isNaN(least) || sqdist < least)) {
                            closest = chest;
                            least = sqdist;
                        }
                    }, this);

                    state.inventory.populate(closest);
                    state.inventory.show();
                }
            },
            handRight: function(event) {
                this.player.punchRight =
                    new Date().getTime(); },
            handLeft: function(event) {
                this.player.punchLeft =
                    new Date().getTime(); }
        };

	state.player = makePlayer(
            (data.chardefs && 'player' in data.chardefs) ?
            data.chardefs['player'] : {}, state);
        state.setStage(fetchParam('startStage') || data.startStage);
        if (data.schema.disableDebug)
            debug = false;
        ripple.app($, container, viewport, state);
    };
})(typeof exports === 'undefined'? this['whiplash'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    const electron = require('electron');
    const path = require('path');
    const url = require('url');
    let mainWindow;

    electron.app
            .on('ready', function() {
                mainWindow = new electron.BrowserWindow(
                    {width: 800, height: 600,
                     webPreferences: { nodeIntegration: false }});
                mainWindow.loadURL(url.format({
                    pathname: path.join(__dirname, 'whiplash.html'),
                    protocol: 'file:',
                    slashes: true }));
                //mainWindow.webContents.openDevTools();
                mainWindow.on('closed', function () {
                    mainWindow = null; });
            })
            .on('window-all-closed', function () {
                if (process.platform !== 'darwin')
                    electron.app.quit(); })
            .on('activate', function () {
                if (mainWindow === null)
                    createWindow(); });
}
