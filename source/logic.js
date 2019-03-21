// logic.js
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
// A set of tools for exploring propositional calculus.
(function(logic) {
    'use strict';
    var operators = {
        stroke:  {sigil: '&#x22bc;'},
        not:     {
            sigil: '&not;', unary: true, devolve: function(list) {
                // TODO: support zero arguments?
                return ['stroke', list[1], list[1]]; }
        },
        implies: {
            sigil: '&#x27f9;', devolve: function(list) {
                // TODO: more than two arguments
                return ['stroke', list[1],
                        ['stroke', list[2], list[2]]]; }
        },
        and: {
            sigil: '&and;', devolve: function(list) {
                return ['stroke', ['stroke', list[1], list[2]],
                        ['stroke', list[1], list[2]]];
            }
        },
        or:      {
            // TODO: more than two arguments
            sigil: '&or;', devolve: function(list) {
                return ['stroke', ['stroke', list[1], list[1]],
                        ['stroke', list[2], list[2]]];
            }
        },
        bicond: {
            sigil: '&#x27fa;', devolve: function(list) {
                // TODO: implement this
                return list; }}
    };

    /**
     * Recursively scan an expression and change variables and
     * operators for higher level functions. */
    var transform = function(config, expression) {
        var result = expression;
        if (typeof(expression) === 'string') {
            if (config && config.variable)
                result = config.variable(expression);
        } else if (Array.isArray(expression)) {
            if (config && config.operator && (expression.length > 0))
                expression = config.operator(expression);

            result = [];
            expression.forEach(function(thing, index) {
                if (index > 0)
                    thing = transform(config, thing);
                result.push(thing);
            });
        }
        return result;
    };

    var equals = function(a, b) {
        if ((typeof(a) === 'string') && (typeof(b) === 'string')) {
            return a === b;
        } else if (Array.isArray(a) && Array.isArray(b)) {
            return a.every(function(element, index) {
                return equals(a[index], b[index]); });
        }
        return false;
    };

    logic.expression = function(value) {
        if (!(this instanceof logic.expression))
            return new logic.expression(value);

        if ((Array.isArray(value)) || (typeof(value) === 'string'))
            this.__value = value;
        else throw 'Unsupported: ' + value;
    };
    logic.expression.prototype.toString = function(config) {
        var result;

        if (Array.isArray(this.__value) && (this.__value.length > 0)) {
            var operator = operators[this.__value[0]];
            if (operator.unary) {
                result = operator.sigil +
                         logic.expression(this.__value[1]).toString();
            } else {
                result = [];
                this.__value.forEach(function(thing, index) {
                    if (index > 1)
                        result.push(operator.sigil);
                    if (index > 0)
                        result.push(logic.expression(thing).toString({
                            parens: true}));
                }, this);

                result = result.join(' ');
                if (config && config.parens)
                    result = '(' + result + ')';
            }
        } else if (typeof(this.__value) === 'string') {
            result = this.__value;
        } else {
            result = 'UNKNOWN';
        }
        return result;
    };

    logic.expression.prototype.devolve = function() {
        return logic.expression(transform({
            operator: function(expression) {
                var operator = operators[expression[0]];
                if (operator.devolve)
                    expression = operator.devolve(expression);
                return expression;
            }
        }, this.__value));
    };

    logic.expression.prototype.simplify = function() {
        return logic.expression(transform({
            operator: function(expression) {
                if (expression[0] === 'stroke')
                    expression = expression;
                return expression;
            }
        }, this.__value));
    };

    logic.expression.prototype.getFree = function() {
        var result = {};
        transform({variable: function(current) {
            result[current] = true;
        }}, this.__value);
        return Object.keys(result).sort();
    };

    logic.expression.prototype.substitute = function(variable, value) {
        return logic.expression(transform({
            variable: function(current) {
                if (current === variable)
                    current = value;
                return current;
            }
        }, this.__value));
    };

}(typeof exports === 'undefined' ? this.logic = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var logic = exports;
    var expressions = {
        nicod: ['stroke', ['stroke', '&phi;',
                           ['stroke', '&psi;', '&chi;']],
                ['stroke', ['stroke', ['stroke', '&tau;', '&chi;'],
                            ['stroke', ['stroke', '&phi;', '&tau;'],
                             ['stroke', '&phi;', '&tau;']]],
                 ['stroke', '&phi;', ['stroke', '&phi;', '&psi;']]]],
        'kleene-impl-intro':
               ['implies', '&phi;', ['implies', '&psi;', '&phi;']],
        'kleene-deduction':
               ['implies', ['implies', '&phi;', '&psi;'],
                ['implies', ['implies', '&phi;',
                             ['implies', '&psi;', '&chi;']],
                 ['implies', '&phi;', '&chi;']]],
        'kleene-conj-intro':
               ['implies', '&phi;', ['implies', '&psi;',
                                     ['and', '&phi;', '&psi;']]],
        'kleene-conj-lelim':
               ['implies', ['and', '&phi;', '&psi;'], '&phi;'],
        'kleene-conj-relim':
               ['implies', ['and', '&phi;', '&psi;'], '&psi;'],
        'kleene-disj-intro':
               ['implies', ['implies', '&phi;', '&psi;'],
                ['implies', ['implies', '&chi;', '&psi;'],
                 ['implies', ['or', '&phi;', '&chi;'], '&psi;']]],
        'kleene-disj-lintro':
               ['implies', '&phi;', ['or', '&phi;', '&psi;']],
        'kleene-disj-rintro':
               ['implies', '&phi;', ['or', '&psi;', '&phi;']],
        'kleene-contradict': ['implies', ['implies', '&phi;', '&psi;'],
                              ['implies', ['implies', '&phi;',
                                           ['not', '&psi;']],
                               ['not', '&phi;']]],
        'kleene-neg-elim':
               ['implies', ['not', ['not', '&phi;']], '&phi;']
    };

    console.log("<!DOCTYPE html>");
    Object.keys(expressions).forEach(function(name) {
        var expression = logic.expression(expressions[name]);
        console.log('<p>');
        console.log(' ', name, expression.toString());
        console.log(' <br />&nbsp;&nbsp;&nbsp;&nbsp;',
                    expression.getFree(),
                    expression.devolve().toString());
        console.log('</p>');
    });
}
