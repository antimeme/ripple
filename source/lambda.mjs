// lambda.js
// Copyright (C) 2017-2024 by Jeff Gold.
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
// :TODO: implement lazy evaluation

/**
 * Generating variable names uses this */
const pickCandidates = Array(26).fill().map(
    (el, index) => String.fromCharCode('a'.charCodeAt(0) + index));

/**
 * Represents an expression in Lambda calculus.
 * An expression can have zero or more variables.  When at least one
 * variable is present this is an abstraction and can be applied to
 * some other expression.  There can also be one or more values.
 * Passing a string to the constructor will attempt to create an
 * expression by parsing. */
class Lambda {
    #variables = undefined;
    #values = undefined;

    /**
     * Parse or copy an expression.  When given a Lambda object this
     * method creates a shallow copy which shares no data structures
     * with its source.  When given a string this method attempts to
     * parse it and create an expression from it. */
    constructor(value) {
        if (typeof(value) === "string") {
            this.#variables = [];
            this.#values = [];
            this.#parse(Lambda.tokenize(value));
        } else if (value instanceof Lambda) { // shallow copy
            this.#variables = value.#variables.slice();
            this.#values    = value.#values.slice();
        } else if (Array.isArray(value)) {
            this.#variables = [];
            this.#values    = value.slice();
        } else throw new TypeError(
            "invalid value (" + typeof(value) + "): " + value);
    }

    /**
     * Break a string down into tokens for easier parsing. */
    static tokenize(value) {
        const result = [];
        let start = undefined; // index where current token starts

        for (let ii = 0; ii < value.length; ++ii) {
            // A token must start with a valid character, which is
            // one that isn't white space, parentheses, dot or unicode
            // lambda.  The "start" variable begins undefined.  When
            // we find a valid character, we set it to the current
            // index.  The next time we find an invalid character we
            // collect all characters from the sart and set start back
            // to undefined again.
            if (/\s/.test(value[ii])) {
                if (!isNaN(start))
                    result.push(value.substring(start, ii));
                start = undefined;
            } else if ('(.\\\u03bb)'.includes(value[ii])) {
                if (!isNaN(start))
                    result.push(value.substring(start, ii));
                start = undefined;
                result.push(value[ii]);
            } else if (isNaN(start))
                start = ii;
        }

        // There may be one last token terminated by the end of the
        // input value.  Grab that if necessary.
        if (!isNaN(start))
            result.push(value.substring(start, value.length));
        return result;
    }

    /**
     * Populate this expression using a string of tokens.  This method
     * MUTATES the expression and MUST NOT be called externally. */
    #parse(tokens) {
        const stack  = []; // used to track sub-expressions
        const pstack = []; // used to separate parentheses and lambdas
        let abstraction = null; // truthy after lambda and before dot
        let depth = 0;
        let current = this;
        let next;

        tokens.forEach(token => {
            if (token === '(') {
                if (abstraction)
                    throw new Error("Invalid lambda expression: " +
                                    tokens.join(' '));
                pstack.push(true);
                stack.push(current);
                next = new Lambda([]);
                current.#values.push(next);
                current = next;
                depth += 1;
            } else if (token === ')') {
                if (abstraction)
                    throw new Error("Invalid lambda expression: " +
                                    tokens.join(' '));
                else if (current.#values.length === 0)
                    throw new Error("Empty parentheses: " +
                                    tokens.join(' '));
                else if (depth === 0)
                    throw new Error("Mismatched parentheses: " +
                                    tokens.join(' '));

                do next = stack.pop();
                while (!pstack.pop());
                current = next;
                depth -= 1;
            } else if ((token === '\u03bb') || (token === '\\') ||
                       (token.toLowerCase() === "lambda")) {
                if (abstraction)
                    throw new Error("Invalid abstraction nesting: " +
                                    tokens.join(' '));
                abstraction = {};

                // When a lambda is the first thing inside parenthesis
                // we can take over the current object.  Otherwise, we
                // nest a level deeper.
                if ((current.#values.length > 0) ||
                    (current.#variables.length > 0)) {
                    pstack.push(false);
                    stack.push(current);
                    next = new Lambda([]);
                    current.#values.push(next);
                    current = next;
                }
            } else if ('.' === token) {
                if (!abstraction)
                    throw new Error("Invalid abstraction " +
                                    "termination: " + tokens.join(' '));
                else if (current.#variables.length === 0)
                    throw new Error("Invalid empty abstraction: " +
                                    tokens.join(' '));
                else abstraction = null;
            } else if (abstraction) {
                if (abstraction[token])
                    throw new Error("Invalid repetition of \"" + token +
                                    "\": " + tokens.join(' '));
                abstraction[token] = true;
                current.#variables.push(token);
            } else current.#values.push(token);
        });
        if (depth > 0)
            throw new Error("Missing terminating parenthesis: " +
                            tokens.join(' '));
    }

    /**
     * Return a string representation of the lambda expression. */
    toString() {
        return ((this.#variables.length > 0) ?
                ('\u03bb' + this.#variables.join(' ') + '.') : '') +
               this.#values.map((value, index, values) =>
                   ((value instanceof Lambda)
                       /* &&
                        *                     (values.length > 1) &&
                        *                     ((index + 1 < values.length) ||
                        *                      (value.#variables.length === 0)) */
                   ) ?
                   '(' + value.toString() + ')' :
                   value.toString()).join(' ');
    }

    /**
     * Collect all variables in the expression that are not bound
     * by an abstraction. */
    getFreeVariables() {
        const result = {};
        this.#values.forEach(value => {
            if (value instanceof Lambda) {
                Object.keys(value.getFreeVariables())
                      .forEach(variable => {
                          if (!this.#variables.includes(variable))
                              result[variable] = true; });
            } else if (typeof(value) === "string") {
                if (!this.#variables.includes(value))
                    result[value] = true;
            } else throw new TypeError("Unknown expression type: " +
                                       typeof(expression));
        });
        return result;
    }

    /**
     * Attempt to eliminate unnecessary complexity in an expression. */
    #simplify() {
        let result = this;
        result.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const simpler = value.#simplify();
                if (simpler !== value) {
                    result = new Lambda(result);
                    result.#values.splice(index, 1, simpler);
                }
            }
        });

        // A lambda with no variables that contains only a single
        // lambda is a useless wrapper
        if ((result.#variables.length === 0) &&
            (result.#values.length === 1) &&
            (result.#values[0] instanceof Lambda))
            result = result.#values[0];

        // A lambda with variables that contains only a single
        // lambda might be able to transfer its variables.
        if ((result.#variables.length > 0) &&
            (result.#values.length === 1) &&
            (result.#values[0] instanceof Lambda) &&
            !result.#variables.some(variable =>
                result.#values[0].#variables.includes(variable))) {
            result = new Lambda(result);
            const next = new Lambda(result.#values[0]);
            while (result.#variables.length > 0)
                next.#variables.unshift(result.#variables.pop());
            result = next;
        }

        // Pull up lambdas that contain nothing but a single variable
        result.#values.forEach((value, index) => {
            if ((value instanceof Lambda) &&
                (value.#variables.length === 0) &&
                (value.#values.length === 1) &&
                !(value.#values[0] instanceof Lambda)) {
                result = new Lambda(result);
                result.#values.splice(index, 1, value.#values[0]);
            }
        });

        return result;
    }

    /**
     * Replace all bound variables in the expression with enumerated
     * values.  So "\a b.a" becomes "\v1 v2.v1" for example.  This
     * makes it possible to compare expressions that are structurally
     * identical but with different bound variable names. */
    canonicalize(index, variables) {
        const result = new Lambda(this).#simplify();
        index = !isNaN(index) ? index : 0;
        variables = Object.assign({}, variables);

        result.#variables = this.#variables.map(variable =>
            variables[variable] = "v" + (++index));
        result.#values = this.#values.map(value =>
            (value instanceof Lambda) ?
            value.canonicalize(index, variables) :
            ((typeof(value) === "string") && variables[value]) ?
            variables[value] : value);
        return result;
    }

    #internalEqual(other) {
        return (other instanceof Lambda) &&
               (this.#variables.length === other.#variables.length) &&
               this.#variables.every((variable, index) =>
                   variable === other.#variables[index]) &&
               (this.#values.length === other.#values.length) &&
               this.#values.every((value, index) =>
                   (value instanceof Lambda) ?
                   value.#internalEqual(other.#values[index]) :
                   (value === other.#values[index]));
    }

    /**
     * Return true if and only if this expression and the other are
     * the same from the perspective of lambda calculus.  For this
     * purpose the names of bound variables don't matter so "\a.a b"
     * and "\c.c b" are equal but "\a.a d" is not. */
    equals(other) {
        return this.canonicalize().#internalEqual(
            other.canonicalize());
    }

    /**
     * Return true if and only if this expression can be reduced
     * directly at the top level */
    #reducible() {
        return ((this.#values.length >= 2) &&
                (this.#values[0] instanceof Lambda) &&
                (this.#values[0].#variables.length >= 1));
    }

    /**
     * Return true if and only if this expression is in normal form. */
    isNormal() {
        return !this.#reducible() &&
               this.#values.every(value =>
                   !(value instanceof Lambda) || value.isNormal());
    }

    /**
     * Replace instances of a free variable with some other value.
     * This operates recursively but does not mutate. */
    #replace(variable, replacement) {
        let result = this;
        if (!this.#variables.includes(variable)) {
            result = new Lambda(result);
            result.#values = this.#values.map(value =>
                (value instanceof Lambda) ?
                value.#replace(variable, replacement) :
                (value === variable) ? replacement : value);
        }
        return result;
    }

    /**
     * Return a variable name which is not a key in exclude */
    #pickUnique(exclude) {

        /**
         * Advance an array of components, propagating backwards
         * as necessary to enumerate all possible values. */
        function increment(components, candidates) {
            const least = components.slice(-1)[0];
            const rest = components.slice(0, -1);

            return (least + 1 < candidates.length) ?
                   (rest.concat([least + 1])) : (rest.length > 0) ?
                   (increment(rest, candidates).concat([0])) : [0, 0];
        }

        let result = undefined;
        let components = [0];
        do {
            result = components.reduce((acc, ii) =>
                acc + pickCandidates[ii], "");
            components = increment(components, pickCandidates);
        } while (result in exclude);
        return result;
    }

    /**
     * Rename a variable to something not found in the exclude object.
     * This method MUTATES the expression and MUST NOT be called
     * externally. */
    #rename(variable, exclude) {
        const replacement = this.#pickUnique(Object.assign(
            {}, exclude, this.getFreeVariables(),
            this.#variables.reduce((acc, vv) =>
                {acc[vv] = true; return acc;}, {})));
        this.#variables = this.#variables.map(vv =>
            (vv === variable) ? replacement : vv);
        this.#values = this.#values.map(value =>
            (value instanceof Lambda) ?
            value.#replace(variable, replacement) :
            (value === variable) ? replacement : value);
        return this;
    }

    /**
     * Replaces a variable with an expression. */
    #substitute(variable, expression) {
        let result = this;
        if (!this.#variables.includes(variable)) {
            const exclude = ((expression instanceof Lambda) ?
                             expression : new Lambda(expression))
                .getFreeVariables();
            result = new Lambda(this);
            Object.keys(exclude).forEach(freev => {
                if (result.#variables.includes(freev))
                    result.#rename(freev, exclude); });
            result.#values = this.#values.map(value =>
                (value instanceof Lambda) ?
                value.#substitute(variable, expression) :
                (value === variable) ? expression : value);
        }
        return result;
    }

    #apply(expression) {
        let result = this;
        if (this.#variables.length > 0) {
            result = new Lambda(this);
            const variable = result.#variables.shift();
            result.#values = result.#values.map(value =>
                (value instanceof Lambda) ?
                value.#substitute(variable, expression) :
                (value === variable) ? expression : value);
        } else result = new Lambda(this.#values.concat(expression));
        return result;
    }

    /**
     * Return an expression with one computation step completed.  This
     * method uses normal order evaluation, which performs the outer
     * most, left most reduction when more than one are available. */
    reduce() {
        let result = this;
        if (this.#reducible()) { // Direct
            const fn = this.#values[0];
            const argument = this.#values[1];
            const value = fn.#apply(argument);

            result = new Lambda(this);
            result.#values.splice(0, 2, value);
        } else this.#values.forEach((value, index) => { // Indirect
            // Skip variables and reductions after the first
            if ((result === this) && (value instanceof Lambda)) {
                const reduced = value.reduce();
                if (value !== reduced) {
                    result = new Lambda(this);
                    result.#values.splice(index, 1, reduced);
                }
            }
        });
        return result.#simplify();
    }

    applyLibrary(library, exclude) {
        let result   = new Lambda(this);
        library = library ? library : Lambda.defaultLibrary;
        exclude = Object.assign({}, exclude, this.#variables.reduce(
            (acc, vv) => { acc[vv] = true; return acc; }, {}));

        result.#values = this.#values.map(value =>
            (value instanceof Lambda) ?
            value.applyLibrary(library, exclude) :
            ((typeof(value) === "string") &&
             (value in library) && !(value in exclude)) ?
            (library[value].expression ? library[value].expression :
             (library[value].expression =
                 new Lambda(library[value].value))) : value);
        return result;
    }

    static eachLibrary(fn, library, self) {
        const result = fn ? self : [];
        library = library ? library : Lambda.defaultLibrary;
        Object.keys(library).forEach(name => {
            let entry = library[name];
            if (!entry.expression) {
                entry.expression = new Lambda(entry.value);
                entry.expression.color = entry.color;
            }
            if (fn)
                fn.call(self, entry.expression, name, entry);
            else result.push({ expression: entry.expression,
                               name: name });
        });
        return result;
    }

    reverseLibrary(library) {
        var result   = this;
        var replaced = false;
        var values   = [];
        library = library ? library : this.defaultLibrary;

        this.#values.forEach(function(value) {
            if (value instanceof Lambda) {
                var current = value.reverseLibrary(library);
                values.push(current);
                if (current !== value)
                    replaced = true;
            } else values.push(value);
        });
        if (replaced) {
            result = new Lambda(this);
            result.#values = values;
        }

        var selection = undefined;
        var priority  = undefined;
        Lambda.eachLibrary((expression, name, entry) => {
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
    }

    toStarlingKestral() { // :TODO:
        var result = this;
        var changed = false;
        if (result.variables.length === 0) {
            result = new Lambda(result);
            result.#values = result.#values.map(value =>
                (value instanceof Lambda) ?
                value.toStarlingKestral() : value);
        } else if ((result.#variables.length === 1) &&
                   (result.#values.length === 1) &&
                   (result.#variables[0] === result.#values[0])) {
            result = new Lambda("I"); // T[\x.x] => I
        } else if ((result.#variables.length > 0) &&
                   result.#values.some(value =>
                       (value instanceof Lambda) ?
                       value.getFreeVariables()[result.#variables[0]] :
                       ((typeof(value) === "string") &&
                        value === result.#variables[0]))) {
            // :FIXME: T[\x.E] => (K T[E]) (x not free in E)
        } else if (result.variables.length > 1) {
            // :FIXME: T[\x.\y.E] => T[\x.T[\y.E]] (x free in E)
        } else {
            // :FIXME: T[\x.(E F)] => (S T[\x.E] T[\x.F]) (x free in E or F)
        }
        return result;
    }

    static combinators = {
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
             value: "\\f.f (\\a b c.a c (b c)) \\d e.d" }
    };

    static __augmentLibrary(library) {
        var numbers = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE",
                       "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN",
                       "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
                       "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
        ["TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY",
         "SEVENTY", "EIGHTY", "NINETY"].forEach(function(current) {
             numbers.push(current);
             for (let ii = 1; ii < 10; ++ii)
                 numbers.push(current + numbers[ii]); });

        for (let ii = 0; ii <= numbers.length; ++ii) {
            let expression = (ii > 0) ? "f a" : "a";
            for (let jj = 2; jj <= ii; ++jj)
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
        return library;
    }

    static defaultLibrary = Lambda.__augmentLibrary({
        TRUE: { description: "Logical TRUE", priority: 2,
                value: Lambda.combinators.K.value },
        FALSE: { description: "Logical FALSE", priority: 2,
                 value: Lambda.combinators.KI.value },
        NOT: { description: "Logical NOT",
               value: Lambda.combinators.C.value },
        AND: { description: "Logical AND",
               value: "lambda p q.p q p" },
        OR: { description: "Logical OR",
              value: "lambda p q.p p q" },
        "BOOLEQ?": { description: "Boolean Equality",
                     value: "lambda p q.p q (NOT q)" },
        PAIR: { value: Lambda.combinators.V.value },
        HEAD: { value: "lambda p.p TRUE" },
        TAIL: { value: "lambda p.p FALSE" },
        "IS-NIL?": { value: "lambda p.p (lambda a b.FALSE)" },
        NIL: { value: "lambda a.TRUE" },
        SUCCESSOR: { description: "Successor",
                     value: "lambda n f a.f (n f a)" },
        ZERO: { description: "Church Numeral ZERO",
                value: Lambda.combinators.KI.value },
        ADD: { description: "Church Numeral Addition",
               value: "lambda m n f a.m f (n f a)" },
        MULTIPLY: { description: "Church Numeral Multiplication",
                    value: Lambda.combinators.B.value },
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
                     value: "lambda m n.IS-ZERO? (MINUS m n)" },
        "GREATEREQ?": {
            description: "Church Numeral Greater Than or Equal",
            value: "lambda m n.IS-ZERO? (MINUS n m)" },
        "LESS?": { description: "Church Numeral Less Than",
                   value: "lambda m n.NOT (GREATEREQ? m n)" },
        "GREATER?": { description: "Church Numeral Greater Than",
                      value: "lambda m n.NOT (LESSEQ? m n)" },
        "EQUAL?": { description: "Church Numeral Equality",
                    value: "lambda m n.AND (LESSEQ? m n) " +
                           "(LESSEQ? n m)" },
        NTH: { value: "lambda n l.n (lambda l.(IS-NIL? l) NIL " +
                      "(TAIL l)) l"},
        FIX: { description: "Fixed-point Combinator",
               value: Lambda.combinators.Y.value },
        FSTEP: { description: "Partial implementation of FACTORIAL",
                 value: "lambda f n.(IS-ZERO? n) ONE " +
                        "(MULTIPLY n (f (PREDECESSOR n)))" },
        FACTORIAL: { description: "Church Numeral FACTORIAL",
                     value: "FIX FSTEP" },
        SUM: { description: "Add up a list of numbers",
               value: "FIX (lambda f l.(IS-NIL? l) ZERO " +
                      "(ADD (HEAD l) (f (TAIL l))))" },
        MAP: { description: "Apply a function to each list member",
               value: "FIX (lambda f g l.(IS-NIL? l) NIL " +
                      "(PAIR (g (HEAD l)) (f g (TAIL l))))" },
        STARLING: { description: "Starling",
                    value: Lambda.combinators.S.value },
        KESTRAL: { description: "Kestral",
                   value: Lambda.combinators.K.value },
        IDENTITY: { description: "Identity",
                    value: Lambda.combinators.I.value },
        IOTA: { description: "Iota",
                value: Lambda.combinators.i.value },
    });

    static check(tests) {
        let failures = 0;
        Lambda.tests.forEach(test => {
            let expression;
            let expected;
            let description = [];
            let forever = false;

            if (typeof(test) === "string")
                expression = new Lambda(test);
            else if (test && (typeof(test) === "object")) {
                if (test.skip)
                    return;
                expression = new Lambda(test.test);
                if (test.expected)
                    expected = new Lambda(test.expected);
                forever = test.forever;
                description = Array.isArray(test.description) ?
                              test.description : [test.description];
            } else throw new Error("Unknown test type: " + typeof(test));

            description.forEach(line => { console.log(line); });
            console.log(expression.toString());
            console.log(expression.canonicalize().toString());
            let count = 100;
            for (; !expression.isNormal() && (count > 0); --count) {
                expression = expression.reduce();
                if (!forever)
                    console.log(">", expression.toString());
            }

            if (!forever && (count <= 0)) {
                console.error("ERROR: depth exceeded");
                ++failures;
            } else if (forever && (count > 0)) {
                console.error("ERROR: unexpected termination");
                ++failures;
            } else if (expected && !expected.equals(expression)) {
                console.error("ERROR: expected", expected.toString());
                ++failures;
            } else console.log("Success:", expression.getFreeVariables());
            console.log();
        });
        if (failures > 0) {
            console.log("Result: " + failures + " failed");
            return failures;
        }
    }

    static tests = [
        {test: "(lambda a.a) a", expected: "a",
         description: ["Check a simple reduction."]},
        {test: "(lambda a.a) lambda b.b", expected: "lambda b.b",
         description: ["Check a simple reduction."]},
        {test: "(lambda a.a a) (lambda b.b) c", expected: "c",
         description: ["Check a multi-step reduction."]},
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
         expected: "lambda c.c b (lambda a.a d)",
         description: ["Check that variable names don't matter."]},
        {test: "(lambda a.lambda b.a) b", expected: "lambda a.b",
         description: [
             "Tricks a naive implementation into producing the ",
             "identity.  The free variable b is not the same ",
             "as the bound variable of the same name and should ",
             "either cause an exception or dynamic renaming of ",
             "the bound variable."]},
    ];
}

export default Lambda;
