// Streya is a science fiction video game for web browsers.  Players
// control a single character but can hire crew, command ships and
// stations, rule over populations and more.  The game takes place in
// the Kuiper Belt around 2220 CE and confines itself to scientifically
// plausible technologies.
//
// TODO
// - save/load ship localStorage
//     https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
// - compute mass and thrust
// - compute cost and apply budget
// - support more than one deck?
(function(streya) {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("./ripple/ripple.js");
        this.fascia   = require("./ripple/fascia.js");
        this.multivec = require("./ripple/multivec.js");
        this.grid     = require("./ripple/grid.js");
        this.pathf    = require("./ripple/pathf.js");
    }

    // === Apparatus
    // An apparatus is a component of a ship or station.  This includes
    // things like life support, crew quarters, shield generators and
    // many other things.  When instantiated with the create method, this
    // represents a single instance of an apparatus.
    streya.Apparatus = {
        data: null,

        create: function(config, data) {
            if (!data)
                data = this.data;
            var result = Object.create(this);
            var settings;

            if (typeof(config) === 'string') {
                result.type = config;
                settings = data[config];
            } else if (typeof(config) === 'object') {
                result.type = config.type;
                settings = config;
            } else settings = {};

            ['sigil', 'console', 'mass', 'power'].forEach(
                function(key) { result[key] = settings[key]; });
            result.active = false;
            return result;
        },

        equals: function(other) {
            var result = false;
            if (other && (other instanceof streya.Apparatus)) {
                result = true;
                ['sigil', 'console', 'mass', 'power'].forEach(
                    function(key) {
                        if (this[key] !== other[key])
                            result = false; });
            }
            return result;
        },

        toJSON: function() { return this.type; },

        draw: function(ctx, size, node) {
            var outer = Math.floor(size * 2 / 5);
            var inner = Math.floor(size / 5);
            var fontSize = Math.floor(size / 3);

            if (this.console) {
                ctx.beginPath();
                ctx.moveTo(node.x + outer, node.y);
                ctx.arc(node.x, node.y, outer, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgb(152, 152, 160)';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(node.x + inner, node.y);
                ctx.arc(node.x, node.y, inner, 0, 2 * Math.PI);
                ctx.fillStyle = this.active ?
                                'rgb(200, 200, 255)' :
                                'rgb(128, 128, 192)';
                ctx.fill();
            }

            if (this.sigil) {
                ctx.beginPath();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold ' + fontSize + 'px sans';
                ctx.fillStyle = 'rgb(48, 48, 96)';
                ctx.fillText(this.sigil, node.x, node.y);
            }
        },

        eachApparatus: function(fn) {
            Object.keys(this.data).forEach(function(key) {
                var apparatus = this.data[key];
                if (!apparatus.internal &&
                    !apparatus.disable &&
                    !apparatus.boundary)
                    fn(key, apparatus);
            }, this);
        },

        eachBoundary: function(fn) {
            Object.keys(this.data).forEach(function(key) {
                var apparatus = this.data[key];
                if (!apparatus.internal &&
                    !apparatus.disable &&
                    apparatus.boundary)
                    fn(key, apparatus);
            }, this);
        }
    };

    // === Ship
    // A ship consists of one or more connected cells, each of which
    // may have an apparatus present, and a set of boundaries which
    // connect pairs of cells.
    streya.Ship = {
        create: function(config) { // Returns a new ship
            var result = Object.create(this);

            result.name = (config && config.name) ?
                          config.name : 'Ship';
            result.grid = grid.create(
                (config && config.grid) ? config.grid :
                { type: 'hex', size: 10 });

            // Undo: each call to setCell or setBoundary pushes an undo
            // entry.  Clients should call undoMark after each complete
            // change and call undo to take a single step back.
            result.__undo = [];
            result.__undoCounter = 0;

            // Extract cells from configuration if possible
            result.__cells = {};
            if (config && config.cells)
                Object.keys(config.cells).forEach(function(id) {
                    result.__cells[id] = {};
                    if (config.cells[id].apparatus)
                        result.__cells[id].apparatus =
                            streya.Apparatus.create(
                                config.cells[id].apparatus);
                });
            else result.setCell({row: 0, col: 0}, {});

            result.__boundaries = {};
            if (config && config.boundaries)
                Object.keys(config.boundaries).forEach(function(key) {
                    result.__boundaries[key] = config.boundaries[key];
                });
            result.activeApparatus = null;

            return result;
        },

        __indexCell: function(node) {
            return ripple.pair(node.col, node.row);
        },
        __unindexCell: function(id) {
            var pair = ripple.unpair(id);
            return {row: pair.y, col: pair.x};
        },
        __indexBoundary: function(nodeA, nodeB) {
            var indexA = this.__indexCell(nodeA);
            var indexB = this.__indexCell(nodeB);
            var swap;

            if (indexA > indexB) {
                swap = indexA;
                indexA = indexB;
                indexB = swap;
            }
            return ripple.pair(indexA, indexB);
        },
        __unindexBoundary: function(id) {
            var pair = ripple.unpair(id);
            return {nodeA: this.__unindexCell(pair.x),
                    nodeB: this.__unindexCell(pair.y)};
        },
        __pushUndo: function(entry) {
            entry.id = this.__undoCounter;
            this.__undo.push(entry);
        },
        __safeDelete(id) {
            // Return true iff deleting the specified cell would
            // preserve the following invariants:
            // - Ship has at least one active cell
            // - All cells are connected by a chain of neighbors
            // We assume these hold before and must return true exactly
            // when they would hold true after deletion
            var result = false;
            var queue = [], visited = {}, current;
            var target = this.__unindexCell(id);
            var count = Object.keys(this.__cells).length;

            if ((count > 1) && (id in this.__cells) &&
                this.grid.neighbors(target).some(
                    function(neigh) {
                        neigh.id = this.__indexCell(neigh);
                        if (neigh.id in this.__cells) {
                            queue.push(neigh);
                            return true;
                        } else return false; }, this)) {
                while (queue.length > 0) {
                    current = queue.pop();
                    if (current.id in visited)
                        continue;
                    visited[current.id] = true;

                    this.grid.neighbors(current).forEach(
                        function(neigh) {
                            neigh.id = this.__indexCell(neigh);
                            if (!(this.id in visited) &&
                                (neigh.id !== id) &&
                                (neigh.id in this.__cells))
                                queue.push(neigh);
                        }, this);
                }
                if (Object.keys(visited).length + 1 == count)
                    result = true;
            }
            return result;
        },

        getCell: function(node) {
            return this.__cells[this.__indexCell(node)]; },

        setCell: function(node, value, noUndo) {
            var id = this.__indexCell(node);
            var undo = noUndo ? null :
                       {cell: id, value: this.__cells[id]};

            if (value) {
                // Force extent recalculation when expanding the
                // footprint of a ship
                if (!(id in this.__cells))
                    this.__extents = undefined;
                else if (value == this.__cells[id])
                    undo = null;
                this.__cells[id] = value;
            } else if (this.__safeDelete(id)) {
                this.grid.neighbors(node).forEach(function(neigh) {
                    this.setBoundary(node, neigh); }, this);
                delete this.__cells[id];
                this.__extents = undefined;
            } else undo = null;

            if (undo) {
                this.__pushUndo(undo);
                this.__mass = undefined;
            }
            return this;
        },

        eachCell: function(fn, context) {
            Object.keys(this.__cells).forEach(function(id) {
                var node = this.__unindexCell(id);
                fn.call(context, this.getCell(node), node);
            }, this);
            return this;
        },

        eachApparatus: function(fn, context) {
            this.eachCell(function(cell, node) {
                if (cell && cell.apparatus)
                    fn.call(context, cell.apparatus, node);
            });
            return this;
        },

        eachWall: function(fn, context) {
            Object.keys(this.__cells).forEach(function(id) {
                var unpair = ripple.unpair(id);
                var neighbors = this.grid.neighbors(
                    this.__unindexCell(id), {points: true});
                var index;

                for (index in neighbors) {
                    if (!this.getCell(neighbors[index]) &&
                        neighbors[index].points.length > 1)
                        fn.call(context, {
                            start: neighbors[index].points[0],
                            end: neighbors[index].points[1],
                            width: 1 });
                }
            }, this);

            Object.keys(this.__boundaries).forEach(function(id) {
                var boundary = this.__unindexBoundary(id);
                var value = this.__boundaries[id];
                var points = this.grid.pairpoints(
                    boundary.nodeA, boundary.nodeB);

                var segment = function(
                    points, width, sfrac, efrac, pass) {
                    var s = points[0];
                    var e = points[1];
                    return {
                        width: width, pass: pass,
                        start: { x: s.x + sfrac * (e.x - s.x),
                                 y: s.y + sfrac * (e.y - s.y) },
                        end: { x: s.x + efrac * (e.x - s.x),
                               y: s.y + efrac * (e.y - s.y) } };
                };

                if (points.length > 1) { // TODO drive with data
                    if (value === 'wall')
                        fn.call(context, segment(points, 1, 0, 1));
                    else if (value === 'pass') {
                        fn.call(context, segment(points, 1, 0, 0.25));
                        fn.call(context, segment(points, 1, 0.75, 1));
                    } else if (value === 'auto') {
                        fn.call(context, segment(
                            points, 0.5, 0.2, 0.8, true));
                        fn.call(context, segment(points, 1, 0, 0.25));
                        fn.call(context, segment(points, 1, 0.75, 1));
                    } else if (value === 'wheel') {
                        fn.call(context, segment(
                            points, 1.5, 0.2, 0.8, true));
                        fn.call(context, segment(points, 1, 0, 0.25));
                        fn.call(context, segment(points, 1, 0.75, 1));
                    }
                }
            }, this);

            return this;
        },

        getBoundary: function(nodeA, nodeB) {
            return this.__boundaries[
                this.__indexBoundary(nodeA, nodeB)];
        },

        setBoundary: function(nodeA, nodeB, value, noUndo) {
            var id = this.__indexBoundary(nodeA, nodeB);
            var undo = noUndo ? null :
                       {boundary: id, value: this.__boundaries[id]};

            if ((this.__indexCell(nodeA) in this.__cells) &&
                (this.__indexCell(nodeB) in this.__cells) &&
                this.grid.adjacent(nodeA, nodeB)) {
                if (value)
                    this.__boundaries[id] = value;
                else delete this.__boundaries[id];
            } else undo = null;

            if (undo)
                this.__pushUndo(undo);
            return this;
        },

        undo: function() { // Reverts the most recent change
            if (this.__undoCounter <= 0)
                return;
            this.__mass = undefined;
            --this.__undoCounter;
            var hardStop = 20;
            while ((this.__undo.length > 0) &&
                   (this.__undo[this.__undo.length - 1].id ===
                       this.__undoCounter)) {
                var entry = this.__undo.pop();
                if (!isNaN(entry.cell))
                    this.setCell(
                        this.__unindexCell(entry.cell),
                        entry.value, true);
                else if (!isNaN(entry.boundary)) {
                    var boundary = this.__unindexBoundary(
                        entry.boundary);
                    this.setBoundary(
                        boundary.nodeA, boundary.nodeB,
                        entry.value, true);
                }
            }
        },

        undoMark: function() {
            // Collects all as-yet-unmarked changes into a single undo
            // event that can be unwound in one step.
            if ((this.__undo.length > 0) &&
                (this.__undo[this.__undo.length - 1].id ===
                    this.__undoCounter))
                this.__undoCounter++;
        },

        __mass: undefined,
        mass: function() {
            if (isNaN(this.__mass)) {
                this.__mass = 0;
                this.eachCell(function(cell, node) {
                    this.__mass += streya.Apparatus.data.Structure.mass;
                    if (cell && cell.apparatus)
                        this.__mass += cell.apparatus.mass;
                }, this);
            }
            return this.__mass;
        },

        cost: function() { // TODO
            var result = 0;
            return result;
        },

        toJSON: function() {
            var result = {
                name: this.name, grid: this.grid,
                cells: {}, boundaries: {},
            };
            Object.keys(this.__cells).forEach(function(id) {
                result.cells[id] = this.__cells[id];
            }, this);
            Object.keys(this.__boundaries).forEach(function(id) {
                result.boundaries[id] = this.__boundaries[id]; }, this);
            return result;
        },

        drawBackground: function(ctx) {
            // Draw the ship cells
            ctx.beginPath();
            this.eachCell(function(cell, node) {
                this.grid.draw(ctx, this.grid.coordinate(node));
            }, this);
            ctx.fillStyle = 'rgb(160, 160, 176)';
            ctx.fill();

            // Draw ship apparatus
            this.eachCell(function(cell, node) {
                if (cell && cell.apparatus)
                    cell.apparatus.draw(ctx, this.grid.size(),
                                        this.grid.coordinate(node));
            }, this);
        },

        draw: function(ctx) {
            // Draw the walls
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgb(96, 96, 240)';
            this.eachWall(function(wall, index) {
                ctx.beginPath();
                ctx.lineWidth = wall.width;
                ctx.moveTo(wall.start.x, wall.start.y);
                ctx.lineTo(wall.end.x, wall.end.y);
                ctx.stroke();
            });
        },

        checkCollision: function(character, collide) {
            var current;

            this.eachWall(function(wall) {
                if (wall.pass)
                    return;
                current = multivec.collideRadiusSegment(
                    character.position, character.destination,
                    character.size, wall);
                if (!isNaN(current) &&
                    (isNaN(collide) || current < collide))
                    collide = current;
            });

            this.eachCell(function(cell, node) {
                if (cell && cell.apparatus && cell.apparatus.console) {
                    node = multivec(this.grid.coordinate(node));
                    if (node.minus(character.position).normSquared() >
                        (this.grid.size() * this.grid.size() / 25)) {
                        current = multivec.collideRadiusRadius(
                            character.position, character.destination,
                            character.size, node, node,
                            this.grid.size() / 5);
                        if (!isNaN(current) &&
                            (isNaN(collide) || current < collide))
                            collide = current;
                    }
                }
            }, this);
            return collide;
        },

        extents: function() {
            if (!this.__extents) {
                this.__extents = { sx: undefined, sy: undefined,
                                   ex: undefined, ey: undefined };
                this.eachCell(function(cell, node) {
                    node = this.grid.coordinate(node);
                    this.grid.points(node).forEach(function(point) {
                        if (isNaN(this.__extents.sx) ||
                            point.x < this.__extents.sx)
                            this.__extents.sx = point.x;
                        if (isNaN(this.__extents.ex) ||
                            point.x > this.__extents.ex)
                            this.__extents.ex = point.x;
                        if (isNaN(this.__extents.sy) ||
                            point.y < this.__extents.sy)
                            this.__extents.sy = point.y;
                        if (isNaN(this.__extents.ey) ||
                            point.y > this.__extents.ey)
                            this.__extents.ey = point.y;
                    }, this);
                }, this);
            }
            return this.__extents;
        },

    }

    var checkFacingClose = function(character,
                                    interactablePosition,
                                    distance, spread) {
        var delta = multivec(interactablePosition).minus(
            character.position);
        return (!delta.zeroish() &&
                (delta.normSquared() < (distance * distance)) &&
                (delta.normalize().dot(multivec(
                    {theta: character.direction})) > spread));
    };

    streya.game = function(preloads) {
        var fasciaRedraw, tap, selected, drag, zooming;
        var viewCenter = function() {
            console.log("Premature viewCenter"); };
        var viewZoom = function(factor) {
            console.log("Premature viewZoom"); };
        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var imageSystem = fascia.imageSystem(
            preloads['streya.json'].imageSystem);
        var itemSystem = fascia.itemSystem(
            preloads['streya.json'].itemSystem);
        var inventoryScreen;
        var apparatusScreen;
        var settingsScreen;
        var player = fascia.createPlayer(
            ripple.mergeConfig(
                (preloads['streya.json'].characterDefinitions &&
                 preloads['streya.json'].characterDefinitions.player) ||
                null, {
                    position: {x: 0, y: 0},
                    itemSystem: itemSystem,
                    interact: function() {
                        if (settingsScreen.isVisible()) {
                            settingsScreen.hide();
                            inventoryScreen.show();
                        } else if (apparatusScreen.isVisible()) {
                             apparatusScreen.hide()
                        } else if (inventoryScreen.isVisible()) {
                             inventoryScreen.hide();
                        } else if (ship.activeApparatus) {
                            apparatusScreen.title(
                                ship.activeApparatus.type);
                            apparatusScreen.show();
                            inventoryScreen.hide();
                        } else {
                            inventoryScreen.populate();
                            inventoryScreen.show();
                        } }}));
        var menu = document.createElement('ul');
        var menuframe = ripple.createElement(
            'fieldset', {'class': 'streya-menu', style: {
                position: 'absolute', top: 10, left: 25,
                'z-order': 2
            }}, ripple.createElement(
                'legend', null, 'Streya Menu'), menu);
        menuframe.addEventListener('click', function(event) {
            if (event.target.tagName.toLowerCase() === 'legend')
                ripple.toggleVisible(menu);
        });

        var menuShipUpdate = function(ship) {
            var massMeter = document.getElementById('mass-meter');
            if (massMeter)
                massMeter.innerHTML = ship.mass();
            return ship;
        };

        streya.Apparatus.data = preloads['streya.json'].apparatus;
        var ship = menuShipUpdate(streya.Ship.create(
            (ripple.param('ship') &&
             ripple.param('ship') in
                preloads['streya.json'].shipDesigns) ?
            preloads['streya.json'].shipDesigns[
                ripple.param('ship')] : undefined));

        var system, systems = {
            edit: {
                start: function() {
                    ripple.hide(bbarLeft);
                    ripple.hide(bbarRight);
                    ripple.show(menuframe);
                },
                keydown: function(event) {
                    if (event.keyCode === 8) { // backspace
                        ship.undo();
                    } else if (event.key === 't') {
                        system = systems.tour;
                        system.start();
                    } else if (event.key === 'c') {
                        viewCenter();
                    } else if (event.key === 'f') {
                        ripple.toggleFullscreen(
                            document.querySelect('.fascia-canvas')
                                    .parentElement);
                    } else if ((event.key === '+') ||
                               (event.key === '=')) {
                        viewZoom(1.1);
                    } else if (event.key === '-') {
                        viewZoom(0.909);
                    }
                },
                singleTap: function(point, camera) {
                    var cell, previous;

                    previous = selected;
                    selected = ship.grid.position(
                        camera.toWorldFromScreen(point));

                    cell = ship.getCell(selected);
                    if (mode.value === 'extend' && !cell) {
                        if (ship.grid.neighbors(selected)
                                .some(function(neigh) {
                                    return ship.getCell(neigh); })) {
                            var current, queue = [];
                            selected.radius = parseInt(
                                modeParam.value, 10);
                            queue.push(selected);

                            while (queue.length > 0) {
                                current = queue.pop();
                                if (!ship.getCell(current))
                                    ship.setCell(current, {});
                                if (isNaN(current.radius) ||
                                    current.radius <= 1)
                                    continue;
                                ship.grid.neighbors(current)
                                    .forEach(function(neigh) {
                                        neigh.radius =
                                            current.radius - 1;
                                        queue.push(neigh);
                                    });
                            }
                            ship.setCell(selected, {});
                            menuShipUpdate(ship);
                        }
                    } else if (mode.value === 'remove' && cell) {
                        if (cell.apparatus)
                            ship.setCell(selected, {});
                        else ship.setCell(selected, undefined);
                        menuShipUpdate(ship);
                    } else if (mode.value === 'toggle') {
                        if (!cell) {
                            if (ship.grid.neighbors(selected)
                                    .some(function(neigh) {
                                        return ship.getCell(neigh); }))
                                ship.setCell(selected, {});
                        } else if (cell.apparatus) {
                            ship.setCell(selected, {});
                        } else ship.setCell(selected, undefined);
                        menuShipUpdate(ship);
                    } else if (mode.value === 'app' && cell) {
                        ship.setCell(selected, modeParam.value ? {
                            apparatus: streya.Apparatus.create(
                                modeParam.value) } : {});
                        menuShipUpdate(ship);
                    } else if (mode.value === 'bound' &&
                               cell && previous) {
                        ship.setBoundary(
                            selected, previous,
                            modeParam.value);
                        menuShipUpdate(ship);
                    }
                    ship.undoMark();
                },
                drag: function(event, camera) {
                    camera.pan({
                        x: (event.last.x - event.current.x) /
                        camera.scale,
                        y: (event.last.y - event.current.y) /
                        camera.scale });
                },
                pinchStart: function(event, camera) {
                    this._pinchScale = camera.scale;
                },
                pinchMove: function(event, camera) {
                    var extents = ship.extents();
                    var min = Math.min(
                        camera.width / (extents.ex - extents.sx),
                        camera.height / (extents.ey - extents.sy));
                    camera.setScale(
                        this._pinchScale * event.length,
                        min / 2, Math.min(
                            camera.width, camera.height) /
                        ship.grid.size());
                },
                draw: function(ctx, camera, now) {
                    if (selected) {
                        ctx.beginPath();
                        ship.grid.draw(ctx, selected);
                        ctx.fillStyle = colorSelected;
                        ctx.fill();
                    }
                }
            },
            tour: {
                active: function() { return true; },
                start: function() {
                    var startNode = ship.grid.position(player.position);
                    var candidate = null;
                    if (!ship.getCell(startNode)) {
                        ship.eachCell(function(cell, node) {
                            node = multivec(
                                ship.grid.coordinate(node));
                            if (!candidate ||
                                (player.position.minus(candidate)
                                       .normSquared() >
                                    player.position.minus(node)
                                          .normSquared()))
                                candidate = node;
                        });
                        if (candidate)
                            player.position = candidate;
                    }

                    ripple.show(bbarLeft);
                    ripple.show(bbarRight);
                    ripple.hide(menuframe);
                },
                keydown: function(event, camera) {
                    if (event.keyCode === 27 /* escape */) {
                        apparatusScreen.hide();
                        inventoryScreen.hide();
                        settingsScreen.show();
                    } else if ((event.key === '+') ||
                               (event.key === '=')) {
                        viewZoom(1.1);
                    } else if (event.key === '-') {
                        viewZoom(0.909);
                    } else {
                        player.control.keydown(event);
                        this.update(camera);
                    }
                },
                keyup: function(event, camera) {
                    player.control.keyup(event);
                    this.update(camera);
                },
                singleTap: function(point, camera) {
                    this.update(camera);
                    player.control.setTarget(
                        camera.toWorldFromScreen(point));
                },
                doubleTap: function(point, camera) {
                    this.update(camera);
                    player.control.setArrow(
                        true, player.position,
                        camera.toWorldFromScreen(point));
                },
                pinchStart: function(event, camera) {
                    this._pinchScale = camera.scale;
                },
                pinchMove: function(event, camera) {
                    var extents = ship.extents();
                    var min = Math.min(
                        camera.width / (extents.ex - extents.sx),
                        camera.height / (extents.ey - extents.sy));
                    camera.setScale(
                        this._pinchScale * event.length,
                        min / 2, Math.min(
                            camera.width, camera.height) /
                        ship.grid.size());
                },
                draw: function(ctx, camera, now) {
                    player.draw(ctx, now);
                },
                update: function(camera, now) {
                    if (isNaN(now))
                        now = Date.now();

                    player.destination = player.plan(now);
                    if (player.destination) {
                        var collide = undefined;

                        collide = ship.checkCollision(player, collide);

                        if (!isNaN(collide))
                            player.destination = player.replan(
                                now, collide, player.destination);
                    }

                    player.update(now);
                    camera.position(player.position);

                    ship.activeApparatus = null;
                    ship.eachApparatus(function(apparatus, node) {
                        if (apparatus.console &&
                            checkFacingClose(
                                player, ship.grid.coordinate(node),
                                3.5, 0.1)) {
                            apparatus.active = true;
                            ship.activeApparatus = apparatus;
                        } else apparatus.active = false;
                    });
                }
            },
        };

        var bbarLeft = ripple.createElement(
            'div', {className: 'bbar', style: {
                display: 'none', bottom: 0, left: 0}},
            imageSystem.createButton(
                'lhand', function() { player.activateLeft(); }, this),
            imageSystem.createButton(
                'rhand', function() { player.activateRight(); }, this));

        var bbarRight = ripple.createElement(
            'div', {className: 'bbar', style: {
                display: 'none', bottom: 0, right: 0}},
            imageSystem.createButton('settings', function(event) {
                apparatusScreen.hide();
                inventoryScreen.hide();
                settingsScreen.show();
            }),
            imageSystem.createButton('interact', function(event) {
                player.interact(); })
        );

        var modeParam = document.createElement('select');
        var mode = document.createElement('select');
        mode.appendChild(ripple.createElement(
            'option', {value: 'extend'}, 'Extend Hull'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'remove'}, 'Remove Hull'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'toggle'}, 'Toggle Hull'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'bound'}, 'Add Boundary'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'app'}, 'Add Apparatus'));
        mode.addEventListener('change', function(event) {
            modeParam.innerHTML = '';
            ripple.hide(modeParam);
            if (mode.value === 'extend') {
                [1, 2, 3].forEach(function(key) {
                    modeParam.appendChild(ripple.createElement(
                        'option', {value: key}, 'Radius ' + key)); });
                ripple.show(modeParam);
            } if (mode.value === 'app') {
                modeParam.appendChild(ripple.createElement(
                    'option', {value: ''}, 'Clear'));
                streya.Apparatus.eachApparatus(
                    function(name, apparatus) {
                        modeParam.append(ripple.createElement(
                            'option', {value: name}, name + (
                                apparatus.sigil ?
                                (' (' + apparatus.sigil + ')') : '')));
                    });
                ripple.show(modeParam);
            } else if (mode.value === 'bound') {
                modeParam.appendChild(ripple.createElement(
                    'option', {'value': ''}, 'Clear'));
                streya.Apparatus.eachBoundary(function(name, boundary) {
                    modeParam.appendChild(ripple.createElement(
                        'option', {value: boundary.boundary}, name));
                });
                ripple.show(modeParam);
            }
        });
        mode.dispatchEvent(new Event('change'));

        menu.appendChild(ripple.createElement(
            'li', {'data-action': 'mode'}, mode));
        menu.appendChild(ripple.createElement('li', null, modeParam));

        var gtype = ripple.createElement(
            'select', {style: {display: 'inline-block'}});
        [{name: "Hex(point)", type: "hex", orient: "point"},
         {name: "Hex(edge)", type: "hex", orient: "edge"},
         {name: "Square", type: "square"},
         {name: "Triangle", type: "triangle"}
        ].forEach(function(g) {
            gtype.appendChild(
                ripple.createElement('option', {
                    value: encodeURI(JSON.stringify(g))}, g.name));
        });
        gtype.addEventListener('change', function(event) {
            var gconfig = JSON.parse(decodeURI(gtype.value));
            gconfig.size = parseInt(gsize.value);
            ship = menuShipUpdate(streya.Ship.create({ grid: gconfig }));
            selected = ship.grid.coordinate(selected);
            fasciaRedraw();
        });

        var gsize = ripple.createElement(
            'select', {style: {display: 'inline-block'}},
            ripple.createElement('option', null, '10'),
            ripple.createElement('option', null, '20'),
            ripple.createElement('option', null, '30'));
        gsize.addEventListener('change', function() {
            var gconfig = JSON.parse(decodeURI(gtype.value));
            ship.grid.size(parseInt(gsize.value));
            selected = ship.grid.coordinate(selected);
            fasciaRedraw();
        });
        menu.appendChild(ripple.createElement('li', null, gtype, gsize));
        menu.appendChild(ripple.createElement('hr'));

        var shipName = ripple.createElement(
            'input', {type: 'text', size: 9, placeholder: 'Ship Name'});
        shipName.addEventListener('change', function(event) {
            ship.name = shipName.value; });
        menu.appendChild(ripple.createElement('li', null, shipName));
        var designs = ripple.createElement('select');
        designs.appendChild(ripple.createElement('option', null, '-'));
        if (preloads['streya.json'].shipDesigns) {
            Object.keys(preloads['streya.json'].shipDesigns)
                  .forEach(function(key) {
                      designs.appendChild(ripple.createElement(
                          'option', null, key));
                  });
            designs.addEventListener('change', function(event) {
                if (designs.value !== '-') {
                    ship = menuShipUpdate(streya.Ship.create(
                        preloads['streya.json']
                            .shipDesigns[designs.value]));
                    shipName.value = ship.name;
                }
                fasciaRedraw();
            });
        }
        menu.appendChild(ripple.createElement('li', null, designs));
        menu.appendChild(ripple.createElement(
            'li', null, ripple.createElement(
                'span', {id: 'mass-meter'},
                ship ? ship.mass() : 'unknown'), 'kg'));
        menu.appendChild(ripple.createElement('li', {
            'data-action': 'undo'}, 'Undo'));
        menu.appendChild(ripple.createElement('li', {
            'data-action': 'center'}, 'Center View'));
        menu.appendChild(ripple.createElement('li', {
            'data-action': 'full-screen'}, 'Full Screen'));
        menu.appendChild(ripple.createElement('li', {
            'data-action': 'save'}, 'Save Ship'));
        menu.appendChild(ripple.createElement('li', {
            'data-action': 'tour'}, 'Tour Ship'));
        menu.addEventListener('click', function(event) {
            var dimensions;
            var target = event.target ?
                         event.target.closest('li') : null;
            if (!target)
                return;

            switch (target.getAttribute('data-action')) {
                case 'center': { viewCenter(); fasciaRedraw(); } break;
                case 'undo': { ship.undo(); fasciaRedraw(); } break;
                case 'save': {
                    ripple.downloadJSON(ship, ship.name);
                } break;
                case 'tour': {
                    system = systems.tour;
                    if (system.start)
                        system.start();
                    fasciaRedraw();
                } break;
                case 'full-screen': {
                    ripple.toggleFullscreen(
                        document.querySelector('.fascia-canvas')
                                .parentElement);
                } break;
            }
        });

        var settingsMenu = ripple.createElement(
            'ul', null, ripple.createElement(
                'li', {tabindex: 0}, 'Edit Ship'));
        settingsMenu.addEventListener('click', function(event) {
            if (event.target.tagName.toLowerCase() === 'li') {
                settingsScreen.hide();
                system = systems.edit;
                system.start();
            }
        });
        settingsMenu.addEventListener('keydown', function(event) {
            if (event.target.tagName.toLowerCase() === 'li') {
                if (event.keyCode === 13 /* enter */) {
                    settingsScreen.hide();
                    system = systems.edit;
                    system.start();
                }
            }
        });

        return {
            init: function(camera, canvas, container, redraw) {
                canvas.style.background = 'rgb(32,32,32)';
                container.appendChild(menuframe);
                container.appendChild(bbarLeft);
                container.appendChild(bbarRight);
                imageSystem.resize(camera.width, camera.height);

                settingsScreen = fascia.screen(
                    container, {imageSystem: imageSystem,
                                title: 'Settings'}, settingsMenu);
                settingsScreen.resize(camera.width, camera.height);
                apparatusScreen = fascia.screen(
                    container, {imageSystem: imageSystem});
                apparatusScreen.resize(camera.width, camera.height);
                inventoryScreen = fascia.inventoryScreen(
                    container, player, itemSystem, imageSystem);
                inventoryScreen.resize(camera.width, camera.height);

                viewZoom = function(factor) {
                    // Change magnification within limits
                    var extents = ship.extents();
                    var max = Math.min(
                        camera.width, camera.height) / ship.grid.size();
                    var min = Math.min(
                        camera.width / (extents.ex - extents.sx),
                        camera.height / (extents.ey - extents.sy));
                    camera.zoom(factor, min * 4 / 5, max);
                };
                viewCenter = function() {
                    // Center the ship for overall view
                    var extents = ship.extents();
                    camera.reset();
                    camera.pan({ x: (extents.sx + extents.ex) / 2,
                                 y: (extents.sy + extents.ey) / 2 });
                    camera.zoom(Math.min(
                        camera.width / (extents.ex - extents.sx),
                        camera.height / (extents.ey - extents.sy)) * 4 / 5);
                };
                viewCenter();

                system = systems.edit;
                if (system.start)
                    system.start();

                fasciaRedraw = redraw; // needed for menu events
            },

            isActive: function() {
                return system && system.active && system.active();
            },

            resize: function(camera, container) {
                var size = Math.min(camera.width, camera.height);

                menuframe.style.borderRadius =
                    Math.floor(size / 50) + 'px';
                menuframe.querySelector('legend').style.borderRadius =
                    Math.floor(size / 80) + 'px';

                container.querySelectorAll('.page').forEach(
                    function(page) {
                        page.style.borderWidth =
                            Math.floor(size / 50) + 'px';
                        page.style.borderRadius =
                            Math.floor(size / 25) + 'px';
                        page.style.top = Math.floor(size / 50);
                        page.style.left = Math.floor(size / 50);
                        page.style.width =
                            width - Math.floor(size / 20);
                        page.style.height =
                            height - Math.floor(size / 20 + size / 11);
                    });

                [imageSystem, inventoryScreen,
                 apparatusScreen,
                 settingsScreen].forEach(function(system) {
                     if (system)
                         system.resize(camera.width, camera.height); });
                zooming = drag = undefined;
            },

            draw: function(ctx, camera, now) {
                if (system.update)
                    system.update(camera, now);

                ship.drawBackground(ctx);
                if (system.draw)
                    system.draw(ctx, camera, now);
                ship.draw(ctx);
            },

            keydown: function(event, camera) {
                if (system.keydown)
                    system.keydown(event, camera);
            },
            keyup: function(event, camera) {
                if (system.keyup)
                    system.keyup(event, camera);
            },
            wheel: function(event, camera) {
                viewZoom(1 + 0.1 * event.y);
            },
            tap: function(event, camera) {
                if (system.singleTap)
                    system.singleTap(event.point, camera);
            },
            doubleTap: function(event, camera) {
                if (system.doubleTap)
                    system.doubleTap(event.point, camera);
            },
            drag: function(event, camera) {
                if (system.drag)
                    system.drag(event, camera);
            },
            pinchStart: function(event, camera) {
                if (system.pinchStart)
                    system.pinchStart(event, camera);
            },
            pinchMove: function(event, camera) {
                if (system.pinchMove)
                    system.pinchMove(event, camera);
            },
        };
    };

}).call(this, typeof exports === 'undefined'?
        (this.streya = {}) :
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
