// quanta/app.js
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
(function(quanta) {
    "use strict";

    var planck  = 4.135667516e-15;
    var masslessSpeed = 299792458; // meters per second

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

        update: function(elapsed) {
            var index;
            var current = 0;
            var processed = 0;
            var event;

            while (processed < elapsed) {
                event = this._nextBounce(elapsed - processed);
                current = event ? event.time : (elapsed - processed);
                this._move(current);
                if (event)
                    event.action.call(event.particle, this);

                processed = current;
            }

            var particles = [];
            for (index = 0; index < this.particles.length; ++index)
                if (!this.particles[index].update(elapsed, this))
                    particles.push(this.particles[index]);
            this.particles = particles;
        },

        draw: function(context) {
            var index;
            for (index = 0; index < this.particles.length; ++index)
                this.particles[index].draw(context, this);
        },

        setup: function(mode, config) {
            if (mode === "soup") {
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
            } else if (mode === "oldproton") {
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
            } else if (mode === "proton") {
                this.add(quanta.Proton.create(this));
                this.add(quanta.Neutron.create(this));
            } else {
                var anti = config && config.anti;
                var rows = 7;
                var cols = 4;
                var row, col;
                var cChargeOffset = Math.floor(Math.random() * 3);

                row = col = 0;
                this.add(quanta.Electron.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Muon.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Tau.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.Neutrino.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.MuonNeutrino.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));
                this.add(quanta.TauNeutrino.create(this, {
                    label: true, anti: anti, position: {
                        x: 1/cols, y: ++row/rows}}));

                row = 0;
                this.add(quanta.UpQuark.create(this, {
                    label: true, anti: anti, cCharge: 0,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.CharmQuark.create(this, {
                    label: true, anti: anti, cCharge: 1,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.TopQuark.create(this, {
                    label: true, anti: anti, cCharge: 2,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.DownQuark.create(this, {
                    label: true, anti: anti,
                    cCharge: (cChargeOffset + 0) % 3,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.StrangeQuark.create(this, {
                    label: true, anti: anti,
                    cCharge: (cChargeOffset + 1) % 3,
                    position: {x: 2/cols, y: ++row/rows}}));
                this.add(quanta.BottomQuark.create(this, {
                    label: true, anti: anti,
                    cCharge: (cChargeOffset + 2) % 3,
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
        mass: 0, /* Given in eV/c^2 */
        spin: 0, /* Fermions are half-integer; bosons are integer */
        eCharge: 0, /* -1, 0 or +1 */
        cCharge: undefined,
        cCharges: ["#a33", "#3a3", "#33e", "#6ee", "#e6e", "#ee6"],
        scaleFactor: 0.05,
        phase: 0,
        position: undefined,
        direction: undefined,
        speed: undefined,
        size: undefined,
        anti: false,
        _name: "Particle",
        _label: undefined,
        _rotate: 0,
        _init: function(lab, config) {},

        create: function(lab, config) {
            var result = Object.create(this);
            result.size = (config && config.size) ?
                          config.size :
                          lab.size * result.scaleFactor;

            if (config && config.label)
                result._label = true;
            if (config && config.anti)
                result.anti = true;

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
                result.speed = 1;
            else result.speed = 0;

            result._init(lab, config);
            return result;
        },

        _update: function(elapsed, lab) {},

        update: function(elapsed, lab) {
            if (!isNaN(this._rotate))
                this.phase += elapsed * this._rotate;
            return this._update(elapsed, lab);
        },

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
                    this.position.y + this.size * 5 / 25);
            }
        },

        randomCCharge: function(config) {
            return ((config && config.anti) ? 3 : 0) +
                   Math.floor(Math.random() * 3);
        },
    };

    quanta.Electron = Object.assign(Object.create(Particle), {
        // An electron is the most stable lepton and has a unit negative
        // electrical charge.
        mass: 510998.910,
        spin: 0.5,
        eCharge: -1,
        scaleFactor: 0.055,
        _name: "Electron",
        _stroke: "#eee",
        _fill: "#444",
        _rotate: 0.001,
        _draw: function(context) {
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
            context.moveTo(-1 / 4, 0);
            context.lineTo(1 / 4, 0);
            if (this.anti) {
                context.moveTo(0, -1 / 4);
                context.lineTo(0, 1 / 4);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = "round";
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    quanta.Muon = Object.assign(Object.create(quanta.Electron), {
        // A muon is the second generation lepton that decays quickly
        // into a Muon Neutrino and a W- Boson..
        mass: 105660000,
        _name: "Muon",
        _draw: function(context) {
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
            if (this.anti) {
                context.moveTo(0, -1 / 4);
                context.lineTo(0, 1 / 4);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = "round";
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    quanta.Tau = Object.assign(Object.create(quanta.Electron), {
        // A Tau is the third generation lepton that decays very
        // quickly into a Tau Neutrino and a W- Boson.  That W-
        // boson can actually decay into a down and anti-up quark
        // pair (or a muon and muon neutrio or an electron and
        // electron neutrino).
        mass: 1776800000,
        _name: "Tau",
        _draw: function(context) {
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
            if (this.anti) {
                context.moveTo(0, -1 / 4);
                context.lineTo(0, 1 / 4);
            }

            context.lineWidth = this.size / 20;
            context.lineCap = "round";
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    // A neutrino is a mysterious and almost massless particle that
    // carries the weak nuclear force.
    quanta.Neutrino = Object.assign(Object.create(Particle), {
        mass: 0.1,
        spin: 0.5,
        eCharge: 0,
        scaleFactor: 0.055,
        _name: "Neutrino",
        _stroke: "#666",
        _fill: "#aaa",
        _rotate: 0.001,
        _draw: function(context) {
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
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    quanta.MuonNeutrino = Object.assign(Object.create(quanta.Neutrino), {
        mass: 170000,
        _name: "Muon Neutrino",
        _rotate: 0.001,
        _draw: function(context) {
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
            context.moveTo(1 / 3 * Math.cos(0),
                           1 / 3 * Math.sin(0));
            context.lineTo(1 / 3 * Math.cos(Math.PI / 2),
                           1 / 3 * Math.sin(Math.PI / 2));
            context.lineTo(1 / 3 * Math.cos(Math.PI),
                           1 / 3 * Math.sin(Math.PI));
            context.lineTo(1 / 3 * Math.cos(Math.PI * 3 / 2),
                           1 / 3 * Math.sin(Math.PI * 3 / 2));
            context.lineTo(1 / 3 * Math.cos(0),
                           1 / 3 * Math.sin(0));
            context.lineTo(1 / 3 * Math.cos(Math.PI),
                           1 / 3 * Math.sin(Math.PI));
            context.lineWidth = 1 / 20;

            context.lineCap = "round";
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    quanta.TauNeutrino = Object.assign(Object.create(quanta.Neutrino), {
        mass: 18200000,
        _name: "Tau Neutrino",
        _rotate: 0.001,
        _draw: function(context) {
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
            context.moveTo(1 / 3 * Math.cos(0),
                           1 / 3 * Math.sin(0));
            context.lineTo(1 / 3 * Math.cos(Math.PI / 2),
                           1 / 3 * Math.sin(Math.PI / 2));
            context.lineTo(1 / 3 * Math.cos(Math.PI),
                           1 / 3 * Math.sin(Math.PI));
            context.lineTo(1 / 3 * Math.cos(Math.PI * 3 / 2),
                           1 / 3 * Math.sin(Math.PI * 3 / 2));
            context.lineTo(1 / 3 * Math.cos(0),
                           1 / 3 * Math.sin(0));
            context.lineTo(1 / 3 * Math.cos(Math.PI),
                           1 / 3 * Math.sin(Math.PI));
            context.moveTo(1 / 3 * Math.cos(Math.PI / 2),
                           1 / 3 * Math.sin(Math.PI / 2));
            context.lineTo(1 / 3 * Math.cos(Math.PI * 3 / 2),
                           1 / 3 * Math.sin(Math.PI * 3 / 2));
            context.lineWidth = 1 / 20;

            context.lineCap = "round";
            context.fillStyle = this._fill;
            context.fill();
            context.strokeStyle = this._stroke;
            context.stroke();
            context.restore();
        },
    });

    quanta.UpQuark = Object.assign(Object.create(Particle), {
        mass: 2200000,
        spin: 0.5,
        eCharge: 2/3,
        cCharge: undefined,
        scaleFactor: 0.055,
        _name: "Up Quark",
        _rotate: 0.001,
        _background: "#eee",
        _init: function(lab, config) {
            if (config && !isNaN(config.cCharge) &&
                (config.cCharge >= 0) &&
                (config.cCharge < this.cCharges.length))
                this.cCharge = Math.floor(config.cCharge);
            if (isNaN(this.cCharge))
                this.cCharge = this.randomCCharge();
        },
        _draw: function(context) {
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
            if (this.anti) {
                context.moveTo(0, -1 / 3);
                context.lineTo(0, 1 / 3);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = "round";
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    quanta.CharmQuark = Object.assign(Object.create(quanta.UpQuark), {
        mass: 2200000,
        _name: "Charm Quark",
        _rotate: 0.001,
        _draw: function(context) {
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
            if (this.anti) {
                context.moveTo(0, -1 / 3);
                context.lineTo(0, 1 / 3);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = 'round';
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    quanta.TopQuark = Object.assign(Object.create(quanta.UpQuark), {
        mass: 2200000,
        _name: "Top Quark",
        _rotate: 0.001,
        _draw: function(context) {
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
            if (this.anti) {
                context.moveTo(0, -1 / 3);
                context.lineTo(0, 1 / 3);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = 'round';
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    quanta.DownQuark = Object.assign(Object.create(Particle), {
        mass: 2200000,
        spin: 0.5,
        eCharge: -1/3,
        cCharge: undefined,
        scaleFactor: 0.055,
        _name: "Down Quark",
        _background: "#eee",
        _rotate: 0.001,
        _init: function(lab, config) {
            if (config && !isNaN(config.cCharge) &&
                (config.cCharge >= 0) &&
                (config.cCharge < this.cCharges.length))
                this.cCharge = Math.floor(config.cCharge);
            if (isNaN(this.cCharge))
                this.cCharge = this.randomCCharge();
        },
        _draw: function(context) {
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
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    quanta.StrangeQuark = Object.assign(Object.create(quanta.DownQuark), {
        mass: 2200000,
        _name: "Strange Quark",
        _rotate: 0.001,
        _draw: function(context) {
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
            context.moveTo(1 / 6, 0);
            context.lineTo(-1 / 6, 0);
            if (this.anti) {
                context.moveTo(0, -1 / 3);
                context.lineTo(0, 1 / 3);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = "round";
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    quanta.BottomQuark = Object.assign(Object.create(quanta.DownQuark), {
        mass: 2200000,
        _name: "Bottom Quark",
        _rotate: 0.001,
        _draw: function(context) {
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
            context.moveTo(1 / 6, 0);
            context.lineTo(-1 / 6, 0);
            context.moveTo(1 / 12, 1/6);
            context.lineTo(-1 / 12, 1/6);
            if (this.anti) {
                context.moveTo(0, -1 / 3);
                context.lineTo(0, 1 / 3);
            }

            context.lineWidth = 1 / 20;
            context.lineCap = "round";
            context.fillStyle = this.cCharges[this.cCharge];
            context.fill();
            context.strokeStyle = this._background;
            context.stroke();
            context.restore();
        },
    });

    // A photon is a massless guage boson that mediates the
    // electromagnetic force.
    quanta.Photon = Object.assign(Object.create(Particle), {
        mass: 0,
        spin: 1,
        _name: "Photon",
        spectrum: [
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
             color: {r: 255, g: 128, b: 255}}],
        setFreq: function(freq) {
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
        },
        _init: function(lab, config) {
            this.setFreq(config && config.freq ? config.freq :
                         this.spectrum[0].freq + Math.random() *
                (this.spectrum[
                    this.spectrum.length - 1].freq -
                 this.spectrum[0].freq));
        },
        _draw: function(context, lab) {
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);
            context.lineWidth = 1 / 25;
            context.lineCap = 'round';

            context.beginPath();
            context.moveTo(0, -1 / 2);
            context.bezierCurveTo(
                -1 / 2, 1 / 5,
                1 / 2, -1 / 5,
                0, 1 / 2);
            context.strokeStyle = "#eee";
            context.stroke();

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
            context.strokeStyle = this._color;
            context.stroke();
            context.restore();
        },
    });

    quanta.Gluon = Object.assign(Object.create(Particle), {
        mass: 0,
        spin: 1,
        eCharge: -1,
        scaleFactor: 0.055,
        _name: "Gluon",
        _colorMatter: undefined,
        _colorAnti  : undefined,
        _rotate: 0.005,
        _draw: function(context, lab) {
            if (isNaN(this._colorMatter))
                this._colorMatter = this.randomCCharge();
            if (isNaN(this._colorAnti))
                this._colorAnti = this.randomCCharge({anti: true});

            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);
            context.lineWidth = 1 / 25;
            context.lineCap = 'round';

            context.beginPath();
            context.moveTo(1 / 2 * Math.cos(Math.PI / 3),
                           1 / 2 * Math.sin(Math.PI / 3));
            context.bezierCurveTo(
                1 / 2 * Math.cos(Math.PI),
                1 / 2 * Math.sin(Math.PI),
                1 / 2 * Math.cos(0),
                1 / 2 * Math.sin(0),
                1 / 2 * Math.cos(-Math.PI / 3),
                1 / 2 * Math.sin(-Math.PI / 3));
            context.strokeStyle = this.cCharges[this._colorMatter];
            context.stroke();

            context.beginPath();
            context.moveTo(1 / 2 * Math.cos(Math.PI * 2 / 3),
                           1 / 2 * Math.sin(Math.PI * 2 / 3));
            context.bezierCurveTo(
                1 / 2 * Math.cos(Math.PI),
                1 / 2 * Math.sin(Math.PI),
                1 / 2 * Math.cos(0),
                1 / 2 * Math.sin(0),
                1 / 2 * Math.cos(-Math.PI * 2 / 3),
                1 / 2 * Math.sin(-Math.PI * 2 / 3));
            context.strokeStyle = this.cCharges[this._colorAnti];
            context.stroke();

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);
            context.strokeStyle = "#eee";
            context.stroke();
            context.restore();
        },
    });

    quanta.WPlusBoson = Object.assign(Object.create(Particle), {
        mass: 80.433e9,
        spin: 1,
        eCharge: -1,
        _name: "W+ Boson",
        _color: 'white',
        _rotate: 0.001,
        _draw: function(context, lab) {
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
        },
    });

    quanta.WMinusBoson = Object.assign(Object.create(Particle), {
        mass: 80.433e9,
        spin: 1,
        eCharge: -1,
        _name: "W- Boson",
        _color: 'white',
        _rotate: 0.001,
        _draw: function(context, lab) {
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
        },
    });

    quanta.ZBoson = Object.assign(Object.create(Particle), {
        mass: 80.433e9,
        spin: 1,
        eCharge: 0,
        _name: "Z Boson",
        _color: 'white',
        _rotate: 0.001,
        _draw: function(context, lab) {
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
        },
    });

    quanta.HiggsBoson = Object.assign(Object.create(Particle), {
        mass: 125.25e9,
        spin: 1,
        eCharge: -1,
        _name: "Higgs Boson",
        _color: 'white',
        _rotate: 0.001,
        _draw: function(context, lab) {
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
        },
    });

    quanta.Hadron = Object.assign(Object.create(Particle), {
        mass: 938.27208816e6,
        spin: 1,
        eCharge: -1,
        scaleFactor: 0.5,
        _name: "Hadron",
        _color: "rgba(96, 96, 32, 0.25)",
        _rotate: 0.001,
        _quarks: null,
        _flavors: [quanta.UpQuark, quanta.UpQuark, quanta.DownQuark],

        _positionQuark: function(quark) {
            var position = {
                x: (Math.cos(quark.start) +
                    quark.progress * (Math.cos(quark.end) -
                                      Math.cos(quark.start))),
                y: (Math.sin(quark.start) +
                    quark.progress * (Math.sin(quark.end) -
                                      Math.sin(quark.start))) };
            position.x *= this.size * 11 / 25;
            position.x += this.position.x;
            position.y *= this.size * 11 / 25;
            position.y += this.position.y;
            quark.particle.position = position;
            return quark;
        },

        _setupQuark: function(lab, color, flavor) {
            return this._positionQuark({
                start: Math.random() * 2 * Math.PI,
                end: Math.random() * 2 * Math.PI,
                progress: Math.random(),
                particle: flavor.create(lab, {cCharge: color}) });
        },

        _init: function(lab, config) {
            var colors = [0, 1, 2];
            var quarks = this._flavors.slice();
            ripple.shuffle(colors);
            ripple.shuffle(quarks);

            this._quarks = [];

            var ii;
            for (ii = 0; ii < 3; ++ii)
                this._quarks.push(this._setupQuark(
                    lab, colors[ii], quarks[ii]));
        },

        _update: function(elapsed, lab) {
            this._quarks.forEach(function(quark) {
                quark.particle.update(elapsed, lab);
                quark.progress += elapsed / 1000;
                if (quark.progress > 1) {
                    quark.progress -= Math.floor(quark.progress);
                    quark.start = quark.end;
                    quark.end = Math.random() * 2 * Math.PI;
                }
                this._positionQuark(quark);
            }, this);
        },

        _draw: function(context, lab) {
            context.save();
            context.translate(this.position.x, this.position.y);
            context.rotate(this.phase);
            context.scale(this.size, this.size);

            context.beginPath();
            context.moveTo(1 / 2, 0);
            context.arc(0, 0, 1 / 2, 0, 2 * Math.PI);

            context.fillStyle = this._color;
            context.fill();
            context.restore();

            this._quarks.forEach(function(quark) {
                quark.particle.draw(context, lab); });
        },
    });

    quanta.Proton = Object.assign(Object.create(quanta.Hadron), {
        _name: "Proton",
        _color: "rgba(96, 96, 32, 0.25)",
        _flavors: [quanta.UpQuark, quanta.UpQuark, quanta.DownQuark],
    });

    quanta.Neutron = Object.assign(Object.create(quanta.Hadron), {
        _name: "Neutron",
        _color: "rgba(64, 64, 96, 0.25)",
        _flavors: [quanta.UpQuark, quanta.DownQuark, quanta.DownQuark],
    });

    quanta.go = function() {
        // Query Parameters
        var mode = ripple.param("mode", {default: "key"});
        var nphotons = Math.max(0, parseInt(
            ripple.param("nphotons") || 3, 10));
        var ngluons = Math.max(0, parseInt(
            ripple.param("ngluons") || 3, 10));
        var center = ripple.param("center") || "center";

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
