(function(exports) {
    var trace = false;

    var map = (function() {
        var result = {};

        return result;
    })();

    // Calculate square distance
    var sqdist = function(node1, node2) {
        return ((node2.x - node1.x) * (node2.x - node1.x) +
                (node2.y - node1.y) * (node2.y - node1.y));
    };

    var create_character = function(grid, config) {
        // A character has a current position, which is really the
        // grid cell that it's in the process of entering.  When
        // progress is less than 1.0 there must be a valid grid
        // cell represented by the previous position.
        //
        // The internal start and stop variables represent the
        // time at which the character began entering the current
        // cell and the time when that step will be complete.
        var result = {current: {row: (config && config.row) ?
                                config.row : 0,
                                col: (config && config.col) ?
                                config.col : 0},
                      previous: null, path: [], progress: 1.0,
                      rate: ((config && config.rate) ?
                             config.rate : 1000),
                      color: ((config && config.color) ?
                              config.color : 'blue')};
        var start = null, stop = null;

        result.update = function(now) {
            if (this.progress < 1.0 || this.path) {
                if (!start) {
                    start = new Date().getTime();
                    stop = start + this.rate;
                }
                this.progress = (now - start) / (stop - start);
                while (this.progress >= 1.0 &&
                       this.path.length > 0) {
                    this.progress -= 1.0;
                    start += this.rate;
                    stop += this.rate;
                    this.previous = this.current;
                    this.current = grid.coordinate(
                        this.path.shift());
                }
                if (this.progress >= 1.0 && !this.path.length) {
                    this.progress = 1.0;
                    this.previous = start = stop = null;
                }
            }
            return this;
        };

        result.move = function () {
            var self = this;

            // We have to sanitize goals because if they contain
            // members other than row and column they won't
            // necessarily match and the path finding will fail.
            var goals = [];
            for (var i in arguments)
                goals.push({row: arguments[i].row,
                              col: arguments[i].col});

            var newpath = pathf.astarsearch(
                self.current, goals,
                function(node) {
                    var neighbors = grid.neighbors(node);
                    var result = [];
                    for (var i in neighbors) {
                        var seed = ripple.pair(neighbors[i].row,
                                               neighbors[i].col);
                        if ((seed % 5) != 2)
                            result.push(neighbors[i]);
                    }
                    return result;
                },
                function(node, cost, goal) {
                    return Math.sqrt((goal.row - node.row) *
                                     (goal.row - node.row) +
                                     (goal.col - node.col) *
                                     (goal.col - node.col));
                },
                null, 15, function(node) {
                    return node.row + ", " + node.col;
                })
            if (newpath)
                this.path = newpath;
            return this;
        };

        result.active = function(ctx) { return !!start; };

        result.draw = function(ctx) {
            var dest = grid.coordinate(result.current);
            var src  = this.previous ?
                grid.coordinate(this.previous) : null;
            var x, y;
            if (src) {
                x = src.x + (dest.x - src.x) *
                    Math.min(this.progress, 1.0);
                y = src.y + (dest.y - src.y) *
                    Math.min(this.progress, 1.0);
            } else { x = dest.x; y = dest.y };
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, grid.size() / 2,
                    0, 2 * Math.PI);
            ctx.fillStyle = this.color;
            ctx.fill();

            if (trace && this.path) {
                ctx.moveTo(x, y);
                for (var i in this.path) {
                    var node = grid.coordinate(this.path[i]);
                    ctx.lineTo(node.x, node.y);
                }
                ctx.strokeStyle = color;
                ctx.stroke();
            }
            return this;
        };

        return result;
    };

    exports.go = function(index, object) {
        var self = $(object);
        var viewport = $(window);
        var mapgrid = grid.create(
            {type: window.params['gridtype'] || 'hex', size: 33});
        var actors = [];
        var target;

        var throttle = null;
        var counter = 0;

        var draw_id = 0;
        var draw = function(now) {
            if (throttle && now < throttle + 1000) {
                if (++counter > 50) {
                    console.log("Throttling " + now + " :: " + throttle);
                    return;
                }
            } else { throttle = now; counter = 0; }

            if (self[0].getContext) {
                var ctx = self[0].getContext('2d');
                var width = self.width(), height = self.height();
                ctx.save();
                ctx.clearRect(0, 0, width, height);

                mapgrid.map(width, height, function(node) {
                    ctx.beginPath();
                    var points = mapgrid.points(node);
                    if (points.length) {
                        var last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (i in points)
                            ctx.lineTo(points[i].x, points[i].y);
                    }

                    var seed = ripple.pair(node.row, node.col);
                    switch (seed % 5) {
                    case 0:
                    case 1:
                        ctx.fillStyle = 'green';
                        break;
                    case 2:
                        ctx.fillStyle = 'rgb(64,64,64)';
                        break;
                    case 3:
                        ctx.fillStyle = 'rgb(128,128,128)';
                        break;
                    default:
                        ctx.fillStyle = 'blue';
                    };
                    ctx.fill();
                });

                var now = new Date().getTime();
                for (var index in actors)
                    actors[index].update(now).draw(ctx);

                // Highlight the targetted grid cell
                if (target) {
                    var points = mapgrid.points(
                        mapgrid.coordinate(target));

                    ctx.beginPath();
                    if (points.length) {
                        var last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (i in points)
                            ctx.lineTo(points[i].x, points[i].y);
                    } else {
                        ctx.moveTo(selected.x, selected.y);
                        ctx.arc(selected.x, selected.y,
                                grid.size() / 2, 0, 2 * Math.PI);
                    }
                    ctx.lineWidth = '5';
                    ctx.strokeStyle = 'black';
                    ctx.stroke();
                }

                ctx.restore();
            }

            var active = false;
            for (var index in actors)
                if (actors[index].active())
                    active = true;

            // Seems like a simple call to requestAnimationFrame
            // should work here, but it causes at least Firefox to
            // chew up lots of CPU cycles.  The indirection seems
            // to fix the problem for some reason.
            draw_id = active ? requestAnimationFrame(
                function () { requestAnimationFrame(draw); }) : 0;
        };
        var redraw = function() {
            if (!draw_id)
                draw_id = requestAnimationFrame(draw);
        };
        var resize = function(event) {
            self.height(viewport.height());
            self.width(viewport.width());
            self.attr("width", self.innerWidth())
            self.attr("height", self.innerHeight());
            redraw();
        };
        viewport.resize(resize);
        resize();

        actors.push(reddie = create_character(mapgrid, {color: 'red'}));
        actors.push(yellow = create_character(mapgrid, {
            color: 'yellow', row: 3, col: 3, rate: 1250}));
        var yellow_follow = function() {
            yellow.move.apply(yellow, mapgrid.neighbors
                              (reddie.current));
            setTimeout(yellow_follow, 2000);
        };
        yellow_follow();
        
        var throb = function() {
            reddie.color = (reddie.color == 'red') ?
                'orangered' : 'red';
            redraw();
            setTimeout(throb, 900);
        };
        throb();

        // Gradually move target grid cell to center of screen
        var drift = (function(grid){
            var start, stop;
            var update_id = 0, update = function() {
                var now = new Date().getTime();
                var offset = grid.offset();
                var progress;
                if (stop && now < stop.when) {
                    progress = (now - start.when) /
                        (stop.when - start.when);
                    update_id = requestAnimationFrame(update, 100);
                } else progress = 1.0;
                offset.left = start.x + (stop.x - start.x) * progress;
                offset.top  = start.y + (stop.y - start.y) * progress;
                grid.offset(offset.left, offset.top);
                redraw();
            };

            return function(tap) {
                var now = new Date().getTime();
                var offset = grid.offset();
                var center = grid.coordinate(
                    grid.position({x: self.width() / 2,
                                   y: self.height() / 2}));
                start = {x: offset.left, y: offset.top, when: now};
                stop  = {when: now + 2000,
                         x: offset.left + (center.x - tap.x),
                         y: offset.top  + (center.y - tap.y)};
                stop.when += 2 * (Math.abs(stop.x - start.x) +
                                  Math.abs(stop.x - start.x));
                update();
            };
        })(mapgrid);
        drift(mapgrid.coordinate({row: 0, col: 0}));

        var zooming, zoom = function(left, top, size, x, y, factor) {
            if (factor && factor > 0) {
                if (size * factor > 33) {
                    mapgrid.offset((left - x) * factor + x,
                                   (top - y)  * factor + y);
                    mapgrid.size(size * factor);
                }
                redraw();
            }
        };

        self.on('mousewheel', function(event) {
            var offset = mapgrid.offset();
            var x = self.width() / 2;
            var y = self.height() / 2;
            zoom(offset.left, offset.top, mapgrid.size(), x, y,
                 1 + 0.1 * event.deltaY);
        });
        self.on('mousedown touchstart', function(event) {
            var targets = $.targets(event);
            if (event.which > 1) {
                // Reserve right and middle clicks for browser menus
            } else if (targets.touches.length > 1) {
                if (targets.touches.length == 2) {
                    var t0 = targets.touches[0];
                    var t1 = targets.touches[1];
                    zooming = {
                        diameter: Math.sqrt(sqdist(t0, t1)),
                        x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2,
                        size: mapgrid.size(), offset: mapgrid.offset()};
                    // yellow.color = (yellow.color == 'yellow') ?
                    //     'black' : 'yellow';
                }
                redraw();
            } else {
                target = mapgrid.position(targets);
                drift(target);
                reddie.move(target);
                redraw();
            }
            return false;
        });
        self.on('mousemove touchmove', function(event) {
            if (zooming) {
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
            zooming = undefined;
            return false;
        });
    };
})(typeof exports === 'undefined'? this['omnomi'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var grid = require('./ripple/grid.js');
    var pathf = require('./ripple/pathf.js');
    console.log('Test!');
}
