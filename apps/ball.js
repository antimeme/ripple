(function(exports) {
    var create = function($, parent) {
        var self = $('<canvas></canvas>').appendTo(parent);
        var resize = function(event) {
            self.height(parent.height());
            self.width(parent.width());
            self.attr("width", self.innerWidth())
            self.attr("height", self.innerHeight());
        };
        resize();
        parent.on('resize', resize);
        $(window).on('resize', resize);

        var bounce = function() {
            var sound = $('#swish')[0];
            sound.pause();
            sound.currentTime = 0;
            sound.play();
        }

        var margin = 20;
        var ball;
        var throttle = 0;

        var draw_id = 0;
        var draw = function() {
            if (self[0].getContext) {
                var ctx = self[0].getContext('2d');
                var width = self.width(), height = self.height();
                var now = new Date().getTime();

                if (!ball)
                    ball = { x: 30, y: 30, radius: 45,
                             dx: 50, dy: 80, last: now - 18000 };
                ball.x += ball.dx * (ball.last - now) / 1000;
                ball.y += ball.dy * (ball.last - now) / 1000;
                ball.last = now;
                while ((ball.x - ball.radius < margin) ||
                       (ball.x + ball.radius > width - margin) ||
                       (ball.y - ball.radius < margin) ||
                       (ball.y + ball.radius > height - margin)) {
                    if (ball.x - ball.radius < margin) {
                        ball.x = margin + ball.radius +
                            (margin + ball.radius - ball.x);
                        ball.dx *= -1;
                    } else if (ball.x + ball.radius > width - margin) {
                        ball.x = (width - margin - ball.radius) -
                            (ball.x - (width - margin - ball.radius));
                        ball.dx *= -1;
                    }
                    if (ball.y - ball.radius < margin) {
                        ball.y = margin + ball.radius +
                            (margin + ball.radius - ball.y);
                        ball.dy *= -1;
                    } else if (ball.y + ball.radius > height - margin) {
                        ball.y = (height - margin - ball.radius) -
                            (ball.y - (height - margin - ball.radius));
                        ball.dy *= -1;
                    }
                    bounce();
                }

                ctx.save();
                ctx.clearRect(0, 0, width, height);

                ctx.beginPath();
                ctx.moveTo(margin, margin);
                ctx.lineTo(width - margin, margin);
                ctx.lineTo(width - margin, height - margin);
                ctx.lineTo(margin, height - margin);
                ctx.lineTo(margin, margin);

                ctx.lineWidth = 5;
                ctx.lineCap = 'square';
                ctx.strokeStyle = 'red';
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(ball.x, ball.y);
                ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
                ctx.lineWidth = 5;
                ctx.fillStyle = 'green';
                ctx.fill();
                if (throttle + 1000 < now) {
                    console.log("DEBUG ball=(" + Math.round(ball.x) +
                                ", " + Math.round(ball.y) +
                                ") delta=(" + Math.round(ball.dx) +
                                ", " + Math.round(ball.dy) + ")");
                    throttle = now;
                }

                ctx.restore();
                draw_id = requestAnimationFrame(draw);
            }
        };
        requestAnimationFrame(draw);
        return self;
    };

    exports.create = create;
})(typeof exports === 'undefined'? this['ball'] = {}: exports);
