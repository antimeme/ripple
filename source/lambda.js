// lambda.js
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
// A lambda calculus engine.  For details on lambda calculus see:
//     https://en.wikipedia.org/wiki/Lambda_calculus
//     http://www.cs.yale.edu/homes/hudak/CS201S08/lambda.pdf
//     https://plato.stanford.edu/entries/lambda-calculus/
//
// :TODO: allow use of internal library on command line
(function() {
    "use strict";

    var getFreeVariables = function(expression, includeBound) {
        // Collect all variables that are free in the expression.
        // When includeBound is truthy any variables bound by
        // this expression itself will be included if they occur
        // free in the expression.  Otherwise they are excluded.
        var result = {};
        if (lambda.isPrototypeOf(expression)) {
            expression.values.forEach(function(value) {
                var processVariable = function(variable) {
                    if (includeBound || !expression.variables.some(
                        function(v) { return v === variable; }))
                        result[variable] = true;
                }

                if (lambda.isPrototypeOf(value))
                    Object.keys(getFreeVariables(value))
                          .forEach(processVariable);
                else processVariable(value);
            }, this);
        } else if (typeof(expression) === "string")
            result[expression] = true;
        return result;
    };

    var lambda = {
        create: function(value) {
            // Parse or copy an expression.  When given an expression
            // object this method creates a shallow copy which
            // shares no data structures with its source.  When given
            // a string this method attempts to parse it and create
            // an expression from it.
            var result;

            if (typeof(value) === "string") {
                result = this.__parse(this.__tokenize(value));
            } else if (lambda.isPrototypeOf(value)) { // shallow copy
                result = Object.create(this);
                result.variables = value.variables.slice();
                result.values    = value.values.slice();
                result.normal    = value.normal;
            } else if (Array.isArray(value)) {
                result = Object.create(this);
                result.variables = [];
                result.values    = value.slice();
                result.normal    = false;
            } else {
                result = Object.create(this);
                result.variables = [];
                result.values    = [];
                result.normal    = false;
            }
            result.__free = getFreeVariables(result);
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

        __pickCandidates: undefined, // Cached data for __pickUnique

        __pickUnique: function(exclude) {
            // Return a variable name which is not a key in used
            var result = "";
            var candidates = this.__pickCandidates;
            var initCandidates = function() {
                if (!candidates) {
                    candidates = [];
                    for (var ii = 0; ii < 26; ++ii)
                        candidates.push(
                            String.fromCharCode(0x61 + ii));
                }
                return candidates;
            };
            this.__pickCandidates = initCandidates();

            var increment = function(components, candidates) {
                // Advance an array of components, propagating backwards
                // as necessary to ensure unique values.
                var current = components.pop();
                current += 1;

                if (current >= candidates.length) {
                    current = 0;
                    if (components.length > 0)
                        increment(components, candidates);
                    else components.push(0);
                }
                components.push(current);
                return components;
            };

            var components = [-1];
            do {
                increment(components, candidates);
                result = components.reduce(function(value, current) {
                    return value + candidates[current];
                }, "");
            } while (result in exclude);
            return result;
        },

        __rename: function(variable, exclude) {
            // Makes use of the equivalence of lambda expressions which
            // differ only in the name of bound variables to correct
            // problems caused by free variables that match bound
            // variables and change the meaning of expressions.
            var replacement;
            var extra = {};
            this.variables.forEach(function(current) {
                extra[current] = true; });
            exclude = Object.assign(exclude, extra);
            exclude = Object.assign(exclude, getFreeVariables(this));
            replacement = lambda.__pickUnique(exclude);

            var replace = function(expression) {
                if (lambda.isPrototypeOf(expression)) {
                    if (!expression.variables.some(v => v === variable))
                        expression.values =
                            expression.values.map(replace);
                } else if (expression === variable)
                    expression = replacement;
                return expression;
            };

            this.values = this.values.map(replace);
            this.variables = this.variables.map(function(current) {
                return (current == variable) ?
                       replacement : current; });
            return this;
        },

        __replace: function(variable, replacement) {
            // Replace a variable with some value except in cases
            // where some lambda argument shadows the variable
            var result   = this;
            var replaced = false;
            var values   = [];
            var free = getFreeVariables(replacement);

            // Free variables in the replacment must not match
            // bound variables or the results may be wrong
            this.variables.forEach(function(variable) {
                if (variable in free)
                    this.__rename(variable, free); }, this);

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

            // Return the same instance unless changes were made
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

        eachLibrary: function(fn, library, self) {
            var result = fn ? self : [];
            library = library ? library : this.defaultLibrary;
            Object.keys(library).forEach(function(name) {
                var entry = this.defaultLibrary[name];
                if (!entry.expression) {
                    entry.expression = lambda.create(entry.value);
                    entry.expression.color = entry.color;
                }
                if (fn)
                    fn.call(self, entry.expression, name, entry);
                else result.push({
                    expression: entry.expression,
                    name: name,
                });
            }, this);
            return result;
        },

        reverseLibrary: function(library) {
            var result   = this;
            var replaced = false;
            var values   = [];
            library = library ? library : this.defaultLibrary;

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

            var selection = undefined;
            var priority  = undefined;
            this.eachLibrary(function(expression, name, entry) {
                if (!entry.expression.equals(result))
                    return;
                if (!isNaN(priority) &&
                    (isNaN(entry.priority) ||
                     (entry.priority < priority)))
                    return;
                selection = name;
                priority  = entry.priority;
            });
            if (selection)
                result = selection;
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

        toStarlingKestral: function() {
            var result = this;
            var changed = false;
            if (result.variables.length === 0) {
                var values = result.values.map(function(value) {
                    var result = value;
                    if (lambda.isPrototypeOf(value))
                        result = value.toStarlingKestral();
                    if (result !== value)
                        changed = true;
                    return result;
                });
                if (changed)
                    result = lambda.create(values);
            } else if ((result.variables.length === 1) &&
                       (result.values.length === 1) &&
                       (result.variables[0] === result.values[0])) {
                result = lambda.create(["I"]); // T[\x.x] => I
            } else if (!(result.variables[0] in
                getFreeVariables(result, true))) {
                // T[\x.E] => (K T[E]) (x not free in E)
                result = lambda.create(result);
                result.variables.shift();
                result = lambda.create([
                    "K", result.toStarlingKestral()]);
            } else if (result.variables.length > 1) {
                // FIXME: T[\x.\y.E] => T[\x.T[\y.E]] (x free in E)
            } else {
                // FIXME: T[\x.(E F)] => (S T[\x.E] T[\x.F]) (x free in E or F)
            }
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

        updateDOM: function(selector, element) {
            // Not yet implemented.  This is intended to create a
            // web form in which lambda expressions can be reduced
            // and otherwise manipulated.
            if (!element)
                element = document;
            Array.prototype.forEach.call(
                element.querySelectorAll(selector),
                function(div, ii) {
            });
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
                                 getFreeVariables(expression));
                console.log();
            });
        },

        tests: [
            {test: "(lambda a.a) (lambda b.b)", expected: "lambda b.b",
             description: ["Check a simple reduction."]},
            {test: "(lambda a.a a) (lambda b.b) 12", expected: "12",
             description: ["Check a more complex reduction."]},
            {test: "(lambda a.a a) (lambda a.a a)", forever: true,
             description: ["Check that infinite loops keep looping."]},
            {test: "(lambda a.b) ((lambda a.a a) (lambda a.a a))",
             expected: "b", description: [
                 "Check that normal order evaluation works."]},
            {test: "(lambda a.(lambda a.a) a a) b", expected: "b b",
             description: "Check that variables get shadowed."},
            {test: "(lambda a.a) (lambda b.b)", expected: "lambda c.c",
             description: ["Check that variable names don't matter."]},
            {test: "lambda a.a b (lambda c.c d)",
             expected: "lambda a.a b (lambda c.c d)",
             description: ["Check that variable names don't matter."]},
            {test: "(lambda a.lambda b.a) b", expected: "lambda a.b",
             description: [
                 "Tricks a naive implementation into producing the ",
                 "identity.  The free variable b is not the same ",
                 "as the bound variable of the same name and should ",
                 "either cause an exception or dynamic renaming of ",
                 "the bound variable."]} ],

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
            i: { name: "Iota",
                 value: "lambda f.f (lambda a b c.a c (b c)) " +
                        "lambda d e.d" }
        },
    };

    lambda.defaultLibrary = {
        TRUE: { description: "Logical TRUE", priority: 2,
                value: lambda.combinators.K.value },
        FALSE: { description: "Logical FALSE", priority: 2,
                 value: lambda.combinators.KI.value },
        NOT: { description: "Logical NOT",
               value: lambda.combinators.C.value },
        AND: { description: "Logical AND",
               value: "lambda p q.p q p" },
        OR: { description: "Logical OR",
              value: "lambda p q.p p q" },
        "BOOLEQ?": { description: "Boolean Equality",
                     value: "lambda p q.p q (NOT q)" },
        PAIR: { value: lambda.combinators.V.value },
        HEAD: { value: "lambda p.p TRUE" },
        TAIL: { value: "lambda p.p FALSE" },
        ISNIL: { value: "lambda p.p (lambda a b.FALSE)" },
        NIL: { value: "lambda a.TRUE" },
        SUCCESSOR: { description: "Successor",
                     value: "lambda n f a.f (n f a)" },
        ZERO: { description: "Church Numeral ZERO",
                value: lambda.combinators.KI.value },
        ADD: { description: "Church Numeral Addition",
               value: "lambda m n f a.m f (n f a)" },
        MULTIPLY: { description: "Church Numeral Multiplication",
                    value: lambda.combinators.B.value },
        POWER: { description: "Church Numeral Exponentiation",
                 value: "lambda m n f a.(n m) f a" },
        "IS-ZERO?": { description: "Church Numeral Zero Check",
                      value: "lambda n.n (lambda a.FALSE) TRUE" },
        "IS-EVEN?": { description: "Church Numeral EvenCheck",
                      value: "lambda n.n (lambda a.NOT a) TRUE" },
        "IS-ODD?": { description: "Church Numeral Odd Check",
                     value: "lambda n.n (lambda a.NOT a) FALSE" },
        PREDECESSOR: { description: "Church Numeral Decrement",
                       value: "lambda n f a.n (lambda g h.h (g f)) " +
                              "(lambda c.a) IDENTITY" },
        SUBTRACT: { description: "Church Numeral Subtraction",
                    value: "lambda m n.n PREDECESSOR m" },
        MINUS: { description: "Church Numeral Subtraction",
                 value: "lambda m n.n PREDECESSOR m" },
        DIVIDE: { description: "Church Numeral Division",
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
        "LESSEQ?": { description: "Church Numeral Less Than or Equal",
                     value: "lambda m n.IS-ZERO? (SUBTRACT m n)" },
        "GREATEREQ?": {
            description: "Church Numeral Greater Than or Equal",
            value: "lambda m n.IS-ZERO? (SUBTRACT n m)" },
        "LESS?": { description: "Church Numeral Less Than",
                   value: "lambda m n.NOT (GREATEREQ? m n)" },
        "GREATER?": { description: "Church Numeral Greater Than",
                      value: "lambda m n.NOT (LESSEQ? m n)" },
        "EQUAL?": { description: "Church Numeral Equality",
                    value: "lambda m n.AND (LESSEQ? m n) " +
                           "(LESSEQ? n m)" },
        FIX: { description: "Fixed-point Combinator",
               value: lambda.combinators.Y.value },
        FACTORIAL: { description: "Church Numeral FACTORIAL",
                     value: "FIX (lambda f n.(IS-ZERO? n) ONE " +
                            "(MULTIPLY n (f (PREDECESSOR n))))" },
        STARLING: { description: "Starling",
                    value: lambda.combinators.S.value },
        KESTRAL: { description: "Kestral",
                   value: lambda.combinators.K.value },
        IDENTITY: { description: "Identity",
                    value: lambda.combinators.I.value },
        IOTA: { description: "Iota",
                value: lambda.combinators.i.value },
    };
    (function(library) {
        var numbers = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE",
                       "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN",
                       "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
                       "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
        ["TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY",
         "SEVENTY", "EIGHTY", "NINETY"].forEach(function(current) {
             numbers.push(current);
             for (var ii = 1; ii < 10; ++ii)
                 numbers.push(current + numbers[ii]); });

        for (var ii = 0; ii <= numbers.length; ++ii) {
            var expression = (ii > 0) ? "f a" : "a";
            for (var jj = 2; jj <= ii; ++jj)
                expression = "f (" + expression + ")";
            expression = "lambda f a." + expression;
            library[numbers[ii]] = {
                description: "Church Numeral " + numbers[ii],
                value: expression };
            library[ii] = {
                description: "Church Numeral " + ii,
                priority: 1, value: expression };
        }

        library["+"] = library["PLUS"]  = library["ADD"];
        library["*"] = library["TIMES"] = library["MULTIPLY"];
        library["="] = library["EQUAL?"];
    })(lambda.defaultLibrary);

    if (typeof(module) !== "undefined") {
        module.exports = lambda;
    } else if (typeof(exports) !== "undefined") {
        exports = lambda;
    } else window['lambda'] = lambda;
}).call(this);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var lambda = (typeof(module) !== "undefined") ?
                 module.exports : exports;
    var tests = [];
    var allowOptions = true;

    process.argv.splice(2).forEach(function(argument) {
        if (allowOptions && (argument === "--")) {
            allowOptions = false;
        } else if (allowOptions && argument.startsWith("--")) {
            if (argument === "--lambda")
                tests = tests; // obsolete
        } else tests.push(argument);
    });

    lambda.runTests(tests);
}
