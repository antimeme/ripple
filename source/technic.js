// technic.js
// Copyright (C) 2018 by Jeff Gold.
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
// A research mechanic for games that allows players to explore a multi-
// dimensional space to find better technology.
(function(technic) {
    'use strict';

    // Generate a research field for players to explore
    // A research object includes the following public fields:
    //
    //   components: available ingredients
    //   recipes: a set of starting recipes to guide research
    //
    // To create a research object, supply a config with these fields:
    //
    var base = function(config) {
        if (!(this instanceof base))
            return new base(config);

        this.dimensions = config.dimensions;
        this.components = {};
        this.designNodes = [];
        this.recipes = [];

        // Create components
        Object.keys(this.dimensions).forEach(function(dimension) {
            [25, 50, 100].forEach(function(value) {
                var name = config.components();
                var settings = {cost: config.costs.base +
                                      value * config.costs.vary};
                Object.keys(this.dimensions).forEach(function(d) {
                    settings[d] = (d === dimension) ? value : 0;
                }, this);
                this.components[name] = settings;
            }, this);
        }, this);

        // Create design nodes
        for (var ii = 0; ii < 5; ++ii) {
            var designNode = {};
            Object.keys(this.dimensions).forEach(function(dimension) {
                // TODO: randomize node locations
                designNode[dimension] = 20 * (ii + 1);
            }, this);
            // TODO randomize and tune node radii
            designNode.radius = 20 / (ii + 1);
            this.designNodes.push(designNode);
        }

        // Create recipes
        // TODO
        var recipe = {};
        
        this.recipes.push(recipe);
    };
    base.prototype.craft = function(skill, station, recipe) {
        // Design space is a mult-dimensional system.  Crafting
        // means finding the point represented by the 
        var result = null;
        var vector, closest, distance, total;

        total = 0; // Compute total weight to normalize
        Object.keys(recipe).forEach(function(component) {
            total += recipe[component]; }, this);

        vector = {}; // Find the location of the recipe in design space
        Object.keys(recipe).forEach(function(component) {
            if (component in this.components)
                Object.keys(this.components[component]).forEach(
                    function(dimension) {
                        if (dimension === 'cost')
                            return;
                        if (!vector[dimension])
                            vector[dimension] = 0;
                        vector[dimension] += (this.components[
                            component][dimension] *
                            recipe[component] / total);
                    }, this);
        }, this);

        closest = null; // Find the most appropriate design node
        this.designNodes.forEach(function(node) {
            var delta = 0;
            Object.keys(this.dimensions).forEach(function(dimension) {
                var nodeval = node[dimension] || 0;
                var vecval  = vector[dimension] || 0;

                delta += (nodeval - vecval) * (nodeval - vecval);
            }, this);
            
            if (isNaN(distance) || delta < distance) {
                distance = delta;
                closest = node;
            }
        }, this);

        if (closest) {
            result = {};
            Object.keys(closest).forEach(function(dimension) {
                if (dimension === 'radius')
                    return;
                result[dimension] = closest[dimension];
                // TODO reduce quality of result based on distance
            }, this);
        }

        return result;
    };

    var shuffle = function(elements, rand) {
        var ii, jj, swap;

        if (!rand || !rand.random)
            rand = Math;
        for (ii = elements.length; ii; --ii) { // swap at random
            jj = Math.floor(rand.random() * ii);
            swap = elements[ii - 1];
            elements[ii - 1] = elements[jj];
            elements[jj] = swap;
        }
        return elements;
    }

    technic.generateTechnicalName = function() {
        var first = ["phasic", "analog", "digital", "optical",
                     "transcoding", "baseband", "rapid", "variable",
                     "photonic", "linear", "continuous", "discrete",
                     "nanowave", "auxilliary", "atomic",
                     "molecular", "particulate", "multiphasic",
                     "isomorphic", "gravimetric", "perpetual",
                     "quantum", "metatronic",
                     "subharmonic", "superluminal", "synthetic",
                     "static", "asymmetric", "symmetric",
                     "hyperwave"];
        var second = ["multitronic", "quantitative", "oscillation",
                      "circuit", "central", "dorsal", "ventral",
                      "inverson", "positron", "neutrino",
                      "compression", "dampening", "field", "plasma",
                      "frequency", "combustion", "attenuation",
                      "reaction", "refraction", "flow", "vacuum",
                      "dueterium", "muon", "ion", "charge", "pulse",
                      "control", "isotope", "containment",
                      "zero-point"];
        var third = ["modulator", "array", "antenna", "injector",
                     "interferometer", "matrix", "sensor",
                     "discriminator", "bank", "coupling",
                     "magnetometer", "multiplier", "deflector",
                     "spinner", "infuser", "dish", "accelerator",
                     "inhibitor", "capacitor", "converter",
                     "regulator", "chamber", "crystal",
                     "module", "shaft", "ingiter", "core",
                     "housing", "splitter", "conduit", "coil"];
        var index = 0;
        shuffle(first); shuffle(second); shuffle(third);

        return function() {
            ++index;
            if (index > first.length ||
                index > second.length ||
                index > third.length) {
                shuffle(first);
                shuffle(second);
                shuffle(third);
                index = 1;
            }
            return first[index - 1] + ' ' +
                   second[index - 1] + ' ' +
                   third[index - 1];
        }
    }();

    technic.create = function(config) { return base(config); };
}(typeof exports === 'undefined' ? this['technic'] = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var technic = exports;
    var multivec = require('./multivec.js');
    var fs = require('fs');
    var mode = null;

    var rules = {
        multivec: multivec,
        dimensions: {
            "Weight": {
                base: 2000, units: "kg", vary: -200,
                comment: "Mass of engine"},
            "Power": {
                base: 200, vary: -20,
                comment: "Reactor energy required for function"},
            "Propellant": {
                base: 0.002, units: "kg/s", vary: -0.0002,
                comment: "Mass of propellant needed per second"},
            "Thrust": {
                base: 100000, vary: +1000,
                comment: "Force exerted"},
            "Stability": {base: .80, vary: +.08}
        },
        components: technic.generateTechnicalName,
        costs: { base: 100, vary: 20 }
    };

    process.argv.splice(2).forEach(function (argument) {
        if (mode === 'load') {
            rules = JSON.parse(fs.readFileSync(argument).
                                  toString('utf-8'));
            mode = null;
        } else if (mode === 'rule') {
            rule = argument;
        } else if (argument.startsWith('--')) {
            mode = argument.slice(2);
        }
    });

    var instance = technic.create(rules);
    Object.keys(instance.components).forEach(function(key) {
        console.log(key + ': ' + instance.components[key].cost +
                    ' credits');
    });
    console.log(instance.craft(1, 1, instance.recipes[0]));
}
