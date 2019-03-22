// omnivore.js
// Copyright (C) 2019 by Jeff Gold.
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
// An abstract parsing and string generation system based on recursive
// descent parsing.  A grammar can be constructed using a JSON
// compatible object.  Each key in the object is the name of a rule
// and each object is an array of descriptors.
//
// A descriptor can be either a string, an array or an object.  A
// string is either a literal value or a percent sign followed by the
// name of a rule (two percent signs means it's a string that starts
// with a single percent sign, not a rule).  An array must contain
// strings with the same format as the single string.  They indicate a
// chain of literals and rules.  Finally, an object is a detailed
// descriptor for advanced uses.
//
// An object descriptor has these fields:
// - weight: positive number used to choose which rule to follow
//           when generating strings
// - rule: string or array of strings of non-object descriptors
(function(omnivore) {
    omnivore.grammar = function(rules) {
        if (!(this instanceof omnivore.grammar))
            return new omnivore.grammar(rules);

        this.__rules = rules;
    }

    omnivore.quote = function(value) {
        return value ? value.replace(/%/g, '%%') : value;
    };

    omnivore.unquote = function(value) {
        return value ? value.replace(/%%/g, '%') : value;
    };

    var isRule = function(value) {
        return (typeof(value) === 'string') && (value.length >= 2) &&
               (value[0] === '%') && (value[1] !== '%');
    };

    var getWeight = function(descriptor) {
        return (!Array.isArray(descriptor) &&
                (typeof descriptor === 'object')) ?
               descriptor.weight : 1;
    }

    var getRule = function(descriptor) {
        return (!Array.isArray(descriptor) &&
                (typeof descriptor === 'object')) ?
               getRule(descriptor.rule) :
               ((typeof descriptor === 'string') ?
                [descriptor] : descriptor);
    };

    omnivore.grammar.prototype.generate = function(rule) {
        var value = '', total = 0, choice;
        var current = this.__rules[rule];

        if (current) {
            current.forEach(function(descriptor, index) {
                total += getWeight(descriptor); });
            choice = Math.random() * total;
            current.forEach(function(descriptor, index) {
                var weight = getWeight(descriptor);

                if (choice < 0) { // skip
                } else if (choice < weight) {
                    getRule(descriptor).forEach(function(component) {
                        if (isRule(component))
                            value += this.generate(
                                component.substring(1));
                        else value += omnivore.unquote(component);
                    }, this);
                    choice = -1;
                } else choice -= weight;
            }, this);
        } else value = 'missing-%' + rule;
        return value;
    };

}(typeof exports === 'undefined' ? this.omnivore = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var omnivore = exports;
    var grammar = omnivore.grammar({
        vowel: ['a', 'e', 'i', 'o', 'u'],
        consonant: [
            'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
            'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'],
        start: [['%consonant', '%vowel']],
        middle: [{weight: 4, rule: ['%consonant', '%vowel']},
                 ['%middle', '%middle']],
        end: [['%consonant']],
        name: [{weight: 4, rule: ['%start', '%middle', '%end']},
               ['%start', '%end']],
    });

    console.log('Omnivore:');
    for (var ii = 0; ii < 10; ++ii)
        console.log(' ', grammar.generate('name'));
}
