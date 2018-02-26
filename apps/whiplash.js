// whiplash.js
// Copyright (C) 2016-2018 by Jeff Gold.
//
// Whiplash Paradox is a game about time travel
// TODO click to target move
// TODO click to access inventory
// TODO event to register punch

(function(whiplash) {
    'use strict';
    if (typeof require !== 'undefined') {
        this.multivec = require('./ripple/multivec.js');
        this.ripple = require('./ripple/ripple.js');
        this.skycam = require('./ripple/skycam.js');
    }

    var fetchParam = function(name) {
        return (typeof window !== 'undefined') ?
               window.params[name] : process.env[name];
    };

    var browserSettings = {
        debug: !!fetchParam('debug'),
        profiling: false,
        rotateworld: !!fetchParam('rotateworld'),
        mazeType: fetchParam('mazeType') || undefined,
        mazeRings: Math.max(Math.min(parseInt(
            fetchParam('mazeRings'), 10), 8), 1),
        startStage: fetchParam('startStage'),
        mode: fetchParam('mode')
    };

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

    var update = function(now) {
        // Called to advance the game state
        if (isNaN(now))
            now = new Date().getTime();
	this.characters.forEach(function(character) {
            if (character.plan)
                character.destination = character.plan(this, now);
            else character.destination = null;
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
        if (data.schema.disableDebug)
            browserSettings.debug = false;

        var state = {
            debug: browserSettings.debug,
            rotateworld: browserSettings.rotateworld,
            mazeRings: browserSettings.mazeRings,
            mazeType: browserSettings.mazeType,
            startStage: browserSettings.startStage || data.startStage,

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
            createButton: function($, config, fn, context) {
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
                var result = $('<button>')
                    .addClass('image-button')
                    .css({
                        'background-image': image,
                        'background-position': position,
                        'background-size': backsize })
                    .on('mousedown touchstart', function(event) {
                        fn.call(context, arguments);
                        return false; });
                return result;
            },

            init: function($, container, viewport) {
                $('<div>') // Left Action Bar
                    .addClass('bbar')
                    .css({ bottom: 0, left: 0 })
                    .appendTo(container)
                    .append(this.createButton(
                        $, 'lhand', this.handLeft, this))
                    .append(this.createButton(
                        $, 'rhand', this.handRight, this));

                $('<div>') // Create action bar
                    .addClass('bbar')
                    .css({ bottom: 0, right: 0 })
                    .appendTo(container)
                    .append(this.createButton(
                        $, 'settings', function(event) {
                            state.settings.toggle();
                            state.inventory.hide(); }))
                    .append(this.createButton(
                        $, 'interact', function(event) {
                            state.interact(); }));

                this.settings = $('<div>')
                    .addClass('page').addClass('settings').hide()
                    .append('<h2>Settings</h2>')
                    .appendTo(container);
                this.inventory = skycam.createInventory(
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
                ctx.translate(width / 2, height / 2); // center origin
                ctx.scale(this.zoom.value, this.zoom.value);
                if (this.rotateworld) {
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
                if (this.debug) {
                    if (this.rotateworld)
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
	        } else if (this.debug)
                    console.log('down', event.keyCode);
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
	        } else if (this.debug) console.log('up', event.keyCode);
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
                    this.inventory.populate(closest);
                    this.inventory.show();
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
                if (this.rotateworld) {
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
            setStage: function(stageName) {
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
                                this.chardefs[character.type]), this));
                    }, this);
                if (stage.maze) {
                    if (this.mazeType)
                        stage.maze.type = this.mazeType;
                    if (this.mazeRings)
                        stage.maze.rings = this.mazeRings;
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
                if (this.inventory.isVisible()) {
                    this.inventory.hide();
                } else if (this.settings.is(':visible')) {
                    this.settings.hide();
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

                    this.inventory.populate(closest);
                    this.inventory.show();
                }
            },
            handRight: function(event) {
                this.player.punchRight =
                    new Date().getTime(); },
            handLeft: function(event) {
                this.player.punchLeft =
                    new Date().getTime(); },
            postPopulate: function() {
                setSquareSize($('.image-button'));
            }
        };

	state.player = skycam.makePlayer(
            (data.chardefs && 'player' in data.chardefs) ?
            data.chardefs['player'] : {}, state);
        state.setStage(state.startStage);
        ripple.app($, container, viewport, state);
    };
}).call(this, typeof exports === 'undefined' ?
        (this.whiplash = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    const electron = require('electron');

    if (electron && electron.app) {
        // Stand alone desktop application mode for whiplash
        //   $ npm run-script whiplash
        const path = require('path');
        const url = require('url');
        var mainWindow;

        electron
            .app
            .on('ready', function() {
                mainWindow = new electron.BrowserWindow(
                    {width: 800, height: 600,
                     webPreferences: { nodeIntegration: false }});
                mainWindow.loadURL(url.format({
                    pathname: path.join(__dirname, 'whiplash.html'),
                    protocol: 'file:',
                    slashes: true }));
                //mainWindow.webContents.openDevTools();
                mainWindow.setMenu(null);
                mainWindow.on('closed', function () {
                    mainWindow = null; }); })
            .on('window-all-closed', function () {
                if (process.platform !== 'darwin')
                    electron.app.quit(); })
            .on('activate', function () {
                if (mainWindow === null)
                    createWindow(); });
    } else console.log('DEBUG command line mode');
}
