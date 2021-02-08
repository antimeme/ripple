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
// :TODO: equality test should not care about bound variable names
// :TODO: mixing bound and free variables should report an error
// :TODO: allow use of internal library on command line
// :TODO: consolidate curried expressions when possible
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

    var lambda = {
        create: function(value) {
            var result;

            // Creates a lambda expression from a string description
            if (lambda.isPrototypeOf(value)) {
                result = Object.create(this);
                result.parent    = value.parent;
                result.variables = value.variables.slice();
                result.values    = value.values.slice();
                result.normal    = value.normal;
            } else if (typeof(value) === "string")
                result = this.__parse(this.__tokenize(value));
            else throw "Invalid expression initializer: " + value
            return result;
        },

        __create: function() {
            var result = Object.create(this);
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
            var stack  = [];
            var pstack = [];
            var current = result;
            var next;
            var depth = 0;
            var abstraction = null;

            tokens.forEach(function(token) {
                if (token === '(') {
                    if (!abstraction) {
                        pstack.push(true);
                        stack.push(current);
                        next = this.__create();
                        current.values.push(next);
                        current = next;
                        depth += 1;
                    } else throw ("Invalid lambda expression: " +
                                  tokens.join(' '));
                } else if (token === ')') {
                    if (abstraction)
                        throw ("Invalid lambda expression: " +
                               tokens.join(' '));
                    else if (current.values.length === 0)
                        throw ("Empty parentheses: " +
                               tokens.join(' '));
                    else if (depth === 0)
                        throw ("Mismatched parentheses: " +
                               tokens.join(' '));
                    else {
                        do next = stack.pop();
                        while (!pstack.pop());
                        current = next;
                        depth -= 1;
                    }
                } else if ((token === '\u03bb') ||
                           (token.toLowerCase() === "lambda")) {
                    if (!abstraction) {
                        abstraction = {};
                        if ((current.values.length > 0) ||
                            (current.variables.length > 0)) {
                            pstack.push(false);
                            stack.push(current);
                            next = this.__create();
                            current.values.push(next);
                            current = next;
                        }
                    } else throw ("Invalid abstraction nesting: " +
                                  tokens.join(' '));
                } else if ('.' === token) {
                    if (!abstraction) {
                        throw ("Invalid abstraction termination: " +
                               tokens.join(' '));
                    } else if (current.variables.length === 0) {
                        throw ("Invalid empty abstraction: " +
                               tokens.join(' '));
                    } else abstraction = null;
                } else if (abstraction) {
                    if (abstraction[token])
                        throw ("Invalid repetition of \"" + token +
                               "\": " + tokens.join(' '));
                    abstraction[token] = true;
                    current.variables.push(token);
                } else current.values.push(token);
            }, this);
            if (depth > 0)
                throw ("Missing terminating parenthesis: " +
                       tokens.join(' '));
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
            // Collects all free and bound variables in this expression.
            // Bound variables are those that are given a value by
            // application (they map to "false" here).  Free variables
            // are those that cannot be reduced (they map to "true").
            var result = {};
            this.variables.forEach(function(variable) {
                result[variable] = false; // bound
            }, this);
            this.values.forEach(function(value) {
                if (lambda.isPrototypeOf(value)) {
                    var subresult = value.getVariables();
                    Object.keys(subresult).forEach(function(key) {
                        if (subresult[key] && !(key in result))
                            result[key] = true;
                    });
                } else if ((typeof(value) === "string") &&
                           !(value in result))
                    result[value] = true; // free
            }, this);
            return result;
        },

        forEachFree: function(fn, self) {
            var result = fn ? [] : this;
            var variables = getVariables();
            Object.keys(variables).forEach(function(variable, index) {
                if (!variables[variable])
                    variable = variable; // skip bound variables
                else if (fn)
                    fn.apply(self, variable, index);
                else result.push(variable);
            });
            return result;
        },

        forEachBound: function(fn, self) {
            var result = fn ? [] : this;
            this.variables.forEach(function(variable, index) {
                if (fn)
                    fn.apply(self, variable, index);
                else result.push(variable);
            });
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
                throw "Cannot apply argument to expression";
            var result = lambda.create(this);
            return result.replace(result.variables.shift(), argument);
        },

        useLibrary: function(library, exclude) {
            var result   = this;
            var replaced = false;
            var values   = [];

            if (!library)
                library = lambda.defaultLibrary;
            if (!exclude)
                exclude = {};
            this.variables.forEach(function(variable) {
                exclude[variable] = true; });

            this.values.forEach(function(value) {
                if ((typeof(value) === "string") &&
                    (value in library) && !(value in exclude)) {
                    if (!library[value].ready)
                        library[value].ready = lambda.create(
                            library[value].expression);
                    values.push(library[value].ready);
                    replaced = true;
                } else if (lambda.isPrototypeOf(value)) {
                    var current = value.useLibrary(library, exclude);
                    values.push(current);
                    if (current !== value)
                        replaced = true;
                } else values.push(value);
            });
            if (replaced) {
                result = lambda.create(this);
                result.values = values;
            }
            return result;
        },

        reduce: function() {
            // Attempt to simplify this expression using normal
            // order evaluation.  This means we look for the
            // outer most and left most substitution possible.
            var result = this;
            var fn, argument, value;

            // Apply an outermost function if possible
            if ((result.values.length >= 2) &&
                (lambda.isPrototypeOf(result.values[0])) &&
                (result.values[0].variables.length > 0)) {
                result = (result === this) ?
                         lambda.create(result) : result;
                fn       = result.values.shift();
                argument = result.values.shift();
                value = fn.apply(argument);
                while (lambda.isPrototypeOf(value) &&
                       (value.variables.length === 0) &&
                       (value.values.length === 1))
                    value = value.values[0];
                result.values.unshift(value);
            } else { // Recursively check for inner functions to apply
                var values = [];
                var replaced = false;
                result.values.forEach(function(value) {
                    var current = value;
                    if (!replaced && lambda.isPrototypeOf(current))
                        current = current.reduce();
                    if (current !== value)
                        replaced = true;
                    values.push(current);
                });
                if (replaced) {
                    result = (result === this) ?
                             lambda.create(result) : result;
                    result.values = values;
                }
            }

            // Replace single value expressions with their value.
            // This avoids unnecessary and confusing extra layers.
            while ((result.variables.length === 0) &&
                   (result.values.length === 1) &&
                   lambda.isPrototypeOf(result.values[0]))
                result = result.values[0];

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

            this.values.forEach(function(value) {
                var representation = value.toString();
                if (lambda.isPrototypeOf(value) &&
                    (this.values.length > 1))
                    representation = '(' + representation + ')';
                result += separator + representation;
                separator = ' ';
            }, this);

            return result;
        },

        runTests: function(tests) {
            if (!tests || (tests.length === 0))
                tests = this.tests;
            tests.forEach(function(test) {
                var expression, expected, description, forever = false;
                if (test && (typeof(test) === "object")) {
                    expression = lambda.create(test.test);
                    if (test.expected)
                        expected = lambda.create(test.expected);
                    if (test.forever)
                        forever = true;
                    if (test.description)
                        description = test.description;
                } else if (typeof(test) === "string")
                    expression = lambda.create(test);

                if (typeof(description) === "string")
                    console.log(description);
                else if (Array.isArray(description))
                    description.forEach(function(line) {
                        console.log(line); });
                var count = 100;
                do {
                    if (!forever)
                        console.log(expression.toString());
                    expression = expression.reduce();
                } while (!expression.normal && (--count > 0));
                if (!forever && (count <= 0))
                    console.error("ERROR: depth exceeded");
                else if (forever && (count > 0))
                    console.error("ERROR: infinite loop halted");
                else if (expected && !expected.equals(expression))
                    console.error("ERROR: expected",
                                  expected.toString());
                else console.log("Success:",
                                 expression.getVariables());
                console.log();
            });
        },
        tests: [
            {test: "(lambda a.a) (lambda b.b)", expected: "lambda b.b",
             description: [
                 "Check a simple reduction."]},
            {test: "(lambda a.a a) (lambda b.b) 12", expected: "12",
             description: [
                 "Check a more complex reduction."]},
            {test: "(lambda a.a a) (lambda a.a a)", forever: true,
             description: [
                 "Check that infinite loops keep looping."]},
            {test: "(lambda a.b) ((lambda a.a a) (lambda a.a a))",
             expected: "b",
             description: [
                 "Check that normal order evaluation works."]},
            {test: "(lambda a.(lambda a.a) a) b", expected: "b",
             description: "Check that variables get shadowed."},
            {test: "(lambda a.a) (lambda b.b)", expected: "lambda c.c",
             description: [
                 "Check that variable names don't matter."]},
            {test: "(lambda a.lambda b.a) b", expected: "lambda c.b",
             description: [
                 "Tricks a naive implementation into producing the ",
                 "mockingbird.  The free variable b is not the same ",
                 "as the bound variable of the same name and should ",
                 "either cause an exception dynamic renaming of the ",
                 "bound variable."]}
        ],

    };

    lambda.combinators = {
        I: { name: "Identity",
             expression: "lambda a.a" },
        M: { name: "Mockingbird",
             expression: "lambda a.a a" },
        S: { name: "Starling",
             expression: "lambda a b c.a c (b c)" },
        K: { name: "Kestral",
             expression: "lambda a b.a" },
        KI: { name: "Kite",
              expression: "lambda a b.b" },
        C: { name: "Cardinal",
             expression: "lambda a b c.a c b" },
        B: { name: "Bluebird",
             expression: "lambda a b c.a (b c)" },
        T: { name: "Thrush",
             expression: "lambda a b.b a" },
        V: { name: "Virio",
             expression: "lambda a b f.f a b" },
        Y: { name: "Fixed-Point",
             expression: (
                 "lambda f.(lambda a.f (a a)) (lambda a.f (a a))") }
    };

    lambda.defaultLibrary = {
        TRUE: { name: "Logical TRUE",
                expression: lambda.combinators.K.expression },
        FALSE: { name: "Logical FALSE",
                 expression: lambda.combinators.KI.expression },
        NOT: { name: "Logical NOT",
               expression: lambda.combinators.C.expression },
        AND: { name: "Logical AND",
               expression: "lambda p q.p q p" },
        OR: { name: "Logical OR",
              expression: "lambda p q.p p q" },
        BOOLEQ: { name: "Boolean Equality",
                  expression: "lambda p q.p q (NOT q)" },
        PAIR: { expression: lambda.combinators.V.expression },
        HEAD: { expression: "lambda p.p TRUE" },
        TAIL: { expression: "lambda p.p FALSE" },
        ISNIL: { expression: "lambda p.p (lambda a b.FALSE)" },
        NIL: { expression: "lambda a.TRUE" },
        SUCCESSOR: { name: "Successor",
                     expression: "lambda n f a.f (n f a)" },
        ZERO: { name: "Church Numeral ZERO",
                expression: lambda.combinators.KI.expression },
        ONE: { name: "Church Numeral ONE",
               expression: "(SUCCESSOR ZERO)"},
        TWO: { name: "Church Numeral TWO",
               expression: "(SUCCESSOR ONE)"},
        THREE: { name: "Church Numeral THREE",
                 expression: "(SUCCESSOR TWO)"},
        FOUR: { name: "Church Numeral FOUR",
                expression: "(SUCCESSOR THREE)"},
        FIVE: { name: "Church Numeral FIVE",
                expression: "(SUCCESSOR FOUR)"},
        SIX: { name: "Church Numeral SIX",
               expression: "(SUCCESSOR FIVE)"},
        SEVEN: { name: "Church Numeral SEVEN",
                 expression: "(SUCCESSOR SIX)"},
        EIGHT: { name: "Church Numeral EIGHT",
                 expression: "(SUCCESSOR SEVEN)"},
        NINE: { name: "Church Numeral NINE",
                expression: "(SUCCESSOR EIGHT)"},
        ADD: { name: "Church Numeral Addition",
               expression: "lambda m n.n SUCCESSOR m" },
        MULTIPLY: { name: "Church Numeral Multiplication",
                    expression: lambda.combinators.B.expression },
        POWER: { name: "Church Numeral Exponentiation",
                 expression: lambda.combinators.T.expression },
        ISZERO: { name: "Church Numeral Zero Check",
                  expression: "lambda n.n (TRUE FALSE) TRUE" },
        PHI: { name: "Helper for PREDECESSOR",
               expression: (
                   "lambda p.PAIR (TAIL p) (SUCCESSOR (TAIL p))") },
        PREDECESSOR: { name: "Church Numeral Decrement",
                       expression: (
                           "lambda n.HEAD (n PHI (PAIR ZERO ZERO))") },
        SUBTRACT: { name: "Church Numeral Subtraction",
                    expression: "lambda m n.n PREDECESSOR m" },
        LESSEQ: { name: "Church Numeral Less Than or Equal",
                  expression: "lambda m n.ISZERO (SUBTRACT n m)" },
        EQ: { name: "Church Numeral Equality",
              expression: "lambda m n.AND (LESSEQ m n) (LESSEQ n m)" },
        GREATER: { name: "Church Numeral Greater Than",
                   expression: "lambda m n.NOT (LESSEQ m n)" },
        FACTORIAL: { name: "Church Numeral FACTORIAL",
                     expression: "Y (lambda f n.(EQ n ZERO) 1 " +
                                 "(MUTIPLY n (f (PREDECESSOR n))))" },
    };

    solvo.lambda = function(value) { return lambda.create(value); };
    solvo.runLambdaTests = function(tests) { lambda.runTests(tests); };
})(typeof exports === 'undefined'? this['solvo'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var solvo = exports;
    var action = "lambda";
    var actions = [];

    process.argv.splice(2).forEach(function (argument) {
        if (argument.startsWith("--")) {
            if (argument === "--math")
                action = "math";
            else if (argument === "--lambda")
                action = "lambda";
        } else actions.push(argument);
    });

    if (action === "math") {
        actions.forEach(function(action) {
            var expression = solvo.arithmetic.create(action);
            console.log(expression.toString() + " => " +
                        solvo.simplify(expression).toString());
        });
    } else if (action === "lambda")
        solvo.runLambdaTests(actions);
}
