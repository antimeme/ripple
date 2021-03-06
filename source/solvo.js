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
//
// The solvo.lambda object is a complete implementation of the untyped
// lambda calculus.  For a brief introduction see:
//     http://www.cs.yale.edu/homes/hudak/CS201S08/lambda.pdf
//     https://en.wikipedia.org/wiki/Lambda_calculus
//
// :TODO: mixing bound and free variables should report an error
// :TODO: allow use of internal library on command line
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
            // Parse or copy an expression.  When given an expression
            // object this method creates a shallow copy which
            // shares no data structures with its source.  When given
            // a string this method attempts to parse it and create
            // an expression from it.
            var result;

            if (lambda.isPrototypeOf(value)) { // shallow copy
                result = Object.create(this);
                result.parent    = value.parent;
                result.variables = value.variables.slice();
                result.values    = value.values.slice();
                result.normal    = value.normal;
            } else if (typeof(value) === "string") {
                result = this.__parse(this.__tokenize(value));
            } else {
                result = Object.create(this);
                result.variables = [];
                result.values    = [];
                result.normal    = false;
            }
            result.__canonical = false;
            return result;
        },

        __tokenize: function(value) {
            // Break a string down into tokens for easier parsing.
            var result = [], ii;
            var start = undefined; // index where current token starts
            var accept = function(tokens, value, start, ii) {
                if (!isNaN(start))
                    tokens.push(value.substring(start, ii));
            };

            for (ii = 0; ii < value.length; ++ii) {
                if (/\s/.test(value[ii])) {
                    start = accept(result, value, start, ii);
                } else if ('(.\\\u03bb)'.includes(value[ii])) {
                    start = accept(result, value, start, ii);
                    result.push(value[ii]);
                } else if (isNaN(start))
                    start = ii;
            }
            start = accept(result, value, start, ii);
            return result;
        },

        __parse: function(tokens) {
            // Parse an array of string tokens and return the
            // expression they represent.
            var result = this.create();
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
                        next = this.create();
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
                } else if ((token === '\u03bb') || (token === '\\') ||
                           (token.toLowerCase() === "lambda")) {
                    if (!abstraction) {
                        abstraction = {};
                        if ((current.values.length > 0) ||
                            (current.variables.length > 0)) {
                            pstack.push(false);
                            stack.push(current);
                            next = this.create();
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

        __canonicalize: function(index, variables) {
            // Replace all bound variables in the expression with
            // enumerated values.  This should make it possible to
            // compare expressions that are structurally identical
            // but with different bound variable names.
            var result;
            if (this.__canonical)
                return this;

            result = lambda.create();
            index = !isNaN(index) ? index : 0;
            variables = (typeof(variables) === "object") ?
                        JSON.parse(JSON.stringify(variables)) : {};
            this.variables.forEach(function(variable) {
                var canonicalVariable = "v" + (++index);
                variables[variable] = canonicalVariable;
                result.variables.push(canonicalVariable);
            }, this);
            this.values.forEach(function(value) {
                var current = value;
                if ((typeof(value) === "string") && variables[value])
                    current = variables[value];
                else if (lambda.isPrototypeOf(value))
                    current = value.__canonicalize(index, variables);
                result.values.push(current);
            }, this);
            result.__canonical = true;
            return result;
        },

        equals: function(other) {
            // Return true if and only if this expression and the other
            // are the same from the perspective of lambda calculus.
            // For this purpose the names of bound variables don't
            // matter so "lambda a.a b" and "lambda c.c b" are equal.
            if (!lambda.isPrototypeOf(other))
                return false;
            var aa = this.__canonicalize();
            var bb = other.__canonicalize();
            return (aa.variables.length == bb.variables.length) &&
                   (aa.values.length === bb.values.length) &&
                   aa.variables.every(function(variable, index) {
                       return (variable === bb.variables[index]); }) &&
                   aa.values.every(function(value, index) {
                       return lambda.isPrototypeOf(value) ?
                              value.equals(bb.values[index]) :
                              (value === bb.values[index]); });
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

        __replace: function(variable, replacement) {
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
                        current = value.__replace(
                            variable, replacement);
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
            return result.__replace(result.variables.shift(), argument);
        },

        applyLibrary: function(library, exclude) {
            var result   = this;
            var replaced = false;
            var values   = [];

            library = library ? library : lambda.defaultLibrary;
            exclude = exclude ? JSON.parse(JSON.stringify(
                exclude)) : {};
            this.variables.forEach(function(variable) {
                exclude[variable] = true; });

            this.values.forEach(function(value) {
                if (lambda.isPrototypeOf(value)) {
                    var current = value.applyLibrary(library, exclude);
                    values.push(current);
                    if (current !== value)
                        replaced = true;
                } else if ((typeof(value) === "string") &&
                           (value in library) && !(value in exclude)) {
                    if (!library[value].expression)
                        library[value].expression = lambda.create(
                            library[value].value);
                    values.push(library[value].expression);
                    replaced = true;
                } else values.push(value);
            });
            if (replaced) {
                result = lambda.create(this);
                result.values = values;
            }
            return result;
        },

        reverseLibrary: function(library) {
            var result   = this;
            var replaced = false;
            var values   = [];

            library = library ? library : lambda.defaultLibrary;

            this.values.forEach(function(value) {
                if (lambda.isPrototypeOf(value)) {
                    var current = value.reverseLibrary(library);
                    values.push(current);
                    if (current !== value)
                        replaced = true;
                } else values.push(value);
            });
            if (replaced) {
                result = lambda.create(this);
                result.values = values;
            }
            replaced = result.__canonicalize();
            Object.keys(library).forEach(function(name) {
                var entry = library[name];
                if (!entry.expression)
                    entry.expression =
                        lambda.create(entry.value);
                if (entry.expression.equals(result))
                    result = name;
            });
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
                    if (!replaced && lambda.isPrototypeOf(current)) {
                        current = current.reduce();
                        if ((current.variables.length === 0) &&
                            (current.values.length === 1))
                            current = current.values[0];
                        if (current !== value)
                            replaced = true;
                    }
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

            // Attempt to consolidate nested abstractions
            while ((result.variables.length > 0) &&
                   (result.values.length === 1) &&
                   lambda.isPrototypeOf(result.values[0]) &&
                   (result.values[0].variables.length > 0)) {
                if (result.variables.some(function(variable) {
                    return variable ===
                        result.values[0].variables[0]; }))
                    break;

                result = lambda.create(result);
                var subresult = lambda.create(result.values.shift());

                result.variables.push(subresult.variables.shift());
                if (subresult.variables.length > 0)
                    result.values.unshift(subresult);
                else result.values = subresult.values;
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
                else console.log("Success:", expression.getVariables());
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
            {test: "(lambda a.lambda b.a) b", expected: "lambda a.b",
             description: [
                 "Tricks a naive implementation into producing the ",
                 "mockingbird.  The free variable b is not the same ",
                 "as the bound variable of the same name and should ",
                 "either cause an exception dynamic renaming of the ",
                 "bound variable."]}
        ],

        combinators: {
            I: { name: "Identity",
                 value: "lambda a.a" },
            M: { name: "Mockingbird",
                 value: "lambda a.a a" },
            S: { name: "Starling",
                 value: "lambda a b c.a c (b c)" },
            K: { name: "Kestral",
                 value: "lambda a b.a" },
            KI: { name: "Kite", value: "lambda a b.b" },
            C: { name: "Cardinal", value: "lambda a b c.a c b" },
            B: { name: "Bluebird", value: "lambda a b c.a (b c)" },
            T: { name: "Thrush", value: "lambda a b.b a" },
            V: { name: "Virio", value: "lambda a b f.f a b" },
            Y: { name: "Fixed-Point",
                 value: "lambda f.(lambda a.f (a a)) " +
                        "(lambda a.f (a a))" },
        },
    };

    lambda.defaultLibrary = {
        TRUE: { name: "Logical TRUE",
                value: lambda.combinators.K.value },
        FALSE: { name: "Logical FALSE",
                 value: lambda.combinators.KI.value },
        NOT: { name: "Logical NOT",
               value: lambda.combinators.C.value },
        AND: { name: "Logical AND",
               value: "lambda p q.p q p" },
        OR: { name: "Logical OR",
              value: "lambda p q.p p q" },
        "BOOLEQ?": { name: "Boolean Equality",
                     value: "lambda p q.p q (NOT q)" },
        PAIR: { value: lambda.combinators.V.value },
        HEAD: { value: "lambda p.p TRUE" },
        TAIL: { value: "lambda p.p FALSE" },
        ISNIL: { value: "lambda p.p (lambda a b.FALSE)" },
        NIL: { value: "lambda a.TRUE" },
        SUCCESSOR: { name: "Successor",
                     value: "lambda n f a.f (n f a)" },
        ZERO: { name: "Church Numeral ZERO",
                value: lambda.combinators.KI.value },
        ADD: { name: "Church Numeral Addition",
               value: "lambda m n f a.m f (n f a)" },
        MULTIPLY: { name: "Church Numeral Multiplication",
                    value: lambda.combinators.B.value },
        POWER: { name: "Church Numeral Exponentiation",
                 value: "lambda m n f a.(n m) f a" },
        "ISZERO?": { name: "Church Numeral Zero Check",
                     value: "lambda n.n (TRUE FALSE) TRUE" },
        PREDECESSOR: { name: "Church Numeral Decrement",
                       value: "lambda n f a.n (lambda g h.h (g f)) " +
                              "(lambda c.a) (lambda b.b)" },
        SUBTRACT: { name: "Church Numeral Subtraction",
                    value: "lambda m n.n PREDECESSOR m" },
        MINUS: { name: "Church Numeral Subtraction",
                 value: "lambda m n.n PREDECESSOR m" },
        DIVIDE: { name: "Church Numeral Division",
                  value: "lambda n.((lambda f.(lambda x.x x) " +
                         "(lambda x.f (x x))) (lambda c.lambda " +
                         "n.lambda m.lambda f.lambda x.(lambda " +
                         "d.(lambda n.n (lambda x.(lambda " +
                         "a.lambda b.b)) (lambda a.lambda b.a)) d " +
                         "((lambda f.lambda x.x) f x) " +
                         "(f (c d m f x))) ((lambda m.lambda n.n " +
                         "(lambda n.lambda f.lambda x.n (lambda " +
                         "g.lambda h.h (g f)) (lambda u.x) " +
                         "(lambda u.u)) m) n m))) ((lambda " +
                         "n.lambda f.lambda x. f (n f x)) n)"},
        "LESSEQ?": { name: "Church Numeral Less Than or Equal",
                     value: "lambda m n.ISZERO? (SUBTRACT m n)" },
        "EQUAL?": { name: "Church Numeral Equality",
                    value: "lambda m n.AND (LESSEQ? m n) " +
                           "(LESSEQ? n m)" },
        "GREATER?": { name: "Church Numeral Greater Than",
                      value: "lambda m n.NOT (LESSEQ? m n)" },
        "LESS?": { name: "Church Numeral Less Than",
                   value: "lambda m n.AND (LESSEQ? m n) " +
                          "(NOT (EQUAL? m n))" },
        "GREATEREQ?": { name: "Church Numeral Greater Than or Equal",
                        value: "lambda m n.NOT (LESS? m n)" },
        FIX: { name: "Fix-point Combinator",
               value: lambda.combinators.Y.value },
        FACTORIAL: { name: "Church Numeral FACTORIAL",
                     value: "FIX (lambda f n.(ISZERO? n) ONE " +
                            "(MULTIPLY n (f (PREDECESSOR n))))" },
        DEBUG: { name: "Debug",
                 value: "FIX (lambda f n.(ISZERO? n) n " +
                        "(f (PREDECESSOR n)))"},
    };
    (function(library) {
        var numbers = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX",
                       "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN",
                       "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
                       "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
                       "TWENTY", "TWENTYONE"];
        for (var ii = 1; ii <= 20; ++ii) {
            var entry = { name: "Church Numeral " + numbers[ii - 1],
                          value: null };
            var expression = "f a";
            for (var jj = 2; jj <= ii; ++jj)
                expression = "f (" + expression + ")";
            entry.value = "lambda f a." + expression;
            library[numbers[ii - 1]] = entry;
            library[ii] = entry;
        }

        library["+"] = library["PLUS"]  = library["ADD"];
        library["*"] = library["TIMES"] = library["MULTIPLY"];
        library["="] = library["EQUAL?"];
    })(lambda.defaultLibrary);

    solvo.lambda = function(value) { return lambda.create(value); };
    solvo.runLambdaTests = function(tests) { lambda.runTests(tests); };
    solvo.forEachLambda = function(fn, self) {
        var result = fn ? self : [];
        Object.keys(lambda.defaultLibrary).forEach(function(name) {
            var entry = lambda.defaultLibrary[name];
            if (!entry.expression) {
                entry.expression = lambda.create(entry.value);
                if (entry.color)
                    entry.expression.color = entry.color;
            }
            if (fn)
                fn.call(self, entry.expression, name);
            else result.push({
                name: name, expression: entry.expression});
        });
        return result;
    };
})(typeof exports === 'undefined'? this['solvo'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var solvo = exports;
    var action = "lambda";
    var tests = [];
    var allowOptions = true;

    process.argv.splice(2).forEach(function(argument) {
        if (allowOptions && (argument === "--")) {
            allowOptions = false;
        } else if (allowOptions && argument.startsWith("--")) {
            if (argument === "--math")
                action = "math";
            else if (argument === "--lambda")
                action = "lambda";
        } else tests.push(argument);
    });

    if (action === "math") {
        actions.forEach(function(action) {
            var expression = solvo.arithmetic.create(action);
            console.log(expression.toString() + " => " +
                        solvo.simplify(expression).toString());
        });
    } else if (action === "lambda")
        solvo.runLambdaTests(tests);
    else throw "Unknown action: " + action;
}
