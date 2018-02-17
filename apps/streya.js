// Streya is a game of space trading, ship construction, crew
// management and combat.
(function(streya) {
    'use strict';

    // === Ship representation
    // A ship consists of a set of connected cells, each of which
    // may have systems or other furnitrue present.
    streya.Ship = {
        create: function(config) {
            var result = Object.create(this);

            // Extract cells from configuration if possible
            result.__cells = {};
            if (config && config.cells) {
                for (key in config.cells)
                    __cells[key] = config.cells[key];
            } else result.setCell({row: 0, col: 0}, {});
            result.__bounds = [];

            result.name = (config && config.name) ?
                          config.name : 'Ship';
            result.grid = grid.create({type: 'hex'});

            return result;
        },
        getCell: function(node) {
            return this.__cells[ripple.pair(node.col, node.row)];
        },
        setCell: function(node, value) {
            var id = ripple.pair(node.col, node.row);

            if (typeof(value) !== 'undefined')
                this.__cells[id] = value;
            else if (Object.keys(this.__cells).length > 1)
                delete this.__cells[id];
            return this;
        },
        setBoundary: function(node, nnode, value) {
            // TODO replace existing boundaries
            var index;
            var cell = this.getCell(node);
            var ncell = this.getCell(nnode);
            if (cell && ncell) {
                var neighbors = this.grid.neighbors(node);
                for (index in neighbors) {
                    if (nnode &&
                        (neighbors[index].row === nnode.row) &&
                        (neighbors[index].col === nnode.col)) {
                        this.__bounds.push([node, nnode, value]);
                    }
                }
            } else {} // silent failure :-(
            return this;
        },

        __connected(node) {
            var entries = {};
            var queue = [];

            node.id = ripple.pair(node.row, node.col);
            queue.push(node);

            while (queue.length > 0) {
                node = queue.pop();

                if (this.__cells[node.id]) {
                    entries[node.id] = true;
                    this.grid.neighbors(node).forEach(function(neigh) {
                        neigh.id = ripple.pair(neigh.col, neigh.row);
                        if (this.__cells[neigh.id] &&
                            !entries[neigh.id])
                            queue.push(neigh);
                    }, this);
                }
            }
            return Object.keys(entries).length;
        },

        weight: function() {
            var result = 0;
            Object.keys(this.__cells).forEach(function(id) {
            }, this);
            return result;
        },
        cost: function() { // TODO
            var result = 0;
            return result;
        },
        walls: function() { // TODO
            var result = [];

            Object.keys(this.__cells).forEach(function(id) {
                var unpair = ripple.unpair(id);

                var neighbors = this.grid.neighbors(
                    {row: unpair.y, col: unpair.x}, {points: true});
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
            this.__bounds.forEach(function(bound) {
                var node = bound[0];
                var nnode = bound[1];
                var value = bound[2];
                var index, found;
                var neighbors = this.grid.neighbors(
                    node, {points: true});
                for (index in neighbors) {
                    if ((neighbors[index].row === nnode.row) &&
                        (neighbors[index].col === nnode.col)) {
                        found = neighbors[index];
                    }
                }

                var frame = function(points, fraction, width, result) {
                    var start = points[0];
                    var end = points[1];
                    var middle;

                    if (isNaN(fraction) || fraction > 0.4 ||
                        fraction < 0)
                        fraction = 0.25;
                    middle = {x: start.x + fraction * (end.x - start.x),
                              y: start.y + fraction * (end.y - start.y)};
                    result.push({start: start, end: middle,
                                 width: width});
                    console.log("DEBUG frame", fraction, width);

                    fraction = 1 - fraction;
                    middle = {x: start.x + fraction * (end.x - start.x),
                              y: start.y + fraction * (end.y - start.y)};
                    result.push({start: middle, end: end,
                                 width: width});
;
                };

                if (found && found.points.length > 1) {
                    if (value === 'wall')
                        result.push({start: found.points[0],
                                     end: found.points[1], width: 5});
                    else if (value === 'pass')
                        frame(found.points, 0.2, 5, result);
                    else if (value === 'door') {
                        result.push({start: found.points[0],
                                     end: found.points[1], width: 1});
                        frame(found.points, 0.2, 5, result);
                    }
                }
            }, this);
            return result;
        },
        save: function() { // TODO
            var result = {};
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
                                Math.min(width, height) / 20) +
                                       'px sans';
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
            .append($('<legend>Steya Menu</legend>').on(
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
                    modeParam.show();
                    Object.keys(shipElements).forEach(function(key) {
                        if (shipElements[key].internal ||
                            shipElements[key].disable ||
                            shipElements[key].boundary)
                            return;
                        modeParam.append(
                            '<option value="' +
                            shipElements[key].sigil +'">' + key +
                            '</option>');
                    });
                } else if (mode.val() === 'bound') {
                    modeParam.show();
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

        menu.append('<hr />');
        var gtype = $('<select>')
            .on('change', function(event) {
                var options = JSON.parse(gtype.val());
                tap = undefined; selected = undefined;
                options.width  = self.width();
                options.height = self.height();
                ship.grid = grid.create(options);
                lineWidth = ship.grid.size() / lineFactor;
                redraw();
            });
        grid.canonical.forEach(function(entry) {
            var selected = (entry.type === 'hex' &&
                            entry.orient === 'point') ?
                           'selected=selected ' : '';
            gtype.append('<option ' + selected + 'value="' +
                         JSON.stringify(entry)
                             .replace(/"/g, '&#34;')
                             .replace(/'/g, '&#39;') + '">' +
                         entry.name + '</option>');
        });
        menu.append($('<li>').append(gtype));

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
                        system: modeParam.text(),
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
