// skycam.js
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
// A collection of routines for implementing top down character oriented
// games in a web browser.
(function(skycam) {
    "use strict";
    if (typeof require !== 'undefined') {
        this.multivec = require('./multivec.js');
        this.multivec = require('./ripple.js');
    }

    skycam.createInventory = function($, state, container, player) {
        if (!(this instanceof skycam.createInventory))
            return new skycam.createInventory(
                $, state, container, player);
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
                .append(state.createButton($, 'close', function(event) {
                    state.inventory.hide();
                }, this)
                             .addClass('close'))
                .append(state.createButton($, 'take', take, this)
                             .addClass('give-and-take'))
                .append(state.createButton($, 'give', give, this)
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

    skycam.createInventory.prototype.show = function() {
        this.pane.show(); };

    skycam.createInventory.prototype.hide = function() {
        this.pane.hide(); };

    skycam.createInventory.prototype.toggle = function() {
        this.pane.toggle(); };

    skycam.createInventory.prototype.isVisible = function() {
        return this.pane.is(':visible'); };

    skycam.createInventory.prototype.addItem = function(
        item, index, isOther) {
        var icon = item.icon;

        if (!icon) {
            var itemdef = this.state.itemdefs[item.type];
            if (itemdef)
                icon = itemdef.icon;
        }
        (isOther ? this.otherPane : this.playerPane).append(
            this.state.createButton($, icon, function(event) {
                jQuery(event[0].target)
                    .toggleClass('selected');
            }, this)
                .prop('title', item.toString())
                .data('index', index));
    };

    skycam.createInventory.prototype.populate = function(other) {
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
        this.state.postPopulate();
    };

    skycam.drawVision = function(ctx, character, state, now) {
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

    skycam.drawCharacter = function(ctx, character, state, now) {
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

    skycam.playerControl = function(player) {
        if (!(this instanceof skycam.playerControl))
            return new skycam.playerControl(player);
        this.player = player;
        this.clear(false);
    };

    skycam.playerControl.prototype.clear = function(keep) {
        if (!keep)
            this.up = this.down = this.left = this.right =
                this.sleft = this.sright = false;
        this.arrow = null;
        this.target = null;
        this.dir = null;
        this.turn = null;
    };

    skycam.playerControl.prototype.setTarget = function(target) {
        this.clear();
        this.target = target;
        this.turn = multivec(target).minus(
            this.player.position).normalize();
    };

    skycam.playerControl.prototype.setArrow = function(turn, start, end) {
        this.clear();
        if (end)
            this.arrow = multivec(end).minus(start);
        else this.arrow = multivec(start);
        this.arrow = this.arrow.normalize();
        this.turn = turn ? this.arrow : null;
    };

    skycam.playerControl.prototype.setLook = function(look) {
        this.clear();
        this.turn = multivec(look).minus(
            this.player.position).normalize();
        this.target = this.player.position;
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
    skycam.makeCharacter = function(config, state) {
        var inventory = [];
        if (!config)
            config = {};

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

            drawPre: config.drawPre || function(ctx, state, now) {
                skycam.drawVision(ctx, this, state, now);
            },

            draw: config.draw || function(ctx, state, now) {
                skycam.drawCharacter(ctx, this, state, now);
            }
        };
    };

    skycam.makePlayer = function(config, state) {
        var result = skycam.makeCharacter(config, state);
        result.control = skycam.playerControl(result);

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

}).call(this, typeof exports === 'undefined' ?
        (this.skycam = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
