// Streya is a game of space trading, ship construction, crew
// management and combat.
(function(streya) {
    'use strict';

    // === Ship representation
    // A ship consists of one or more connected cells, each of which
    // may have systems present.
    streya.Ship = {
        // Invariants:
        // - A ship has at least one active cell
        // - Active cells and neighbors form a connected graph

        // Returns a new ship
        create: function(config) {
            var result = Object.create(this);

            // Extract cells from configuration if possible
            result.__cells = {};
            if (config && config.cells) {
                for (key in config.cells)
                    __cells[key] = config.cells[key];
            } else result.setCell({row: 0, col: 0}, {});
            result.__boundaries = {};

            result.name = (config && config.name) ?
                          config.name : 'Ship';
            result.grid = grid.create({type: 'hex'});

            return result;
        },

        getCell: function(node) {
            return this.__cells[this.__indexCell(node)];
        },

        setCell: function(node, value) {
            var id = this.__indexCell(node);

            if (value)
                this.__cells[id] = value;
            else if (this.__safeDelete(id)) {
                this.grid.neighbors(node).forEach(function(neigh) {
                    this.setBoundary(node, neigh); }, this);
                delete this.__cells[id];
            }
            return this;
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
            var result = {};
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
                            width: 3 });
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

                if (points.length > 1) {
                    if (value === 'wall')
                        result.push(segment(points, 5, 0, 1));
                    else if (value === 'pass') {
                        result.push(segment(points, 5, 0, 0.25));
                        result.push(segment(points, 5, 0.75, 1));
                    } else if (value === 'auto') {
                        result.push(segment(points, 3, 0.2, 0.8));
                        result.push(segment(points, 5, 0, 0.25));
                        result.push(segment(points, 5, 0.75, 1));
                    } else if (value === 'wheel') {
                        result.push(segment(points, 8, 0.2, 0.8));
                        result.push(segment(points, 5, 0, 0.25));
                        result.push(segment(points, 5, 0.75, 1));
                    }
                }
            }, this);
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
        var self = $('<canvas>')
            .css({position: 'relative', 'z-order': 1,
                  'touch-action': 'none'})
            .appendTo(parent);

        var state = {data: data};
        var ship = streya.Ship.create(state);

        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var lineWidth = 0, lineFactor = 40;
        var tap, selected, drag, zooming, gesture, press = 0;

        var draw_id = 0;
        var draw = function() {
            var neighbors, vector, radius;
            var points, last, index;

            if (self[0].getContext) {
                var ctx = self[0].getContext('2d');
                var width = self.width(), height = self.height();
                var color = (self.css('color') == 'transparent' ?
                             'white' : self.css('color'));
                ctx.save();
                ctx.fillStyle = 'rgb(32, 32, 32)';
                ctx.fillRect(0, 0, width, height);

                // Draw the ship
                ship.grid.map(width, height, function(node) {
                    var index, points, last;
                    var cell = ship.getCell(node);
                    if (cell) {
                        points = ship.grid.points(node);
                        ctx.beginPath();
                        ctx.lineWidth = lineWidth;
                        if (points.length) {
                            last = points[points.length - 1];
                            ctx.moveTo(last.x, last.y);
                            for (index in points)
                                ctx.lineTo(points[index].x,
                                           points[index].y);
                        }
                        ctx.fillStyle = 'rgb(160, 160, 160)';
                        ctx.fill();

                        if (cell.sigil) {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.font = 'bold ' + Math.round(
                                ship.grid.size() / 2) + 'px sans';
                            ctx.fillStyle = 'rgb(48, 48, 48)';
                            ctx.fillText(cell.sigil, node.x, node.y);
                        }
                    }
                });

                if (selected) {
                    // Coordinates of the selected square must be
                    // updated in case the grid offsets have moved
                    // since the last draw call.
                    selected = ship.grid.coordinate(selected);
                    points = ship.grid.points(selected);

                    ctx.beginPath();
                    if (points.length) {
                        last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (index in points)
                            ctx.lineTo(points[index].x,
                                       points[index].y);
                    } else {
                        ctx.moveTo(selected.x, selected.y);
                        ctx.arc(selected.x, selected.y,
                                state.ship.size() / 2, 0, 2 * Math.PI);
                    }
                    ctx.fillStyle = colorSelected;
                    ctx.fill();
                }

                ctx.lineCap = 'round';
                ctx.strokeStyle = 'blue';
                ship.walls().forEach(function(wall) {
                    ctx.beginPath();
                    ctx.lineWidth = lineWidth * wall.width;
                    ctx.moveTo(wall.start.x, wall.start.y);
                    ctx.lineTo(wall.end.x, wall.end.y);
                    ctx.stroke();
                }, this);

                ctx.restore();
            }
            draw_id = 0;
        };
        var redraw = function()
        { if (!draw_id) draw_id = requestAnimationFrame(draw); };

        var resize = function(event) {
            // Consume enough space to fill the viewport.
            self.height(viewport.height());
            self.width(viewport.width());

            // A canvas has a height and a width that are part of the
            // document object model but also separate height and
            // width attributes which determine how many pixels are
            // part of the canvas itself.  Keeping the two in sync
            // is essential to avoid ugly stretching effects.
            self.attr("width", self.innerWidth());
            self.attr("height", self.innerHeight());

            ship.grid.center(self.width(), self.height());
            lineWidth = ship.grid.size() / lineFactor;

            zooming = drag = undefined;
            redraw();
        };
        viewport.resize(resize);
        resize();

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
            .appendTo(self.parent());
        //.menu a { text-decoration: none; color: white; }
        //.menu li { padding: 0.5em; border-radius: 5px; }
        //.menu li:hover { background: #55e; }

        var modeParam = $('<select>')
        var mode = $('<select>')
            .on('change', function(event) {
                var shipElements = data.shipElements;
                modeParam.empty();
                modeParam.hide();
                if (mode.val() === 'sys') {
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
        modeParam.hide();

        menu.append($('<li data-action="mode">').append(mode));
        menu.append($('<li>').append(modeParam));
        menu.append('<li data-action="export">Export</li>');
        menu.append('<li data-action="full-screen">Full Screen</li>');
        menu.on('click', 'li', function(event) {
            switch (this.getAttribute('data-action')) {
                case 'export': {
                    // How to create a data file to save?
                } break;
                case 'full-screen': {
                    $.toggleFullscreen(self.parent().get(0));
                    resize();
                } break;
            }
        });

        // Show grid menu at event location
        var menuate = function(tap) {
            //menu.show();
            drag = undefined;
        };

        // Calculate square distance
        var sqdist = function(node1, node2) {
            return ((node2.x - node1.x) * (node2.x - node1.x) +
                     (node2.y - node1.y) * (node2.y - node1.y));
        };

        var zoom = function(left, top, size, x, y, factor) {
            if (factor && factor > 0) {
                if (size * factor > 50) {
                    ship.grid.offset((left - x) * factor + x,
                                     (top - y)  * factor + y);
                    ship.grid.size(size * factor);
                    lineWidth = ship.grid.size() / lineFactor;
                }
                redraw();
            }
        };

        // Process mouse and touch events on grid itself
        self.on('mousewheel', function(event) {
            var offset = ship.grid.offset();
            var x, y;
            if (tap) {
                x = tap.x; y = tap.y;
            } else { x = self.width() / 2; y = self.height() / 2; }
            zoom(offset.left, offset.top, ship.grid.size(), x, y,
                 1 + 0.1 * event.deltaY);
        });
        self.on('mousedown touchstart', function(event) {
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
                    zooming = {
                        diameter: Math.sqrt(sqdist(t0, t1)),
                        x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2,
                        size: ship.grid.size(),
                        offset: ship.grid.offset()};
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                oldtap = tap;
                tap = drag = touches;
                selected = ship.grid.position(tap);

                cell = ship.getCell(selected);
                if (mode.val() === 'extend' && !cell) {
                    neighbors = ship.grid.neighbors(
                        selected, {coordinates: true, points: true});
                    for (index in neighbors) {
                        if (ship.getCell(neighbors[index])) {
                            ship.setCell(selected, {});
                            break;
                        }
                    }
                } else if (mode.val() === 'remove' && cell) {
                    if (cell.system)
                        ship.setCell(selected, {});
                    else ship.setCell(selected, undefined);
                } else if (mode.val() === 'sys' && cell) {
                    ship.setCell(selected, {
                        system: modeParam.val() ?
                                modeParam.text() : undefined,
                        sigil: modeParam.val() });
                } else if (mode.val() === 'bound' && cell && oldtap) {
                    ship.setBoundary(
                        selected, ship.grid.position(oldtap),
                        modeParam.val());
                }
            }

            redraw();
            return false;
        });
        self.on('mousemove touchmove', function(event) {
            if (drag) {
                tap = ripple.createTouches(event);
                var goff = ship.grid.offset();
                ship.grid.offset(goff.left + tap.x - drag.x,
                                 goff.top + tap.y - drag.y);
                if ((sqdist(drag, tap) > 125) && press)
                    clearTimeout(press);
                redraw();
                drag = tap;
            }
            if (zooming) {
                var touches = ripple.createTouches(event);
                var factor;
                if (zooming.diameter && touches.current.length == 2) {
                    var t0 = touches.current[0];
                    var t1 = touches.current[1];
                    var diameter = Math.sqrt(sqdist(t0, t1));
                    factor = diameter / zooming.diameter;
                }
                if (factor && factor > 0)
                    zoom(zooming.offset.left, zooming.offset.top,
                         zooming.size,
                         zooming.x, zooming.y, factor);
            }
            return false;
        });
        self.on('mouseleave mouseup touchend', function(event) {
            drag = zooming = undefined;
            if (press) { clearTimeout(press); press = 0; }
            return false;
        });
    };
})(typeof exports === 'undefined'? this['streya'] = {}: exports);
