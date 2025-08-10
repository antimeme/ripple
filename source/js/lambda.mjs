// lambda.js
// Copyright (C) 2017-2025 by Jeff Gold.
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
// :TODO: create a number subclass for more flexible arithmetic

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
export class Lambda {
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
            if ((value.length === 1) &&
                (value[0] instanceof Lambda)) {
                this.#variables = value[0].#variables.slice();
                this.#values    = value[0].#values.slice();
            } else {
                this.#variables = [];
                this.#values    = value.slice();
            }
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
    simplify() {
        let result = this;
        this.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const simpler = value.simplify();
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
        const result = new Lambda(this).simplify();
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
     * the same from the perspective of lambda calculus.  This is
     * intensional equality, not extensional equality.  For this
     * purpose the names of bound variables don't matter so "\a.a b"
     * and "\c.c b" are equal but "\a.a d" is not. */
    equals(other) {
        if (typeof other === "string")
            other = new Lambda(other);
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

    #innerChurchNumeral(func, arg) {
        return ((this.#values.length === 1) &&
                (this.#values[0] === arg)) ? 0 :
               ((this.#values.length === 2) &&
                (this.#values[0] === func) &&
                (this.#values[1] === arg)) ? 1 :
               ((this.#values.length === 2) &&
                (this.#values[0] === func) &&
                (this.#values[1] instanceof Lambda) &&
                (this.#values[1].#variables.length === 0)) ?
               (this.#values[1].#innerChurchNumeral
                   (func, arg) + 1) : NaN;
    }

    /**
     * Return a natural number corresponding to the Church numeral
     * represented by this expression or NaN if this expression is
     * not a Church numeral. */
    getChurchNumeral() {
        return (this.#variables.length === 2) ?
               this.#innerChurchNumeral(
                   this.#variables[0], this.#variables[1]) : NaN;
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
        return result.simplify();
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

    #onceLibrary(library, exclude) {
        let result = this;
        const ignoreCase =
            (library && (typeof(library.ignoreCase) === "boolean")) ?
            library.ignoreCase : false;

        library = (library && library.library) ? library.library :
                  library ? library : Lambda.defaultLibrary;
        exclude = Object.assign({}, exclude, this.#variables.reduce(
            (acc, vv) => { acc[vv] = true; return acc; }, {}));

        this.#values.forEach((value, index) => {
            if (value instanceof Lambda) {
                const current = value.#onceLibrary(library, exclude);
                if (current !== value) {
                    if (result === this)
                        result = new Lambda(this);
                    result.#values.splice(index, 1, current);
                }
            } else if (!isNaN(value)) {
                let number = new Array(parseInt(value, 10))
                    .fill(0).reduce((acc, ignore) =>
                        new Lambda(["f", acc]), new Lambda("a"));
                number.#variables.push("f");
                number.#variables.push("a");
                if (result === this)
                    result = new Lambda(this);
                result.#values.splice(index, 1, number.simplify());
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

    applyLibrary(library) {
        let result = this;
        let previous = undefined;
        do {
            previous = result;
            result = result.#onceLibrary(library);
        } while (result !== previous);
        return result;
    }

    reverseLibrary(library) {
        let result = this;
        const numeral = result.getChurchNumeral();
        if (!isNaN(numeral))
            return numeral;
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
        return result.simplify();
    }

    #skSimplify() {
        let result = this.simplify();
        this.#values.forEach((value, index) => {
            if (value instanceof Lambda)  {
                const simpler = value.#skSimplify();
                if (simpler !== value) {
                    result = new Lambda(result);
                    result.#values.splice(index, 1, simpler);
                }
            }
        });

        if ((result.#values.length >= 3) &&
                   (result.#values[0] === "S") &&
                   (result.#values[0] === "K")) {
            result = new Lambda(result);
            result.#values.splice(0, 3, "I");
        }
        if ((result.#values.length > 1) &&
             (result.#values[0] === "I")) {
            result = new Lambda(result);
            result.#values.splice(0, 1);
        }
        if ((result.#values.length >= 3) &&
            (result.#values[0] === "S") &&
            (result.#values[1] instanceof Lambda) &&
            (result.#values[1].#variables.length === 0) &&
            (result.#values[1].#values.length === 2) &&
            (result.#values[1].#values[0] === "K") &&
            (result.#values[1].#values[1] === "K") &&
            (result.#values[2] === "I")) {
            result = new Lambda(result);
            result.#values.splice(0, 3, "K");
        }
        return result;
    }

    toStarlingKestral(config) {
        let result = this;
        if (config && !isNaN(config.count) &&
            --config.count < 1)
            throw new Error("Overflow");

        if (result.#variables.length === 0) {
            // T[a] => a ^ T[E F] => T[E] T[F]
            result = new Lambda(result);
            result.#values = result.#values.map(value =>
                (value instanceof Lambda) ?
                value.toStarlingKestral(config) : value);
        } else if ((result.#values.length === 1) &&
                   (result.#variables.length === 1) &&
                   (result.#variables[0] === result.#values[0])) {
            result = new Lambda("I"); // T[\a.a] => I
        } else if ((result.#variables.length > 0) &&
                   !result.#values.some(value =>
                       (value instanceof Lambda) ?
                       (result.#variables[0] in
                           value.getFreeVariables()) :
                       (value === result.#variables[0]))) {
            // T[\a.E] => K T[E] (a not free in E)
            const remain = new Lambda(result);
            remain.#variables.shift();
            result = new Lambda([
                "K", remain.toStarlingKestral(config)]);
        } else if (result.#variables.length > 1) {
            // T[\a b.E] => T[\a.T[\b.E]] (a free in E)
            const remain = new Lambda(result);
            const variable = remain.#variables.shift();
            result = remain.toStarlingKestral(config);
            result.#variables.unshift(variable);
            result = result.toStarlingKestral(config);
        } else if ((result.#values.length === 1) &&
                   (result.#values[0] instanceof Lambda) &&
                   (result.#values[0].#variables.length > 0)) {
            // T[\a.\b.E] => T[\a.T[\b.E]] (a free in E)
            const variable = result.#variables[0];
            result = new Lambda([
                result.#values[0].toStarlingKestral(config)]);
            result.#variables.unshift(variable);
            result = result.toStarlilngKestral(config);
        } else if (result.#values.length > 1) {
            // T[\a.E F] => S T[\a.E] T[\a.F] (a free in E or F)
            result = new Lambda(result);
            const variable = result.#variables.shift();
            const last = new Lambda(result.#values.slice(-1));
            const prev = new Lambda(result.#values.slice(0, -1));
            last.#variables.unshift(variable);
            prev.#variables.unshift(variable);
            result = new Lambda(["S", prev.toStarlingKestral(config),
                                 last.toStarlingKestral(config)]);
        }
        return result.#skSimplify();
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
        }

        library["="] = library["EQUAL?"];
        library["+"] = library["PLUS"]  = library["ADD"];
        library["*"] = library["TIMES"] = library["MULTIPLY"];
        library["-"] = library["MINUS"] = library["SUBTRACT"];
        library["/"] = library["DIVIDE"];
        return library;
    }

    static defaultLibrary = Lambda.__augmentLibrary({
        // Boolean logic
        TRUE: { value: "\\a b.a", priority: 2,
                description: "Logical TRUE" },
        FALSE: { value: "\\a b.b", priority: 2,
                 description: "Logical FALSE" },
        NOT: { value: "\\a b c.a c b", description: "Logical NOT" },
        AND: { value: "\\p q.p q p", description: "Logical AND" },
        OR: { value: "\\p q.p p q", description: "Logical OR" },
        "BOOLEQ?": { value: "\\p q.p q (NOT q)",
                     description: "Boolean equality" },

        // Pairs and nil allows us to create lists, which can be
        // a basis for data structures.
        PAIR: { value: "\\h t f.f h t" },
        HEAD: { value: "\\p.p TRUE" },
        TAIL: { value: "\\p.p FALSE" },
        NIL: { value: "\\f.TRUE" },
        "IS-NIL?": { value: "\\p.p (\\h t.FALSE)" },

        // Arithmetic
        SUCCESSOR: { value: "\\n f a.f (n f a)",
                     description: "Adds one to a Church numerals" },
        ZERO: { value: "\\f a.a",
                description: "Zero expressed as a Church numeral" },
        ADD: { value: "\\m n f a.m f (n f a)",
               description: "Addition of Church numerals" },
        MULTIPLY: { value: "\\m n f.m (n f)",
                    description: "Multiplication of Church numerals" },
        POWER: { value: "\\m n f a.(n m) f a",
                 description: "Exponentiation of Church numerals" },
        PREDECESSOR: {
            value: "\\n f a.n (\\g h.h (g f)) (\\c.a) \\b.b",
            description: "Decrements a Church numeral" },
        SUBTRACT: { value: "\\m n.n PREDECESSOR m",
                    description: "Subtraction of Church numerals" },
        DIVIDE: {
            value: "\\n.FIX (\\c n m f a.(\\d.IS-ZERO? d a " +
                   "(f (c d m f a))) (SUBTRACT n m)) (SUCCESSOR n)",
            description: "Division of Church numerals" },
        "IS-ZERO?": {
            value: "\\n.n (\\a.FALSE) TRUE",
            description: "Reduces to true if an only if " +
                         "argument is zero" },
        "IS-EVEN?": {
            value: "\\n.n (\\a.NOT a) TRUE",
            description: "Reduces to true if and only if " +
                         "argument is even" },
        "IS-ODD?": {
            value: "\\n.n (\\a.NOT a) FALSE",
            description: "Reduces to true if and only if " +
                         "argument is odd" },

        // Numeric comparisons
        "LESSEQ?": {
            value: "\\m n.IS-ZERO? (SUBTRACT m n)",
            description: "Reduces to true if the first Church " +
                         "numeral is less than or equal to " +
                         "the second" },
        "GREATEREQ?": {
            value: "\\m n.IS-ZERO? (SUBTRACT n m)",
            description: "Reduces to true if the first Church " +
                         "numeral is greater than or equal to " +
                         "the second" },
        "LESS?": {
            value: "\\m n.NOT (GREATEREQ? m n)",
            description: "Reduces to true if the first Church " +
                         "numeral is less than the second" },
        "GREATER?": {
            value: "\\m n.NOT (LESSEQ? m n)",
            description: "Reduces to true if the first Church " +
                         "numeral is greater than the second" },
        "EQUAL?": {
            value: "\\m n.AND (LESSEQ? m n) (LESSEQ? n m)",
            description: "Reduces to true if and only if the two " +
                         "Church numeral arguments are the same" },

        NTH: {
            value: "\\n l.n (\\l.(IS-NIL? l) l (TAIL l)) l",
            description: "Reduces to the nth member of a list" },
        FACTITER: {
            value: "λn.TAIL (n (λp.PAIR (ADD ONE (HEAD p)) " +
                   "(MULTIPLY (HEAD p) (TAIL p))) (PAIR ONE ONE))",
            description: "Factorial computed iteratively" },

        FIX: {
            value: "\\f.(\\a.f (a a)) \\a.f (a a)",
            description: "Fixed-point combinator for applying a " +
                         "function to itself repeatedly" },
        FACTORIAL: {
            value: "FIX \\f n.IS-ZERO? n ONE " +
                   "(MULTIPLY n (f (PREDECESSOR n)))",
            description: "Factorial computed recursively" },
        COUNT: {
            value: "FIX \\c l.IS-NIL? l ZERO (ADD ONE (c (TAIL l)))",
            description: "Return the number of elements in a list" },
        SUM: {
            value: "FIX \\f l.IS-NIL? l ZERO " +
                   "(ADD (HEAD l) (f (TAIL l)))",
            description: "Reduce to the sum of all numbers in a list" },
        MAP: {
            value: "FIX \\f g l.IS-NIL? l l " +
                   "(PAIR (g (HEAD l)) (f g (TAIL l)))",
            description: "Apply a function to each list member" },
        ADDUP: {
            value: "FIX \\f n.IS-ZERO? n n " +
                   "(ADD n (f (PREDECESSOR n)))",
            description: "Return the sum of a Church numeral and " +
                         "all of its predecessors",
        },

        // Combinator birds as named by Raymond Smullyan
        IBIS: { value: "\\i.i", description: "Ibis combinator" },
        KESTRAL: { value: "\\a b.a",
                   description: "Kestral combinator" },
        KITE: { value: "\\a b.b", description: "Kite combinator" },
        MOCKINGBIRD: { value: "\\a.a a",
                       description: "Mockingbird combinator" },
        CARDINAL: { value: "\\a b c.a c b",
                    description: "Cardinal combinator" },
        BLUEBIRD: { value: "\\a b c.a (b c)",
                    description: "Bluebird combinator" },
        THRUSH: { value: "\\a b.b a",
                  description: "Thrush combinator" },
        VIRIO: { value: "\\a b c.c a b",
                 description: "Virio combinator" },
        STARLING: { value: "\\a b c.a c (b c)",
                    description: "Starling combinator" },

        // One combinator to rule them all...
        IOTA: { value: "\\f.f STARLING KESTRAL",
                description: "Iota combinator" },
    });

    static createInterface(element) {
        const expression = document.createElement("textarea");
        const steps = document.createElement("input");
        const delay = document.createElement("input");
        let repeatID = 0;
        let repeating = false;

        expression.value =
            (typeof(element.dataset.expr) === "string") ?
            element.dataset.expr.replace(/\s+/g, " ") : "";

        function countReduce(expr) {
            if (!expr.isNormal()) {
                const value = parseInt(steps.value);
                steps.value = isNaN(value) ? 1 : (value + 1);
                expr = expr.reduce().simplify();
            } else repeating = false;
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
                repeatID = 0;
                try {
                    if (!repeating)
                        return;
                    const expr = new Lambda(expression.value);
                    if (expr.isNormal()) {
                        repeating = false;
                        if (post)
                            setExpression(post(expr));
                    } else {
                        setExpression(fn(expr));
                        repeatID = setTimeout(repeat, delay.value);
                    }
                } catch (ex) { console.error(ex); alert(ex); }
            }
            button.addEventListener("click", event => {
                try {
                    repeating = true;
                    if (pre)
                        setExpression(pre(new Lambda
                            (expression.value)));
                    if (!repeatID)
                        repeatID = setTimeout(repeat, delay.value);
                } catch (ex) { console.error(ex); alert(ex); }
            });
            element.appendChild(button);
        }

        createButton("Reduce", countReduce);
        createRepeatButton("Repeat", countReduce);
        if (typeof(element.dataset.expr) === "string")
            createButton("Reset", expr => {
                repeating = false;
                steps.value = 0;
                return element.dataset.expr.replace(/\s+/g, " ");
            });
        delay.type = "range";
        delay.min = 5;
        delay.max = 1000;
        delay.value = !isNaN(element.dataset.delay) ?
                      element.dataset.delay : 100;
        delay.style = "text-align: right; width: 5em;";
        element.appendChild(delay);
        if (element.dataset.library) {
            createButton("Library", expr => expr.applyLibrary(
                {ignoreCase: true, library: Lambda.defaultLibrary}));
            createButton("Discover", expr => expr.reverseLibrary());
            createRepeatButton("Go", countReduce,
                               expr => expr.applyLibrary({
                                   ignoreCase: true,
                                   library: Lambda.defaultLibrary}),
                               expr => expr.reverseLibrary());
        }
        if (element.dataset.sk)
            createButton("SKI", expr => expr.toStarlingKestral());
        steps.disabled = true;
        steps.style = "text-align: right; width: 5em;";
        element.appendChild(steps);
        element.appendChild(document.createElement("br"));
        expression.setAttribute(
            "rows", !isNaN(element.dataset.rows) ?
            element.dataset.rows : 3);
        expression.setAttribute(
            "cols", !isNaN(element.dataset.cols) ?
            element.dataset.cols : 80);
        expression.addEventListener("input", event =>
            { repeating = false; steps.value = 0; });
        element.appendChild(expression);
        return element;
    }
}

if ((typeof process !== "undefined") &&
    process.release?.name === "node") {
    const { describe, it } = await import('node:test');
    const assert = await import('node:assert');

    describe("Reduction", () => {
        it("reduce to variable: (\\a.a) a -> a", () => {
            assert.ok(new Lambda("(\\a.a) a").reduce().equals("a"));
        });
        it("reduce to abstraction: (\\a.a) \\b.b -> \\b.b", () => {
            assert.ok(new Lambda("(\\a.a) \\b.b")
                .reduce().equals("\\b.b"));
        });
        it("reduce twice: (\\a.a) (\\b.b) c", () => {
            assert.ok(new Lambda("(\\a.a) (\\b.b) c")
                .reduce().reduce().equals("c"));
        });
        it("endless reduction: (\\a.a a) (\\a.a a)", () => {
            const start = new Lambda("(\\a.a a) (\\a.a a)");
            let expression = start;
            for (let ii = 0; ii < 100; ++ii)
                expression.reduce();
            assert.strictEqual(expression, start);
        });
        it("normal order: (\\a.b) ((\\a.a a) (\\a.a a)) -> b", () => {
            assert.ok(new Lambda("(\\a.b) ((\\a.a a) (\\a.a a))")
                .reduce().equals("b"));
        });
        it("shadow variables", () => {
            assert.ok(new Lambda("(\\a.(\\a.a) a a) b")
                .reduce().reduce().equals("b b"));
        });
        it("variable names: (\\a.a) (\\b.b) <-> \\c.c", () => {
            assert.ok(new Lambda("(\\a.a) (\\b.b)")
                .reduce().equals("\\c.c"));
        });
        it("variable names: \\a.a b (\\c.c d) <-> " +
           "\\c.c b (\\a.a d)", () => {
               assert.ok(new Lambda("\\a.a b (\\c.c d)")
                   .equals("\\c.c b (\\a.a d)"));
        });
    });

    describe("Free Variable Capture", () => {
        it("(\\a.\\b.a) b -> \\a.b", () => {
            // This is the most important test.  Getting this
            // right in the implementation is tricky and requires
            // understanding that the free variables in the argument
            // must not match the bound variables in the abstraction.
            assert.ok(new Lambda("(\\a.\\b.a) b")
                .reduce().equals("\\a.b"));
        });
        it("(\\a b.a) b -> \\c.b", () => {
            assert.ok(new Lambda("(\\a b.a) b")
                .reduce().equals("\\c.b"));
        });
        it("(\\a.\\b.b) b -> \\b.b", () => {
            assert.ok(new Lambda("(\\a.\\b.b) b")
                .reduce().equals("\\b.b"));
        });
        it("(\\a b.b) b -> \\b.b", () => {
            assert.ok(new Lambda("(\\a b.b) b")
                .reduce().equals("\\b.b"));
        });
        it("(\\g.(\\a.(\\b.a))) a -> \\a b.a", () => {
            assert.ok(new Lambda("(\\g.(\\a.(\\b.a))) a")
                .reduce().equals("\\a b.a"));
        });
        it("(\\g a b.a) a -> \\a b.a", () => {
            assert.ok(new Lambda("(\\g a b.a) a")
                .reduce().equals("\\a b.a"));
        });
    });

    describe("Church Numerals", () => {
        it("\\f a.f -> NaN", () => {
            // Not everything is a Church numeral
            assert.ok(isNaN(new Lambda("\\f a.f").getChurchNumeral()));
        });
        it("\\f a.a -> 0", () => {
            assert.strictEqual(new Lambda("\\f a.a")
                .getChurchNumeral(), 0);
        });
        it("\\f a.f a -> 1", () => {
            assert.strictEqual(new Lambda("\\f a.f a")
                .getChurchNumeral(), 1);
        });
        it("\\f a.f (f a) -> 2", () => {
            assert.strictEqual(new Lambda("\\f a.f (f a)")
                .getChurchNumeral(), 2);
        });
    });

    describe("Starling Kestral", () => {
        it("Ibis: \\a.a = I", () => {
            assert.ok(new Lambda("\\a.a")
                .toStarlingKestral().equals("I"));
        });
        it("Kestral: \\a b.a = K", () => {
            assert.ok(new Lambda("\\a b.a")
                .toStarlingKestral().equals("K"));
        });
        it("Kite: \\a b.b = K I", () => {
            assert.ok(new Lambda("\\a b.b")
                .toStarlingKestral().equals("K I"));
        });
        it("Bluebird: \\a b c.a (b c)", () => {
            assert.ok(new Lambda("\\a b c.a (b c)")
                .toStarlingKestral()
                .equals("S (S (K S) (S (K K) (S (K S) K))) " +
                        "(K (S (S (K S) K) (K I)))"));
        });
        it("Cardinal: \\a b c.a c b", () => {
            assert.ok(new Lambda("\\a b c.a c b")
                .toStarlingKestral()
                .equals("S (S (K S) (S (K K) (S (K S) " +
                        "(S (S (K S) K) (K I))))) (K K)"));
        });
        it("Thrush: \\a b.b a", () => {
            assert.ok(new Lambda("\\a b.b a")
                .toStarlingKestral().equals("S (K (S I)) K"));
        });
        it("Mockingbird: \\a.a a", () => {
            assert.ok(new Lambda("\\a.a a")
                .toStarlingKestral().equals("S I I"));
        });
        it("Fixed-point: \\f.(\\a.f (a a)) \\a.f (a a)", () => {
            assert.ok(new Lambda("\\f.(\\a.f (a a)) \\a.f (a a)")
                .toStarlingKestral()
                .equals("S (S (S (K S) K) (K (S I I))) " +
                        "(S (S (K S) K) (K (S I I)))"));
        });
    });
}

export default Lambda;
