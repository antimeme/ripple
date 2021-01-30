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
(function(solvo) {
    "use strict";

    var tokenize = function(data) {
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
    };

    var expression = {
        create: function(up) {
            var result = Object.create(this);
            result.values = [];
            result.op = undefined;
            result.up = up;
            result.term = false;
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
    };

    var parse = function(tokens) {
        var result = expression.create();
        var current = result, next;
        var ii;
        var item;
        var depth = 0;
        var ready = true;

        for (ii = 0; ii < tokens.length; ++ii) {
            if (tokens[ii] === '(') {
                current.values.push(next = expression.create(current));
                current = next;
                depth += 1;
            } else if (tokens[ii] === ')') {
                if (current.values.length === 0) {
                    throw 'Empty parentheses';
                } else if (current.up) {
                    if (current.term)
                        current = current.up;
                    current = current.up;
                    depth -= 1;
                } else throw 'Mismatched parentheses';
            } else if (tokens[ii] === '^') {
                // TODO
            } else if ('-/'.includes(tokens[ii])) {
                // TODO
            } else if ('+*'.includes(tokens[ii])) {
                if (!current.op)
                    current.op = tokens[ii];
                else if (current.op === '+' && tokens[ii] === '*') {
                    item = current.values.pop();
                    current.values.push(
                        next = expression.create(current));
                    next.term = true;
                    next.op = '*';
                    next.values.push(item);
                    current = next;
                } else if (current.op === '*' && tokens[ii] === '+') {
                    if (current.term) {
                         current = current.up;
                    } else {
                        next = expression.create();
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

    solvo.create = function(data) {
        return parse(tokenize(data));
    };

    var lambda = {
        create: function(value) {
            // Creates a lambda expression from a string description
            if (lambda.isPrototypeOf(value)) {
                var result = Object.create(this);
                result.parent    = value.parent;
                result.variables = value.variables.slice();
                result.values    = value.values.slice();
                result.normal    = value.normal;
                return result;
            }
            return this.__parse(this.__tokenize(value));
        },

        __create: function(parent) {
            var result = Object.create(this);
            result.parent    = parent;
            result.variables = [];
            result.values    = [];
            result.normal    = false;
            return result;
        },

        __tokenize: function(value) {
            var result = [], ii;
            var start = undefined; // index where current token starts
            var accept = function(tokens, value, start, ii) {
                if (!isNaN(start))
                    tokens.push(value.substring(start, ii));
            };

            for (ii = 0; ii < value.length; ++ii) {
                if (/\s/.test(value[ii])) {
                    start = accept(result, value, start, ii);
                } else if ('(.\u03bb)'.includes(value[ii])) {
                    start = accept(result, value, start, ii);
                    result.push(value[ii]);
                } else if (isNaN(start))
                    start = ii;
            }
            start = accept(result, value, start, ii);
            return result;
        },

        __parse: function(tokens) {
            var result = this.__create();
            var current = result;
            var next;
            var depth = 0;
            var abstraction = null;

            tokens.forEach(function(token) {
                if (token === '(') {
                    if (!abstraction) {
                        current.values.push(
                            next = this.__create(current));
                        current = next;
                        depth += 1;
                    } else throw "Invalid lambda expression";
                } else if (token === ')') {
                    if (abstraction)
                        throw "Invalid lambda expression";
                    else if (current.values.length === 0)
                        throw 'Empty parentheses';
                    else if (!current.parent)
                        throw "Mismatched parentheses";
                    else {
                        if (current.term)
                            current = current.parent;
                        current = current.parent;
                        depth -= 1;
                    }
                } else if ((token === '\u03bb') ||
                           (token === "lambda")) {
                    if (!abstraction) {
                        abstraction = {};
                        if (current.values > 0) {
                            current.values.push(
                                next = this.__create(current));
                            current = next;
                        }
                    } else throw "Invalid abstraction nesting";
                } else if ('.'.includes(token)) {
                    if (!abstraction) {
                        throw "Invalid abstraction termination";
                    } else if (current.variables.length === 0) {
                        throw "Invalid empty abstraction";
                    } else abstraction = null;
                } else if (abstraction) {
                    if (abstraction[token])
                        throw "Invalid variable repetition: " + token;
                    abstraction[token] = true;
                    current.variables.push(token);
                } else current.values.push(token);
            }, this);
            if (depth > 0)
                throw "Missing terminating parenthesis";
            return result;
        },

        equals: function(other) {
            return lambda.isPrototypeOf(other) &&
                   (this.variables.length == other.variables.length) &&
                   (this.values.length === other.values.length) &&
                   this.variables.every(function(variable, index) {
                       return (variable === other.variables[index]);
                   }) &&
                   this.values.every(function(value, index) {
                       return lambda.isPrototypeOf(value) ?
                              value.equals(other.values[index]) :
                              (value === other.values[index]);
                   });
        },

        getVariables: function() {
            var result = {};
            
            return result;
        },

        replace: function(variable, replacement) {
            // Replace a variable with some value except in cases
            // where some lambda argument shadows the variable
            var result = this;
            var replaced = false;
            var values = [];

            // Accumulate replacement values recursively
            this.values.forEach(function(value) {
                var current = value;
                if (lambda.isPrototypeOf(value)) {
                    if (!value.variables.some(
                        function(v) { return v === variable; }))
                        current = value.replace(variable, replacement);
                } else if (value === variable)
                    current = replacement;
                values.push(current);
                if (current != value)
                    replaced = true;
            });

            // Return the same instance if no changes were made
            if (replaced) {
                result = lambda.create(this);
                result.values = values;
            }
            return result;
        },

        apply: function(argument) {
            // Substitute the argument provided for the first variable
            // of this expression.  Obviously it's an error to apply to
            // an expression with no variables.
            if (this.variables.length === 0)
                throw "Cannot apply argument to application expression";
            var result = lambda.create(this);
            var variable = result.variables.shift();
            return result.replace(variable, argument);
        },

        reduce: function() {
            // Attempt to simplify this expression.
            var result = this;
            var fn, argument, value;

            if ((result.values.length >= 2) &&
                (lambda.isPrototypeOf(result.values[0])) &&
                (result.values[0].variables.length > 0)) {
                result = (result === this) ?
                         lambda.create(result) : result;
                fn       = result.values.shift();
                argument = result.values.shift();
                value = fn.apply(argument);

                if ((result.values.length === 0) &&
                    (result.variables.length === 0) &&
                    lambda.isPrototypeOf(value))
                    result = value;
                else result.values.unshift(value);
            }

            var values = [];
            var replaced = false;
            result.values.forEach(function(value) {
                var current = value;
                if (lambda.isPrototypeOf(current)) {
                    current = current.reduce();
                    if ((current.variables.length === 0) &&
                        (current.values.length === 1))
                        current = current.values[0];
                }
                if (current !== value)
                    replaced = true;
                values.push(current);
            });
            if (replaced) {
                if (result === this)
                    result = lambda.create(result);
                result.values = values;
            }

            result.normal = (result === this);
            return result;
        },

        toString: function() {
            var result = "";
            var separator = '';

            if (this.variables.length > 0) {
                result += '\u03bb';
                this.variables.forEach(function(variable) {
                    result += separator + variable;
                    separator = ' ';
                }, this);
                result += '.';
                separator = '';
            }

            this.values.forEach(function(value, index) {
                var representation = value.toString();
                if (lambda.isPrototypeOf(value) &&
                    (this.values.length > 1))
                    representation = '(' + representation + ')';
                result += separator + representation;
                separator = ' ';
            }, this);

            return result;
        },
    };

    lambda.combinators = {
        I: { name: "Identity",
             expression: lambda.create("lambda a.a") },
        M: { name: "Mockingbird",
             expression: lambda.create("lambda a.a a") },
        K: { name: "Kestral",
             expression: lambda.create("lambda a b.a") },
        KI: { name: "Kite",
              expression: lambda.create("lambda a b.b") },
        C: { name: "Cardinal",
             expression: lambda.create("lambda a b c.a c b") },
        B: { name: "Bluebird",
             expression: lambda.create("lambda a b c.a (b c)") },
        T: { name: "Thrush",
             expression: lambda.create("lambda a b.b a") },
        V: { name: "Virio",
             expression: lambda.create("lambda a b f.f a b") },
        Y: { name: "Fixed-Point",
             expression: lambda.create(
                 "lambda f.(lambda a.f (a a)) (lambda a.f (a a))") }
    };

    lambda.defaultLibrary = {
        TRUE: { name: "Logical Truth",
                expression: lambda.combinators.K },
        FALSE: { name: "Logical Falsity",
                 expression: lambda.combinators.KI },
        NOT: { name: "Logical Not",
               expression: lambda.combinators.C },
        AND: { name: "Logical And",
               expression: lambda.create("lambda p q.p q p") },
        OR: { name: "Logical Or",
              expression: lambda.create("lambda p q.p p q") },
        BOOLEQ: { name: "Boolean Equality",
                  expression: lambda.create("lambda p q.p q (NOT q)") },
        PAIR: { expression: lambda.combinators.V },
        HEAD: { expression: lambda.create("lambda p.p TRUE") },
        TAIL: { expression: lambda.create("lambda p.p FALSE") },
        NIL: { expression: lambda.create("lambda a.TRUE") },
        ISNIL: { expression: lambda.create(
            "lambda p.p (lambda a b.FALSE)") },
        ZERO: { name: "Church Numeral Zero",
                expression: lambda.combinators.KI },
        SUCCESSOR: { name: "Successor",
                     expression: lambda.create(
                         "lambda n f a.f (n f a)") },
        ADD: { name: "Church Numeral Addition",
               expression: lambda.create(
                   "lambda m n.n SUCCESSOR m") },
        MULTIPLY: { name: "Church Numeral Multiplication",
                    expression: lambda.combinators.B },
        POWER: { name: "Church Numeral Exponentiation",
                 expression: lambda.combinators.T },
        ISZERO: { name: "Church Numeral Zero Check",
                  expression: lambda.create(
                      "lambda n.n (TRUE FALSE) TRUE") },
        PHI: { name: "Helper for PREDECESSOR",
               expression: lambda.create(
                   "lambda p.PAIR (TAIL p) (SUCCESSOR (TAIL p))") },
        PREDECESSOR: { name: "Church Numeral Decrement",
                       expression: lambda.create(
                           "lambda n.HEAD (n PHI (PAIR ZERO ZERO))") },
        SUBTRACT: { name: "Church Numeral Subtraction",
                    expression: lambda.create(
                        "lambda m n.n PREDECESSOR m") },
        LESSEQ: { name: "Church Numeral Less Than or Equal",
                  expression: lambda.create(
                      "lambda m n.ISZERO (SUBTRACT n m)") },
        EQ: { name: "Church Numeral Equality",
              expression: lambda.create(
                  "lambda m n.AND (LESSEQ m n) (LESSEQ n m)") },
        GREATER: { name: "Church Numeral Greater Than",
                   expression: lambda.create(
                       "lambda m n.NOT (LESSEQ m n)") }
    };

    solvo.lambda = function(value) {
        return lambda.create(value);
    };

})(typeof exports === 'undefined'? this['solvo'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var solvo = exports;
    var expression;

    process.argv.splice(2).forEach(function (argument) {
        //expression = solvo.create(argument);
        //console.log(expression.toString() + " => " +
        //            solvo.simplify(expression).toString());

        expression = solvo.lambda(argument);

        var count = 20;
        do {
            console.log(expression.toString());
            expression = expression.reduce();
        } while (!expression.normal && (--count > 0));
        if (count <= 0)
            console.log("ERROR: depth exceeded");
        console.log();
    });
}
