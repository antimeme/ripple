// quanta.js
// Copyright (C) 2015-2017 by Jeff Gold.
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

    var planck  = 4.135667516e-15;
    var c = 1; // speed of light

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
                if (!multivec(this.particles[index].speed).zeroish())
                    return true;
            return false;
        },

        add: function(particle) { this.particles.push(particle); },

        make: function(particleType, config)
        { this.add(particleType.create(this, config)); },

        _move: function(delta) {
            var index, particle, velocity;

            for (index = 0; index < this.particles.length; ++index) {
                particle = this.particles[index];
                velocity = particle.direction.multiply(particle.speed);
                particle.position = particle.position.add(
                    velocity.multiply(delta));
            }
        },

        _bounds: function(particle) {
            var halfscale = particle.scale / 2;
            return {
                xmin: halfscale,
                xmax: this.width - halfscale,
                ymin: halfscale,
                ymax: this.height - halfscale,
            }
        },

        _particles: function(map, reduce, start) {
            // Calls the map function on each particle and then uses
            // the reduce function to construct a return value.  The
            // start parameter is optional and is used as the second
            // argument to reduce the first time map is called.
            var result = start;
            var index;

            for (index = 0; index < this.particles.length; ++index) {
                result = (reduce ? reduce: function(a, b)
                          { return a; })(
                    map.call(this, this.particles[index], index),
                    result);
            }
            return result;
        },

        _nextBounce: function(delta) {
            return this._particles(function(particle, index) {
                var xtime, ytime, time, dir;
                var bounds = this._bounds(particle);
                var velocity = particle.direction.multiply(
                    particle.speed);

                xtime = !multivec(velocity.x).zeroish() ?
                        (((velocity.x < 0) ? bounds.xmin : bounds.xmax) -
                         particle.position.x) / velocity.x : -1;
                ytime = !multivec(velocity.y).zeroish() ?
                        (((velocity.y < 0) ? bounds.ymin : bounds.ymax) -
                         particle.position.y) / velocity.y : -1;

                if ((xtime < 0 && ytime < 0) ||
                    (xtime > delta && ytime > delta)) {
                    return null;
                } else if (xtime >= 0 && ytime < 0) {
                    dir = "y";  time = ytime;
                } else if (ytime >= 0 && xtime < 0) {
                    dir = "x";  time = xtime;
                } else {
                    dir = (xtime < ytime) ? "x" : "y";
                }
                return {
                    time: time, particle: particle,
                    action: function() {
                        if (dir === 'x')
                            this.direction = this.direction.reflect(
                                {'y': 1});
                        else if (dir === 'y')
                            this.direction = this.direction.reflect(
                                {'x': 1});
                    }};
            }, function(current, best) {
                return !best ? current :
                    ((!current || (best.time <= current.time)) ?
                     best : current);
            });
        },

        update: function(delta) {
            var index, current = 0, processed = 0, event;
            var particle;

            while (processed < delta) {
                event = this._nextBounce(delta - processed);
                current = event ? event.time : (delta - processed);
                this._move(current);
                if (event)
                    event.action.call(event.particle, this);

                processed = current;
            }

            for (index = 0; index < this.particles.length; ++index) {
                particle = this.particles[index];
                if ((particle.position.x < particle.scale) ||
                    (particle.position.x > particle.scale) ||
                    (particle.position.y < particle.scale) ||
                    (particle.position.y > particle.scale)) {
                    // TODO: detect escapees
                }
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
        phase: Math.PI / 6,
        position: undefined,
        direction: undefined,
        speed: undefined,
        scale: undefined,
        _init: function(lab, config) { return this; },
        create: function(lab, config) {
            var result = Object.create(this);
            result.scale = config && config.scale ? config.scale :
                lab.scale * result.scaleFactor;
            result.position = multivec([
                Math.random() * (lab.width - result.scale) +
                result.scale / 2,
                Math.random() * (lab.height - result.scale) +
                result.scale / 2]);
            result.direction = (config && config.direction) ?
                               config.direction.normalize() :
                               multivec({theta: Math.random() *
                                   2 * Math.PI});
            result.phase = (config && config.phase) ?
                config.phase : Math.random() * 2 * Math.PI;
            if (result.mass === 0)
                result.speed = c;
            else result.speed = 0;
            return result._init(lab, config);
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
            var vs = this.direction.multiply(this.speed);
            var vo = other.direction.multiply(other.speed);
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

            return (!multivec(m).zeroish() ?
                    (Math.sqrt(n * n - m *
                        (q - radius * radius)) - n) / m : undefined);
        }
    };

    // A photon is a massless guage boson that mediates the
    // electromagnetic force.
    quanta.Photon = Object.create(Particle);
    quanta.Photon.spin = 1;
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

        this._rotrate = Math.log(freq) / (2000 * Math.log(10));
        this.freq = freq;
    };
    quanta.Photon._init = function(lab, config) {
        this.setFreq(config && config.freq ? config.freq :
                     this.spectrum[0].freq + Math.random() *
                     (this.spectrum[
                         this.spectrum.length - 1].freq -
                      this.spectrum[0].freq));
        return this;
    };
    quanta.Photon._update = function(delta, lab) {
        this.phase += delta * this._rotrate;
    };
    quanta.Photon._draw = function(context, lab) {
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
        context.save();
        context.translate(this.position.x, this.position.y);
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

        context.beginPath();
        context.rotate(this.phase);
        context.moveTo(0, -this.scale / 2);
        context.arc(0, -this.scale / 2, this.scale / 10, 0, 2 * Math.PI);
        context.fillStyle = 'lightgrey';
        context.fill();

        context.restore();
    };

    quanta.go = function($, container, viewport) {
        // Query Parameters
        var nphotons = Math.max(0, parseInt(
            window.params['nphotons'] || 3, 10));
        var center = window.params['center'] || 'center';
        c = Math.max(0.01, parseFloat(window.params['customc'] || 1.0));

        // Settings
        var index, lab = null;
        var canvas = $('<canvas class="' + center +
                       '"></canvas>').appendTo(container);
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
        };
        var resize = function() {
            var width = viewport.innerWidth();
            var height = viewport.innerHeight();
            if (width > height)
                width = height;
            else if (height > width)
                height = width;
            canvas.attr('width', width);
            canvas.attr('height', height);
            requestAnimationFrame(update);
        };
        resize();
        viewport.resize(resize);
        canvas.on('click', function(event) {
            console.log(lab.active());
        });

        lab = quanta.Laboratory.create(
            canvas.attr('width'), canvas.attr('height'));
        for (index = 0; index < nphotons; ++index)
            lab.make(quanta.Photon);
        lab.make(quanta.Photon, {freq: 10000});
        lab.make(quanta.Photon, {freq: Math.pow(10, 18)});
        lab.make(quanta.Electron);
    };

})(typeof exports === 'undefined'? this['quanta'] = {}: exports);
