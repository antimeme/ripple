// Streya is a game of space trading, ship construction, crew
// management and combat.
//
// TODO ship design
// - undo
// - save/load ship file
// - save/load ship localStorage
//     https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
// - compute weight and thrust
// - compute cost and apply budget
// - support more than one deck?
(function(streya) {
    'use strict';
    if (typeof require !== 'undefined') {
        this.multivec = require('./ripple/multivec.js');
        this.fascia = require('./ripple/fascia.js');
    }

    var browserSettings = {
        debug: !!ripple.fetchParam('debug'),
        ship: ripple.fetchParam('ship')
    };

    // === Ship representation
    // A ship consists of one or more connected cells, each of which
    // may have systems present, and a set of boundaries which connect
    // pairs of cells.
    streya.Ship = {
        create: function(config) { // Returns a new ship
            var result = Object.create(this);

            // Extract cells from configuration if possible
            result.__cells = {};
            if (config && config.cells)
                Object.keys(config.cells).forEach(function(key) {
                    result.__cells[key] = config.cells[key];
                });
            else result.setCell({row: 0, col: 0}, {});
            result.__boundaries = {};
            if (config && config.boundaries)
                Object.keys(config.boundaries).forEach(function(key) {
                    result.__boundaries[key] = config.boundaries[key];
                });

            result.name = (config && config.name) ?
                          config.name : 'Ship';
            result.grid = grid.create(
                (config && config.grid) ? config.grid :
                { type: 'hex', size: 10 });

            return result;
        },

        getCell: function(node) {
            return this.__cells[this.__indexCell(node)];
        },

        setCell: function(node, value) {
            var id = this.__indexCell(node);

            if (value) {
                if (!(id in this.__cells))
                    this.__extents = undefined;
                this.__cells[id] = value;
            } else if (this.__safeDelete(id)) {
                this.grid.neighbors(node).forEach(function(neigh) {
                    this.setBoundary(node, neigh); }, this);
                this.__extents = undefined;
                delete this.__cells[id];
            }
            return this;
        },

        mapCells: function(fn, context) {
            Object.keys(this.__cells).forEach(function(id) {
                var node = this.__unindexCell(id);
                fn.call(context, node, this.getCell(node));
            }, this);
        },

        getBoundary: function(nodeA, nodeB) {
            return this.__boundaries[
                this.__indexBoundary(nodeA, nodeB)];
        },

        setBoundary: function(nodeA, nodeB, value) {
            var id = this.__indexBoundary(nodeA, nodeB);

            if ((this.__indexCell(nodeA) in this.__cells) &&
                (this.__indexCell(nodeB) in this.__cells) &&
                this.grid.adjacent(nodeA, nodeB)) {
                if (value)
                    this.__boundaries[id] = value;
                else delete this.__boundaries[id];
            }
            return this;
        },

        weight: function() { // TODO
            var result = 0;
            Object.keys(this.__cells).forEach(function(id) {
            }, this);
            return result;
        },

        cost: function() { // TODO
            var result = 0;
            return result;
        },

        save: function() { // TODO
            var result = {
                name: this.name,
                grid: {
                    type: 'hex', // TODO set this correctly
                    size: this.grid.size()},
                cells: {}, boundaries: {},
            };
            Object.keys(this.__cells).forEach(function(id) {
                result.cells[id] = this.__cells[id]; }, this);
            Object.keys(this.__boundaries).forEach(function(id) {
                result.boundaries[id] = this.__boundaries[id]; }, this);
            return result;
        },

        walls: function() {
            var result = [];

            Object.keys(this.__cells).forEach(function(id) {
                var unpair = ripple.unpair(id);
                var neighbors = this.grid.neighbors(
                    this.__unindexCell(id), {points: true});
                var index;

                for (index in neighbors) {
                    if (!this.getCell(neighbors[index]) &&
                        neighbors[index].points.length > 1)
                        result.push({
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
                        result.push(segment(points, 1, 0, 1));
                    else if (value === 'pass') {
                        result.push(segment(points, 1, 0, 0.25));
                        result.push(segment(points, 1, 0.75, 1));
                    } else if (value === 'auto') {
                        result.push(segment(
                            points, 0.5, 0.2, 0.8, true));
                        result.push(segment(points, 1, 0, 0.25));
                        result.push(segment(points, 1, 0.75, 1));
                    } else if (value === 'wheel') {
                        result.push(segment(
                            points, 1.5, 0.2, 0.8, true));
                        result.push(segment(points, 1, 0, 0.25));
                        result.push(segment(points, 1, 0.75, 1));
                    }
                }
            }, this);
            return result;
        },

        extents: function() {
            if (!this.__extents) {
                this.__extents = { sx: undefined, sy: undefined,
                                   ex: undefined, ey: undefined };
                this.mapCells(function(node) {
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

        __safeDelete(id) {
            // Return true iff deleting the specified cell would
            // preserve the following invariants:
            // - At least once cell is active
            // - All cells are connected by a chain of neighbors
            // We can assume these hold before and must guarantee
            // that they hold after deletion when returning true
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
        }
    }

    streya.game = function($, data) {
        var game, redraw, tap, selected, drag, zooming, gesture;

        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var menu = $('<ul>');
        var menuframe = $('<fieldset>')
            .addClass('streya-menu')
            .css({ position: 'absolute', top: 10, left: 25,
                   'z-order': 2})
            .append($('<legend>Streya Menu</legend>').on(
                'click', function() {
                    menu.toggle(); }))
            .append(menu);
        var tform = ripple.transform();
        var ship = streya.Ship.create(
            (browserSettings.ship &&
             browserSettings.ship in data.shipDesigns) ?
            data.shipDesigns[browserSettings.ship] : undefined);
        var imageSystem = fascia.imageSystem(data.imageSystem);
        var itemSystem = fascia.itemSystem(data.itemSystem);
        var player = fascia.createPlayer(
            ripple.mergeConfig(
                (data.characterDefinitions &&
                 data.characterDefinitions.player) || null, {
                     position: {x: 0, y: 0},
                     itemSystem: itemSystem,
                     interact: function() {
                         if (inventoryPane.isVisible())
                             inventoryPane.hide();
                         else {
                             inventoryPane.populate($);
                             inventoryPane.show();
                         } }}));
        var inventoryPane;

        var system, systems = {
            edit: {
                start: function() {
                    bbarLeft.hide();
                    bbarRight.hide();
                    menuframe.show();
                },
                keydown: function(event) {
                    if (event.key === 't') {
                        system = systems.tour;
                        system.start();
                    } else if (event.key === 'c') {
                        game.center();
                    } else if (event.key === 'f') {
                        $.toggleFullscreen(
                            $('.fascia-canvas').parent().get(0));
                    } else if ((event.key === '+') ||
                               (event.key === '=')) {
                        game.zoom(1.1);
                    } else if (event.key === '-') {
                        game.zoom(0.909);
                    }
                },
                singleTap: function(touches) {
                    var cell, previous;

                    previous = selected;
                    selected = ship.grid.position(
                        tform.toWorldFromScreen(touches));

                    cell = ship.getCell(selected);
                    if (mode.val() === 'extend' && !cell) {
                        if (ship.grid.neighbors(selected, {
                            coordinates: true, points: true })
                                .some(function(neigh) {
                                    return ship.getCell(neigh); })) {
                            var current, queue = [];
                            selected.radius = parseInt(
                                modeParam.val(), 10);
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
                        }
                    } else if (mode.val() === 'remove' && cell) {
                        if (cell.system)
                            ship.setCell(selected, {});
                        else ship.setCell(selected, undefined);
                    } else if (mode.val() === 'sys' && cell) {
                        ship.setCell(selected, {
                            system: modeParam.val() ?
                                    modeParam.find(
                                        'option:selected').text() :
                                    undefined,
                            sigil: modeParam.val() });
                    } else if (mode.val() === 'bound' &&
                               cell && previous) {
                        ship.setBoundary(
                            selected, previous,
                            modeParam.val());
                    }
                },
                draw: function(ctx, now) {
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
                        ship.mapCells(function(node, cell) {
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

                    bbarLeft.show();
                    bbarRight.show();
                    menuframe.hide();
                },
                keydown: function(event) {
                    player.control.keydown(event);
                    this.update();
                },
                keyup: function(event) {
                    player.control.keyup(event);
                    this.update();
                },
                singleTap: function(touches) {
                    this.update();
                    player.control.setTarget(
                        tform.toWorldFromScreen(touches));
                },
                doubleTap: function(touch) {
                    this.update();
                    player.control.setArrow(
                        true, player.position,
                        tform.toWorldFromScreen(touch));
                },
                draw: function(ctx, now) {
                    player.draw(ctx, now);
                },
                update: function(now) {
                    if (isNaN(now))
                        now = Date.now();

                    player.destination = player.plan(now);
                    if (player.destination) {
                        var collide = undefined;
                        var updateCollide = function(current) {
                            if (!isNaN(current) &&
                                (isNaN(collide) || current < collide))
                                collide = current;
                        };

                        ship.walls().forEach(function(wall) {
                            if (!wall.pass)
                                updateCollide(
                                    multivec.collideRadiusSegment(
                                        player.position,
                                        player.destination,
                                        player.size, wall));
                        }, this);

                        if (!isNaN(collide))
                            player.destination = player.replan(
                                now, collide, player.destination);
                    }

                    player.update(now);
                    tform.position(player.position);
                }
            },
        };

        var bbarLeft = $('<div>')
            .addClass('bbar').hide()
            .css({ bottom: 0, left: 0 })
            .append(imageSystem.createButton(
                'lhand', $, function() {
                    player.punchLeft = Date.now();
                }, this))
            .append(imageSystem.createButton(
                'rhand', $, function() {
                    player.punchRight = Date.now();
                }, this));
        var bbarRight = $('<div>')
            .addClass('bbar').hide()
            .css({ bottom: 0, right: 0 })
            .append(imageSystem.createButton(
                'settings', $, function(event) {
                    inventoryPane.hide();
                    system = systems.edit;
                    system.start(); }))
            .append(imageSystem.createButton(
                'interact', $, function(event) {
                    player.interact(); }));

        var modeParam = $('<select>');
        var mode = $('<select>')
            .on('change', function(event) {
                var shipElements = data.shipElements;
                modeParam.empty();
                modeParam.hide();
                if (mode.val() === 'extend') {
                    [1, 2, 3].forEach(function(key) {
                        modeParam.append(
                            '<option value="' + key + '">' +
                            'Radius ' + key + '</option>'); });
                    modeParam.show();
                } if (mode.val() === 'sys') {
                    modeParam.append('<option value="">Clear</option>');
                    Object.keys(shipElements).forEach(function(key) {
                        var element = shipElements[key];

                        if (element.internal || element.disable ||
                            element.boundary)
                            return;
                        modeParam.append(
                            '<option value="' +
                            element.sigil +'">' + key + (
                                element.sigil ? (
                                    ' (' + element.sigil + ')') : '') +
                            '</option>');
                    });
                    modeParam.show();
                } else if (mode.val() === 'bound') {
                    modeParam.append('<option value="">Clear</option>');
                    Object.keys(shipElements).forEach(function(key) {
                        if (shipElements[key].internal ||
                            shipElements[key].disable ||
                            !shipElements[key].boundary)
                            return;
                        modeParam.append(
                            '<option value="' +
                            shipElements[key].boundary + '">' + key +
                            '</option>');
                    });
                    modeParam.show();
                }
            })
            .append('<option value="extend">Extend Hull</option>')
            .append('<option value="remove">Remove Hull</option>')
            .append('<option value="sys">Add System</option>')
            .append('<option value="bound">Add Boundary</option>');
        mode.change();

        menu.append($('<li data-action="mode">').append(mode));
        menu.append($('<li>').append(modeParam));

        var gtype = $('<select>')
            .on('change', function() {
                var gconfig = JSON.parse(gtype.val());
                gconfig.size = parseInt(gsize.val());
                ship = streya.Ship.create({ grid: gconfig });
                selected = ship.grid.coordinate(selected);
                redraw();
            })
            .css({display: 'inline-block'});
        [{name: "Hex(point)", type: "hex", orient: "point"},
         {name: "Hex(edge)", type: "hex", orient: "edge"},
         {name: "Square", type: "square"},
         {name: "Triangle", type: "triangle"}
        ].forEach(function(g) {
            gtype.append('<option value="' +
                         JSON.stringify(g)
                             .replace(/"/g, '&#34;')
                             .replace(/'/g, '&#39;') + '">' +
                         g.name + '</option>');
        });

        var gsize = $('<select>')
            .on('change', function() {
                var gconfig = JSON.parse(gtype.val());
                ship.grid.size(parseInt(gsize.val()));
                selected = ship.grid.coordinate(selected);
                redraw();
            })
            .css({display: 'inline-block'});
        gsize.append('<option>10</option>');
        gsize.append('<option>20</option>');
        gsize.append('<option>30</option>');
        menu.append($('<li>').append(gtype).append(gsize));

        menu.append('<hr />');

        if (data.shipDesigns) {
            var designs = $('<select>');
            designs.append('<option>-</options>');
            Object.keys(data.shipDesigns).forEach(function(key) {
                designs.append('<option>' + key + '</option>');
            });
            designs.on('change', function(event) {
                if (designs.val() !== '-') {
                    ship = streya.Ship.create(
                        data.shipDesigns[designs.val()]);
                }
                redraw();
            });
            menu.append($('<li>').append(designs));
        }
        menu.append('<li data-action="center">Center View</li>');
        menu.append('<li data-action="full-screen">Full Screen</li>');
        menu.append('<li data-action="save">Save Ship</li>');
        menu.append('<li data-action="tour">Tour Ship</li>');
        menu.on('click', 'li', function(event) {
            var dimensions;

            switch (this.getAttribute('data-action')) {
                case 'save': {
                    // How to create a data file to save?
                    console.log(JSON.stringify(ship.save()));
                } break;
                case 'center': { game.center(); redraw(); } break;
                case 'tour': {
                    system = systems.tour;
                    if (system.start)
                        system.start();
                    redraw();
                } break;
                case 'full-screen': {
                    $.toggleFullscreen(
                        $('.fascia-canvas').parent().get(0));
                } break;
            }
        });

        var game = {
            init: function($, container, viewport, fasciaRedraw) {
                inventoryPane = fascia.inventoryPane(
                    $, container, player, itemSystem, imageSystem);
                container
                    .append(menuframe)
                    .append(bbarLeft)
                    .append(bbarRight)
                //.append(systemPane) // TODO
                //.append(settingsPane) // TODO
                    .append(inventoryPane);

                this.center();
                system = systems.edit;
                if (system.start)
                    system.start();
                redraw = fasciaRedraw;
            },

            isActive: function() {
                return system.active && system.active();
            },

            resize: function(width, height, $) {
                var size = Math.min(width, height);
                this.width = width;
                this.height = height;

                tform.resize(width, height);
                imageSystem.resize(width, height, $);

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
                zooming = drag = undefined;
            },

            draw: function(ctx, width, height, now) {
                var neighbors, vector, radius;
                var points, last, index;
                var now = Date.now();

                if (system.update)
                    system.update(now);

                ctx.save();
                ctx.fillStyle = 'rgb(32, 32, 32)';
                ctx.fillRect(0, 0, this.width, this.height);
                tform.setupContext(ctx);

                // Draw the ship cells
                ctx.beginPath();
                ship.mapCells(function(node, cell) {
                    ship.grid.draw(ctx, ship.grid.coordinate(node));
                }, this);
                ctx.fillStyle = 'rgb(160, 160, 176)';
                ctx.fill();

                // Draw ship systems
                ctx.beginPath();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold ' + Math.round(
                    ship.grid.size() / 2) + 'px sans';
                ctx.fillStyle = 'rgb(48, 48, 96)';
                ship.mapCells(function(node, cell) {
                    node = ship.grid.coordinate(node);
                    if (cell && cell.sigil)
                        ctx.fillText(cell.sigil, node.x, node.y);
                }, this);

                if (system.draw)
                    system.draw(ctx, now);

                // Draw the walls
                ctx.lineCap = 'round';
                ctx.strokeStyle = 'rgb(96, 96, 240)';
                ship.walls().forEach(function(wall, index) {
                    ctx.beginPath();
                    ctx.lineWidth = wall.width;
                    ctx.moveTo(wall.start.x, wall.start.y);
                    ctx.lineTo(wall.end.x, wall.end.y);
                    ctx.stroke();
                }, this);

                ctx.restore();
            },

            keydown: function(event, redraw) {
                if (system.keydown)
                    system.keydown(event);
                redraw();
            },
            keyup: function(event, redraw) {
                if (system.keyup)
                    system.keyup(event);
                redraw();
            },

            // Move the center of the screen within limts
            pan: function(vector) {
                tform.pan(vector);
            },

            // Change the magnification within limits
            zoom: function(factor) {
                var extents = ship.extents();
                var max = Math.min(
                    this.width, this.height) / ship.grid.size();
                var min = Math.min(
                    this.width / (extents.ex - extents.sx),
                    this.height / (extents.ey - extents.sy));
                tform.zoom(factor, min / 2, max);
            },

            // Center the ship to get a good overall view
            center: function() {
                var extents = ship.extents();
                tform.reset();
                tform.pan({ x: (extents.sx + extents.ex) / 2,
                            y: (extents.sy + extents.ey) / 2 });
                tform.zoom(Math.min(
                    this.width / (extents.ex - extents.sx),
                    this.height / (extents.ey - extents.sy)) / 2);
            },

            mwheel: function(event, redraw) {
                this.zoom(1 + 0.1 * event.deltaY);
                redraw();
            },

            mtdown: function(touches, event, redraw) {
                if (event.which > 1) {
                    // Reserve right and middle clicks for browser menus
                    return true;
                } else if (touches.current.length > 1) {
                    tap = touches;
                    if (touches.current.length == 2) {
                        var t0 = touches.current[0];
                        var t1 = touches.current[1];
                        zooming = {
                            diameter: Math.sqrt(sqdist(t0, t1)) };
                    }
                } else {
                    tap = drag = touches;
                }

                redraw();
                return false;
            },

            mtmove: function(touches, event, redraw) {
                if (drag) {
                    var wtap = tform.toWorldFromScreen(touches);
                    var wdrag = tform.toWorldFromScreen(drag);
                    game.pan({ x: wdrag.x - wtap.x,
                               y: wdrag.y - wtap.y });
                    tap = touches;
                    drag = tap;
                }
                if (zooming) {
                    var factor;
                    if (zooming.diameter &&
                        touches.current.length == 2) {
                        var t0 = touches.current[0];
                        var t1 = touches.current[1];
                        var diameter = Math.sqrt(sqdist(t0, t1));
                        factor = diameter / zooming.diameter;
                    }
                    if (factor && factor > 0)
                        game.zoom(factor);
                }
                redraw();
                return false;
            },

            mtup: function(event) {
                drag = zooming = undefined;
                return false;
            },

            tap: function(touch, redraw) {
                if (system.singleTap)
                    system.singleTap(touch);
                redraw();
            },

            doubleTap: function(touch, redraw) {
                if (system.doubleTap)
                    system.doubleTap(touch);
                redraw();
            }
        };

        // Calculate square distance
        var sqdist = function(node1, node2) {
            return ((node2.x - node1.x) * (node2.x - node1.x) +
                           (node2.y - node1.y) * (node2.y - node1.y));
        };

        return game;
    };

}).call(this, typeof exports === 'undefined'?
        (this.streya = {}):
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
