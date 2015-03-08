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
// Note that particles always have an exact position and momentum,
// which would violate the Heisenburg Uncertainty Principle in
// reality.  However, there's no obvious way to display an electron
// with uncertain position and momentum so to make the visualization
// understandable we dispense with some realism.
(function(exports) {
    "use strict";

    var Vector = {
        create: function(x, y) {
            // Creates and returns a vector using Cartesian coordinates
            var result = Object.create(this);
            result.x = x;
            result.y = y;
            return result;
        },
        polar: function(r, theta) {
            // Creates and returns a vector using polar coordinates
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
        times: function(value)
        { return this.create(this.x * value, this.y * value); },
        dotp: function(other)
        { return this.x * other.x + this.y * other.y; },
        norm: function() {
            var m = Math.sqrt(this.dotp(this));
            return this.create(this.x / m, this.y / m);
        }
    };

    var Environment = {
        planck: 4.135667516 / Math.pow(10, 15),

        particles: undefined,
        create: function(width, height) {
            var result = Object.create(this);
            result.particles = [];
            result.width = width;
            result.height = height;
            result.scale = (width > height ? height : width);
            return result;
        },
        add: function(particle) {
            this.particles.push(particle);
        },
        make: function(particleType, config) {
            this.add(particleType.create(this, config));
        },
        _collect: function(events) {
            var index, particle, velocity, time;
            var xmin, xmax, ymin, ymax;
            for (index = 0; index < this.particles.length; ++index) {
                particle = this.particles[index];
                xmin = particle.scale / 2;
                xmax = this.width - xmin;
                ymin = particle.scale / 2;
                ymax = this.height - ymin;
                velocity = particle.direction.times(particle.speed);

                time = -1;
                if (velocity.x < 0)
                    time = (xmin - particle.position.x) / velocity.x;
                else if (velocity.x > 0)
                    time = (xmax - particle.position.x) / velocity.x;
                if (time >= 0)
                    events.push({
                        time: time, particle: particle,
                        action: function() {
                            this.direction.x = -this.direction.x;
                            return {};
                        }});

                time = -1;
                if (velocity.y < 0)
                    time = (ymin - particle.position.y) / velocity.y;
                else if (velocity.y > 0)
                    time = (ymax - particle.position.y) / velocity.y;
                if (time >= 0)
                    events.push({
                        time: time, particle: particle,
                        action: function() {
                            this.direction.y = -this.direction.y; }});
            }
            events.sort(function(a, b) { return a.time - b.time; });
            return events;
        },
        _move: function(delta) {
            var index, particle, velocity, oldpos;
            var xmin, xmax, ymin, ymax;

            for (index = 0; index < this.particles.length;
                 ++index) {
                particle = this.particles[index];
                velocity = particle.direction.times(particle.speed);
                particle.position = particle.position.plus(
                    velocity.times(delta));
            }
        },
        update: function(delta) {
            var index, current = 0, processed = 0, event, events;
            events = this._collect([]);

            while (processed < delta) {
                event = null;
                if ((events.length > 0) && (events[0].time <= delta)) {
                    event = events.shift();
                    current = event.time;
                } else current = delta;

                this._move(current - processed);
                if (event)
                    event.action.call(event.particle, this);
                processed = current;
                current = 0;
            }

            for (index = 0; index < this.particles.length; ++index)
                this.particles[index].update(delta, this);
        },
        draw: function(context) {
            var index;
            for (index = 0; index < this.particles.length; ++index)
                this.particles[index].draw(context, this);
        }
    };

    var Particle = {
        // Abstraction to describe both fundamental and composite
        // particles such as electrons, photons, quarks, protons,
        // neutrons and even entire atoms.  Use this by calling
        // Object.create(Particle) and using the return value as a new
        // class.  Call the .create() method of the result to create
        // instances of the new particle type.
        mass: 0 /* Given in eV/c^2 */,
        spin: 0,
        eCharge: 0,
        cCharge: 'w',
        scaleFactor: 0.05,
        absorbed: false,
        position: undefined,
        direction: undefined,
        speed: undefined,
        scale: undefined,
        _init: function(env, config) {
            this.scale = config && config.scale ? config.scale :
                env.scale * this.scaleFactor;
            this.position = Vector.create(
                    Math.random() * (env.width - this.scale) +
                    this.scale / 2,
                    Math.random() * (env.height - this.scale) +
                    this.scale / 2);
            this.direction = (config && config.direction) ?
                direction.norm() :
                Vector.polar(1, Math.random() * 2 * Math.PI);
            if (this.mass === 0)
                this.speed = 1;
            else this.speed = 0;
            return this;
        },
        create: function(env, config) {
            return Object.create(this)._init(env, config);
        },
        _update: function(delta, env) {},
        update: function(delta, env)
        { return this._update(delta, env); },
        _draw: function(context) {},
        draw: function(context) {
            this._draw(context);
        },
    };

    // A photon is a massless guage boson that mediates the
    // electromagnetic force.
    var Photon = Object.create(Particle);
    Photon.spin = 1;
    Photon.phase = Math.PI / 6;
    Photon.spectrum = [
        {name: 'red',    freq: 442 * Math.pow(10, 12),
         color: {r: 255, g: 128, b: 128}},
        {name: 'orange', freq: 496 * Math.pow(10, 12),
         color: {r: 255, g: 192, b: 128}},
        {name: 'yellow', freq: 517 * Math.pow(10, 12),
         color: {r: 255, g: 255, b: 128}},
        {name: 'green',  freq: 566 * Math.pow(10, 12),
         color: {r: 128, g: 255, b: 128}},
        {name: 'blue',   freq: 637 * Math.pow(10, 12),
         color: {r: 128, g: 128, b: 255}},
        {name: 'violet', freq: 728.5 * Math.pow(10, 12),
         color: {r: 255, g: 128, b: 255}}];
    Photon.setFreq = function(freq) {
        var fraction;
        var index, current = null, low = null, high = null;
        for (index = 0; index < this.spectrum.length; ++index) {
            low = current;
            current = this.spectrum[index];
            high = current;
            if (freq <= current.freq)
                break;
            high = null;
        }

        var _lerp = function(low, high, i, f) {
            return Math.floor(low.color[i] + f *
                              (high.color[i] - low.color[i]));
        };
        this._color = 'white';
        if (low !== null && high !== null) { // visible
            fraction = (freq - low.freq) / (high.freq - low.freq);
            this._color = 'rgb(' + _lerp(low, high, 'r', fraction) +
                ',' + _lerp(low, high, 'g', fraction) + ',' +
                _lerp(low, high, 'b', fraction) + ')';
        } else if (low === null && high !== null) { // infra
        } else if (low !== null && high === null) { // ultra
        }

        this._speed = Math.log(freq) / (1000 * Math.log(10));
        this.freq = freq;
    };
    Photon.create = function(env, config) {
        var result = Object.create(this);
        result._init(env, config);

        result.setFreq(config && config.freq ? config.freq :
                       result.spectrum[0].freq + Math.random() *
                       (result.spectrum[
                           result.spectrum.length - 1].freq -
                        result.spectrum[0].freq));
        return result;
    };
    Photon._update = function(delta, env) {
        this.phase += delta * this._speed;
    };
    Photon._draw = function(context, env) {
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
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    // An electron is the most stable charged lepton.
    var Electron = Object.create(Particle);
    Electron.mass = 510998.910;
    Electron.spin = 0.5;
    Electron.eCharge = -1;
    Electron.scaleFactor *= 1.1;
    Electron._draw = function(context) {
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
    };

    exports.go = function($, container) {
        var quanta = exports;
        var nphotons = Math.max(0, parseInt(
            window.params['nphotons'], 10) || 3);

        // Resize canvas to consume most of the screen
        var canvas = $('<canvas></canvas>').appendTo(container);
        canvas.get(0).setAttribute('width', window.innerWidth);
        canvas.get(0).setAttribute('height', window.innerHeight);
        var env = Environment.create(
            canvas.get(0).getAttribute('width'),
            canvas.get(0).getAttribute('height'));
        var index;
        for (index = 0; index < nphotons; ++index)
            env.make(Photon);
        //env.make(Photon, {freq: 10000});
        //env.make(Photon, {freq: Math.pow(10, 18)});
        env.make(Electron);

        var context = canvas.get(0).getContext('2d');
        var last = new Date().getTime();
        var update = function() {
            var now = new Date().getTime();
            env.update(now - last);
            last = now;
            
            context.clearRect(0, 0, env.width, env.height);
            env.draw(context);

            context.font = Math.floor(env.scale / 40) + 'px serif';
            context.fillStyle = 'red';
            context.fillText("DEBUG", 15, env.height - 15);

            requestAnimationFrame(update);
        };
        update();
    };

})(typeof exports === 'undefined'? this['quanta'] = {}: exports);
