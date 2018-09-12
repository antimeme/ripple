// whiplash.js
// Copyright (C) 2016-2018 by Jeff Gold.
//
// Whiplash Paradox is a game about time travel
// TODO click to access inventory
// TODO event to register punch

(function(whiplash) {
    'use strict';
    if (typeof require !== 'undefined') {
        this.multivec = require('./ripple/multivec.js');
        this.ripple = require('./ripple/ripple.js');
        this.fascia = require('./ripple/fascia.js');
    }

    var browserSettings = {
        debug: !!ripple.param('debug'),
        profiling: false,
        rotateworld: !!ripple.param('rotateworld'),
        mazeType: ripple.param('mazeType') || undefined,
        mazeRings: Math.max(Math.min(parseInt(
            ripple.param('mazeRings'), 10), 8), 1),
        startStage: ripple.param('startStage'),
        mode: ripple.param('mode')
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

    var randomLoot = function(itemSystem) {
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
            itemSystem.createItem({'type': items[Math.floor(
                Math.random() * items.length)]}),
            itemSystem.createItem({'type': items[Math.floor(
                Math.random() * items.length)]})];
        return result;
    };

    var drawEnvironment = function(ctx, state, now) {
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

    var drawChest = function(ctx, chest, now) {
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
            now = Date.now();
	this.characters.forEach(function(character) {
            if (character.plan)
                character.destination = character.plan(now);
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
                    now, collide, this.player.destination);
        }

        this.characters.forEach(function(character) {
            character.update(now); }, this);

        this.chests.forEach(function(chest) {
            chest.checkAccessible(this.player); }, this);
    };

    whiplash.game = function(data) {
        return {
            debug: browserSettings.debug && !data.schema.disableDebug,
            rotateworld: browserSettings.rotateworld,
            mazeRings: browserSettings.mazeRings,
            mazeType: browserSettings.mazeType,
            startStage: browserSettings.startStage || data.startStage,

            height: 320, width: 320,
            zoom: {
                value: 25, min: 10, max: 100, reference: 0,
                change: function(value) {
                    this.value = ripple.clamp(
                        this.value * value, this.min, this.max);
                    return this;
                }},
            tap: null, mmove: null,
            player: null, update: update,
            itemSystem: fascia.itemSystem(data.itemdefs),
            imageSystem: fascia.imageSystem(data.images),

            init: function(container, viewport) {
                var self = this;

                $('<div>') // Left Action Bar
                    .addClass('bbar')
                    .css({ bottom: 0, left: 0 })
                    .appendTo(container)
                    .append(this.imageSystem.createButton(
                        'lhand', function() {
                            this.player.punchLeft = Date.now();
                        }, this))
                    .append(this.imageSystem.createButton(
                        'rhand', function() {
                            this.player.punchRight = Date.now();
                        }, this));

                $('<div>') // Create action bar
                    .addClass('bbar')
                    .css({ bottom: 0, right: 0 })
                    .appendTo(container)
                    .append(this.imageSystem.createButton(
                        'settings', function(event) {
                            self.settings.toggle();
                            self.inventory.hide(); }))
                    .append(this.imageSystem.createButton(
                        'interact', function(event) {
                            self.interact(); }));

	        this.player = fascia.createPlayer(
                    ripple.mergeConfig(
                        (data.chardefs && 'player' in data.chardefs) ?
                        data.chardefs['player'] : {},
                        {itemSystem: this.itemSystem,
                         interact: function() {
                             self.interact(); }}));

                this.settings = $('<div>')
                    .addClass('page').addClass('settings').hide()
                    .append('<h2>Settings</h2>')
                    .appendTo(container);
                this.inventory = fascia.inventoryPane(
                    container, this.player,
                    this.itemSystem, this.imageSystem);

                this.setStage(this.startStage);
            },

            resize: function(width, height) {
                var size = Math.min(width, height);
                this.width = width;
                this.height = height;

                $('.page').css({
                    'border-width': Math.floor(size / 100),
                    'border-radius': Math.floor(size / 25),
                    top: Math.floor(size / 50),
                    left: Math.floor(size / 50),
                    width: width - Math.floor(size / 20),
                    height: height - Math.floor(
                        size / 20 + size / 11)
                });

                this.imageSystem.resize(width, height);
                this.inventory.resize(width, height);
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
                ctx.translate((-1) * this.player.position.x,
                              (-1) * this.player.position.y);
                ctx.lineWidth = lineWidth;

                this.characters.forEach(function(character) {
                    if (character.drawPre)
                        character.drawPre(ctx, this, now);
                });

                drawEnvironment(ctx, this, now);
                (this.chests || []).forEach(function(chest) {
                    drawChest(ctx, chest, now);
                }, this);

                this.characters.forEach(function(character) {
                    if (character.draw)
                        character.draw(ctx, now);
                }, this);

                this.characters.forEach(function(character) {
                    if (character.drawPost)
                        character.drawPost(ctx, now);
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
                ctx.fillText(this.text, this.width / 2, size / 50);
            },
            text: 'Whiplash Paradox',
            keydown: function(event, redraw) {
                redraw();
                this.update();
                if (event.key === '+' || event.key === '=') {
                    this.zoom.change(1.1);
                } else if (event.key === '-') {
                    this.zoom.change(0.9);
                } else if (this.player.control.keydown(event)) {
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
                if (event.keyCode === 80 /* p */) {
                } else if (this.player.control.keyup(event)) {
	        } else if (this.debug)
                    console.log('up', event.keyCode);
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
                                inventory: randomLoot(this.itemSystem)
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
        };
    };
}).call(this, typeof exports === 'undefined' ?
        (this.whiplash = {}) : ((typeof module !== undefined) ?
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
