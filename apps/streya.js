// Streya is a game of space trading, ship construction, crew
// management and combat.
(function () {
    var streya = function($, viewport, canvas, seed) {
        var result = {};
        var selected = null;
        var oldselect = null;
        var tap = null;
        var path = null;

        var grid = Grid.create({"type":   params.grid   || "hex",
                                "size":   params.size   || 50,
                                "orient": params.orient || "point"});
        var obstacles = function(row, col) {
            var reference = (row + col) * (row + col + 1) / 2 + col;
            return !(reference % 7);
        };

        var update = function(canvas) {
            if (canvas[0].getContext) {
                var ctx = canvas[0].getContext('2d');
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width(), canvas.height());

                if (selected) {
                    ctx.beginPath();
                    var points = grid.points(selected);
                    var last = points[points.length - 1];
                    ctx.moveTo(last.x, last.y);
                    for (i in points)
                        ctx.lineTo(points[i].x, points[i].y);
                    ctx.fillStyle = "rgba(255, 255, 0, 0.6)";
                    ctx.fill();

                    var neighbors = grid.neighbors(selected);
                    ctx.beginPath();
                    for (var i in neighbors) {
                        var points = grid.points(neighbors[i]);
                        var last = points[points.length - 1];
                        ctx.moveTo(last.x, last.y);
                        for (i in points)
                            ctx.lineTo(points[i].x, points[i].y);
                    }
                    ctx.fillStyle = "rgba(128, 128, 255, 0.2)";
                    ctx.fill();
                }

                grid.map(canvas.width(), canvas.height(),
                         function(node) {
                             if (obstacles(node.row, node.col)) {
                                 ctx.beginPath();
                                 var points = grid.points(node);
                                 var last = points[points.length - 1];
                                 ctx.moveTo(last.x, last.y);
                                 for (i in points)
                                     ctx.lineTo(points[i].x,
                                                points[i].y);
                                 ctx.fillStyle =
                                     "rgba(32, 255, 255, 0.6)";
                                 ctx.fill();
                             }});

                if (tap) {
                    ctx.beginPath();
                    ctx.arc(tap.x, tap.y, Math.max(3, grid.size / 3),
                            0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(128, 255, 128, 0.8)";
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(tap.x, tap.y, Math.max(1, grid.size / 6),
                            0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(45, 45, 128, 1)";
                    ctx.fill();

                    if (path) {
                        var prev = oldselect;
                        ctx.beginPath();
                        for (var i in path) {
                            var next = path[i];
                            if (prev)
                                canvas_arrow(ctx, grid.size / 2,
                                             prev.x, prev.y,
                                             next.x, next.y)
                            var prev = next;
                        }
                        ctx.strokeStyle = "#fff";
                        ctx.stroke();
                    }
                }
            }
        };

        var resize = function(event) {
            // Consume enough space to fill the viewport but leave
            // enough for containing elements if possible.  Note
            // that while some browser engines (Gecko & Webkit)
            // seem to make the HTML element the sum of the child
            // heights, others (Trident) seem to use the maximum
            // of that and the size of the viewport.
            canvas.height(Math.max(
                canvas.height(),
                canvas.height() + viewport.height() - Math.max.apply
                (null, canvas.parents().map(
                    function () {
                        return (this.nodeName.toLowerCase() !=
                                'html') ? $(this).height() : 0;
                    }).get())));
            canvas.width(canvas.parent().width());

            // A canvas has a height and a width that are part of
            // the document object model but also separate height
            // and width attributes which determine how many
            // pixels are part of the canvas itself.  Keeping the
            // two in sync is essential to avoid ugly stretching.
            canvas.attr("width", canvas.innerWidth())
            canvas.attr("height", canvas.innerHeight());

            update(canvas);
        };
        viewport.on("resize", resize);
        resize();

        var triedFullScreen = 1; // set to 1 to disable
        canvas.on("click", function(event) {
            if (!triedFullScreen) {
                var req = this.requestFullScreen ||
                    this.webkitRequestFullScreen ||
                    this.mozRequestFullScreen;
                if (req) {
                    req.call(this);
                    resize();
                }
                triedFullScreen = 1;
            }

            tap = mousep(event);
            var candidate = grid.position(tap);
            if (!obstacles(candidate.row, candidate.col)) {
                oldselect = selected;
                selected = candidate;
                if (oldselect && selected) {
                    path = astarsearch(
                        oldselect, [selected], function(t) {
                            var result = [];
                            grid.neighbors(t).forEach(
                                function (neighbor) {
                                    if (!obstacles(
                                        neighbor.row, neighbor.col))
                                        result.push(neighbor);
                                });
                            return result;
                        },
                        null, null, 40, function(node) {
                            return JSON.stringify({row: node.row,
                                                   col: node.col});
                        });
                }
            }
            update(canvas);
        });
        return result;
    };

    this.streya = streya;
})();

function mousep(event) { // Get component mouse coordinates for event
    var offset = jQuery(event.target).offset();
    var x = Math.round(event.pageX - offset.left);
    var y = Math.round(event.pageY - offset.top);
    return { x: x, y: y, coord: "(" + x + ", " + y + ")" };
};

function canvas_arrow(ctx, headlen, fromx, fromy, tox, toy) {
    //http://stackoverflow.com/questions/808826/draw-arrow-on-canvas-tag
    var angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6),
               toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6),
               toy - headlen * Math.sin(angle + Math.PI / 6));
}

if (typeof module === 'undefined') { jQuery(function($) {
    $('.streya').each(function() {
        streya($, $(window), $(this));
    });
});}
