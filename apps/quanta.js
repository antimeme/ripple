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
(function(quanta) {
    "use strict";

    var epsilon = 0.000001;
    var planck  = 4.135667516e-15;

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
        },
        reflect: function(target) {
            // r = d - ((2 d . n) / (n . n)) n
            return (this.dotp(this) > epsilon) ?
                target.minus(this.times(2 * this.dotp(target) /
                                        this.dotp(this))) : target;
        },
        draw: function(context, center, config) {
            context.save();
            context.beginPath();
            context.translate(center.x, center.y);
            context.moveTo(0, 0);
            context.lineTo(this.x, this.y);
            context.lineWidth = (config && config.lineWidth) || 5;
            context.strokeStyle = (config && config.color) || 'white';
            context.stroke();
            context.closePath();
            context.restore();
        }
    };

    quanta.Laboratory = {
        particles: undefined,
        create: function(width, height) {
            var result = Object.create(this);
            result.particles = [];
            result.resize(width, height);
            return result;
        },
        resize: function(width, height) {
            var index;
            this.width = width;
            this.height = height;
            this.scale = (width > height ? height : width);
            for (index = 0; index < this.particles.length; ++index)
                this.particles[index].scale = (
                    this.particles[index].scaleFactor * this.scale);
        },
        active: function() {
            // Returns true iff there is continuing activity in the lab.
            var index;
            for (index = 0; index < this.particles.length; ++index)
                if (this.particles[index].speed > 0)
                    return true;
            return false;
        },
        add: function(particle) { this.particles.push(particle); },
        make: function(particleType, config)
        { this.add(particleType.create(this, config)); },
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
        _init: function(lab, config) {
            this.scale = config && config.scale ? config.scale :
                lab.scale * this.scaleFactor;
            this.position = Vector.create(
                    Math.random() * (lab.width - this.scale) +
                    this.scale / 2,
                    Math.random() * (lab.height - this.scale) +
                    this.scale / 2);
            this.direction = (config && config.direction) ?
                direction.norm() :
                Vector.polar(1, Math.random() * 2 * Math.PI);
            if (this.mass === 0)
                this.speed = 1;
            else this.speed = 0;
            return this;
        },
        create: function(lab, config) {
            return Object.create(this)._init(lab, config);
        },
        _update: function(delta, lab) {},
        update: function(delta, lab)
        { return this._update(delta, lab); },
        _draw: function(context) {},
        draw: function(context) { this._draw(context); },
        brush: function(other, radius) {
            // This is an experimental function intended to determine
            // the time at which two moving objects will brush up
            // against one another.  The radius should be the sum of
            // the radii of the two objects.
            var vs = this.direction.times(this.speed);
            var vo = other.direction.times(other.speed);
            var m = ((vs.x - vo.x) * (vs.x - vo.x) +
                     (vs.x - vo.y) * (vs.x - vo.y));
            var n = ((this.position.x - other.position.x) *
                     (this.position.x - other.position.x) *
                     (vs.x - vo.x) * (vs.x - vo.x) +
                     (this.position.y - other.position.y) *
                     (this.position.y - other.position.y) *
                     (vs.y - vo.y) * (vs.y - vo.y));
            var q = ((this.position.x - other.position.x) *
                     (this.position.x - other.position.x) +
                     (this.position.y - other.position.y) *
                     (this.position.y - other.position.y));

            return ((Math.abs(m) > epsilon) ?
                    (Math.sqrt(n * n - m *
                               (q - radius * radius)) - n) / m :
                    undefined);
        }
    };

    // A photon is a massless guage boson that mediates the
    // electromagnetic force.
    quanta.Photon = Object.create(Particle);
    quanta.Photon.spin = 1;
    quanta.Photon.phase = Math.PI / 6;
    quanta.Photon.spectrum = [
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
    quanta.Photon.setFreq = function(freq) {
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
    quanta.Photon.create = function(lab, config) {
        var result = Object.create(this);
        result._init(lab, config);

        result.setFreq(config && config.freq ? config.freq :
                       result.spectrum[0].freq + Math.random() *
                       (result.spectrum[
                           result.spectrum.length - 1].freq -
                        result.spectrum[0].freq));
        return result;
    };
    quanta.Photon._update = function(delta, lab) {
        this.phase += delta * this._speed;
    };
    quanta.Photon._draw = function(context, lab) {
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
    quanta.Electron = Object.create(Particle);
    quanta.Electron.mass = 510998.910;
    quanta.Electron.spin = 0.5;
    quanta.Electron.eCharge = -1;
    quanta.Electron.scaleFactor *= 1.1;
    quanta.Electron._draw = function(context) {
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

    quanta.go = function($, container, viewport) {
        var nphotons = Math.max(0, parseInt(
            window.params['nphotons'] || 3, 10));
        var index, lab = null;
        var canvas = $('<canvas></canvas>').appendTo(container);
        var context = canvas.get(0).getContext('2d');
        var last = new Date().getTime();
        var update = function() {
            var now = new Date().getTime();
            lab.update(Math.min(5000, now - last));
            last = now;

            context.clearRect(0, 0, canvas.attr('width'),
                              canvas.attr('height'));
            lab.resize(canvas.attr('width'), canvas.attr('height'));
            lab.draw(context);
            if (lab.active())
                requestAnimationFrame(update);

            // var center = Vector.create(canvas.attr('width') / 2,
            //                            canvas.attr('height') / 2);
            // var d = Vector.create(250, 250);
            // var axis = Vector.create(-50, 0);
            // var r = axis.reflect(d);
            // d.draw(context, center, {color: 'green'});
            // axis.draw(context, center, {color: 'blue'});
            // r.draw(context, center, {color: 'red'});
        };
        var resize = function() {
            canvas.attr('width', viewport.innerWidth());
            canvas.attr('height', viewport.innerHeight());
            requestAnimationFrame(update);
        };
        resize();
        viewport.resize(resize);

        lab = quanta.Laboratory.create(
            canvas.attr('width'), canvas.attr('height'));
        for (index = 0; index < nphotons; ++index)
            lab.make(quanta.Photon);
        //lab.make(quanta.Photon, {freq: 10000});
        //lab.make(quanta.Photon, {freq: Math.pow(10, 18)});
        lab.make(quanta.Electron);
    };

})(typeof exports === 'undefined'? this['quanta'] = {}: exports);
