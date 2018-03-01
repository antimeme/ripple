// fascia.js
// Copyright (C) 2018 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
// A library of tools for creating a video game user interface within a
// web browser.
(function(fascia) {
    "use strict";
    if (typeof require !== 'undefined') {
        this.multivec = require('./multivec.js');
        this.multivec = require('./ripple.js');
    }

    fascia.playerControl = function(player) {
        if (!(this instanceof fascia.playerControl))
            return new fascia.playerControl(player);
        this.player = player;
        this.clear(false);
    };

    fascia.playerControl.prototype.clear = function(keep) {
        if (!keep) {
            this.up = false;
            this.down = false;
            this.left = false;
            this.right = false;
            this.sleft = false;
            this.sright = false;
        }
        this.arrow = null;
        this.target = null;
        this.dir = null;
        this.turn = null;
    };

    fascia.playerControl.prototype.keydown = function(event) {
        var result = true;
        if (event.keyCode === 37 /* left */ ||
            event.keyCode === 65 /* a */) {
            this.clear(true);
	    this.left = true;
	} else if (event.keyCode === 38 /* up */ ||
                   event.keyCode === 87 /* w */) {
            this.clear(true);
            this.up = true;
	} else if (event.keyCode === 39 /* right */ ||
                   event.keyCode === 68 /* d */) {
            this.clear(true);
	    this.right = true;
	} else if (event.keyCode === 40 /* down */ ||
                   event.keyCode === 83 /* s */) {
            this.clear(true);
	    this.down = true;
        } else if (event.keyCode === 81 /* q */) {
            this.clear(true);
	    this.sleft = true;
        } else if (event.keyCode === 69 /* e */) {
            this.clear(true);
	    this.sright = true;
	} else if (event.keyCode === 90 /* z */) {
            this.player.punchRight = Date.now();
	} else if (event.keyCode === 67 /* c */) {
            this.player.punchLeft = Date.now();
        } else if (event.keyCode === 73 /* i */ ||
                   event.keyCode === 192 /* tilde */) {
            this.player.interact();
        } else result = false;
        return result;
    };

    fascia.playerControl.prototype.keyup = function(event) {
        var result = true;
	if (event.keyCode === 37 || event.keyCode === 65) {
            this.clear(true);
	    this.left = false;
	} else if (event.keyCode === 38 || event.keyCode === 87) {
            this.clear(true);
            this.up = false;
	} else if (event.keyCode === 39 || event.keyCode === 68) {
            this.clear(true);
	    this.right = false;
	} else if (event.keyCode === 40 || event.keyCode === 83) {
            this.clear(true);
	    this.down = false;
        } else if (event.keyCode === 81 /* q */) {
            this.clear(true);
	    this.sleft = false;
        } else if (event.keyCode === 69 /* e */) {
            this.clear(true);
	    this.sright = false;
	} else if (event.keyCode === 90 /* z */) {
	} else if (event.keyCode === 67 /* c */) {
        } else if (event.keyCode === 70 /* i */ ||
                   event.keyCode === 192 /* tilde */) {
        }
        return result;
    };

    fascia.playerControl.prototype.setTarget = function(target) {
        this.clear();
        this.target = target;
        this.turn = multivec(target).minus(
            this.player.position).normalize();
    };

    fascia.playerControl.prototype.setArrow = function(turn, start, end) {
        this.clear();
        if (end)
            this.arrow = multivec(end).minus(start);
        else this.arrow = multivec(start);
        this.arrow = this.arrow.normalize();
        this.turn = turn ? this.arrow : null;
    };

    fascia.playerControl.prototype.setLook = function(look) {
        this.clear();
        this.turn = multivec(look).minus(
            this.player.position).normalize();
        this.target = this.player.position;
    };

    fascia.drawVision = function(ctx, character, now) {
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

    fascia.drawCharacter = function(ctx, character, now) {
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

    fascia.drawCharacterPortrait = function(ctx, character, now) {
        var head = {x: 0, y: 9/10, radius: 1/10};
        var hand = {x: 1/3, y: 1/2, radius: 1/25};
        var eye = {x: 1/30, y: 9/10, radius: 1/75};
        var neck = {x: 1/20, y: 31/40, radius: 0};
        var shoulder = {x: 3/20, y: 30/40, radius: 1/20};
        var armpit = {x: 13/100, y: 27/40, radius: 1/20};
        var elbow = {x: 5/24, y: 12/20, radius: 1/30};
        var waste = {x: 1/10, y: 26/50, radius: 0};
        var hip = {x: 7/60, y: 9/20, radius: 0};
        var knee = {x: 3/32, y: 9/40, radius: 1/20};
        var ankle = {x: 3/32, y: 1/20, radius: 1/20};
        var groin = {x: 0, y: 16/40, radius: 0};

        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(neck.x, neck.y);
        ctx.lineTo(shoulder.x, shoulder.y);
        ctx.lineTo(elbow.x + elbow.radius, elbow.y);
        ctx.lineTo(hand.x + hand.radius / 2, hand.y);
        ctx.lineTo(hand.x - hand.radius / 2, hand.y);
        ctx.lineTo(elbow.x - elbow.radius, elbow.y - elbow.radius);
        ctx.lineTo(armpit.x, armpit.y);
        ctx.lineTo(waste.x, waste.y);
        ctx.lineTo(hip.x, hip.y);
        ctx.lineTo(knee.x + knee.radius, knee.y);
        ctx.lineTo(ankle.x + ankle.radius, ankle.y);
        ctx.lineTo(ankle.x - ankle.radius, ankle.y);
        ctx.lineTo(knee.x - knee.radius, knee.y);
        ctx.lineTo(groin.x, groin.y);
        ctx.lineTo(-knee.x + knee.radius, knee.y);
        ctx.lineTo(-ankle.x + ankle.radius, ankle.y);
        ctx.lineTo(-ankle.x - ankle.radius, ankle.y);
        ctx.lineTo(-knee.x - knee.radius, knee.y);
        ctx.lineTo(-hip.x, hip.y);
        ctx.lineTo(-waste.x, waste.y);
        ctx.lineTo(-armpit.x, armpit.y);
        ctx.lineTo(-elbow.x + elbow.radius, elbow.y - elbow.radius);
        ctx.lineTo(-hand.x + hand.radius / 2, hand.y);
        ctx.lineTo(-hand.x - hand.radius / 2, hand.y);
        ctx.lineTo(-elbow.x - elbow.radius, elbow.y);
        ctx.lineTo(-shoulder.x, shoulder.y);
        ctx.lineTo(-neck.x, neck.y);
        ctx.moveTo(-head.x, head.y);
        ctx.fillStyle = character.bodyColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius, 0, 2 * Math.PI);
        ctx.moveTo(hand.x, hand.y);
        ctx.arc(hand.x, hand.y, hand.radius, 0, 2 * Math.PI); // left
        ctx.moveTo(-hand.x, hand.y);
        ctx.arc(-hand.x, hand.y, hand.radius, 0, 2 * Math.PI); // right
        ctx.fillStyle = character.headColor;
        ctx.fill();

        if (!character.blinkFreq || !character.blinkLength ||
            ((now + character.blinkPhase) % character.blinkFreq) >
            character.blinkLength) {
            ctx.beginPath();
            ctx.arc(eye.x, eye.y, eye.radius, 0, 2 * Math.PI);
            ctx.moveTo(-eye.x, eye.y);
            ctx.arc(-eye.x, eye.y, eye.radius, 0, 2 * Math.PI);
            ctx.fillStyle = character.eyeColor;
            ctx.fill();
        }
    };

    /**
     * A character is a representation of a humanoid create.
     * Characters have the folleowing properties:
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
    fascia.createCharacter = function(config) {
        var inventory = [];
        if (!config)
            config = {};

        config.inventory && config.inventory.forEach(function(item) {
            if (item && item.type && config.itemSystem)
                inventory.push(config.itemSystem.createItem(item));
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

            last: config.last || Date.now(),

            update: config.update || function(now) {
                if (this.destination) {
                    this.position = this.destination;
                    this.destination = null;
                }
            },

            plan: config.planners ?
                  ((config.plan && config.plan in config.planners) ?
                   config.planners[config.plan] :
                   config.planners.idle) : null,

            replan: function() {
                // This is how the system informs us of collisions
                // which indicates that we must update our plan
                this.control.swipe = null;
                this.destination =
                    this.position.add(
                        this.destination.multiply(collide));
            },

            drawPre: config.drawPre || function(ctx, now) {
                fascia.drawVision(ctx, this, now);
            },

            draw: config.draw || function(ctx, now) {
                fascia.drawCharacter(ctx, this, now);
            },

            drawPortrait: config.draw || function(ctx, now) {
                fascia.drawCharacterPortrait(ctx, this, now);
            }
        };
    };

    fascia.createPlayer = function(config) {
        var result = fascia.createCharacter(config);

        result.control = fascia.playerControl(result);

        result.interact = config.interact || function() {};

        result.replan = function(now, collide, destination) {
            this.control.clear(true);
            return this.position.add(
                destination.minus(this.position).multiply(collide));
        };

        result.plan = function(now) {
            var result = undefined;
            var steps = this.speed * (now - this.last);
            var rads = 0.005 * (now - this.last);
            var dirvec, signrads, needrads, swipe;

            if (this.control.target)
                console.log('DEBUG-a', steps);
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
                    if (this.control.target)
                        console.log('DEBUG-b', steps, needrads, rads);
                } else {
                    this.direction += signrads * needrads;
                    dirvec = multivec({theta: this.direction});
                    steps *= (rads - needrads) / rads;
                    if (this.control.target)
                        console.log('DEBUG-c', steps);
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

    fascia.itemSystem = function(itemdefs) {
        if (!(this instanceof fascia.itemSystem))
            return new fascia.itemSystem(itemdefs);
        this.itemdefs = itemdefs || {};
    };

    fascia.itemSystem.prototype.createItem = function(item) {
        var result = {
            type: item.type,
            weight: item.weight || 0,
            toString: function() { return item.type; } };

        if (item.type in this.itemdefs)
            result.definition = this.itemdefs[item.type];
        result.icon = result.definition ?
                      result.definition.icon : 'default';
        return result;
    };

    // Manages icon images in sprite sheets
    fascia.imageSystem = function(config, $) {
        if (!(this instanceof fascia.imageSystem))
            return new fascia.imageSystem(config);

        this.images = config.files;
        this.icons = config.icons;
        this.size = 45;
    };

    fascia.imageSystem.prototype.resize = function(width, height, $) {
        this.size = Math.floor(Math.min(width, height) / 11);
        $('.image-button').css({width: this.size, height: this.size});
    };

    fascia.imageSystem.prototype.createButton = function(
        config, $, fn, context) {
        var position = 'center';
        var backsize = 'contain';
        var imgdef;
        var image;

        if (!config)
            config = this.icons['default'];
        else if (typeof config === 'string')
            config = this.icons[config];

        imgdef = this.images[config.image || 'default'];
        if (imgdef) {
            image = 'url(' + imgdef.url + ')';
            if (!isNaN(imgdef.cols) && !isNaN(imgdef.rows)) {
                backsize = (
                    (imgdef.size * imgdef.cols) + '% ' + (
                        imgdef.size * imgdef.rows) + '%');
                position = (
                    Math.floor(100 * config.col /
                        (imgdef.cols - 1)) + '% ' + 
                    Math.floor(100 * config.row /
                        (imgdef.rows - 1)) + '%');
            }
        } else image = config.image;

        var result = $('<button>')
            .addClass('image-button')
            .css({
                'background-image': image,
                'background-position': position,
                'background-size': backsize,
                width: this.size, height: this.size })
            .on('mousedown touchstart', function(event) {
                fn.call(context, arguments);
                return false; });
        return result;
    };

    // Create an HTML inventory system
    fascia.inventoryPane = function(
        $, container, player, itemSystem, imageSystem) {
        if (!(this instanceof fascia.inventoryPane))
            return new fascia.inventoryPane(
                $, container, player, itemSystem, imageSystem);
        this.imageSystem = imageSystem;
        this.itemSystem = itemSystem;
        this.player = player;
        this.other = null;
        this.__drawPortraitID = 0;

        var give = function(event) {
            var selected = this.playerPane.find('.selected');
            if (selected.size() > 0) {
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
                this.populate($, this.other);
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
                this.populate($, this.other);
            } else this.otherPane.find('button').addClass('selected');
        };
        
        this.pane = $('<div>')
            .addClass('page').addClass('inventory').hide()
            .appendTo(container);
        this.header = $('<div>')
            .addClass('inventory-header')
            .append($('<div>')
                .addClass('bbar')
                .append(this.imageSystem.createButton(
                    'close', $, function(event) {
                        this.hide();
                    }, this).addClass('inventory-close'))
                .append(this.imageSystem.createButton(
                    'take', $, take, this)
                            .addClass('inventory-givetake'))
                .append(this.imageSystem.createButton(
                    'give', $, give, this)
                            .addClass('inventory-givetake')))
            .appendTo(this.pane);
        this.playerPane = $('<div>')
            .addClass('inventory-pane')
            .addClass('inventory-personal')
            .appendTo(this.pane);
        this.otherPane = $('<div>')
            .addClass('inventory-pane')
            .addClass('inventory-other')
            .appendTo(this.pane);
        this.portraitPane = $('<canvas>')
            .addClass('inventory-pane')
            .addClass('inventory-portrait')
            .appendTo(this.pane);
        this.footer = $('<div>')
            .addClass('inventory-footer')
            .appendTo(this.pane);
        this.populate($);
    };

    fascia.inventoryPane.prototype.showPortrait = function() {
        var self = this;
        var draw = function() {
            var canvas = self.portraitPane;

            if (self.isVisible() && canvas.size() &&
                canvas.get(0).getContext) {
                var width = canvas.innerWidth();
                var height = canvas.innerHeight();
                var size = Math.min(width, height);
                var ctx;

                canvas.attr('width', Math.floor(canvas.innerWidth()));
                canvas.attr('height', Math.floor(canvas.innerHeight()));

                ctx = canvas.get(0).getContext('2d');
                ctx.fillStyle = 'rgb(224, 224, 224)';
                ctx.fillRect(0, 0, width, height);
                ctx.save();
                ctx.translate(width / 2, height);
                ctx.scale(size, -size);
                self.player.drawPortrait(ctx, Date.now());
                ctx.restore();

            }
            if (!self.other)
                self.__drawPortraitID = requestAnimationFrame(draw);
        };

        draw();
        return this;
    };

    fascia.inventoryPane.prototype.show = function() {
        this.pane.show(); return this; };

    fascia.inventoryPane.prototype.hide = function() {
        this.pane.hide(); return this; };

    fascia.inventoryPane.prototype.toggle = function() {
        this.pane.toggle(); return this; };

    fascia.inventoryPane.prototype.isVisible = function() {
        return this.pane.is(':visible'); };

    fascia.inventoryPane.prototype.addItem = function(
        $, item, index, itemPane) {
        itemPane.append(this.imageSystem.createButton(
            item.icon, $, function(event) {
                $(event[0].target).toggleClass('selected');  }, this)
                            .prop('title', item.toString())
                            .data('index', index));
        return this;
    };

    fascia.inventoryPane.prototype.populate = function($, other) {
        this.playerPane.empty();
        if (this.player) {
            this.player.inventory.forEach(function(item, index) {
                this.addItem($, item, index, this.playerPane);
            }, this);
        }

        this.otherPane.empty();
        this.other = other;
        if (this.other) {
            this.other.inventory.forEach(function(item, index) {
                this.addItem($, item, index, this.otherPane);
            }, this);
            $('.inventory-portrait').hide();
            $('.inventory-givetake').show();
        } else {
            $('.inventory-givetake').hide();
            $('.inventory-portrait').show();
            this.showPortrait();
        }
    };

    // Framework for canvas applications
    // Object passed as the app is expected to have the following:
    //
    // app.init($, container, viewport)
    // app.draw(ctx, width, height, now)
    // app.resize(width, height)
    // app.keydown(event, redraw)
    // app.keyup(event, redraw)
    // app.mtdown(targets, event, redraw)
    // app.mtup(targets, event, redraw)
    // app.mtmove(targets, event, redraw)
    // app.isActive() // return falsy if redraw not needed
    // app.color
    // app.background
    fascia.app = function($, container, viewport, app) {
        var canvas = $('<canvas>')
            .attr('class', 'fascia-app')
            .appendTo(container);

        if (app.init)
            app.init($, container, viewport);

        var draw_id = 0, draw_last = 0;
        var draw = function() {
            var ii, ctx, width, height;
            var now = new Date().getTime();
            draw_id = 0;

            if (canvas.size() && canvas.get(0).getContext) {
                width = canvas.innerWidth();
                height = canvas.innerHeight();
                ctx = canvas.get(0).getContext('2d');
                ctx.clearRect(0, 0, width, height);
                if (app.draw)
                    app.draw(ctx, width, height, now, draw_last);
            }
            draw_last = now;
            if (!app.isActive || app.isActive())
                redraw();
        };

        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        var resize = function(event) {
            var width = viewport.width();
            var height = viewport.height();
            var size = Math.min(width, height);

            canvas.width(width);
	    canvas.height(height);
            if (app.resize)
                app.resize(
                    canvas.innerWidth(), canvas.innerHeight(), $);

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            canvas.attr("width",  Math.floor(canvas.innerWidth()));
            canvas.attr("height", Math.floor(canvas.innerHeight()));
            redraw();
        };

        viewport.resize(resize);
        resize();

	viewport.on('keydown', function(event) {
            if (app.keydown)
                return app.keydown(event, redraw);
	});

	viewport.on('keyup', function(event) {
            if (app.keyup)
                return app.keyup(event, redraw);
	});

        var g = ripple.gestur({
            next: true,
            tap: function(name, touch) {
                if (app.tap)
                    return app.tap(touch);
            },
            doubleTap: function(name, touch) {
                if (app.doubleTap)
                    return app.doubleTap(touch);
            },
            flick: function(name, start, end) {
                if (app.flick)
                    return app.flick(start, end);
            },
            drag: function(name, start, last, current) {
                if (app.drag)
                    return app.drag(start, last, current);
            },
            pinch: function(name, length, angle) {
                if (app.pinch)
                    return app.pinch(length, angle);
            },
        });
        g.setTarget(canvas);

        canvas.on('mousedown touchstart', function(event) {
            var touches;
            if (app.mtdown) {
                touches = ripple.createTouches(event);
                return app.mtdown(touches, event, redraw);
            }
            return false;
        });

        canvas.on('mousemove touchmove', function(event) {
            var touches;
            if (app.mtmove) {
                touches = ripple.createTouches(event);
                return app.mtmove(touches, event, redraw);
            }
            return false;
        });

        canvas.on('mouseleave mouseup touchend', function(event) {
            var touches;
            if (app.mtup) {
                touches = ripple.createTouches(event);
                return app.mtup(touches, event, redraw);
            }
            return false;
        });

        canvas.on('mousewheel', function(event) {
            if (app.mwheel)
                return app.mwheel(event, redraw);
            return false;
        });
    };

}).call(this, typeof exports === 'undefined' ?
        (this.fascia = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
