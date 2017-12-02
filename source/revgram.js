// revgram.js
// Copyright (C) 2011-2014 by Jeff Gold.
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
// Reverse context-free grammar used to generate strings.
(function(revgram) {

    revgram.quote = function(value) {
        return value ? value.replace(/%/g, '%%') : value;
    };
    revgram.unquote = function(value) {
        return value ? value.replace(/%%/g, '%') : value;
    };

    var isrule = function(value) {
        return (value.length >= 2) && (value[0] === '%') &&
            (value[1] !== '%');
    };

    var getWeight = function(element) {
        return (typeof(element) === 'string' ||
                !element.length || isNaN(element[0]) ||
                (typeof(element[0]) === 'string')) ? 1 : element[0];
    };

    var getRule = function(element) {
        return (typeof(element) === 'string') ? [element] :
               element.slice(
                   (!element.length || isNaN(element[0]) ||
                    (typeof(element[0]) === 'string')) ? 0 : 1);
    };

    revgram.generate = function(rules, start) {
        var value = '', total = 0, choice;
        var current = rules[start];

        if (current) {
            current.forEach(function(element, index) {
                total += getWeight(element); });
            choice = Math.random() * total;
            current.forEach(function(element, index) {
                var weight = getWeight(element);

                if (choice < 0) { // skip
                } else if (choice < weight) {
                    getRule(element).forEach(function(component) {
                        if (isrule(component))
                            value += revgram.generate(
                                rules, component.substring(1));
                        else value += revgram.unquote(component);
                    });
                    choice = -1;
                } else choice -= weight;
            });
        } else value = 'missing-%' + start;
        return value;
    }
}(typeof exports === 'undefined' ? this['revgram'] = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    // TODO support comments
    // TODO support exclusion lists
    var rule = 'name', rules = {
        'name': [[4, '%start', '%middle', '%end'],
                 [1, '%start', '%end']],
        'start': [[1, '%consonant', '%vowel']],
        'middle': [[4, '%consonant', '%vowel'],
                   [1, '%middle', '%middle']],
        'end': [[1, '%consonant']],

        'vowel': [[1, 'a'], [1, 'e'], [1, 'i'], [1, 'o'], [1, 'u']],
        'consonant': [[1, 'b'], [1, 'c'], [1, 'd'], [1, 'f'], [1, 'g'],
                      [1, 'h'], [1, 'j'], [1, 'k'], [1, 'l'], [1, 'm'],
                      [1, 'n'], [1, 'p'], [1, 'r'], [1, 's'], [1, 't'],
                      [1, 'v'], [1, 'w'], [1, 'x'], [1, 'z']]
    };

    var fs = require('fs');
    var revgram = exports;

    var mode = null;
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

    var index;
    for (index = 0; index < 22; ++index)
        console.log(revgram.generate(rules, rule));
}
