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
// Abstract parsing and string generation.  Parsing uses a recursive
// descent algorithm.  A grammar can be constructed using a JSON
// object.  Each key in the object is the name of a rule and each
// value associated with a key is a production.
//
//     var language = {
//         ws: [' ', '\t', '\r', '\n'],
//         wsp: ['%ws', ['%ws', '%wsp']],
//         digit: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
//         digits: ['%digit', ['%digit', '%digits']],
//         number: ['%digits', ['%digits', '.', '%digits']],
//     };
//
// A production can be either a string, an array or an object.
//
// A production string is either a literal or a rule reference.  The
// difference is that a rule reference starts with a single '%' followed
// by at least one other character that is not '%'.  A reference refers
// is replaced by the result of following the rule it refers to.  A
// literal either starts with a character that isn't '%' or starts with
// two '%' characters (in which case these are unquoted to a single
// one).  Literals refer directly to characters in the language.
//
// A production array is a series of alternatives, any one of which
// can be used to satisfy the rule.  When an array appears as a member
// of a production array, this represents a sequence of production
// that must match in order.
//
// A production can also be an object for advanced usage.
//
(function(omnivore) {

    omnivore.quote = function(value) {
        return value ? value.replace(/%/g, '%%') : value; };

    omnivore.unquote = function(value) {
        return value ? value.replace(/%%/g, '%') : value; };

    var isRule = function(value) {
        return (typeof(value) === 'string') && (value.length >= 2) &&
               (value[0] === '%') && (value[1] !== '%');
    };

    var getWeight = function(production) {
        return (!Array.isArray(production) &&
                (typeof production === 'object')) ?
               production.weight : 1;
    }

    var getRule = function(production) {
        return (Array.isArray(production) ? production :
                ((typeof production === 'string') ?
                 [production] : getRule(production.rule)));
    };

    omnivore.grammar = function(rules) {
        if (!(this instanceof omnivore.grammar))
            return new omnivore.grammar(rules);

        this.__rules = rules;
    };

    omnivore.grammar.prototype.generate = function(rule) {
        var value = '', total = 0, choice;
        var current = this.__rules[rule];

        if (current) {
            current.forEach(function(production, index) {
                total += getWeight(production); });
            choice = Math.random() * total;
            current.forEach(function(production, index) {
                var weight = getWeight(production);

                if (choice < 0) { // skip
                } else if (choice < weight) {
                    getRule(production).forEach(function(component) {
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

    var matchString = function(match, current, value) {
        return ((current + match.length < value.length) &&
                (value.indexOf(match, current) === current)) ?
               (current + match.length) : -1;
    };

    var parseRule = function(grammar, production, current, value) {
        var maxmatch = -1;
        production.forEach(function(member) {
            var matched = -1;
            if (typeof(member) === 'string') {
                if (isRule(member)) {
                    // TODO
                } else {
                    matched = matchString(omnivore.unquote(member),
                                          current, value);
                    if ((match >= 0) && (match > maxmatch))
                        maxmatch = matched;
                }
            } else if (Array.isArray(member) || member.rule) {
                // TODO
            }
        });
    };

    var parseInternal = function(grammar, rule, value) {
        var result = null;
        var current = 0;

        parseRule(grammar, getRule(grammar.__rules[rule]),
                  current, value);
        return result;
    };

    // Return a function that accepts a string and partially
    omnivore.grammar.prototype.parseBegin = function(rule) {
        var chunks = [];
        var grammar = this;
        var result = function(value) {
            if (value.length > 0) {
                // TODO: parse partial input chunks to support
                // sockets and other such streaming scenarios.
                // At the moment only complete inputs can be
                // processed because that's easier to implement.
                chunks.push(value);
            } else return parseInternal(grammar, rule, chunks.join(''));
            return result;
        };
        return result;
    };

    // Return a syntax tree representation based on the given string.
    // This is a one-step process.
    omnivore.grammar.prototype.parse = function(rule, value) {
        return this.parseBegin(rule)(value)(""); };

    omnivore.example = omnivore.grammar({
        ws: [' ', {weight: 0, rule: '\t'}, {weight: 0, rule: '\r'},
             {weight: 0, rule: '\n'}],
        wsp: ['%ws', {weight: 0, rule: ['%ws', '%wsp']}],
        wss: ['', '%wsp'],
        vowel: ['a', 'e', 'i', 'o', 'u'],
        consonant: [
            'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
            'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'],
        entry: [['%male_name', '%wsp', '%last_name',
                 '%wsp', 'm', '%ws', '%notes'],
                ['%female_name', '%wsp', '%last_name',
                 '%wsp', 'f', '%ws', '%notes']],
        notes: [['(', '%quirk', ' ', '%skill', ')']],
        skill: ['baker', 'cook', 'blacksmith', 'cobbler',
                'soldier', 'guard', 'carpenter', 'poet',
                'musician(lute)', 'musician(flute)'],
        quirk: ['quick-tempered', 'selfish', 'shy',
                'generous', 'gregarious', 'secretive',
                'stern', 'meddlesome', 'aloof'],

        male_name: ['Merek', 'Carac', 'Ulric', 'Tybalt', 'Borin',
                    'Sadon', 'Terrowin', 'Rowan', 'Forthwind', 'Brom',
                    'Hadrian', 'Walter', 'Gregory', 'Peter', 'Henry',
                    'Frederick', 'Thomas', 'Arthur', 'Bryce',
                    'Leofrick', 'Lief', 'Barda', 'Jarin', 'Gavin',
                    'Josef', 'Doran', 'Asher', 'Quinn', 'Zane',
                    'Favian', 'Destrian', 'Dain', 'Berinon',
                    'Tristan', 'Gorvenal'],
        female_name: ['Alys', 'Ayleth', 'Ailenor', 'Cedany', 'Ellyn',
                      'Helewys', 'Sybbyl', 'Ysmay', 'Thea', 'Amelia',
                      'Bess', 'Catherine', 'Anne', 'Mary', 'Arabella',
                      'Elspeth', 'Hidlegard', 'Brunhild', 'Adelaide',
                      'Beatrix', 'Emaline', 'Isabel', 'Margaret',
                      'Mirabelle', 'Rose', 'Guinevere', 'Isolde',
                      'Maerwynn', 'Godiva', 'Catrain', 'Jasmine',
                      'Josslyn', 'Victoria', 'Gwendolynn', 'Janet',
                      'Krea', 'Dimia', 'Ariana', 'Katrina', 'Loreena',
                      'Serephina', 'Duriana', 'Ryia', 'Ryla'],
        last_name: [['%last_first', '%last_last']],
        last_first: ['Yard', 'River', 'Stone', 'Cobble', 'Tangle',
                     'Yarn', 'Loom', 'Fletch', 'Notch', 'Buckle'],
        last_last: ['star', 'ran', 'mace', 'mance', 'alber',
                    'ton', 'berry', 'merry', 'string'],
    });
}(typeof exports === 'undefined' ? this.omnivore = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var omnivore = exports;

    console.log('Omnivore:');
    for (var ii = 0; ii < 10; ++ii)
        console.log(' ', omnivore.example.generate('entry'));
}
