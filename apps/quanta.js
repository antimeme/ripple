// quanta.js
// Copyright (C) 2015 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
// A particle physics simulation.
//
// Note that particles always have an exact position and momentum, which
// would violate the Heisenburg Uncertainty Principle.  For the moment
// ease of understanding is favored over accuracy, since it's not clear
// how to visually represent particle-wave duality.
(function(exports) {
    "use strict";

    var Vector = {
        create: function(x, y) {
            var result = Object.create(this);
            result.x = x;
            result.y = y;
            return result;
        },
        polar: function(r, theta) {
            var result = Object.create(this);
            result.x = r * Math.cos(theta);
            result.y = r * Math.sin(theta);
            return result;            
        },
        reverse: function()
        { return this.create(-this.x, -this.y); },
        plus: function(other)
        { return this.create(this.x + other.x, this.y + other.y); },
        minus: function(other)
        { return this.plus(other.reverse()); },
        dotp: function(other)
        { return this.x * other.x + this.y * other.y; },
        norm: function() {
            var m = Math.sqrt(this.dotp(this));
            return this.create(this.x / m, this.y / m);
        }
    };

    var Environment = {
        create: function(width, height) {
            var result = Object.create(this);
            result.width = width;
            result.height = height;
            return result;
        },

        bounce: function(particle, factor) {
            particle.position.x += particle.velocity.x * factor;
            if (particle.position.x < particle.scale / 2) {
                particle.position.x = particle.scale / 2;
                particle.velocity.x = -particle.velocity.x;
            } else if (particle.position.x > this.width -
                       particle.scale / 2) {
                particle.position.x = this.width - particle.scale / 2;
                particle.velocity.x = -particle.velocity.x;
            }
            
            particle.position.y += particle.velocity.y * factor;
            if (particle.position.y < particle.scale / 2) {
                particle.position.y = particle.scale / 2;
                particle.velocity.y = -particle.velocity.y;
            } else if (particle.position.y > this.height -
                       particle.scale / 2) {
                particle.position.y = this.height - particle.scale / 2;
                particle.velocity.y = -particle.velocity.y;
            }
        }
    };

    var Photon = {
        spin: 1,
        particle: 'photon',
        env: undefined, freq: undefined,
        position: {x: undefined, y: undefined}, scale: undefined,
        phase: Math.PI / 6, velocity: {x: 0, y: 0}, absorbed: false,

        create: function(env, scale, position, velocity, freq) {
            var result = Object.create(this);
            result.env = env;
            result.scale = scale;
            result.position = position;
            if (velocity)
                result.velocity = velocity.norm();
            result.freq = freq;
            return result;
        },

        update: function(dt) {
            var retain_chance;
            this.phase += dt * 0.01;
            if (this.absorbed) {
                this.absorbed.duration += dt;
                retain_chance = Math.pow(0.999, Math.floor
                                         (this.absorbed.duration / 10));
                if (Math.random() > retain_chance) {
                    this.velocity = Vector.polar(
                        1, Math.random() * 2 * Math.PI);
                    this.position = Vector.create(
                        this.absorbed.by.position.x + this.velocity.x *
                            (this.scale + this.absorbed.by.scale),
                        this.absorbed.by.position.y + this.velocity.y *
                            (this.scale + this.absorbed.by.scale));
                    this.absorbed = false;
                } else this.absorbed.duration %= 1;
            } else this.env.bounce(this, dt * 0.25);
            return this;
        },
        draw: function(context) {
            if (this.absorbed)
                return;
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.beginPath();
            context.moveTo(this.scale / 2, 0);
            context.arc(0, 0, this.scale / 2, 0, 2 * Math.PI);
            context.moveTo(0, -this.scale / 2);
            context.bezierCurveTo(
                    -this.scale / 2, this.scale / 5,
                this.scale / 2, -this.scale / 5,
                0, this.scale / 2);
            context.lineWidth = this.scale / 25;
            context.lineCap = 'round';
            context.strokeStyle = 'white';
            context.stroke();
            context.restore();
        }
    };

    var Electron = {
        spin: 0.5,
        particle: 'electron',
        cx: undefined, cy: undefined, scale: undefined,
        phase: Math.PI / 6, velocity: {dx: 0, dy: 0},
        absorbed: false,

        create: function(env, scale, position, velocity) {
            var result = Object.create(this);
            result.env = env;
            result.scale = scale;
            result.position = position;
            if (velocity)
                result.velocity = velocity.norm();
            return result;
        },

        update: function(dt) {
            var index, other, touch, delta, distance;
            for (index = 0; index < this.env.particles.length;
                 ++index) {
                other = this.env.particles[index];
                if (other.particle !== 'photon')
                    continue;
                
                touch = other.scale / 2 + this.scale / 2;
                touch *= touch;
                delta = this.position.minus(other.position);
                distance = delta.dotp(delta);
                if (distance < touch) {
                    other.absorbed = {by: this, duration: 0};
                }
            }
            
            this.phase += dt * 0.005;
            if (this.absorbed) {
            } else this.env.bounce(this, dt * 0.25);
            return this;
        },
        draw: function(context) {
            if (this.absorbed)
                return;
            context.save();
            context.translate(this.position.x, this.position.y);
            //context.rotate(this.phase);
            context.beginPath();
            context.moveTo(this.scale / 2, 0);
            context.arc(0, 0, this.scale / 2, 0, 2 * Math.PI);
            context.moveTo(-this.scale / 4, 0);
            context.lineTo(this.scale / 4, 0);
            context.lineWidth = this.scale / 20;
            context.lineCap = 'round';
            context.fillStyle = "rgb(64,64,255)";
            context.fill();
            context.strokeStyle = 'lightgrey';
            context.stroke();
            context.restore();
        }
    };
    

    exports.go = function($, container) {
        // Resize canvas to consume most of the screen
        var canvas = $('<canvas></canvas>').appendTo(container);
        canvas.get(0).setAttribute('width', window.innerWidth);
        canvas.get(0).setAttribute('height', window.innerHeight);
        var env = Environment.create(
            canvas.get(0).getAttribute('width'),
            canvas.get(0).getAttribute('height'));
        var scale = (env.width > env.height ? env.height : env.width);
        env.particles = [
            Photon.create(
                env, scale * 0.05,
                Vector.create(Math.random() * env.width,
                              Math.random() * env.height),
                Vector.polar(1, Math.random() * 2 * Math.PI)),
            Photon.create(
                env, scale * 0.05,
                Vector.create(Math.random() * env.width,
                              Math.random() * env.height),
                Vector.polar(1, Math.random() * 2 * Math.PI)),
            Photon.create(
                env, scale * 0.05,
                Vector.create(Math.random() * env.width,
                              Math.random() * env.height),
                Vector.polar(1, Math.random() * 2 * Math.PI)),
            Electron.create(
                env, scale * 0.075,
                Vector.create(Math.random() * env.width,
                              Math.random() * env.height),
                Vector.polar(1, Math.random() * 2 * Math.PI))];

        var context = canvas.get(0).getContext('2d');
        var last = new Date().getTime();
        var update = function() {
            var now = new Date().getTime();
            var p, index;
            for (index = 0; index < env.particles.length; ++index)
                env.particles[index].update(now - last);
            last = now;
            
            context.clearRect(0, 0, env.width, env.height);
            context.font = '32px serif';
            context.fillStyle = 'red';
            //context.fillText("DEBUG ");
            for (index = 0; index < env.particles.length; ++index)
                env.particles[index].draw(context);
            requestAnimationFrame(update);
        };
        update();
    };

})(typeof exports === 'undefined'? this['quanta'] = {}: exports);
