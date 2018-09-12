// Streya is a game of space trading, ship construction, crew
// management and combat.
//
// TODO ship design
// - undo
// - save/load ship file
// - save/load ship localStorage
//     https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
// - compute mass and thrust
// - compute cost and apply budget
// - support more than one deck?
(function(streya) {
    'use strict';
    if (typeof require !== 'undefined') {
        this.ripple = require('./ripple/ripple.js');
        this.multivec = require('./ripple/multivec.js');
        this.fascia = require('./ripple/fascia.js');
    }

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

        mass: function() { // TODO
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

    streya.game = function(data) {
        var game, redraw, tap, selected, drag, zooming, gesture;

        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var menu = document.createElement('ul');
        var menuframe = ripple.createElement(
            'fieldset', null, ripple.createElement(
                'legend', null, 'Streya Menu'), menu);
        menuframe.setAttribute('class', 'streya-menu');
        menuframe.style.position = 'absolute';
        menuframe.style.top = 10;
        menuframe.style.left = 25;
        menuframe.style['z-order'] = 2;

        menuframe.addEventListener('click', function(event) {
            if (event.target.tagName.toLowerCase() === 'legend')
                ripple.toggleVisible(menu);
        });
        var tform = ripple.transform();
        var ship = streya.Ship.create(
            (ripple.param('ship') &&
             ripple.param('ship') in data.shipDesigns) ?
            data.shipDesigns[ripple.param('ship')] : undefined);
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
                             inventoryPane.populate();
                             inventoryPane.show();
                         } }}));
        var inventoryPane;

        var system, systems = {
            edit: {
                start: function() {
                    ripple.hide(bbarLeft);
                    ripple.hide(bbarRight);
                    ripple.show(menuframe);
                },
                keydown: function(event) {
                    if (event.key === 't') {
                        system = systems.tour;
                        system.start();
                    } else if (event.key === 'c') {
                        game.center();
                    } else if (event.key === 'f') {
                        ripple.toggleFullscreen(
                            document.querySelect('.fascia-canvas')
                                    .parentElement);
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
                    if (mode.value === 'extend' && !cell) {
                        if (ship.grid.neighbors(selected, {
                            coordinates: true, points: true })
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
                        }
                    } else if (mode.value === 'remove' && cell) {
                        if (cell.system)
                            ship.setCell(selected, {});
                        else ship.setCell(selected, undefined);
                    } else if (mode.value === 'sys' && cell) {
                        ship.setCell(selected, {
                            system: modeParam.value ?
                                    modeParam.options[
                                        modeParam.selectedIndex].text :
                                    undefined,
                            sigil: modeParam.value });
                    } else if (mode.value === 'bound' &&
                               cell && previous) {
                        ship.setBoundary(
                            selected, previous,
                            modeParam.value);
                    }
                },
                drag: function(start, last, current) {
                    tform.pan({
                        x: (last.x - current.x) / tform.scale,
                        y: (last.y - current.y) / tform.scale});
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

                    ripple.show(bbarLeft);
                    ripple.show(bbarRight);
                    ripple.hide(menuframe);
                },
                keydown: function(event) {
                    if (event.keyCode === 27) {
                        ripple.hide(inventoryPane.pane);
                        system = systems.edit;
                        system.start();
                    } else {
                        player.control.keydown(event);
                        this.update();
                    }
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

        var bbarLeft = document.createElement('div');
        bbarLeft.setAttribute('class', 'bbar');
        bbarLeft.style.display = 'none';
        bbarLeft.style.bottom = 0;
        bbarLeft.style.left = 0;
        bbarLeft.appendChild(imageSystem.createButton(
            'lhand', function() {
                player.punchLeft = Date.now(); }, this));
        bbarLeft.appendChild(imageSystem.createButton(
            'rhand', function() {
                player.punchRight = Date.now(); }, this));

        var bbarRight = document.createElement('div');
        bbarRight.style.display = 'none';
        bbarRight.style.bottom = 0;
        bbarRight.style.right = 0;
        bbarRight.appendChild(imageSystem.createButton(
            'settings', function(event) {
                ripple.hide(inventoryPane);
                system = systems.edit;
                system.start();
            }));
        bbarRight.appendChild(imageSystem.createButton(
            'interact', function(event) {
                player.interact(); }));

        var modeParam = document.createElement('select');
        var mode = document.createElement('select');
        mode.appendChild(ripple.createElement(
            'option', {value: 'extend'}, 'Extend Hull'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'remove'}, 'Remove Hull'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'sys'}, 'Add System'));
        mode.appendChild(ripple.createElement(
            'option', {value: 'bound'}, 'Add Boundary'));
        mode.addEventListener('change', function(event) {
            var shipElements = data.shipElements;
            modeParam.innerHTML = '';
            ripple.hide(modeParam);
            if (mode.value === 'extend') {
                [1, 2, 3].forEach(function(key) {
                    modeParam.appendChild(ripple.createElement(
                        'option', {value: key}, 'Radius ' + key)); });
                ripple.show(modeParam);
            } if (mode.value === 'sys') {
                modeParam.appendChild(ripple.createElement(
                    'option', {value: ''}, 'Clear'));
                Object.keys(shipElements).forEach(function(key) {
                    var element = shipElements[key];

                    if (element.internal || element.disable ||
                        element.boundary)
                        return;
                    modeParam.append(ripple.createElement(
                        'option', {value: element.sigil},
                        key + (element.sigil ?
                               (' (' + element.sigil + ')') : '')));
                });
                ripple.show(modeParam);
            } else if (mode.value === 'bound') {
                modeParam.append('<option value="">Clear</option>');
                Object.keys(shipElements).forEach(function(key) {
                    if (shipElements[key].internal ||
                        shipElements[key].disable ||
                        !shipElements[key].boundary)
                            return;
                        modeParam.appendChild(ripple.createElement(
                            'option', {value: shipElements[
                                key].boundary}, key));
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
            ship = streya.Ship.create({ grid: gconfig });
            selected = ship.grid.coordinate(selected);
            redraw();
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
            redraw();
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
        if (data.shipDesigns) {
            Object.keys(data.shipDesigns).forEach(function(key) {
                designs.appendChild(ripple.createElement(
                    'option', null, key));
            });
            designs.addEventListener('change', function(event) {
                if (designs.value !== '-') {
                    ship = streya.Ship.create(
                        data.shipDesigns[designs.value]);
                    shipName.value = ship.name;
                }
                redraw();
            });
        }
        menu.appendChild(ripple.createElement('li', null, designs));
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
                case 'save': {
                    ripple.downloadJSON(ship.save(), ship.name);
                } break;
                case 'center': { game.center(); redraw(); } break;
                case 'tour': {
                    system = systems.tour;
                    if (system.start)
                        system.start();
                    redraw();
                } break;
                case 'full-screen': {
                    ripple.toggleFullscreen(
                        document.querySelector('.fascia-canvas')
                                .parentElement);
                } break;
            }
        });

        var game = {
            init: function(container, viewport, fasciaRedraw) {
                inventoryPane = fascia.inventoryPane(
                    container, player, itemSystem, imageSystem);
                container.appendChild(menuframe);
                container.appendChild(bbarLeft);
                container.appendChild(bbarRight);
                //container.appendChild(systemPane) // TODO
                //container.appendChild(settingsPane) // TODO
                container.appendChild(inventoryPane.pane);

                this.center(); // TODO relies on prior resize call
                system = systems.edit;
                if (system.start)
                    system.start();
                redraw = fasciaRedraw;
            },

            isActive: function() {
                return system.active && system.active();
            },

            resize: function(width, height) {
                var size = Math.min(width, height);
                this.width = width;
                this.height = height;

                ripple.queryEach('.streya-menu', function(element) {
                    element.style['border-radius'] =
                        Math.floor(size / 50) + 'px'; });
                ripple.queryEach(
                    '.streya-menu legend', function(element) {
                        element.style['border-radius'] =
                            Math.floor(size / 80) + 'px'; });
                document.querySelectorAll(
                    '.page', function(element) {
                        element.style['border-width'] =
                            Math.floor(size / 50) + 'px';
                        element.style['border-radius'] =
                            Math.floor(size / 25) + 'px';
                        element.style.top = Math.floor(size / 50);
                        element.style.left = Math.floor(size / 50);
                        element.style.width =
                            width - Math.floor(size / 20);
                        element.style.height =
                            height - Math.floor(size / 20 + size / 11);
                    });

                tform.resize(width, height);
                imageSystem.resize(width, height);
                inventoryPane.resize(width, height);
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

            wheel: function(event, redraw) {
                this.zoom(1 + 0.1 * event.y);
                redraw();
            },

            tap: function(touch, redraw) {
                if (system.singleTap) {
                    system.singleTap(touch);
                    redraw();
                }
            },

            doubleTap: function(touch, redraw) {
                if (system.doubleTap) {
                    system.doubleTap(touch);
                    redraw();
                }
            },

            drag: function(start, last, current) {
                if (system.drag) {
                    system.drag(start, last, current);
                    redraw();
                }
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
