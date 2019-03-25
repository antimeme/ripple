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
                if (Array.isArray(list[2]) &&
                    (list[2].length === 3) && (list[2][0] === 'and')) {
                    return ['stroke', list[1],
                            ['stroke', list[2][1], list[2][2]]];
                }
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
            result = [];
            if (config && config.down)
                expression = config.down(expression);

            expression.forEach(function(thing, index) {
                if (index > 0)
                    thing = transform(config, thing);
                result.push(thing);
            });

            if (config && config.up && (result.length > 0))
                result = config.up(result);
        }
        return result;
    };

    /**
     * Returns truthy iff a and b are the same expression.
     * This addresses intensional, not extensional, equality.  That
     * means some expressions that yield the same value for all
     * possible inputs will get false from this. */
    var equals = function(a, b) {
        var result = false;
        if ((typeof(a) === 'string') && (typeof(b) === 'string')) {
            result = (a === b);
        } else if (Array.isArray(a) && Array.isArray(b)) {
            if ((a.length === 3) && (a[0] === 'stroke') &&
                (b.length === 3) && (b[0] === 'stroke')) {
                result = ((equals(a[1], b[1]) && equals(a[2], b[2])) ||
                          (equals(a[1], b[2]) && equals(a[2], b[1])));
            } else result = a.every(function(element, index) {
                return equals(a[index], b[index]); });
        }
        return result;
    };

    var easynegate = function(expression) {
        var result = null;
        if (Array.isArray(expression) && (expression.length > 1)) {
            if (expression[0] === 'not')
                result = expression[1];
            else if (expression[0] === 'stroke')
                result = ['and'].concat(expression.slice(1));
        }
        return result;
    };

    var tokenize = function(value) {
        var states = {
            ready: 1,
        }, state;
        var result = [];
        for (var ii = 0; ii < value.length; ++ii)
            switch (states[state]) {
                case states.ready:
                    if ((value.indexOf(' ', ii) === ii) ||
                        (value.indexOf('\t', ii) === ii) ||
                        (value.indexOf('\r', ii) === ii) ||
                        (value.indexOf('\n', ii) === ii)) {
                    }
                default:
            };
        return result;
    };

    var parse = function(value) {
        return value;
    };

    logic.expression = function(value) { // Constructor
        if (!(this instanceof logic.expression))
            return new logic.expression(value);

        if (typeof(value) === 'string')
            this.__value = parse(value);
        else if (typeof(value) === 'boolean')
            this.__value = value;
        else if (Array.isArray(value))
            this.__value = value;
        else if (value instanceof logic.expression)
            this.__value = value.__value;
        else throw Error('Unsupported expression: ' + value);
    };

    logic.expression.prototype.equals = function() {
        var result = true;
        for (var ii = 0; ii < arguments.length; ++ii)
            if (!equals(this.__value, logic.expression(
                arguments[ii]).__value))
                result = false;
        return result;
    };

    logic.expression.prototype.toString = function(config) {
        var result;

        if (Array.isArray(this.__value) && (this.__value.length > 0)) {
            var operator = operators[this.__value[0]];
            if (operator.unary) {
                result = operator.sigil +
                         logic.expression(this.__value[1]).toString({
                             parens: true});
            } else {
                result = [];
                this.__value.forEach(function(thing, index, arr) {
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
        } else if (typeof(this.__value) === 'boolean') {
            result = this.__value ? 'true' : 'false';
        } else {
            result = 'UNKNOWN';
        }
        return result;
    };

    logic.expression.prototype.devolve = function() {
        return logic.expression(transform({
            down: function(expression) {
                var operator = operators[expression[0]];
                if (operator.devolve)
                    expression = operator.devolve(expression);
                return expression;
            }
        }, this.__value));
    };

    logic.expression.prototype.simplify = function() {
        return logic.expression(transform({
            up: function(expression) {
                var negate1, negate2;

                // Change (a stroke a) to not a
                if ((expression[0] === 'stroke') &&
                    (equals(expression[1], expression[2])))
                    expression = ['not', expression[1]];

                // Change not-nand to and
                if ((expression[0] === 'not') &&
                    Array.isArray(expression[1]) &&
                    (expression[1].length > 0) &&
                    (expression[1][0] === 'stroke'))
                    expression = ['and'].concat(
                        expression[1].slice(1));

                // Change nand-not-not to or
                if ((expression[0] === 'stroke') &&
                    (expression.length === 3) &&
                    ((negate1 = easynegate(expression[1])) !== null) &&
                    ((negate2 = easynegate(expression[2])) !== null))
                    expression = ['or', negate1, negate2];

                // Construct implications
                if ((expression[0] === 'stroke') &&
                    (expression.length === 3)) {

                    if (Array.isArray(expression[2]) &&
                        (expression[2].length === 2) &&
                        (expression[2][0] === 'not'))
                        expression = [
                            'implies', expression[1], expression[2][1]];
                    else if (Array.isArray(expression[2]) &&
                             (expression[2].length === 3) &&
                             (expression[2][0] === 'stroke') &&
                             equals(expression[2][1], expression[1]))
                        expression = [
                            'implies', expression[1], expression[2][2]];
                    else if ((negate2 = easynegate(
                        expression[2])) !== null)
                        expression = [
                            'implies', expression[1], negate2];
                    else if ((negate1 = easynegate(
                        expression[1])) !== null)
                        expression =
                            ['implies', expression[2], negate1];
                }


                // Simplify boolean constant expressions
                if ((expression[0] === 'not') &&
                    (expression.length === 2) &&
                    (typeof(expression[1]) === 'boolean')) {
                    expression = !expression[1];
                } else if ((expression[0] === 'stroke') &&
                           (expression.length === 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    if (expression[1]) {
                        if (typeof(expression[2]) === 'boolean')
                            expression = !expression[2];
                        else expression = ['not', expression[2]];
                    } else expression = true;
                } else if ((expression[0] === 'stroke') &&
                           (expression.length === 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ?
                                 ['not', expression[1]] : true;
                } else if ((expression[0] === 'and') &&
                           (expression.length === 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? expression[2] : false;
                } else if ((expression[0] === 'and') &&
                           (expression.length === 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ? expression[1] : false;
                } else if ((expression[0] === 'or') &&
                           (expression.length === 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? true : expression[2];
                } else if ((expression[0] === 'or') &&
                           (expression.length === 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ? true : expression[1];
                } else if ((expression[0] === 'implies') &&
                           (expression.length === 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? expression[2] : true;
                } else if ((expression[0] === 'implies') &&
                           (expression.length === 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ? true :
                                 ['not', expression[1]];
                }

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

    logic.library = {
        'Wajsberg': {
            Axiom: ['stroke', ['stroke', '&phi;',
                               ['stroke', '&psi;', '&chi;']],
                    ['stroke', ['stroke', ['stroke', '&tau;', '&chi;'],
                                ['stroke', ['stroke', '&phi;', '&tau;'],
                                 ['stroke', '&phi;', '&tau;']]],
                     ['stroke', '&phi;', ['stroke', '&phi;', '&psi;']]]],
        },
        'Kleene': {
            'Implication Introduction':
            ['implies', '&phi;', ['implies', '&psi;', '&phi;']],
            Deduction: ['implies', ['implies', '&phi;', '&psi;'],
                        ['implies', ['implies', '&phi;',
                                     ['implies', '&psi;', '&chi;']],
                         ['implies', '&phi;', '&chi;']]],
            'Conjunction Introduction':
                       ['implies', '&phi;',
                        ['implies', '&psi;',
                         ['and', '&phi;', '&psi;']]],
            'Conjunction Left Elimination':
                       ['implies', ['and', '&phi;', '&psi;'], '&phi;'],
            'Conjunction Right Elimination':
                       ['implies', ['and', '&phi;', '&psi;'], '&psi;'],
            'Disjunction Elimination':
                       ['implies', ['implies', '&phi;', '&psi;'],
                        ['implies', ['implies', '&chi;', '&psi;'],
                         ['implies', ['or', '&phi;', '&chi;'], '&psi;']]],
            'Disjunction Left Introduction':
                       ['implies', '&phi;', ['or', '&phi;', '&psi;']],
            'Disjunction Right Introduction':
                       ['implies', '&phi;', ['or', '&psi;', '&phi;']],
            'Contradiction': ['implies', ['implies', '&phi;', '&psi;'],
                              ['implies', ['implies', '&phi;',
                                           ['not', '&psi;']],
                               ['not', '&phi;']]],
            'Negation Elimination': [
                'implies', ['not', ['not', '&phi;']], '&phi;']
        },
    };
    logic.eachLibrary = function(fn, context) {
        var index = 0;
        Object.keys(logic.library).forEach(function(library) {
            Object.keys(logic.library[library]).forEach(
                function(formula) {
                    var expression = logic.expression(
                        logic.library[library][formula]);
                    fn.call(context, expression,
                            formula, library, index++);
                });
        });
    };
}(typeof exports === 'undefined' ? this.logic = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var logic = exports;
}
