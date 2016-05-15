// Stonewars is a game of strategy and tactics created by Julian Gold
(function(stonewars) {

    stonewars.demo = function($, parent, viewport) {
        var animating = true;
        var renderer = new THREE.WebGLRenderer( { antialias: true } );
        var resize = function(event) {
            renderer.setSize(parent.width(), parent.height());
        }
        resize();
        parent.append(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(
            45, parent.width() / parent.height());
        parent.append(renderer.domElement);
        camera.position.set(0, 0, 3);

        var light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(0, 0, 1);
        scene.add(light);

        var update = function() {
            renderer.render(scene, camera);
            if (animating)
                cube.rotation.y -= 0.01;
            requestAnimationFrame(update);
        };
        var geometry = new THREE.CubeGeometry(1, 1, 1);
        var material, cube;
        var loader = new THREE.TextureLoader();
        loader.load("img/ripple.png", function(texture) {
            material = new THREE.MeshPhongMaterial({'map': texture});
            cube = new THREE.Mesh(geometry, material);
            cube.rotation.x = Math.PI / 5;
            cube.rotation.y = Math.PI / 5;
            scene.add(cube);

            renderer.domElement.addEventListener(
            'mouseup', function(event) {
                event.preventDefault();
                animating = !animating;
            });

            update();
        },
	function(xhr) {
	    console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
	},
	function ( xhr ) {
	    console.log( 'An error happened' );
	});
    };

    stonewars.game = function($, parent, viewport) {
        var self = $('<canvas></canvas>').appendTo(parent);
        var colorTapInner = 'rgba(45, 45, 128, 0.8)';
        var colorTapOuter = 'rgba(128, 255, 128, 0.6)';
        var colorSelected = 'rgba(192, 192, 0, 0.6)';
        var colorNeighbor = 'rgba(128, 128, 0, 0.4)';
        var lineWidth = 0, lineFactor = 40;
        var numbers = false, combined = false;
        var instance;
        var tap, selected, drag, zooming, gesture, press = 0;

        var draw_id = 0;
        var draw = function() {
            var ctx, width, height, color;
            var points, last, index;
            var neighbors, vector, radius;

            if (self[0].getContext) {
                ctx = self[0].getContext('2d');
                width = self.width();
                height = self.height();
                color = (self.css('color') == 'transparent' ?
                             'white' : self.css('color'));
                ctx.save();
                ctx.clearRect(0, 0, width, height);

                // Create a grid
                ctx.beginPath();
                ctx.lineWidth = lineWidth;
                ctx.textAlign = 'center';
                ctx.font = 'bold ' + 12 + 'pt sans-serif';
                instance.map(width, height, function(node) {
                    points = instance.points(node);
                    if (points.length) {
                        last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (index in points)
                            ctx.lineTo(points[index].x,
                                       points[index].y);
                    }
                });
                ctx.fillStyle = self.css('background-color');
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.stroke();
                if (combined)
                    instance.map(width, height, function(node) {
                        ctx.fillStyle = color;
                        ctx.fillText(
                            ripple.pair(node.row, node.col),
                            node.x, node.y);
                    });
                else if (numbers)
                    instance.map(width, height, function(node) {
                        ctx.fillStyle = color;
                        ctx.fillText('(' + node.row + ', ' +
                                     node.col + ')', node.x, node.y);
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

                    neighbors = instance.neighbors(
                        selected, {coordinates: true, points: true});
                    ctx.beginPath();
                    for (index in neighbors) {
                        points = instance.points(neighbors[index]);
                        if (points.length) {
                            last = points[points.length - 1];
                            ctx.moveTo(last.x, last.y);
                            for (index in points)
                                ctx.lineTo(points[index].x,
                                           points[index].y);
                        } else {
                            ctx.moveTo(neighbors[index].x,
                                       neighbors[index].y);
                            ctx.arc(
                                neighbors[index].x, neighbors[index].y,
                                instance.size() / 2, 0, 2 * Math.PI);
                        }
                    }
                    ctx.fillStyle = colorNeighbor;
                    ctx.fill();

                    var colors = ['red', 'green', 'blue',
                                  'cyan', 'magenta', 'yellow',
                                  'black', 'white'];
                    for (index in neighbors) {
                        ctx.beginPath();
                        points = neighbors[index].points;
                        if (points.length > 1) {
                            vector = {x: points[1].x - points[0].x,
                                      y: points[1].y - points[0].y};
                            ctx.moveTo(points[0].x + 0.25 * vector.x,
                                       points[0].y + 0.25 * vector.y);
                            ctx.lineTo(points[0].x + 0.75 * vector.x,
                                       points[0].y + 0.75 * vector.y);
                        } else if (points.length === 1) {
                            radius = lineWidth * 5;
                            ctx.moveTo(points[0].x + radius,
                                       points[0].y);
                            ctx.arc(points[0].x, points[0].y,
                                    radius, 0, 2 * Math.PI);
                        }
                        ctx.moveTo(neighbors[index].x + lineWidth * 2,
                                   neighbors[index].y);
                        ctx.arc(neighbors[index].x, neighbors[index].y,
                                lineWidth * 2, 0, 2 * Math.PI);

                        ctx.strokeStyle = colors[index % colors.length];
                        ctx.stroke();
                    }
                }
                if (tap) {
                    for (index = 0; index < tap.touches.length;
                         ++index) {
                        ctx.beginPath();
                        ctx.arc(tap.touches[index].x,
                                tap.touches[index].y,
                                20, 0, 2 * Math.PI);
                        ctx.fillStyle = colorTapOuter;
                        ctx.fill();
                    }
                    ctx.beginPath();
                    ctx.arc(tap.x, tap.y, 10, 0, 2 * Math.PI);
                    ctx.fillStyle = colorTapInner;
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
        instance = grid.create({width: self.width(),
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
            case 'animation': {
                animation.toggle();
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
    
})(typeof exports === 'undefined'? this['stonewars'] = {}: exports);
