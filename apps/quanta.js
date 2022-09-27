// quanta.js
// Copyright (C) 2015-2022 by Jeff Gold.
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
// A particle physics playground.
//
// Note that particles always have an exact position and momentum,
// which would violate the Heisenburg Uncertainty Principle in
// reality.  However, there's no obvious way to display an electron
// with uncertain position and momentum so to make the visualization
// understandable we dispense with some realism.
//
// Actual speed of light is approximately 299,792,458 m/s but here
// we use 1 as in a space-time diagram.
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
            this.size = Math.min(width, height);
            for (index = 0; index < this.particles.length; ++index)
                this.particles[index].size = (
                    this.particles[index].scaleFactor * this.size);
        },

        add: function(particle) { this.particles.push(particle); },

        _move: function(delta) {
            var index, particle, velocity;

            for (index = 0; index < this.particles.length; ++index) {
                particle = this.particles[index];
                velocity = particle.direction.multiply(
                    particle.speed, 0.25);
                particle.position = particle.position.add(
                    velocity.multiply(delta));
            }
        },

        _bounds: function(particle) {
            var halfsize = particle.size / 2;
            return {
                xmin: halfsize,
                xmax: this.width - halfsize,
                ymin: halfsize,
                ymax: this.height - halfsize,
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
                if ((particle.position.x < particle.size) ||
                    (particle.position.x > particle.size) ||
                    (particle.position.y < particle.size) ||
                    (particle.position.y > particle.size)) {
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
        },

        setup: function(mode, config) {
            if (mode === "key") {
                var rows = 7;
                var cols = 4;
                var row, col;

                row = col = 0;
                this.add(quanta.Electron.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Muon.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Tau.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Neutrino.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.MuonNeutrino.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.TauNeutrino.create(this, {
                    label: true, position: {
                        x: 1/cols, y: ++row/rows}}));

                row = 0;
                this.add(quanta.UpQuark.create(this, {
                    label: true, cCharge: 0,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.DownQuark.create(this, {
                    label: true,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.CharmQuark.create(this, {
                    label: true, cCharge: 1,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.StrangeQuark.create(this, {
                    label: true,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.TopQuark.create(this, {
                    label: true, cCharge: 2,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.BottomQuark.create(this, {
                    label: true,
                    position: {x: 2/cols, y: ++row/rows}}));

                row = 0;
                this.add(quanta.Photon.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
                this.add(quanta.Gluon.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
                this.add(quanta.ZBoson.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
                this.add(quanta.WPlusBoson.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
                this.add(quanta.WMinusBoson.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
                this.add(quanta.HiggsBoson.create(this, {
                    label: true, position: {
                        x: 3/cols, y: ++row/rows}}));
            } else if (mode === "proton") {
                var index;
                var colors = [0, 1, 2];
                var quarks = [quanta.UpQuark, quanta.UpQuark,
                              quanta.DownQuark];

                ripple.shuffle(colors);
                ripple.shuffle(quarks);

                this.add(quarks[0].create(this, {
                    cCharge: colors[0], position: {x: 1/2, y: 1/3}}));
                this.add(quarks[1].create(this, {
                    cCharge: colors[1], position: {x: 1/3, y: 2/3}}));
                this.add(quarks[2].create(this, {
                    cCharge: colors[2], position: {x: 2/3, y: 2/3}}));
            } else {
                var index;
                var nphotons = (config && !isNaN(config.nphotons)) ?
                               config.nphotons : 0;
                var ngluons = (config && !isNaN(config.nphotons)) ?
                              config.nphotons : 0;

                for (index = 0; index < nphotons; ++index)
                    this.add(quanta.Photon.create(this));
                for (index = 0; index < ngluons; ++index)
                    this.add(quanta.Gluon.create(this));
                this.add(quanta.Photon.create(this, {freq: 10000}));
                this.add(quanta.Photon.create(
                    this, {freq: Math.pow(10, 18)}));

                this.add(quanta.Electron.create(this));
                this.add(quanta.Neutrino.create(this));
                this.add(quanta.UpQuark.create(this));
                this.add(quanta.DownQuark.create(this));
            }
        },
    };

    var Particle = {
        // Abstraction to describe both fundamental and composite
        // particles such as electrons, photons, quarks, protons,
        // neutrons and even entire atoms.  Use this by calling
        // Object.create(Particle) and using the return value as a new
        // class.  Call the .create() method of the result to create
        // instances of the new particle type.
        mass: 0 /* Given in eV/c^2 */,
        spin: 0 /* Fermions half-integer, bosons integer */,
        eCharge: 0 /* -1, 0 or +1 */,
        cCharge: undefined,
        cCharges: ["#e66", "#6e6", "#aaf", "#6ee", "#e6e", "#ee6"],
        scaleFactor: 0.05,
        phase: Math.PI / 6,
        position: undefined,
        direction: undefined,
        speed: undefined,
        size: undefined,
        _name: "Particle",
        _label: undefined,
        _rotate: 0,
        _init: function(lab, config) { return this; },

        create: function(lab, config) {
            var result = Object.create(this);
            result.size = (config && config.size) ?
                          config.size :
                          lab.size * result.scaleFactor;

            if (config && config.label)
                result._label = true;

            if (config && config.position) {
                result.position = multivec(
                    config.position).times(lab.size);
            } else result.position = multivec([
                Math.random() * (lab.width - result.size) +
                result.size / 2,
                Math.random() * (lab.height - result.size) +
                result.size / 2]);

            result.direction = (config && config.direction) ?
                               config.direction.normalize() :
                               multivec({theta: Math.random() *
                                   2 * Math.PI});
            result.phase = (config && config.phase) ?
                           config.phase : Math.random() * 2 * Math.PI;
            if (!result._label && result.mass === 0)
                result.speed = c;
            else result.speed = 0;

            result._init(lab, config);
            return result;
        },

        _update: function(delta, lab) {
            if (!isNaN(this._rotate))
                this.phase += delta * this._rotate;
        },

        update: function(delta, lab)
        { return this._update(delta, lab); },

        _draw: function(context) {},

        draw: function(context) {
            this._draw(context);
            if (this._label) {
                context.font = Math.floor(
                    this.size * 17/32) + "px sans-serif";
                context.fillStyle = "#eee";
                context.fillText(
                    this._name,
                    this.position.x + 2 * this.size / 3,
                    this.position.y + this.size / 6);
            }
        },

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
        },

        randomCCharge: function(config) {
            return ((config && config.anti) ? 3 : 0) +
                   Math.floor(Math.random() * 3);
        },
    };

    // An electron is the most stable lepton and has a unit negative
    // electrical charge.
    quanta.Electron = Object.create(Particle);
    quanta.Electron.mass = 510998.910;
    quanta.Electron.spin = 0.5;
    quanta.Electron.eCharge = -1;
    quanta.Electron.scaleFactor *= 1.1;
    quanta.Electron._name = "Electron";
    quanta.Electron._background = "#444";
    quanta.Electron._rotate = 0.001;
    quanta.Electron._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(-1 / 4, 0);
        context.lineTo(1 / 4, 0);
        context.lineWidth = 1 / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = 'lightgrey';
        context.stroke();

        context.restore();
    };

    // A muon is the second generation lepton that decays quickly
    // into an electron.
    quanta.Muon = Object.create(quanta.Electron);
    quanta.Muon.mass = 105660000;
    quanta.Muon._name = "Muon";
    quanta.Muon._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(-1 / 4, 1 / 8);
        context.lineTo(1 / 4, 1 / 8);
        context.moveTo(-1 / 4, -1 / 8);
        context.lineTo(1 / 4, -1 / 8);
        context.lineWidth = 1 / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = 'lightgrey';
        context.stroke();

        context.restore();
    };

    // A muon is the second generation lepton that decays quickly
    // into an electron.
    quanta.Tau = Object.create(quanta.Electron);
    quanta.Tau.mass = 1776800000;
    quanta.Tau._name = "Tau";
    quanta.Tau._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.moveTo(-this.size / 4, this.size / 6);
        context.lineTo(this.size / 4, this.size / 6);
        context.moveTo(-this.size / 4, 0);
        context.lineTo(this.size / 4, 0);
        context.moveTo(-this.size / 4, -this.size / 6);
        context.lineTo(this.size / 4, -this.size / 6);
        context.lineWidth = this.size / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = 'lightgrey';
        context.stroke();

        context.restore();
    };

    // A neutrino is a mysterious and almost massless particle that
    // carries the weak nuclear force.
    quanta.Neutrino = Object.create(Particle);
    quanta.Neutrino.mass = 0.1;
    quanta.Neutrino.spin = 0.5;
    quanta.Neutrino.eCharge = 0;
    quanta.Neutrino.scaleFactor *= 1.1;
    quanta.Neutrino._name = "Neutrino";
    quanta.Neutrino._foreground = "#333";
    quanta.Neutrino._background = "#aaa";
    quanta.Neutrino._rotate = 0.001;
    quanta.Neutrino._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.moveTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineTo(this.size / 3 * Math.cos(Math.PI / 2),
                       this.size / 3 * Math.sin(Math.PI / 2));
        context.lineTo(this.size / 3 * Math.cos(Math.PI),
                       this.size / 3 * Math.sin(Math.PI));
        context.lineTo(this.size / 3 * Math.cos(Math.PI * 3 / 2),
                       this.size / 3 * Math.sin(Math.PI * 3 / 2));
        context.lineTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineWidth = this.size / 20;

        context.lineCap = 'round';
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this._foreground;
        context.stroke();

        context.restore();
    };

    quanta.MuonNeutrino = Object.create(quanta.Neutrino);
    quanta.MuonNeutrino.mass = 170000;
    quanta.MuonNeutrino._name = "Muon Neutrino";
    quanta.MuonNeutrino._rotate = 0.001;
    quanta.MuonNeutrino._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.moveTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineTo(this.size / 3 * Math.cos(Math.PI / 2),
                       this.size / 3 * Math.sin(Math.PI / 2));
        context.lineTo(this.size / 3 * Math.cos(Math.PI),
                       this.size / 3 * Math.sin(Math.PI));
        context.lineTo(this.size / 3 * Math.cos(Math.PI * 3 / 2),
                       this.size / 3 * Math.sin(Math.PI * 3 / 2));
        context.lineTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineTo(this.size / 3 * Math.cos(Math.PI),
                       this.size / 3 * Math.sin(Math.PI));
        context.lineWidth = this.size / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this._foreground;
        context.stroke();

        context.restore();
    };

    quanta.TauNeutrino = Object.create(quanta.Neutrino);
    quanta.TauNeutrino.mass = 18200000;
    quanta.TauNeutrino._name = "Tau Neutrino";
    quanta.TauNeutrino._rotate = 0.001;
    quanta.TauNeutrino._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.moveTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineTo(this.size / 3 * Math.cos(Math.PI / 2),
                       this.size / 3 * Math.sin(Math.PI / 2));
        context.lineTo(this.size / 3 * Math.cos(Math.PI),
                       this.size / 3 * Math.sin(Math.PI));
        context.lineTo(this.size / 3 * Math.cos(Math.PI * 3 / 2),
                       this.size / 3 * Math.sin(Math.PI * 3 / 2));
        context.lineTo(this.size / 3 * Math.cos(0),
                       this.size / 3 * Math.sin(0));
        context.lineTo(this.size / 3 * Math.cos(Math.PI),
                       this.size / 3 * Math.sin(Math.PI));
        context.moveTo(this.size / 3 * Math.cos(Math.PI / 2),
                       this.size / 3 * Math.sin(Math.PI / 2));
        context.lineTo(this.size / 3 * Math.cos(Math.PI * 3 / 2),
                       this.size / 3 * Math.sin(Math.PI * 3 / 2));
        context.lineWidth = this.size / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this._foreground;
        context.stroke();

        context.restore();
    };

    quanta.UpQuark = Object.create(Particle);
    quanta.UpQuark.mass = 2200000;
    quanta.UpQuark.spin = 0.5;
    quanta.UpQuark.eCharge = 2/3;
    quanta.UpQuark.cCharge = undefined;
    quanta.UpQuark.scaleFactor *= 1.1;
    quanta.UpQuark._name = "Up Quark";
    quanta.UpQuark._rotate = 0.001;
    quanta.UpQuark._background = "#666";
    quanta.UpQuark._init = function(lab, config) {
        if (config && !isNaN(config.cCharge) &&
            (config.cCharge >= 0) &&
            (config.cCharge < this.cCharges.length))
            this.cCharge = Math.floor(config.cCharge);
        if (isNaN(this.cCharge))
            this.cCharge = this.randomCCharge();
    };
    quanta.UpQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.moveTo(0, -1 / 3);
        context.lineTo(0, 1 / 3);
        context.lineWidth = 1 / 20;

        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    quanta.CharmQuark = Object.create(quanta.UpQuark);
    quanta.CharmQuark.mass = 2200000;
    quanta.CharmQuark._name = "Charm Quark";
    quanta.CharmQuark._rotate = 0.001;
    quanta.CharmQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.moveTo(1 / 3 / 3, 1 / 3 * 2 / 3);
        context.lineTo(1 / 3 / 3, -1 / 3 * 2 / 3);
        context.moveTo(-1 / 3 / 3, 1 / 3 * 2 / 3);
        context.lineTo(-1 / 3 / 3, -1 / 3 * 2 / 3);
        context.lineWidth = 1 / 20;

        context.lineCap = 'round';
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    quanta.TopQuark = Object.create(quanta.UpQuark);
    quanta.TopQuark.mass = 2200000;
    quanta.TopQuark._name = "Top Quark";
    quanta.TopQuark._rotate = 0.001;
    quanta.TopQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.moveTo(0, 1 / 3);
        context.lineTo(0, -1 / 3);
        context.moveTo(1 / 6, 1 / 6);
        context.lineTo(1 / 6, -1 / 6);
        context.moveTo(-1 / 6, 1 / 6);
        context.lineTo(-1 / 6, -1 / 6);
        context.lineWidth = 1 / 20;

        context.lineCap = 'round';
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    quanta.DownQuark = Object.create(Particle);
    quanta.DownQuark.mass = 2200000;
    quanta.DownQuark.spin = 0.5;
    quanta.DownQuark.eCharge = -1/3;
    quanta.DownQuark.cCharge = undefined;
    quanta.DownQuark.scaleFactor *= 1.1;
    quanta.DownQuark._name = "Down Quark";
    quanta.DownQuark._background = "#666";
    quanta.DownQuark._rotate = 0.001;
    quanta.DownQuark._init = function(lab, config) {
        if (config && !isNaN(config.cCharge) &&
            (config.cCharge >= 0) &&
            (config.cCharge < this.cCharges.length))
            this.cCharge = Math.floor(config.cCharge);
        if (isNaN(this.cCharge))
            this.cCharge = this.randomCCharge();
    };
    quanta.DownQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.moveTo(1 / 6, -1/6);
        context.lineTo(-1 / 6, -1/6);

        context.lineWidth = 1 / 20;
        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    quanta.StrangeQuark = Object.create(quanta.DownQuark);
    quanta.StrangeQuark.mass = 2200000;
    quanta.StrangeQuark._name = "Strange Quark";
    quanta.StrangeQuark._rotate = 0.001;
    quanta.StrangeQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.moveTo(1 / 6, -1/6);
        context.lineTo(-1 / 6, -1/6);
        context.moveTo(1 / 6, 1/6);
        context.lineTo(-1 / 6, 1/6);

        context.lineWidth = 1 / 20;
        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    quanta.BottomQuark = Object.create(quanta.DownQuark);
    quanta.BottomQuark.mass = 2200000;
    quanta.BottomQuark._name = "Bottom Quark";
    quanta.BottomQuark._rotate = 0.001;
    quanta.BottomQuark._draw = function(context) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 3, 0);
        context.lineTo(0, 1 / 3);
        context.lineTo(-1 / 3, 0);
        context.lineTo(1 / 3, 0);
        context.moveTo(1 / 6, -1/6);
        context.lineTo(-1 / 6, -1/6);
        context.moveTo(1 / 6, 1/6);
        context.lineTo(-1 / 6, 1/6);

        context.lineWidth = 1 / 20;
        context.lineCap = "round";
        context.fillStyle = this._background;
        context.fill();
        context.strokeStyle = this.cCharges[this.cCharge];
        context.stroke();
        context.restore();
    };

    // A photon is a massless guage boson that mediates the
    // electromagnetic force.
    quanta.Photon = Object.create(Particle);
    quanta.Photon.mass = 0;
    quanta.Photon.spin = 1;
    quanta.Photon._name = "Photon";
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

        this._rotate = Math.log(freq) / (2000 * Math.log(10));
        this.freq = freq;
    };
    quanta.Photon._init = function(lab, config) {
        this.setFreq(config && config.freq ? config.freq :
                     this.spectrum[0].freq + Math.random() *
            (this.spectrum[
                this.spectrum.length - 1].freq -
             this.spectrum[0].freq));
    };
    quanta.Photon._draw = function(context, lab) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.lineWidth = this.size / 25;
        context.lineCap = 'round';

        context.beginPath();
        context.moveTo(0, -this.size / 2);
        context.bezierCurveTo(
                -this.size / 2, this.size / 5,
            this.size / 2, -this.size / 5,
            0, this.size / 2);
        context.strokeStyle = "#eee";
        context.stroke();

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    quanta.Gluon = Object.create(Particle);
    quanta.Gluon.mass = 0;
    quanta.Gluon.spin = 1;
    quanta.Gluon.eCharge = -1;
    quanta.Gluon.scaleFactor *= 1;
    quanta.Gluon._name = "Gluon";
    quanta.Gluon._colorMatter = undefined;
    quanta.Gluon._colorAnti   = undefined;
    quanta.Gluon._rotate = 0.005;
    quanta.Gluon._draw = function(context, lab) {
        if (isNaN(this._colorMatter))
            this._colorMatter = this.randomCCharge();
        if (isNaN(this._colorAnti))
            this._colorAnti = this.randomCCharge({anti: true});

        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.lineWidth = this.size / 25;
        context.lineCap = 'round';

        context.beginPath();
        context.moveTo(this.size / 2 * Math.cos(Math.PI / 3),
                       this.size / 2 * Math.sin(Math.PI / 3));
        context.bezierCurveTo(
            this.size / 2 * Math.cos(Math.PI),
            this.size / 2 * Math.sin(Math.PI),
            this.size / 2 * Math.cos(0),
            this.size / 2 * Math.sin(0),
            this.size / 2 * Math.cos(-Math.PI / 3),
            this.size / 2 * Math.sin(-Math.PI / 3));
        context.strokeStyle = this.cCharges[this._colorMatter];
        context.stroke();

        context.beginPath();
        context.moveTo(this.size / 2 * Math.cos(Math.PI * 2 / 3),
                       this.size / 2 * Math.sin(Math.PI * 2 / 3));
        context.bezierCurveTo(
            this.size / 2 * Math.cos(Math.PI),
            this.size / 2 * Math.sin(Math.PI),
            this.size / 2 * Math.cos(0),
            this.size / 2 * Math.sin(0),
            this.size / 2 * Math.cos(-Math.PI * 2 / 3),
            this.size / 2 * Math.sin(-Math.PI * 2 / 3));
        context.strokeStyle = this.cCharges[this._colorAnti];
        context.stroke();

        context.beginPath();
        context.moveTo(this.size / 2, 0);
        context.arc(0, 0, this.size / 2, 0, 2 * Math.PI);
        context.strokeStyle = "#eee";
        context.stroke();
        context.restore();
    };

    quanta.WPlusBoson = Object.create(Particle);
    quanta.WPlusBoson.mass = 80.433e9;
    quanta.WPlusBoson.spin = 1;
    quanta.WPlusBoson.eCharge = -1;
    quanta.WPlusBoson.scaleFactor *= 1;
    quanta.WPlusBoson._name = "W+ Boson";
    quanta.WPlusBoson._color = 'white';
    quanta.WPlusBoson._rotate = 0.001;
    quanta.WPlusBoson._draw = function(context, lab) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 2 * Math.cos(Math.PI / 4),
                       1 / 2 * Math.sin(Math.PI / 4));
        context.lineTo(1 / 2 * Math.cos(-Math.PI / 3),
                       1 / 2 * Math.sin(-Math.PI / 3));
        context.lineTo(1 / 5 * Math.cos(-Math.PI / 2),
                       1 / 5 * Math.sin(-Math.PI / 2));
        context.lineTo(1 / 2 * Math.cos(-Math.PI * 2 / 3),
                       1 / 2 * Math.sin(-Math.PI * 2 / 3));
        context.lineTo(1 / 2 * Math.cos(Math.PI * 3 / 4),
                       1 / 2 * Math.sin(Math.PI * 3 / 4));

        context.moveTo(1 / 7 * Math.cos(Math.PI / 2) - 1 / 7,
                       1 / 7 * Math.sin(Math.PI / 2));
        context.lineTo(1 / 7 * Math.cos(Math.PI / 2) + 1 / 7,
                       1 / 7 * Math.sin(Math.PI / 2));
        context.moveTo(1 / 7 * Math.cos(Math.PI / 2),
                       1 / 7 * Math.sin(Math.PI / 2) - 1 / 7);
        context.lineTo(1 / 7 * Math.cos(Math.PI / 2),
                       1 / 7 * Math.sin(Math.PI / 2) + 1 / 7);
        context.lineWidth = 1 / 25;
        context.lineCap = 'round';
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    quanta.WMinusBoson = Object.create(Particle);
    quanta.WMinusBoson.mass = 80.433e9;
    quanta.WMinusBoson.spin = 1;
    quanta.WMinusBoson.eCharge = -1;
    quanta.WMinusBoson.scaleFactor *= 1;
    quanta.WMinusBoson._name = "W- Boson";
    quanta.WMinusBoson._color = 'white';
    quanta.WMinusBoson._rotate = 0.001;
    quanta.WMinusBoson._draw = function(context, lab) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 2 * Math.cos(Math.PI / 4),
                       1 / 2 * Math.sin(Math.PI / 4));
        context.lineTo(1 / 2 * Math.cos(-Math.PI / 3),
                       1 / 2 * Math.sin(-Math.PI / 3));
        context.lineTo(1 / 5 * Math.cos(-Math.PI / 2),
                       1 / 5 * Math.sin(-Math.PI / 2));
        context.lineTo(1 / 2 * Math.cos(-Math.PI * 2 / 3),
                       1 / 2 * Math.sin(-Math.PI * 2 / 3));
        context.lineTo(1 / 2 * Math.cos(Math.PI * 3 / 4),
                       1 / 2 * Math.sin(Math.PI * 3 / 4));

        context.moveTo(1 / 7 * Math.cos(Math.PI / 2) - 1 / 7,
                       1 / 7 * Math.sin(Math.PI / 2));
        context.lineTo(1 / 7 * Math.cos(Math.PI / 2) + 1 / 7,
                       1 / 7 * Math.sin(Math.PI / 2));
        context.lineWidth = 1 / 25;
        context.lineCap = 'round';
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    quanta.ZBoson = Object.create(Particle);
    quanta.ZBoson.mass = 80.433e9;
    quanta.ZBoson.spin = 1;
    quanta.ZBoson.eCharge = -1;
    quanta.ZBoson.scaleFactor *= 1;
    quanta.ZBoson._name = "Z Boson";
    quanta.ZBoson._color = 'white';
    quanta.ZBoson._rotate = 0.001;
    quanta.ZBoson._draw = function(context, lab) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 2 * Math.cos(Math.PI / 4),
                       1 / 2 * Math.sin(Math.PI / 4));
        context.lineTo(1 / 2 * Math.cos(Math.PI * 3 / 4),
                       1 / 2 * Math.sin(Math.PI * 3 / 4));
        context.lineTo(1 / 2 * Math.cos(-Math.PI / 4),
                       1 / 2 * Math.sin(-Math.PI / 4));
        context.lineTo(1 / 2 * Math.cos(-Math.PI * 3 / 4),
                       1 / 2 * Math.sin(-Math.PI * 3 / 4));
        context.lineWidth = 1 / 25;
        context.lineCap = 'round';
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    quanta.HiggsBoson = Object.create(Particle);
    quanta.HiggsBoson.mass = 125.25e9;
    quanta.HiggsBoson.spin = 1;
    quanta.HiggsBoson.eCharge = -1;
    quanta.HiggsBoson.scaleFactor *= 1;
    quanta.HiggsBoson._name = "Higgs Boson";
    quanta.HiggsBoson._color = 'white';
    quanta.HiggsBoson._rotate = 0.001;
    quanta.HiggsBoson._draw = function(context, lab) {
        context.save();
        context.translate(this.position.x, this.position.y);
        context.rotate(this.phase);
        context.scale(this.size, this.size);

        context.beginPath();
        context.moveTo(1 / 2, 0);
        context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
        context.moveTo(1 / 2 * Math.cos(Math.PI / 3),
                       1 / 2 * Math.sin(Math.PI / 3));
        context.lineTo(1 / 2 * Math.cos(-Math.PI / 3),
                       1 / 2 * Math.sin(-Math.PI / 3));
        context.moveTo(1 / 2 * Math.cos(Math.PI * 2 / 3),
                       1 / 2 * Math.sin(Math.PI * 2 / 3));
        context.lineTo(1 / 2 * Math.cos(-Math.PI * 2 / 3),
                       1 / 2 * Math.sin(-Math.PI * 2 / 3));
        context.moveTo(1 / 2 * Math.cos(Math.PI / 3), 0);
        context.lineTo(1 / 2 * Math.cos(Math.PI * 2 / 3), 0);
        context.lineWidth = 1 / 25;
        context.lineCap = 'round';
        context.strokeStyle = this._color;
        context.stroke();
        context.restore();
    };

    quanta.go = function() {
        // Query Parameters
        var mode = ripple.param("mode", {default: "key"});
        var nphotons = Math.max(0, parseInt(
            ripple.param("nphotons") || 3, 10));
        var ngluons = Math.max(0, parseInt(
            ripple.param("ngluons") || 3, 10));
        var center = ripple.param("center") || "center";
        c = Math.max(0.01, parseFloat(ripple.param("customc") || 1.0));

        var lab;

        return {
            init: function(camera, canvas, container, fasciaRedraw) {
                camera.center = false;
                lab = quanta.Laboratory.create(
                    camera.width, camera.height);
                lab.setup(mode, {
                    nphotons: nphotons, ngluons: ngluons });
            },

            draw: function(ctx, camera, now, last) { lab.draw(ctx); },
            resize: function(camera, container)
            { if (lab) lab.resize(camera.width, camera.height); },
            update: function(camera, elapsed, now)
            { lab.update(elapsed); },
            isActive: true,
        };
    };

})(typeof exports === 'undefined'? this['quanta'] = {}: exports);
