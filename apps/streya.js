// Streya is a game of space trading, ship construction, crew
// management and combat.
(function(streya) {
    'use strict';

    // === Ship representation
    // A ship consists of a set of connected cells, each of which
    // may have systems or other furnitrue present.
    var Ship = {
        create: function(config) {
            var result = Object.create(this);
            result.__cells = {};
            if (config && config.cells) {
                for (key in config.cells)
                    __cells[key] = config.cells[key];
            } else result.setCell({row: 0, col: 0}, {});
            result.name = (config && config.name) ?
                          config.name : 'Ship';
            return result;
        },
        getCell: function(node) {
            return this.__cells[ripple.pair(node.row, node.col)];
        },
        setCell: function(node, value) {
            var id = ripple.pair(node.row, node.col);

            if (typeof(value) !== 'undefined')
                this.__cells[id] = value;
            else if (Object.keys(this.__cells).length > 1)
                delete this.__cells[id];
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
                    grid.neighbors(node).forEach(function(neigh) {
                        neigh.id = ripple.pair(neigh.row, neigh.col);
                        if (this.__cells[neigh.id] &&
                            !entries[neigh.id])
                            queue.push(neigh);
                    }, this);
                }
            }
            return Object.keys(entries).length;
        },

        getData: function() {}
    }

    streya.game = function($, parent, viewport, data) {
        var self = $('<canvas>')
            .css({position: 'relative', 'z-order': 1,
                  'touch-action': 'none'})
            .appendTo(parent);

        var state = {grid: null};
        var ship = Ship.create(state);

        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
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
                state.grid.map(width, height, function(node) {
                    var index, points, last;
                    var cell = ship.getCell(node);
                    if (cell) {
                        points = state.grid.points(node);
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
                    }
                });

                if (selected) {
                    // Coordinates of the selected square must be
                    // updated in case the grid offsets have moved
                    // since the last draw call.
                    selected = state.grid.coordinate(selected);
                    points = state.grid.points(selected);

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
                                state.grid.size() / 2, 0, 2 * Math.PI);
                    }
                    ctx.fillStyle = colorSelected;
                    ctx.fill();
                }
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

            zooming = drag = undefined;
            redraw();
        };
        viewport.resize(resize);
        resize();
        state.grid = grid.create({type: 'hex',
                                  width: self.width(),
                                  height: self.height()});
        lineWidth = state.grid.size() / lineFactor;

        // Populate menu with available grid types
        var menu = $('<ul>')
            .attr('class', 'menu')
            .css({
                position: 'absolute', top: 10, left: 25,
                'z-order': 2,
                padding: '0.5em',
                background: '#333', color: 'white',
                border: '2px solid white',
                'border-radius': '5px',
                'list-style-type': 'none',
                'list-style-position': 'outside'})
            .appendTo(self.parent());
        //.menu a { text-decoration: none; color: white; }
        //.menu li { padding: 0.5em; border-radius: 5px; }
        //.menu li:hover { background: #55e; }

        var mode = $('<select>')
            .on('change', function(event) {})
            .append('<option>Structures</option>')
            .append('<option>Extend</option>')
            .append('<option>Remove</option>');

        menu.append($('<li data-action="mode">').append(mode));
        menu.append('<li data-action="full-screen">Full Screen</li>');

        menu.on('click', 'li', function(event) {
            switch (this.getAttribute('data-action')) {
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
                state.grid = grid.create(options);
                lineWidth = state.grid.size() / lineFactor;
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
                    state.grid.offset((left - x) * factor + x,
                                      (top - y)  * factor + y);
                    state.grid.size(size * factor);
                    lineWidth = state.grid.size() / lineFactor;
                }
                redraw();
            }
        };

        // Process mouse and touch events on grid itself
        self.on('mousewheel', function(event) {
            var offset = state.grid.offset();
            var x, y;
            if (tap) {
                x = tap.x; y = tap.y;
            } else { x = self.width() / 2; y = self.height() / 2; }
            zoom(offset.left, offset.top, state.grid.size(), x, y,
                 1 + 0.1 * event.deltaY);
        });
        self.on('mousedown touchstart', function(event) {
            var cell, index, neighbors;
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
                        size: state.grid.size(),
                        offset: state.grid.offset()};
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                tap = drag = touches;
                selected = state.grid.position(tap);

                cell = ship.getCell(selected);
                if (mode.val() === 'Extend' && !cell) {
                    neighbors = state.grid.neighbors(
                        selected, {coordinates: true, points: true});
                    for (index in neighbors) {
                        if (ship.getCell(neighbors[index])) {
                            ship.setCell(selected, {});
                            break;
                        }
                    }
                } else if (mode.val() === 'Remove' && cell) {
                    ship.setCell(selected, undefined);
                }

                // Show a menu on either double tap or long press.
                // There are some advantages to using a native double
                // click event on desktop platforms (for example, the
                // timing can be linked to operating system
                // accessibility) but here testing is what matters.
                var now = new Date().getTime();
                if (gesture && gesture.time > now &&
                    sqdist(tap, gesture) < 225) {
                    gesture = undefined;
                    menuate(tap);
                } else {
                    gesture = {time: now + 600, x: tap.x, y: tap.y};
                    press = setTimeout(function() { menuate(tap); },
                                       1000);
                }
            }

            redraw();
            return false;
        });
        self.on('mousemove touchmove', function(event) {
            if (drag) {
                tap = ripple.createTouches(event);
                var goff = state.grid.offset();
                state.grid.offset(goff.left + tap.x - drag.x,
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
