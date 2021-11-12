// solvo.js
// Copyright (C) 2017-2021 by Jeff Gold.
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
// A collection of tools for solving equations.
(function(solvo) {
    "use strict";

    solvo.arithmetic = {
        create: function(value) {
            var result = Object.create(this);
            if (typeof(value) === "string") {
                result = this.__parse(this.__tokenize(value));
            } else if (solvo.arithmetic.isPrototypeOf(value)) {
                result.values = value.values.slice();
                result.op     = value.op;
                result.term   = value.term;
            } else {
                result.values = [];
                result.op = undefined;
                result.term = false
            }
            return result;
        },
        toString: function() {
            var result = '';
            var ii;
            for (ii = 0; ii < this.values.length; ++ii) {
                if (ii > 0)
                    result += ' ' + this.op + ' ';
                if (typeof(this.values[ii]) === 'object')
                    result += '(' + this.values[ii].toString() + ')';
                else result += this.values[ii].toString();
            }
            return result;
        },

        __tokenize: function(data) {
            var result = [], ii, start = undefined;
            var accept = function(tokens, data, start, ii) {
                var token;
                if (!isNaN(start)) {
                    token = data.substring(start, ii);
                    if (isNaN(token) && !isNaN(token[0]))
                        throw 'Invalid variable "' + token + '"';
                    tokens.push(token);
                }
            };

            for (ii = 0; ii < data.length; ++ii) {
                if (/\s/.test(data[ii])) {
                    start = accept(result, data, start, ii);
                } else if ('(+-*/^)'.includes(data[ii])) {
                    start = accept(result, data, start, ii);
                    result.push(data[ii]);
                } else if (isNaN(start)) {
                    start = ii;
                }
            }
            start = accept(result, data, start, ii);
            return result;
        },

        __parse: function(tokens) {
            var result = this.create();
            var current = result, next;
            var stack = [];
            var ii;
            var item;
            var depth = 0;
            var ready = true;

            for (ii = 0; ii < tokens.length; ++ii) {
                if (tokens[ii] === '(') {
                    next = this.create();
                    current.values.push(next);
                    stack.push(current);
                    current = next;
                    depth += 1;
                } else if (tokens[ii] === ')') {
                    if (current.values.length === 0) {
                        throw 'Empty parentheses';
                    } else if (stack.length > 0) {
                        if (current.term)
                            current = stack.pop();
                        current = stack.pop();
                        depth -= 1;
                    } else throw ('Mismatched parentheses: ' +
                                  tokens.join(" "));
                } else if (tokens[ii] === '^') {
                    // TODO
                } else if ('-/'.includes(tokens[ii])) {
                    // TODO
                } else if ('+*'.includes(tokens[ii])) {
                    if (!current.op)
                        current.op = tokens[ii];
                    else if (current.op === '+' && tokens[ii] === '*') {
                        item = current.values.pop();
                        next = this.create();
                        current.values.push(next);
                        stack.push(current);

                        next.term = true;
                        next.op = '*';
                        next.values.push(item);
                        current = next;
                    } else if (current.op === '*' &&
                               tokens[ii] === '+') {
                        if (current.term) {
                            current = stack.pop();
                        } else {
                            next = this.create();
                            next.op = '*';
                            next.values = current.values;
                            current.values = [next];
                            current.op = '+';
                        }
                    }
                    ready = true;
                } else if (ready) {
                    current.values.push(tokens[ii]);
                    ready = false;
                } else throw 'No operator between values';
            }
            if (depth > 0)
                throw 'Missing terminating parenthesis';
            if (ready)
                throw 'Missing expression component';
            return result;
        },
    };

    solvo.simplify = function(value) {
        var ii, scalar, current, replacements;
        // TODO distributed rule
        // TODO cancel denominator factors

        if (typeof(value) === 'object') {
            if (value.values.length === 1)
                value = solvo.simplify(value.values[0]);
            else if (value.op === '+') {
                scalar = 0; replacements = [];
                for (ii = 0; ii < value.values.length; ++ii) {
                    current = solvo.simplify(value.values[ii]);
                    if (isNaN(current))
                        replacements.push(current);
                    else scalar += parseInt(current, 10);
                }
                if (replacements.length === 0)
                    value = scalar;
                else if (scalar) {
                    replacements.push(scalar);
                    value.values = replacements;
                }
            } else if (value.op === '*') {
                scalar = 1; replacements = [];
                for (ii = 0; ii < value.values.length; ++ii) {
                    current = solvo.simplify(value.values[ii]);
                    if (isNaN(current))
                        replacements.push(current);
                    else scalar *= parseInt(current, 10);
                }
                if (replacements.length === 0)
                    value = scalar;
                else if (scalar !== 1) {
                    replacements.unshift(scalar);
                    value.values = replacements;
                }
            }
        }
        return value;
    };
})(typeof exports === 'undefined'? this['solvo'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var solvo = exports;
    var actions = [];
    var allowOptions = true;

    process.argv.splice(2).forEach(function(argument) {
        if (allowOptions && (argument === "--")) {
            allowOptions = false;
        } else if (allowOptions && argument.startsWith("--")) {
            if (argument === "--math")
                action = "math";
            else if (argument === "--lambda")
                action = "lambda";
        } else actions.push(argument);
    });

    actions.forEach(function(action) {
        var expression = solvo.arithmetic.create(action);
        console.log(expression.toString() + " => " +
                    solvo.simplify(expression).toString());
    });
}
