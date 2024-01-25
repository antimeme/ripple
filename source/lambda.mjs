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
// :TODO: better handling of library case insensitivity
// :TODO: optional controls in interface
// :TODO: create a number subclass for more flexible arithmetic
// :TODO: finish S K combinator conversion

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
                   ((value instanceof Lambda) &&
                    (values.length > 1) &&
                    ((index + 1 < values.length) ||
                     (value.#variables.length === 0))) ?
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
        this.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const simpler = value.#simplify();
                if ((simpler.#variables.length === 0) &&
                    (simpler.#values.length === 1) &&
                    !(simpler.#values[0] instanceof Lambda)) {
                    if (result === this)
                        result = new Lambda(result);
                    result.#values.splice(index, 1, simpler.#values[0]);
                } else if (simpler !== value) {
                    if (result === this)
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

        // Application is left associative, so embedded lambdas
        // at the front with no variables are just extra parentheses.
        if ((result.#values.length >= 1) &&
            (result.#values[0] instanceof Lambda) &&
            (result.#values[0].#variables.length === 0)) {
            const embedded = result.#values[0].#values;
            if (result === this)
                result = new Lambda(result);
            result.#values.splice(0, 1, ...embedded);
        }

        // A lambda with variables that contains only a single
        // lambda might be able to transfer its variables.
        if ((result.#variables.length > 0) &&
            (result.#values.length === 1) &&
            (result.#values[0] instanceof Lambda) &&
            !result.#variables.some(variable =>
                result.#values[0].#variables.includes(variable))) {
            if (result === this)
                result = new Lambda(result);
            const next = new Lambda(result.#values[0]);
            while (result.#variables.length > 0)
                next.#variables.unshift(result.#variables.pop());
            result = next;
        }

        return result;
    }

    /**
     * Replace all bound variables in the expression with enumerated
     * values.  So "\a b.a" becomes "\v1 v2.v1" for example.  This
     * makes it possible to compare expressions that are structurally
     * identical but with different bound variable names. */
    #canonicalize(index, variables) {
        const result = new Lambda(this).#simplify();
        index = !isNaN(index) ? index : 0;
        variables = Object.assign({}, variables);

        result.#variables = this.#variables.map(variable =>
            variables[variable] = "v" + (++index));
        result.#values = this.#values.map(value =>
            (value instanceof Lambda) ?
            value.#canonicalize(index, variables) :
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
        return this.#canonicalize().#internalEqual(
            other.#canonicalize());
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
    #pickUnused(exclude) {

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
        const replacement = this.#pickUnused(Object.assign(
            {}, exclude, this.getFreeVariables(),
            this.#variables.reduce((acc, vv) =>
                { acc[vv] = true; return acc; }, {})));
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

        if (!this.#variables.includes(variable) &&
            this.#values.some(value =>
                (value instanceof Lambda) ?
                (variable in value.getFreeVariables()) :
                (value === variable))) {
            const exclude = (expression instanceof Lambda) ?
                            expression.getFreeVariables() :
                            {[expression]: true};
            result = new Lambda(this);
            Object.keys(exclude).forEach(freev => {
                if (result.#variables.includes(freev))
                    result.#rename(freev, exclude); });
            result.#values = result.#values.map(value =>
                (value instanceof Lambda) ?
                value.#substitute(variable, expression) :
                (value === variable) ? expression : value);
        }
        return result;
    }

    /**
     * Return an expression with one computation step completed.  This
     * method uses normal order evaluation, which performs the outer
     * most, left most reduction when more than one are available. */
    reduce() {
        let result = this;
        if (this.#reducible()) { // Direct
            const fn = new Lambda(this.#values[0]);
            result = new Lambda(this);
            result.#values.splice(0, 2, fn.#substitute(
                fn.#variables.shift(), this.#values[1]));
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

    static eachLibrary(fn, library, self) {
        const result = fn ? self : [];
        library = library ? library : Lambda.defaultLibrary;
        Object.keys(library).forEach(name => {
            const entry = library[name];
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

    applyLibrary(library, exclude, ignoreCase) {
        let result = this;
        library = library ? library : Lambda.defaultLibrary;
        exclude = Object.assign({}, exclude, this.#variables.reduce(
            (acc, vv) => { acc[vv] = true; return acc; }, {}));

        this.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const current = value.applyLibrary(
                    library, exclude, ignoreCase);
                if (current !== value) {
                    if (result === this)
                        result = new Lambda(this);
                    result.#values.splice(index, 1, current);
                }
            } else if (typeof(value) === "string") {
                const current = ignoreCase ?
                                value.toUpperCase() : value;
                if ((current in library) && !(value in exclude)) {
                    if (result === this)
                        result = new Lambda(this);
                    if (!library[current].expression)
                        library[current].expression =
                            new Lambda(library[current].value);
                    result.#values.splice(
                        index, 1, library[current].expression);
                }
            }
        });
        return result;
    }

    reverseLibrary(library) {
        let result = this;
        library = library ? library : Lambda.defaultLibrary;

        this.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const current = value.reverseLibrary(library);
                if (current !== value) {
                    if (result === this)
                        result = new Lambda(this);
                    result.#values.splice(index, 1, current);
                }
            }
        });

        Lambda.eachLibrary((expression, name, entry) => {
            if (expression.equals(result))
                result = new Lambda(name);
        }, library);
        return result.#simplify();
    }

    toStarlingKestral() { // incomplete!
        var result = this;
        var changed = false;
        if (result.variables.length === 0) {
            result = new Lambda(result);
            result.#values = result.#values.map(value =>
                (value instanceof Lambda) ?
                value.toStarlingKestral() : value);
        } else if ((result.#values.length === 1) &&
                   (result.#variables.length === 1) &&
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

    static __augmentLibrary(library) {
        var numbers = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE",
                       "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN",
                       "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
                       "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
        ["TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY",
         "SEVENTY", "EIGHTY", "NINETY"].forEach(current => {
             numbers.push(current);
             for (let ii = 1; ii < 10; ++ii)
                 numbers.push(current + numbers[ii]); });
        numbers.push("ONEHUNDRED");

        for (let ii = 0; ii < numbers.length; ++ii) {
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

        library["="] = library["EQUAL?"];
        library["+"] = library["PLUS"]  = library["ADD"];
        library["*"] = library["TIMES"] = library["MULTIPLY"];
        library["-"] = library["MINUS"] = library["SUBTRACT"];
        library["/"] = library["DIVIDE"];
        return library;
    }

    static defaultLibrary = Lambda.__augmentLibrary({
        TRUE: { description: "Logical TRUE", priority: 2,
                value: "\\a b.a" },
        FALSE: { description: "Logical FALSE", priority: 2,
                 value: "\\a b.b" },
        NOT: { description: "Logical NOT",
               value: "\\a b c.a c b" },
        AND: { description: "Logical AND",
               value: "\\p q.p q p" },
        OR: { description: "Logical OR",
              value: "\\p q.p p q" },
        "BOOLEQ?": { description: "Boolean equality",
                     value: "\\p q.p q (NOT q)" },

        PAIR: { value: "\\h t f.f h t" },
        HEAD: { value: "\\p.p TRUE" },
        TAIL: { value: "\\p.p FALSE" },
        "IS-NIL?": { value: "\\p.p (\\a b.FALSE)" },
        NIL: { value: "\\a.TRUE" },

        SUCCESSOR: { description: "Adds one to a Church numerals",
                     value: "\\n f a.f (n f a)" },
        ZERO: { description: "Zero expressed as a Church numeral",
                value: "\\f a.a" },
        ADD: { description: "Addition of Church numerals",
               value: "\\m n f a.m f (n f a)" },
        MULTIPLY: { description: "Multiplication of Church numerals",
                    value: "\\m n f.m (n f)" },
        POWER: { description: "Exponentiation of Church numerals",
                 value: "\\m n f a.(n m) f a" },
        "IS-ZERO?": { description: "Reduces to true if an only if " +
                                   "argument is zero",
                      value: "\\n.n (\\a.FALSE) TRUE" },
        "IS-EVEN?": { description: "Reduces to true if and only if " +
                                   "argument is even",
                      value: "\\n.n (\\a.NOT a) TRUE" },
        "IS-ODD?": { description: "Reduces to true if and only if " +
                                  "argument is odd",
                     value: "\\n.n (\\a.NOT a) FALSE" },
        PREDECESSOR: { description: "Decrements a Church numeral",
                       value: "\\n f a.n (\\g h.h (g f)) " +
                              "(\\c.a) (\\u.u)" },
        SUBTRACT: { description: "Subtraction of Church numerals",
                    value: "\\m n.n PREDECESSOR m" },
        DIVIDE: { description: "Division of Church numerals",
                  value: "\\n.((\\f.(\\x.x x) " +
                         "(\\x.f (x x))) (\\c.\\" +
                         "n.\\m.\\f.\\x.(\\" +
                         "d.(\\n.n (\\x.(\\" +
                         "a.\\b.b)) (\\a.\\b.a)) d " +
                         "((\\f.\\x.x) f x) " +
                         "(f (c d m f x))) ((\\m.\\n.n " +
                         "(\\n.\\f.\\x.n (\\" +
                         "g.\\h.h (g f)) (\\u.x) " +
                         "(\\u.u)) m) n m))) ((\\" +
                         "n.\\f.\\x. f (n f x)) n)"},

        "LESSEQ?": {
            description: "Reduces to true if the first Church " +
                         "numeral is less than or equal to " +
                         "the second",
            value: "\\m n.IS-ZERO? (SUBTRACT m n)" },
        "GREATEREQ?": {
            description: "Reduces to true if the first Church " +
                         "numeral is greater than or equal to " +
                         "the second",
            value: "\\m n.IS-ZERO? (SUBTRACT n m)" },
        "LESS?": {
            description: "Reduces to true if the first Church " +
                         "numeral is less than the second",
            value: "\\m n.NOT (GREATEREQ? m n)" },
        "GREATER?": {
            description: "Reduces to true if the first Church " +
                         "numeral is greater than the second",
            value: "\\m n.NOT (LESSEQ? m n)" },
        "EQUAL?": {
            description: "Reduces to true if and only if the two " +
            "Church numeral arguments are the same",
            value: "\\m n.AND (LESSEQ? m n) (LESSEQ? n m)" },

        NTH: {
            description: "Reduces to the nth member of a list",
            value: "\\n l.n (\\l.(IS-NIL? l) NIL " +
                   "(TAIL l)) l"},
        FACTITER: {
            description: "Factorial computed iteratively",
            value: "λn.TAIL (n (λp.PAIR (+ ONE (HEAD p)) " +
                   "(* (HEAD p) (TAIL p))) (PAIR ONE ONE))"},

        FIX: {
            description: "Fixed-point combinator for applying a " +
                         "function to itself repeatedly",
            value: "\\f.(\\a.f (a a)) \\a.f (a a)" },
        FACTORIAL: {
            description: "Factorial computed recursively",
            value: "FIX \\f n.IS-ZERO? n ONE " +
                   "(MULTIPLY n (f (PREDECESSOR n)))" },
        ADDUP: {
            description: "Return the sum of a Church numeral and " +
                         "all of its predecessors",
            value: "FIX \\f n.IS-ZERO? n ZERO " +
                   "(ADD n (f (PREDECESSOR n)))" },
        SUM: {
            description: "Reduce to the sum of all numbers in a list",
            value: "FIX \\f l.IS-NIL? l ZERO " +
                   "(ADD (HEAD l) (f (TAIL l)))" },
        MAP: { description: "Apply a function to each list member",
               value: "FIX \\f g l.IS-NIL? l NIL " +
                      "(PAIR (g (HEAD l)) (f g (TAIL l)))" },

        IDENTITY: { description: "Identity combinator",
                    value: "\\i.i" },
        KESTRAL: { description: "Kestral combinator",
                   value: "\\a b.a" },
        KITE: { description: "Kite combinator",
                value: "\\a b.b" },
        MOCKINGBIRD: { description: "Mockingbird combinator",
                       value: "\\a.a a" },
        CARDINAL: { description: "Cardinal combinator",
                    value: "\\a b c.a c b" },
        BLUEBIRD: { description: "Bluebird combinator",
                    value: "\\a b c.a (b c)" },
        THRUSH: { description: "Thrush combinator",
                  value: "\\a b.b a" },
        VIRIO: { description: "Virio combinator",
                 value: "\\a b c.c a b" },
        STARLING: { description: "Starling combinator",
                    value: "\\a b c.a c (b c)" },
        IOTA: { description: "Iota combinator",
                value: "\\f.f STARLING KESTRAL" },
    });

    static createInterface(element) {
        const expression = document.createElement("textarea");
        const steps = document.createElement("input");
        const delay = document.createElement("input");
        let repeating = false;

        expression.value =
            (typeof(element.dataset.expr) === "string") ?
            element.dataset.expr.replace(/\s+/g, " ") : "";

        function countReduce(expr) {
            if (expr.isNormal()) {
                repeating = false;
            } else {
                const value = parseInt(steps.value);
                steps.value = isNaN(value) ? 1 : (value + 1);
                expr = expr.reduce();
            }
            return expr;
        }

        function setExpression(expr) {
            expression.value = expr.toString();
            return expr;
        }

        function createButton(name, fn) {
            const button = document.createElement("button");
            button.appendChild(document.createTextNode(name));
            button.addEventListener("click", event => {
                try {
                     setExpression(fn(new Lambda(expression.value)));
                } catch (ex) { console.error(ex); alert(ex); }
            });
            element.appendChild(button);
        }

        function createRepeatButton(name, fn, pre, post) {
            const button = document.createElement("button");
            button.appendChild(document.createTextNode(name));
            function repeat() {
                try {
                    const expr = fn(new Lambda(expression.value));
                    setExpression(expr);
                    if (expr.isNormal()) {
                        if (post)
                            setExpression(post(expr));
                    } else if (repeating)
                        setTimeout(repeat, delay.value);
                } catch (ex) { console.error(ex); alert(ex); }
            }
            button.addEventListener("click", event => {
                try {
                    repeating = true;
                    if (pre)
                        setExpression(pre(new Lambda
                            (expression.value)));
                    setTimeout(repeat, delay.value);
                } catch (ex) { console.error(ex); alert(ex); }
            });
            element.appendChild(button);
        }

        createButton("Reduce", countReduce);
        createRepeatButton("Repeat", countReduce);
        createRepeatButton("Go", countReduce,
                           expr => expr.applyLibrary(),
                           expr => expr.reverseLibrary());
        createButton("Library", expr => expr.applyLibrary());
        createButton("Discover", expr => expr.reverseLibrary());
        steps.disabled = true;
        steps.style = "text-align: right; width: 5em;";
        element.appendChild(steps);
        delay.type = "range";
        delay.min = 5;
        delay.max = 1000;
        delay.value = 100
        delay.style = "text-align: right; width: 5em;";
        element.appendChild(delay);
        element.appendChild(document.createElement("br"));
        expression.setAttribute("rows", 12);
        expression.setAttribute("cols", 80);
        expression.addEventListener("input", event =>
            { repeating = false; steps.value = 0; });
        element.appendChild(expression);
        return element;
    }

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
            } else throw new Error("Unknown test type: " +
                                   typeof(test));

            if (description.length)
                description.forEach(line => { console.log(line); });
            console.log(expression.toString());
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
            } else console.log("Success:",
                               expression.getFreeVariables());
            console.log();
        });
        if (failures > 0) {
            console.log("Result: " + failures + " failed");
            return failures;
        }
    }

    static tests = [
        {test: "(\\a.a) a", expected: "a",
         description: ["Check a simple reduction."]},
        {test: "(\\a.a) \\b.b", expected: "\\b.b",
         description: ["Check a simple reduction."]},
        {test: "(\\a.a a) (\\b.b) c", expected: "c",
         description: ["Check a multi-step reduction."]},
        {test: "(\\a.a a) (\\a.a a)", forever: true,
         description: ["Check that infinite loops keep looping."]},
        {test: "(\\a.b) ((\\a.a a) (\\a.a a))",
         expected: "b", description: [
             "Check that normal order evaluation works."]},
        {test: "(\\a.(\\a.a) a a) b", expected: "b b",
         description: "Check that variables get shadowed."},
        {test: "(\\a.a) (\\b.b)", expected: "\\c.c",
         description: ["Check that variable names don't matter."]},
        {test: "\\a.a b (\\c.c d)",
         expected: "\\c.c b (\\a.a d)",
         description: ["Check that variable names don't matter."]},

        {test: "(\\a.\\b.a) b", expected: "\\a.b",
         description: ["Avoid free variable capture."]},
        {test: "(\\a b.a) b", expected: "\\a.b",
         description: ["Avoid free variable capture."]},
        {test: "(\\a.\\b.b) b", expected: "\\b.b",
         description: ["Don't avoid capture too hard."]},
        {test: "(\\a b.b) b", expected: "\\b.b",
         description: ["Don't avoid capture too hard."]},
        {test: "(\\g.(\\a.(\\b.a))) a", expected: "\\a b.a",
         description: ["Subtle capture problem."]},
        {test: "(\\g a b.a) a", expected: "\\a b.a",
         description: ["Subtle capture problem."]}
    ];
}

export default Lambda;
