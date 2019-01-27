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
// A library of tools for creating a video game user interface.
(function(fascia) {
    "use strict";
    if (typeof require !== 'undefined') {
        this.multivec = require('./multivec.js');
        this.multivec = require('./ripple.js');
    }

    // A playerControl stores state related to the direction a player
    // should move.
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
        if (event.keyCode === 37 || event.key === 'a') {
            this.clear(true);
	    this.left = true;
	} else if (event.keyCode === 38 || event.key === 'w') {
            this.clear(true);
            this.up = true;
	} else if (event.keyCode === 39 || event.key === 'd') {
            this.clear(true);
	    this.right = true;
	} else if (event.keyCode === 40 || event.key === 's') {
            this.clear(true);
	    this.down = true;
        } else if (event.key === 'q') {
            this.clear(true);
	    this.sleft = true;
        } else if (event.key === 'e') {
            this.clear(true);
	    this.sright = true;
	} else if (event.key === 'z') { this.player.activateRight();
	} else if (event.key === 'c') { this.player.activateLeft();
        } else if (event.key === 'i' || event.key === '`') {
            this.player.interact();
        } else result = false;
        return result;
    };

    fascia.playerControl.prototype.keyup = function(event) {
        var result = true;
	if (event.keyCode === 37 || event.key === 'a') {
            this.clear(true);
	    this.left = false;
	} else if (event.keyCode === 38 || event.key === 'w') {
            this.clear(true);
            this.up = false;
	} else if (event.keyCode === 39 || event.key === 'd') {
            this.clear(true);
	    this.right = false;
	} else if (event.keyCode === 40 || event.key === 's') {
            this.clear(true);
	    this.down = false;
        } else if (event.key === 'q') {
            this.clear(true);
	    this.sleft = false;
        } else if (event.key === 'e') {
            this.clear(true);
	    this.sright = false;
	} else if (event.key === 'z') {
	} else if (event.key === 'c') {
        } else if (event.key === 'i' || event.key === '`') {
        }
        return result;
    };

    // Set a destination the player should attempt to reach
    fascia.playerControl.prototype.setTarget = function(target) {
        var diff;

        this.clear();
        target = multivec(target);
        if (!(diff = target.minus(this.player.position)).zeroish()) {
            this.target = target;
            this.turn = diff.normalize();
        }
    };

    // Set a direction the player should move in until hitting an obstacl
    fascia.playerControl.prototype.setArrow = function(
        turn, start, end) {
        this.clear();

        if (start) {
            if (end)
                this.arrow = multivec(end).minus(start);
            else this.arrow = multivec(start);
        } else this.arrow = turn;

        this.arrow = this.arrow.normalize();
        this.turn = turn ? this.arrow : null;
    };

    fascia.playerControl.prototype.setLook = function(look) {
        this.clear();
        this.turn = multivec(look).minus(
            this.player.position).normalize();
        this.target = this.player.position;
    };

    // Draws a vision cone to illustrate what a character can see
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

    // Draws a character from top-down perspective
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

    // Draw a character portrait.  All coordinates are between (0, 0)
    // and (1, 1) so it's important to scale the context appropriately
    // before calling this function.
    fascia.drawCharacterPortrait = function(ctx, character, now) {
        var head = {x: 0, y: 9/10, radius: 1/10};
        var hand = {x: 1/3, y: 1/2, radius: 1/25};
        var eye = {x: 1/30, y: 9/10, radius: 1/75};
        var foot = {x: 3/32, y: 0, radius: 1/20};
        var neck = {x: 1/20, y: 31/40, radius: 0};
        var shoulder = {x: 3/20, y: 30/40, radius: 1/20};
        var armpit = {x: 12/100, y: 26/40, radius: 1/20};
        var elbow = {x: 5/24, y: 12/20, radius: 1/30};
        var waste = {x: 1/10, y: 26/50, radius: 0};
        var hip = {x: 7/60, y: 9/20, radius: 0};
        var knee = {x: 3/32, y: 9/40, radius: 1/20};
        var ankle = {x: 3/32, y: 1/50, radius: 1/20};
        var groin = {x: 0, y: 16/40, radius: 0};

        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(neck.x, neck.y);
        ctx.lineTo(shoulder.x, shoulder.y);
        ctx.lineTo(elbow.x + elbow.radius, elbow.y);
        ctx.lineTo(hand.x + hand.radius / 2, hand.y);
        ctx.lineTo(hand.x - hand.radius / 2, hand.y - hand.radius / 2);
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
        ctx.lineTo(-hand.x + hand.radius / 2, hand.y - hand.radius / 2);
        ctx.lineTo(-hand.x - hand.radius / 2, hand.y);
        ctx.lineTo(-elbow.x - elbow.radius, elbow.y);
        ctx.lineTo(-shoulder.x, shoulder.y);
        ctx.lineTo(-neck.x, neck.y);
        ctx.moveTo(-head.x, head.y);
        ctx.fillStyle = character.bodyColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, head.y);
        ctx.lineTo(0, waste.y);
        ctx.moveTo(neck.x / 2, neck.y);
        ctx.lineTo(-neck.x / 2, neck.y);
        ctx.moveTo(foot.x, (shoulder.y + armpit.y) / 2);
        ctx.lineTo(foot.x - foot.radius, (shoulder.y + armpit.y) / 2);
        ctx.lineWidth = 0.01;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'black';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius, 0, 2 * Math.PI);
        ctx.moveTo(hand.x, hand.y);
        ctx.arc(hand.x, hand.y, hand.radius, 0, 2 * Math.PI);
        ctx.moveTo(-hand.x, hand.y);
        ctx.arc(-hand.x, hand.y, hand.radius, 0, 2 * Math.PI);
        ctx.moveTo(foot.x, foot.y);
        ctx.arc(foot.x, foot.y, foot.radius, 0, Math.PI);
        ctx.moveTo(-foot.x, foot.y);
        ctx.arc(-foot.x, foot.y, foot.radius, 0, Math.PI);
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
     * A character is a representation of a humanoid creature.  It might
     * be a human, robot, monster or something else.  Characters have
     * the following properties:
     *
     *   position: vector representing location
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
                inventory.push(config.itemSystem.create(item));
        });

        return {
            position: config.position ?
                      multivec(config.position) :
                      multivec([
                          config.x || 0, config.y || 0, config.z || 0]),
            direction: config.direction || 0,
            size: config.size || 1,
            speed: config.speed || 0.005,
            turnSpeed: config.turnsSpeed || 0.005,
            destination: null,

            headColor: config.headColor || '#666',
            bodyColor: config.bodyColor || '#333',
            eyeColor: config.eyeColor || '#eee',
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

        result.interact = (config && config.interact) || function() {};

        result.activateLeft = function() {
            this.punchLeft = Date.now();
        };
        result.activateRight = function() {
            this.punchRight = Date.now();
        };

        // Adjusts the destination determined by player actions to
        // account for obstacles.
        result.replan = function(now, collide, destination) {
            this.control.clear(true);
            return this.position.add(
                destination.minus(this.position).multiply(collide));
        };

        // Creates a destination based on what the player is asking
        // his/her character to do.
        result.plan = function(now) {
            var result = undefined;
            var needrads, signrads, tgtvec;
            var rads = this.turnSpeed * (now - this.last);
            var steps = this.speed * (now - this.last);
            var dirvec = multivec({theta: this.direction});

            if (this.control.turn) {
                // Work out how much turning is necessary to face
                // the designated target
                signrads = (dirvec.times({o2o1: 1}).dot(
                    this.control.turn).scalar < 0) ? 1 : -1;
                needrads = Math.acos(ripple.clamp(dirvec.dot(
                    this.control.turn).scalar, -1, 1));

                // Do as much turning as we can in the time available
                // and use extra time to take steps
                if (needrads < 0.01) {
                    // Close enough for now
                } else if (needrads > rads) {
                    this.direction += signrads * rads;
                    steps = 0;
                } else {
                    this.direction += signrads * needrads;
                    dirvec = multivec({theta: this.direction});
                    steps *= (rads - needrads) / rads;
                    this.control.turn = null;
                }
            }

            if (this.control.target) {
                tgtvec = this.control.target.minus(this.position);

                if (tgtvec.normSquared() < (steps * steps)) {
                    result = this.control.target;
                    this.control.clear();
                } else if (steps > 0)
                    result = this.position.plus(dirvec.times(steps));
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

    var fasciaButtonSize = function(width, height) {
        return Math.floor(Math.min(width, height) / 7); };

    // An item system connects items from a characters inventory to
    // definition objects that give the items default properties.
    fascia.itemSystem = function(itemdefs) {
        if (!(this instanceof fascia.itemSystem))
            return new fascia.itemSystem(itemdefs);
        this.itemdefs = itemdefs || {};
    };

    fascia.itemSystem.prototype.create = function(item) {
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

    // The image system manages icon images in sprite sheets so that
    // a single source image can be used to supply many icons at once.
    fascia.imageSystem = function(config) {
        if (!(this instanceof fascia.imageSystem))
            return new fascia.imageSystem(config);

        this.images = (config && config.files) || {};
        this.icons = (config && config.icons) || {};
        this.size = 45;
    };

    fascia.imageSystem.prototype.resize = function(width, height) {
        this.size = fasciaButtonSize(width, height);
        document.querySelectorAll('.fascia-item').forEach(
            function(button) {
                button.style.width = this.size + 'px';
                button.style.height = this.size + 'px';
            }, this);
    };

    fascia.imageSystem.prototype.applyItem = function(config, element) {
        var position = 'center';
        var backsize = 'contain';
        var imgdef;
        var image;
        var settings;
        var className = 'fascia-item';

        if (!config)
            settings = this.icons['default'] || {};
        else if (typeof config === 'string')
            settings = this.icons[config] || {};
        else {
            settings = (typeof(config.icon) === 'object') ?
                       config.icon : (this.icons[config.icon] || {});
            if (config.className)
                className += ' ' + config.className;
            if (config.title)
                element.setAttribute('title', config.title);
            if (config.data)
                Object.keys(config.data).forEach(function(key) {
                    element.setAttribute(
                        'data-' + key, config.data[key]); });
            if (config.drag) {
                element.style.cursor = 'move';
                element.setAttribute('draggable', true);
                element.addEventListener('dragstart', function(event) {
                    event.target.classList.add('dragging');
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(
                        'text/json', JSON.stringify(config.drag));
                });
                element.addEventListener('dragend', function(event) {
                    event.target.classList.remove('dragging');
                });
            }
            if (config.drop) {
                element.addEventListener('dragover', function(event) {
                    if (event.preventDefault)
                        event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    return false;
                });
                element.addEventListener('dragenter', function(event) {
                    event.target.classList.add('over');
                });
                element.addEventListener('dragleave', function(event) {
                    event.target.classList.remove('over');
                });
                element.addEventListener('drop', function(event) {
                    if (event.stopPropagation)
                        event.stopPropagation();
                    config.drop(JSON.parse(event.dataTransfer.getData(
                        'text/json')))
                    return false;
                });
            }
        };

        imgdef = this.images[settings.image || 'default'];
        if (imgdef) {
            image = 'url(' + imgdef.url + ')';
            if (!isNaN(imgdef.cols) && !isNaN(imgdef.rows)) {
                backsize = (
                    (imgdef.size * imgdef.cols) + '% ' + (
                        imgdef.size * imgdef.rows) + '%');
                position = (
                    Math.floor(100 * settings.col /
                        (imgdef.cols - 1)) + '% ' +
                    Math.floor(100 * settings.row /
                        (imgdef.rows - 1)) + '%');
                }
        } else image = settings.image;

        element.setAttribute('class', className);
        element.style['background-image'] = image;
        element.style['background-position'] = position;
        element.style['background-size'] = backsize;
        element.style.width = this.size + 'px';
        element.style.height = this.size + 'px';
        return element;
    };

    fascia.imageSystem.prototype.createItem = function(config) {
        var result = document.createElement('div');
        return this.applyItem(config, result);
    };

    fascia.imageSystem.prototype.createButton = function(
        config, fn, context) {
        var result = document.createElement('button');
        result.addEventListener('mousedown', function(event) {
            fn.apply(context, arguments);
            return false;
        });
        result.addEventListener('touchstart', function(event) {
            fn.apply(context, arguments);
            return false;
        });
        return this.applyItem(config, result);
    };

    fascia.screen = function(container, options) {
        var index;
        if (!(this instanceof fascia.screen)) {
            var screen = new fascia.screen(container, options);
            for (index = 2; index < arguments.length; ++index)
                screen.pane.appendChild(arguments[index]);
            return screen;
        }
        this.pane = ripple.createElement(
            'div', {className: 'fascia-screen'});
        for (index = 2; index < arguments.length; ++index)
            this.pane.appendChild(arguments[index]);
        this.hide();

        if (!options)
            options = {};
        this._title = options.title || 'Screen';
        if (options.imageSystem)
            this.pane.appendChild(
                ripple.createElement(
                    'div', {className: 'bbar', style: {
                        position: 'relative', top: 0, left: 0}},
                    options.imageSystem.createButton(
                        {icon: 'close', className: 'inventory-close'},
                        function(event) { this.hide(); }, this),
                    ripple.createElement(
                        'h1', null, document.createTextNode(
                            this._title))));
        container.appendChild(this.pane);
    };

    fascia.screen.prototype.title = function(value) {
        if (value) {
            var h1 = this.pane.querySelector('h1');
            if (h1) {
                h1.innerHTML = '';
                h1.appendChild(document.createTextNode(value));
            }
            this._title = value
            return this;
        } else return this._title;
    };

    fascia.screen.prototype.show = function() {
        return ripple.show(this.pane); };

    fascia.screen.prototype.hide = function() {
        return ripple.hide(this.pane); };

    fascia.screen.prototype.toggle = function() {
        return ripple.toggleVisible(this.pane); };

    fascia.screen.prototype.isVisible = function() {
        return ripple.isVisible(this.pane); };

    fascia.screen.prototype.resize = function(width, height) {
        var size = fasciaButtonSize(width, height);
        this.pane.style.width = Math.floor(width - size / 2) + 'px';
        this.pane.style.height = Math.floor(height - size / 2) + 'px';
        this.pane.style.top = Math.floor(size / 4) + 'px';
        this.pane.style.left = Math.floor(size / 4) + 'px';
        return this;
    };

    // Create an HTML inventory system
    fascia.inventoryScreen = function(
        container, player, itemSystem, imageSystem) {
        if (!(this instanceof fascia.inventoryScreen))
            return new fascia.inventoryScreen(
                container, player, itemSystem, imageSystem);
        fascia.screen.call(this, container);
        ripple.addClass(this.pane, 'inventory');

        this.imageSystem = imageSystem;
        this.itemSystem = itemSystem;
        this.player = player;
        this.other = null;
        this.__drawPortraitID = 0;

        var give = function(event) {
            var selected =
                this.playerPane.querySelectorAll('.selected');
            if (selected.length > 0) {
                var chosen = {};
                var updated = [];
                selected.forEach(function(item, index) {
                    var value = item.getAttribute('data-index');
                    if (!isNaN(value))
                        chosen[parseInt(value, 10)] = true; });
                this.player.inventory.forEach(function(item, index) {
                    if (index in chosen)
                        this.other.inventory.push(item);
                    else updated.push(item);
                }, this);
                this.player.inventory = updated;
                this.populate(this.other);
            } else this.playerPane.querySelectorAll('button').forEach(
                function(button) {
                    ripple.addClass(button, 'selected'); });
        };

        var take = function(event) {
            var selected =
                this.otherPane.querySelectorAll('.selected');
            if (selected.length > 0) {
                var chosen = {};
                var updated = [];
                selected.forEach(function(item, index) {
                    var value = item.getAttribute('data-index');
                    if (!isNaN(value))
                        chosen[parseInt(value, 10)] = true; });
                this.other.inventory.forEach(function(item, index) {
                    if (index in chosen)
                        this.player.inventory.push(item);
                    else updated.push(item);
                }, this);
                this.other.inventory = updated;
                this.populate(this.other);
            } else this.otherPane.querySelectorAll('button').forEach(
                function(button) {
                    ripple.addClass(button, 'selected'); });
        };

        this.header = ripple.createElement('div', {
            'class': 'inventory-header'}, ripple.createElement(
                'div', {'class': 'bbar'},
                this.imageSystem.createButton(
                    {icon: 'close', className: 'inventory-close'},
                    function(event) { this.hide(); }, this),
                this.imageSystem.createItem(
                    {icon: 'lhand', className: 'inventory-lhand',
                     drop: function(value) {
                         console.log('DEBUG-lhand-drop', value); }}),
                this.imageSystem.createItem(
                    {icon: 'rhand', className: 'inventory-rhand',
                     drop: function(value) {
                         console.log('DEBUG-rhand-drop', value); }}),
                this.imageSystem.createButton(
                    {icon: 'take', className: 'inventory-givetake'},
                    take, this),
                this.imageSystem.createButton(
                    {icon: 'give', className: 'inventory-givetake'},
                    give, this)
            ));
        this.pane.appendChild(this.header);
        this.playerPane = ripple.createElement(
            'div', {'class': 'inventory-pane inventory-self'});
        this.pane.appendChild(this.playerPane);
        this.otherPane = ripple.createElement(
            'div', {'class': 'inventory-pane inventory-other'});
        this.pane.appendChild(this.otherPane);
        this.footer = ripple.createElement(
            'div', {'class': 'inventory-footer'});
        this.pane.appendChild(this.footer);
        this.portraitPane = ripple.createElement(
            'canvas', {'class': 'inventory-pane inventory-portrait'});
        this.pane.appendChild(this.portraitPane);
        this.populate();
    };
    fascia.inventoryScreen.prototype =
        Object.create(fascia.screen.prototype);

    fascia.inventoryScreen.prototype.resize = function(width, height) {
        var size = fasciaButtonSize(width, height);
        fascia.screen.prototype.resize.call(this, width, height);
        document.querySelectorAll('.inventory-header, .inventory-footer')
                .forEach(function(element) {
                    element.style.height =
                        Math.floor(size) + 'px'; });
        return this;
    };

    fascia.inventoryScreen.prototype.showPortrait = function() {
        var self = this;
        var draw = function() {
            var canvas = self.portraitPane;

            if (self.isVisible() && canvas.getContext) {
                var width = canvas.clientWidth;
                var height = canvas.clientHeight;
                var size = Math.min(width, height);
                var margin = 0.05;
                var ctx;

                canvas.width = width;
                canvas.height = height;

                ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, width, height);
                ctx.save();
                ctx.translate(
                    width / 2, height -
                    (height - (1 - margin) * size) / 2);
                ctx.scale((1 - margin) * size, -(1 - margin) * size);
                self.player.drawPortrait(ctx, Date.now());
                ctx.restore();

            }
            if (!self.other)
                self.__drawPortraitID = requestAnimationFrame(draw);
            else self.__drawPortraitID = 0;
        };

        if (!self.__drawPortraitID)
            draw();
        return this;
    };

    fascia.inventoryScreen.prototype.addItem = function(
        item, index, itemPane) {
        var element = document.createElement('div');

        element = this.imageSystem.applyItem(
            {icon: item.icon, title: item.toString(), drag: item,
             data: {index: index}}, element);
        element.addEventListener('click', function(event) {
            ripple.toggleClass(event.target, 'selected'); });
        itemPane.appendChild(element);
        return this;
    };

    fascia.inventoryScreen.prototype.populate = function(other) {
        this.playerPane.innerHTML = '';
        if (this.player) {
            this.player.inventory.forEach(function(item, index) {
                this.addItem(item, index, this.playerPane);
            }, this);
        }

        this.otherPane.innerHTML = '';
        this.other = other;
        if (this.other) {
            this.other.inventory.forEach(function(item, index) {
                this.addItem(item, index, this.otherPane);
            }, this);
            document.querySelectorAll('.inventory-portrait').forEach(
                function(element) { element.style.display = 'none'; });
            document.querySelectorAll('.inventory-givetake').forEach(
                function(element) { element.style.display = 'block'; });
        } else {
            document.querySelectorAll('.inventory-givetake').forEach(
                function(element) { element.style.display = 'none'; });
            document.querySelectorAll('.inventory-portrait').forEach(
                function(element) { element.style.display = 'block'; });
            this.showPortrait();
        }
    };

    // Framework for canvas applications
    // Object passed as the app is expected to have the following:
    //
    // app.init(container, viewport, redraw)
    // app.draw(ctx, width, height, now, last)
    // app.resize(width, height)
    // app.keydown(event, redraw)
    // app.keyup(event, redraw)
    // app.mtdown(targets, event, redraw)
    // app.mtup(targets, event, redraw)
    // app.mtmove(targets, event, redraw)
    // app.isActive() // return falsy if redraw not needed
    // app.color
    // app.background
    fascia.app = function(app, container, viewport) {
        if (!container)
            container = document.body;
        if (!viewport)
            viewport = window;

        var canvas = ripple.createElement(
            'canvas', {'class': 'fascia-canvas'});
        container.insertBefore(canvas, container.firstChild);

        var draw_id = 0, draw_last = 0;
        var draw = function() {
            var ii, ctx, width, height;
            var now = Date.now();
            draw_id = 0;

            width = canvas.clientWidth;
            height = canvas.clientHeight;
            ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            if (app.draw)
                app.draw(ctx, width, height, now, draw_last);
            draw_last = now;
            if (app.isActive && app.isActive())
                redraw();
        };

        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        viewport.addEventListener('resize', function(event) {
            var width = viewport.innerWidth || viewport.clientWidth;
            var height = viewport.innerHeight || viewport.clientHeight;
            if (!width || !height)
                return;
            canvas.style.width  = canvas.width  = width;
            canvas.style.height = canvas.height = height;
            if (app.resize)
                app.resize(width, height, container);
            redraw();
        });
        viewport.dispatchEvent(new Event('resize'));
        if (app.init)
            app.init(container, viewport, redraw);

        var g = ripple.gestur({
            next: true,
            tap: function(name, event) {
                if (app.tap)
                    return app.tap(event, redraw);
            },
            doubleTap: function(name, event) {
                if (app.doubleTap)
                    return app.doubleTap(event, redraw);
            },
            swipe: function(name, event) {
                if (app.swipe)
                    return app.swipe(event, redraw);
            },
            drag: function(name, event) {
                if (app.drag)
                    return app.drag(event, redraw);
            },
            pinchStart: function(name, event) {
                if (app.pinchStart)
                    return app.pinchStart(event, redraw);
            },
            pinchMove: function(name, event) {
                if (app.pinchMove)
                    return app.pinchMove(event, redraw);
            },
            wheel: function(name, event) {
                if (app.wheel)
                    return app.wheel(event, redraw);
            }
        }, canvas);

	viewport.addEventListener('keydown', function(event) {
            if (app.keydown)
                return app.keydown(event, redraw);
	});

	viewport.addEventListener('keyup', function(event) {
            if (app.keyup)
                return app.keyup(event, redraw);
	});
    };

}).call(this, typeof exports === 'undefined' ?
        (this.fascia = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
