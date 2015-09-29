// Streya is a game of space trading, ship construction, crew
// management and combat.
(function(streya) {
    streya.game = function($, parent, viewport) {
        var self = $('<canvas></canvas>').appendTo(parent);
        var ship = {
            name: 'Ship',
            getCell: function(node) {
                return this.cells[ripple.pair(node.row, node.col)];
            },
            setCell: function(node, value) {
                this.cells[ripple.pair(node.row, node.col)] = value;
                return this;
            },
            cells: {0: 'emtpy'}
        };






        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.2)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
        var lineWidth = 0, lineFactor = 40;
        var instance;
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
                instance.map(width, height, function(node) {
                    var index, points, last;
                    var cell = ship.cells[
                        ripple.pair(node.row, node.col)];
                    if (cell) {
                        points = instance.points(node);
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
                    selected = instance.coordinate(selected);
                    points = instance.points(selected);

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
                                instance.size() / 2, 0, 2 * Math.PI);
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
        instance = grid.create({type: 'hex',
                                width: self.width(),
                                height: self.height()});
        lineWidth = instance.size() / lineFactor;

        var animation = new (function() {
            var id, current, start, stop, limit = 60000;
            var choose = function(size) {
                return Math.floor(size * Math.random());
            };

            this.start = function() {
                var now = new Date().getTime();
                if (!current)
                   current = now;
                do {
                    if (!stop) {
                       var offset = instance.offset();
                       var angle = 2 * Math.PI * Math.random();
                       var magnitude = 100 + choose(50);

                       if (now - current > limit)
                           current = now - limit;
                       start = {left: offset.left, top: offset.top,
                                time: current};
                       stop = {left: offset.left + magnitude *
                                     Math.cos(angle),
                               top:  offset.top  + magnitude *
                                     Math.sin(angle),
                               time: current + choose(5000) + 2500};
                    }
                    var portion = Math.min(1.0, (now - start.time) /
                                           (stop.time - start.time));
                    instance.offset(
                        Math.floor(start.left + portion *
                                   (stop.left - start.left)),
                        Math.floor(start.top + portion *
                                   (stop.top - start.top)));
                    if (stop.time < now) {
                        current = stop.time;
                        stop = undefined;
                    }
                } while (!stop);
                draw();
                var a = this;
                id = requestAnimationFrame(function() { a.start(); });
            };
            this.stop = function() {
                if (id)
                    cancelAnimationFrame(id);
                id = 0;
                current = undefined;
                stop = undefined;
            };
            this.toggle = function() {
                if (!id)
                    this.start();
                else this.stop();
            };
        })();

        // Populate menu with available grid types
        var menu = $('<ul class="menu"></ul>').hide();
        menu.css({
            position: 'absolute', padding: '0.5em',
            background: '#333', color: 'white',
            border: '2px solid white'
        }).
            css('border-radius', '5px').
            css('list-style-type', 'none').
            css('list-style-position', 'outside');
        //.menu a { text-decoration: none; color: white; }
        //.menu li { padding: 0.5em; border-radius: 5px; }
        //.menu li:hover { background: #55e; }
        
        menu.appendTo(self.parent());
        grid.canonical.forEach(function (entry) {
            var name = entry[0];
            var options = JSON.stringify(entry[1]);
            menu.append('<li data-grid-type="' + name +
                        (options ? '" data-grid-options="' +
                         options.replace(/"/g, '&#34;').  // "
                                 replace(/'/g, '&#39;') : '') +
                        '">' + name + '</li>');
        });
        menu.append('<hr />');
        menu.append('<li data-action="animation">' +
                    'Toggle Animation</li>');
        menu.append('<li data-action="colors">' +
                    'Swap Colors</li>');
        menu.append('<li data-action="full-screen">Full Screen</li>');
        menu.on('click', 'li', function(event) {
            menu.hide();
            var gtype = this.getAttribute('data-grid-type');
            if (gtype) {
                tap = undefined; selected = undefined;
                var options = JSON.parse(
                    this.getAttribute('data-grid-options'));
                if (!options)
                   options = {type: gtype};
                options.width  = self.width();
                options.height = self.height();
                instance = grid.create(options);
                lineWidth = instance.size() / lineFactor;
                redraw();
            }

            switch (this.getAttribute('data-action')) {
            case 'full-screen': {
                $.toggleFullscreen(self.parent().get(0));
                resize();
            } break;
            case 'animation': {
                animation.toggle();
            } break;
            case 'colors': {
                var foreground = self.css('color');
                var background = self.css('background-color');
                self.css({color: background,
                          "background-color": foreground});
                redraw();
            } break;
            }
        });

        // Show grid menu at event location
        var menuate = function(tap) {
            menu.css('top', 10).css('left', 25).show();
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
                    instance.offset((left - x) * factor + x,
                                    (top - y)  * factor + y);
                    instance.size(size * factor);
                    lineWidth = instance.size() / lineFactor;
                }
                redraw();
            }
        };

        // Process mouse and touch events on grid itself
        self.on('mousewheel', function(event) {
            var offset = instance.offset();
            var x, y;
            if (tap) {
                x = tap.x; y = tap.y;
            } else { x = self.width() / 2; y = self.height() / 2; }
            zoom(offset.left, offset.top, instance.size(), x, y,
                 1 + 0.1 * event.deltaY);
        });
        self.on('mousedown touchstart', function(event) {
            var cell, index, neighbors;
            var targets = $.targets(event);
            menu.hide();
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else if (targets.touches.length > 1) {
                tap = targets;
                if (targets.touches.length == 2) {
                    var t0 = targets.touches[0];
                    var t1 = targets.touches[1];
                    zooming = {
                        diameter: Math.sqrt(sqdist(t0, t1)),
                        x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2,
                        size: instance.size(),
                        offset: instance.offset()};
                }
                if (press) { clearTimeout(press); press = 0; }
            } else {
                tap = drag = targets;
                selected = instance.position(tap);

                cell = ship.getCell(selected);
                if (!cell) {
                    neighbors = instance.neighbors(
                        selected, {coordinates: true, points: true});
                    for (index in neighbors) {
                        if (ship.getCell(neighbors[index])) {
                            ship.setCell(selected, 'empty');
                            break;
                        }
                    }
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
                animation.stop();
                tap = $.targets(event);
                var goff = instance.offset();
                instance.offset(goff.left + tap.x - drag.x,
                                goff.top + tap.y - drag.y);
                if ((sqdist(drag, tap) > 125) && press)
                    clearTimeout(press);
                redraw();
                drag = tap;
            }
            if (zooming) {
                animation.stop();
                var targets = $.targets(event);
                var factor;
                if (zooming.diameter && targets.touches.length == 2) {
                    var t0 = targets.touches[0];
                    var t1 = targets.touches[1];
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
