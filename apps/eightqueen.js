(function(eightqueen) {
    eightqueen.go = function($, parent, viewport) {
        var self = $('<canvas></canvas>').appendTo(parent);
        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.6)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
        var lineWidth = 0, lineFactor = 40;
        var numbers = false, combined = false;
        var instance;
        var queens = [];
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
                ctx.clearRect(0, 0, width, height);

                // Checkerboard pattern
                ctx.beginPath();
                instance.map(width, height, function(node) {
                    if (node.row <= 0 || node.row > 8 ||
                        node.col <= 0 || node.col > 8 ||
                        ((node.row + node.col) % 2))
                        return;

                    var index, points = instance.points(node);
                    if (points.length) {
                        var last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (index in points)
                            ctx.lineTo(points[index].x,
                                       points[index].y);
                    }
                });
                ctx.fillStyle = 'rgb(64, 64, 64)';
                ctx.fill();

                // Create a grid
                ctx.beginPath();
                ctx.lineWidth = lineWidth;
                ctx.textAlign = 'center';
                ctx.font = 'bold ' + 12 + 'pt sans-serif';
                instance.map(width, height, function(node) {
                    if ((node.row <= 0 || node.row > 8) ||
                        (node.col <= 0 || node.col > 8))
                        return;

                    var index, points = instance.points(node);
                    if (points.length) {
                        var last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (index in points)
                            ctx.lineTo(points[index].x,
                                       points[index].y);
                    }
                });
                ctx.strokeStyle = color;
                ctx.stroke();

                // Draw capture possibilities
                ctx.beginPath();
                var row, col, qnum;
                for (row = 1; row <= 8; ++row) {
                    for (col = 1; col <= 8; ++col) {
                        for (qnum = 0; qnum < queens.length; ++qnum) {
                            var queen = queens[qnum];
                            var rdiff = queen.row - row;
                            var cdiff = queen.col - col;
                            if (queen.row === row || queen.col === col ||
                                rdiff === cdiff || rdiff === -cdiff) {
                                var points = instance.points(
                                    instance.coordinate(
                                        {row: row, col: col}));
                                var last = points[points.length - 1];
                                ctx.moveTo(last.x, last.y);
                                for (index in points)
                                    ctx.lineTo(points[index].x,
                                               points[index].y);
                            }
                        }
                    }
                }
                ctx.fillStyle = 'rgba(192, 192, 0, 0.6)';

                ctx.fill();

                // Draw queens
                ctx.beginPath();
                for (index = 0; index < queens.length; ++index) {
                    var queen = instance.coordinate(queens[index]);
                    ctx.moveTo(queen.x + instance.size() / 3, queen.y);
                    ctx.arc(queen.x, queen.y, instance.size() / 3,
                            0, Math.PI * 2);
                }
                ctx.fillStyle = 'green';
                ctx.fill();

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
        instance = grid.create();
        lineWidth = instance.size() / lineFactor;

        // Populate menu with available grid types
        var menu = $('<ul class="menu"></ul>').hide();
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
        menu.append('<li data-action="numbers">' +
                    'Toggle Numbers</li>');
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
            case 'numbers': {
                if (combined) {
                    numbers = combined = false;
                } else if (numbers)
                    combined = true;
                else numbers = true;
                redraw();
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
            var targets = ripple.getInputPoints(event);
            var candidate, qnum;

            menu.hide();
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
                return true;
            } else if (targets.targets && targets.targets.length > 1) {
                tap = targets;
                if (targets.targets.length == 2) {
                    var t0 = targets.targets[0];
                    var t1 = targets.targets[1];
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

                if (selected.row >= 1 && selected.row <= 8 &&
                    selected.col >= 1 && selected.col <= 8) {
                    candidate = selected;

                    for (qnum = 0; (qnum < queens.length) &&
                         candidate; ++qnum) {
                        var queen = queens[qnum];
                        var rdiff = queen.row - candidate.row;
                        var cdiff = queen.col - candidate.col;
                        if (queen.row === candidate.row ||
                            queen.col === candidate.col ||
                            Math.abs(rdiff) === Math.abs(cdiff)) {
                            candidate = undefined;
                        }
                    }
                    if (candidate)
                        queens.push(candidate);
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
                tap = ripple.getInputPoints(event);
                var goff = instance.offset();
                instance.offset(goff.left + tap.x - drag.x,
                                goff.top + tap.y - drag.y);
                if ((sqdist(drag, tap) > 125) && press)
                    clearTimeout(press);
                redraw();
                drag = tap;
            }
            if (zooming) {
                var targets = ripple.createTargets(event);
                var factor;
                if (zooming.diameter && targets.targets.length == 2) {
                    var t0 = targets.targets[0];
                    var t1 = targets.targets[1];
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
})(typeof exports === 'undefined'? this['eightqueen'] = {}: exports);
