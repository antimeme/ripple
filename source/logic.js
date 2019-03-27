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
//
// A detailed system proving the most important results from a single
// axiom (Łukasiewicz 1961) using single undefined operator and a
// single detatchment rule (a modified form of modus ponens):
//   https://projecteuclid.org/download/pdf_1/euclid.ndjfl/1093958259
// Axiomatization of Propositional Calculus with Sheffer Functors
// by Thomas W. Scharle.
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

    var complexity = function(value) {
        var result = 0;
        if (typeof(value) === 'boolean')
            result = 0;
        else if (typeof(value) === 'string')
            result = 1;
        else if (Array.isArray(value)) {
            value.forEach(function(item, index) {
                if (index > 0) {
                    var current = complexity(item);
                    if (current > result)
                        result = current;
                }
            });
            result += 1;
        }
        return result;
    };

    // Returns the negation of an easily negated expression or null.
    // What "easy" means here is a judgement call.  Obviously a "not"
    // expression is easy to negate.  A "stroke" expression can be
    // replaced by an "and" expression to negate it.
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

    // Returns true iff the operator matches and either the count
    // is falsy or contains the length of the expression.  This
    // routine assumes the expression argument is an array and that
    // count is either falsy or a positive integer.
    var matchOp = function(expression, operator, count) {
        return (expression.length >= 1) &&
               (expression[0] === operator) &&
               (!count || (expression.length === count));
    };

    var matchExprOp = function(expression, operator, count) {
        return Array.isArray(expression) &&
               matchOp(expression, operator, count);
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

    logic.parseLNotation = function(value) {
        var current;
        var index;
        var last;
        var stack = [];

        var complete = function(entry) {
            return (((entry[0] === 'stroke') ||
                     (entry[0] === 'implies') ||
                     (entry[0] === 'and') ||
                     (entry[0] === 'or')) &&
                    (entry.length >= 3)) ||
                   ((entry[0] === 'not') && (entry.length >= 2));
        };

        for (index = 0; index < value.length; ++index) {
            current = value[index];
            if (current === 'D') {
                stack.push(['stroke']);
            } else if (current === 'N') {
                stack.push(['not']);
            } else if (current === 'C') {
                stack.push(['implies']);
            } else if (current === 'A') {
                stack.push(['and']);
            } else if (current === 'K') {
                stack.push(['or']);
            } else if ((current >= 'a') && (current <= 'z')) {
                if (!stack.length)
                    throw Error("Invalid L Notation: " + value);

                // Complete entries on the way up
                while (stack.length > 0) {
                    last = stack.pop();
                    last.push(current);
                    if (complete(last)) {
                        current = last;
                    } else {
                        stack.push(last);
                        break;
                    }
                }
            }
        }
        return last;
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

    logic.expression.prototype.simplify = function(config) {
        return logic.expression(transform({
            up: function(expression) {
                var negate1, negate2;

                // Conjunction Compression
                if ((!config || (config.all || config.andsame)) &&
                    (matchOp(expression, 'and', 3) &&
                     equals(expression[1], expression[2])))
                    expression = expression[1];

                // Definition of NOT
                if ((!config || (config.all || config.not)) &&
                    matchOp(expression, 'stroke', 3) &&
                    equals(expression[1], expression[2]))
                    expression = ['not', expression[1]];

                // Definition of AND
                if ((!config || (config.all || config.and)) &&
                    matchOp(expression, 'not', 2) &&
                    matchExprOp(expression[1], 'stroke'))
                    expression = ['and'].concat(
                        expression[1].slice(1));

                // Definition of IMPLICATION
                if ((!config || (config.all || config.implies)) &&
                    matchOp(expression, 'stroke', 3)) {
                    negate1 = easynegate(expression[1]);
                    negate2 = easynegate(expression[2]);

                    if (negate1 && negate2)
                        expression = (complexity(expression[2]) <
                            complexity(expression[1])) ? [
                                'implies', expression[1], negate2] : [
                                    'implies', expression[2], negate1];
                    else if (negate1)
                        expression =
                            ['implies', expression[2], negate1];
                    else if (negate2)
                        expression =
                            ['implies', expression[1], negate2];
                }

                // Definition of OR
                if ((!config || (config.all || config.or)) &&
                    matchOp(expression, 'stroke', 3) &&
                    ((negate1 = easynegate(expression[1])) !== null) &&
                    ((negate2 = easynegate(expression[2])) !== null))
                    expression = ['or', negate1, negate2];

                // Simplify boolean constants
                if (matchOp(expression, 'not', 2) &&
                    (typeof(expression[1]) === 'boolean')) {
                    expression = !expression[1];
                } else if (matchOp(expression, 'stroke', 3)) {
                    if (typeof(expression[1]) === 'boolean') {
                        if (typeof(expression[2]) === 'boolean')
                            expression = !(expression[1] &&
                                           expression[2]);
                        else if (expression[1]) {
                            expression =
                                (!config || (config.all || config.not)) ?
                                ['not', expression[2]] : [
                                    'stroke', expression[2],
                                    expression[2]];
                        } else expression = true;
                    } else if (typeof(expression[2]) === 'boolean') {
                        if (expression[2]) {
                            expression =
                                (!config || (config.all || config.not)) ?
                                ['not', expression[1]] : [
                                    'stroke', expression[1],
                                    expression[1]];
                        } else expression = true;
                    }
                } else if (matchOp(expression, 'and', 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? expression[2] : false;
                } else if (matchOp(expression, 'and', 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ? expression[1] : false;
                } else if (matchOp(expression, 'or', 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? true : expression[2];
                } else if (matchOp(expression, 'or', 3) &&
                           (typeof(expression[2]) === 'boolean')) {
                    expression = expression[2] ? true : expression[1];
                } else if (matchOp(expression, 'implies', 3) &&
                           (typeof(expression[1]) === 'boolean')) {
                    expression = expression[1] ? expression[2] : true;
                } else if (matchOp(expression, 'implies', 3) &&
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

    var neolibrary = {
        'Nicod': { theorems: { axiom: "DDpDqrDDtDttDDsqDDpsDps" } },
        'Łukasiewicz': {
            theorems: {
                Axiom: "DDpDqrDDsDssDDsqDDpsDps",
                AxiomAlternate: "DDpDqrDDpDrpDDsqDDpsDps"
            },
        },
        "Kleene": {
            theorems: {
                "Axiom Implication Introduction": "CpCqp",
                "Axiom Deduction": "CCpqCCpCqrCpr",
                "Axiom Conjunction Introduction": "CpCqApq",
                "Axiom Conjunction Left Elimination": "CApqp",
                "Axiom Conjunction Right Elimination": "CApqq",
                "Axiom Disjunction Elimination": "CCpqCCrqCKprq",
                "Axiom Disjunction Left Introduction": "CpKpq",
                "Axiom Disjunction Right Introduction": "CpKqp",
                "Axiom Contradiction": "CCpqCCpNqNp",
                "Axiom Negation Elimination": "CNNpp",
            },
        }
    };

    var library = {
        'Nicod': { Axiom: { rule: "DDpDqrDDtDttDDsqDDpsDps" } },
        'Łukasiewicz': {
            Axiom1: { rule: "DDpDqrDDsDssDDsqDDpsDps" },
            Axiom2: { rule: "DDpDqrDDpDrpDDsqDDpsDps" },
        },
        'Wajsberg': { Axiom: { rule: "DDpDqrDDDsrDDpsDpsDpDpq" }, },
        'Kleene': {
            'Implication Introduction': "CpCqp",
            Deduction: "CCpqCCpCqrCpr",
            'Conjunction Introduction': "CpCqApq",
            'Conjunction Left Elimination': "CApqp",
            'Conjunction Right Elimination': "CApqq",
            'Disjunction Elimination': "CCpqCCrqCKprq",
            'Disjunction Left Introduction': "CpKpq",
            'Disjunction Right Introduction': "CpKqp",
            'Contradiction': "CCpqCCpNqNp",
            'Negation Elimination': "CNNpp"
        },
    };
    var getLibraryExpression = function(entry) {
        var value;

        if (typeof(entry) === 'string') {
            value = logic.parseLNotation(entry);
        } else if (Array.isArray(entry)) {
            value = entry;
        } else if ((typeof(entry) === 'object') && entry.rule) {
            if (typeof(entry.rule) === 'string')
                value = logic.parseLNotation(entry.rule);
            else if (Array.isArray(entry.rule))
                value = entry.rule;
        } else throw Error("Invalid library entry", entry);
        return logic.expression(value);
    };
    logic.findLibrary = function(name, formula) {
        return getLibraryExpression(library[name][formula]);
    };
    logic.eachLibrary = function(fn, context) {
        var index = 0;
        Object.keys(library).forEach(function(name) {
            Object.keys(library[name]).forEach(
                function(formula) {
                    var entry = library[name][formula];
                    var wajsberg = Array.isArray(entry) ?
                                   null : entry.wajsberg;
                    var expression = getLibraryExpression(entry);
                    fn.call(context, expression, {
                        name: name, formula: formula,
                        wajsberg: wajsberg, index: index++});
                });
        });
    };
}(typeof exports === 'undefined' ? this.logic = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var logic = exports;

    process.argv.forEach(function(value, index) {
        if (index > 1)
            console.log(logic.expression(
                logic.parseLNotation(value)).toString());
    });
}
