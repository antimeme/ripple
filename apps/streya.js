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
(function(streya) {
    'use strict';
    if (typeof require !== 'undefined') {
        this.multivec = require('./ripple/multivec.js');
        this.skycam = require('./ripple/skycam.js');
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

                var segment = function(points, width, sfrac, efrac) {
                    var s = points[0];
                    var e = points[1];
                    return {
                        width: width,
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
                        result.push(segment(points, 0.5, 0.2, 0.8));
                        result.push(segment(points, 1, 0, 0.25));
                        result.push(segment(points, 1, 0.75, 1));
                    } else if (value === 'wheel') {
                        result.push(segment(points, 1.5, 0.2, 0.8));
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

    streya.game = function($, parent, viewport, data) {
        var canvas = $('<canvas>')
            .css({
                position: 'relative',
                'z-order': 1,
                'touch-action': 'none'})
            .appendTo(parent);
        var tform = ripple.transform();

            var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var tap, selected, drag, zooming, gesture;
        var ship = streya.Ship.create();
        var player = skycam.makePlayer();

        var state = {

            draw_id: 0,
            draw: function() {
                var neighbors, vector, radius;
                var points, last, index;

                if (canvas[0].getContext) {
                    var ctx = canvas[0].getContext('2d');

                    ctx.save();
                    ctx.fillStyle = 'rgb(32, 32, 32)';
                    ctx.fillRect(0, 0, this.width, this.height);
                    tform.setupContext(ctx);

                    // Draw the ship cells
                    ctx.beginPath();
                    ship.mapCells(function(node, cell) {
                        ship.grid.draw(ctx, ship.grid.coordinate(node));
                    }, this);
                    ctx.fillStyle = 'rgb(160, 160, 160)';
                    ctx.fill();

                    // Draw ship systems
                    ctx.beginPath();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold ' + Math.round(
                        ship.grid.size() / 2) + 'px sans';
                    ctx.fillStyle = 'rgb(48, 48, 48)';
                    ship.mapCells(function(node, cell) {
                        node = ship.grid.coordinate(node);
                        if (cell && cell.sigil)
                            ctx.fillText(cell.sigil, node.x, node.y);
                    }, this);

                    if (selected) {
                        // Coordinates of the selected square must be
                        // updated in case the grid offsets have moved
                        // since the last draw call.
                        selected = ship.grid.coordinate(selected);
                        points = ship.grid.points(selected);

                        ctx.beginPath();
                        ship.grid.draw(ctx, selected);
                        ctx.fillStyle = colorSelected;
                        ctx.fill();
                    }

                    // Draw the walls
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = 'blue';
                    ship.walls().forEach(function(wall, index) {
                        ctx.beginPath();
                        ctx.lineWidth = wall.width;
                        ctx.moveTo(wall.start.x, wall.start.y);
                        ctx.lineTo(wall.end.x, wall.end.y);
                        ctx.stroke();
                    }, this);

                    ctx.restore();
                }
                this.draw_id = 0;
            },

            redraw: function() {
                if (!this.draw_id) {
                    var self = this;
                    this.draw_id = requestAnimationFrame(
                        function() { self.draw(); });
                }
            },

            resize: function(event) {
                var state = this;
                if (event && event.data)
                    state = event.data;
                zooming = drag = undefined;

                // Consume enough space to fill the viewport.
                canvas.height(viewport.height());
                canvas.width(viewport.width());

                // A canvas has a height and a width that are part of
                // the document object model but also separate height
                // and width attributes which determine how many pixels
                // are part of the canvas itself.  Keeping the two in
                // sync is essential to avoid ugly stretching effects.
                canvas.attr("width", canvas.innerWidth());
                canvas.attr("height", canvas.innerHeight());

                state.width = canvas.width();
                state.height = canvas.height();
                tform.resize(state.width, state.height);
                state.redraw();
            },

            // Move the center of the screen within limts
            pan: function(vector) {
                var extents = ship.extents();
                if (tform.x + vector.x < extents.sx)
                    vector.x = extents.sx - tform.x;
                if (tform.x + vector.x > extents.ex)
                    vector.x = extents.ex - tform.x;
                if (tform.y + vector.y < extents.sy)
                    vector.y = extents.sy - tform.y;
                if (tform.y + vector.y > extents.ey)
                    vector.y = extents.ey - tform.y;
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
                this.redraw();
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
                this.redraw();
            },
        };

        viewport.on('resize', state, state.resize);
        state.resize();
        state.center();

        // Populate menu with available grid types
        var menu = $('<ul>');
        var menuframe = $('<fieldset>')
            .attr('class', 'menu')
            .css({ position: 'absolute', top: 10, left: 25,
                   'z-order': 2})
            .append($('<legend>Streya Menu</legend>').on(
                'click', function() {
                    menu.toggle(); }))
            .append(menu)
            .appendTo(canvas.parent());
        //.menu a { text-decoration: none; color: white; }
        //.menu li { padding: 0.5em; border-radius: 5px; }
        //.menu li:hover { background: #55e; }

        var modeParam = $('<select>')
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

        var regrid = function() {
            ship = streya.Ship.create({
                grid: JSON.parse(gtype.val()),
                size: parseInt(gsize.val(), 10) });
            state.redraw();
        };
        var gtype = $('<select>')
            .on('change', regrid)
            .css({display: 'inline-block'});
        [{name: "Hex(point)", type: "hex", orient: "point"},
         {name: "Hex(edge)", type: "hex", orient: "edge"},
         {name: "Square", type: "square"},
         {name: "Triangle", type: "triangle"}].forEach(function(g) {
             var value = JSON.stringify(g)
                             .replace(/"/g, '&#34;')
                             .replace(/'/g, '&#39;');
             gtype.append('<option value="' + value + '">' +
                          g.name + '</option>');
         });

        var gsize = $('<select>')
            .on('change', regrid)
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
                    console.log(data.shipDesigns[designs.val()]);
                    ship = streya.Ship.create(
                        data.shipDesigns[designs.val()]);
                    state.redraw();
                }
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
                case 'center': { state.center(); } break;
                case 'full-screen': {
                    $.toggleFullscreen(canvas.parent().get(0));
                    state.resize();
                } break;
            }
        });

        // Calculate square distance
        var sqdist = function(node1, node2) {
            return ((node2.x - node1.x) * (node2.x - node1.x) +
                       (node2.y - node1.y) * (node2.y - node1.y));
        };

        // Process mouse and touch events on grid itself
        canvas.on('mousewheel', function(event) {
            state.zoom(1 + 0.1 * event.deltaY);
            state.redraw();
        });
        canvas.on('mousedown touchstart', function(event) {
            var cell, index, neighbors, oldtap, oldcell;
            var touches = ripple.createTouches(event);
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else if (touches.current.length > 1) {
                tap = touches;
                if (touches.current.length == 2) {
                    var t0 = touches.current[0];
                    var t1 = touches.current[1];
                    zooming = { diameter: Math.sqrt(sqdist(t0, t1)) };
                }
            } else {
                oldtap = tap;
                tap = drag = touches;
                selected = ship.grid.position(
                    tform.toWorldFromScreen(tap));

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
                                    'option:selected').text() : undefined,
                        sigil: modeParam.val() });
                } else if (mode.val() === 'bound' && cell && oldtap) {
                    ship.setBoundary(
                        selected, ship.grid.position(
                            tform.toWorldFromScreen(oldtap)),
                        modeParam.val());
                }
            }

            state.redraw();
            return false;
        });
        canvas.on('mousemove touchmove', function(event) {
            var touches = ripple.createTouches(event);

            if (drag) {
                var wtap = tform.toWorldFromScreen(touches);
                var wdrag = tform.toWorldFromScreen(drag);
                state.pan({ x: wdrag.x - wtap.x, y: wdrag.y - wtap.y});
                state.redraw();
                tap = touches;
                drag = tap;
            }
            if (zooming) {
                var factor;
                if (zooming.diameter && touches.current.length == 2) {
                    var t0 = touches.current[0];
                    var t1 = touches.current[1];
                    var diameter = Math.sqrt(sqdist(t0, t1));
                    factor = diameter / zooming.diameter;
                }
                if (factor && factor > 0)
                    state.zoom(factor);
            }
            return false;
        });
        canvas.on('mouseleave mouseup touchend', function(event) {
            drag = zooming = undefined;
            return false;
        });
    };

}).call(this, typeof exports === 'undefined'?
        (this.streya = {}):
        ((typeof module !== undefined) ?
         (module.exports = exports) : exports));
