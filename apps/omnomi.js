(function(exports) {
    var trace = false;

    var create_character = function(grid, redraw, color, position) {
        var result = {current: position, previous: null,
                      path: [], progress: 1.0, rate: 1000, grid: grid};
        result.move = (function() {
            var start = null, stop = null;
            var update_id = 0, update = function() {
                var now = new Date().getTime();
                if (!start) {
                    start = now;
                    stop = start + result.rate;
                    result.previous = result.current;
                    if (result.path.length)
                        result.current = grid.coordinate(
                            result.path.shift());
                }
                result.progress = (now - start) / (stop - start);
                while (result.progress >= 1.0 &&
                       result.path.length > 0) {
                    result.progress -= 1.0;
                    start += result.rate;
                    stop += result.rate;
                    result.previous = result.current;
                    result.current = grid.coordinate(
                        result.path.shift());
                }
                if (result.progress < 1.0 || result.path.length) {
                    update_id = requestAnimationFrame(update);
                } else {
                    start = stop = null;
                    update_id = 0;
                }
                redraw();
            };
            return function () {
                var targets = [];
                for (var i in arguments)
                    targets.push({row: arguments[i].row,
                                  col: arguments[i].col});

                var newpath = pathf.astarsearch(
                    result.current, targets,
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
                if (newpath) {                    
                    result.path = newpath;
                    if (!update_id)
                        update_id = requestAnimationFrame(update);
                }
            };
        })();
        result.draw = function(ctx) {
            var dest = grid.coordinate(result.current);
            var src  = result.previous ?
                grid.coordinate(result.previous) : null;
            var x, y;
            if (src) {
                x = src.x + (dest.x - src.x) *
                    Math.min(result.progress, 1.0);
                y = src.y + (dest.y - src.y) *
                    Math.min(result.progress, 1.0);
            } else { x = dest.x; y = dest.y };
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, grid.size() / 2,
                    0, 2 * Math.PI);
            ctx.fillStyle = color;
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
        };
        return result;
    };

    exports.go = function(index, object) {
        var self = $(object);
        var viewport = $(window);
        var mapgrid = grid.create(
            {type: window.params['gridtype'] || 'hex'});
        var reddie, yellow;
        var target;

        var draw_id = 0;
        var draw = function() {
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

                yellow.draw(ctx);
                reddie.draw(ctx);

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
            draw_id = 0;
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

        reddie = create_character(mapgrid, redraw, 'red',
                                  {row: 0, col: 0});
        yellow = create_character(mapgrid, redraw, 'yellow',
                                  {row: 3, col: 3});
        var yellow_follow = function() {
            yellow.move.apply(yellow, mapgrid.neighbors
                              (reddie.current));
            setTimeout(yellow_follow, 2000);
        };
        yellow_follow();
        
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

        var zoom = function(left, top, size, x, y, factor) {
            if (factor && factor > 0) {
                if (size * factor > 40) {
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
                }
                redraw();
            } else {
                target = mapgrid.position(targets);
                drift(target);
                reddie.move(target);
            }
            return false;
        });
    };
})(typeof exports === 'undefined'? this['omnomi'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var grid = require('./ripple/grid.js');
    var pathf = require('./ripple/pathf.js');
    console.log('Test!');
}
