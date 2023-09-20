// omnivore.mjs
// Copyright (C) 2019-2023 by Jeff Gold.
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
// Abstract parsing and string generation.  Parsing uses a recursive
// descent algorithm.  A grammar can be constructed using a JSON
// object.  Each key in the object is the name of a rule and each
// value associated with a key is a production.
//
// Here is an example grammar that parses arithmetic expressions:
//
// {
//     expression: [["%term", " + ", "%expression"], "%term"],
//     term: [["(", "%expression", ")"],
//            ["%number", " * ", "%term"], "%number"],
//     number: [["%@integer", ".", "%@fractional"], "%@integer"],
//     "@integer": [{weight: 10, rule: [
//         "%@nonZeroDigit", "%@digits"]}, "0"],
//     "@fractional": [["%@digit", "%@fractional"], "%@nonZeroDigit"],
//     "@digits": [["%@digit", "%@digits"], ""],
//     "@digit": ["0", {"weight": 9, "rule": "%@nonZeroDigit"}],
//     "@nonZeroDigit": ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
// }
//
// Notice that the way this grammar is defined creates:
//   - No left recursion (rule is never first element in production)
//   - No ambiguity (only one parse tree possible for any value)
// Grammars defined less carefully will create unexpected results,
// mostly in the form of valid values not being recognized.
//
// Each key in the grammar is considered a rule.  The value associated
// with a rule is called a production.  A production must be an array.
// Each member of a production array is called an alternative and must
// be either an array, a string or an object.
//
// When an element of an alternative is a string it will either be a
// reference or a terminal.  A terminal is a literal part of a value
// in the language described by the grammar.  A reference is replaced
// by the corresponding rule.  References are denoted by a leading
// percent character ('%') and another character which is something
// else.  Two percent characters ("%%") are converted to one and
// used as a literal instead.
//
// When an element of an alternative is an array it is treated as a
// sequence of terminals and references.
//
// When an element of an alternative is an object it can give special
// instructions to the generator and parser.  The object must have
// a "rule" or "r" field, which must be a string or an array.  This
// value is substituted for the alternative in generation and parsing.
//
// At the moment, the only special instruction comes from the "weight"
// or "w" field.  This affects the probability that the alternative is
// selected when generating strings.

/**
 * Returns true iff value represents a rule reference */
function isReference(value) {
    return (typeof(value) === "string") && (value.length >= 2) &&
           (value[0] === '%') && (value[1] !== '%');
}

function getRule(value) { return value.substring(1); }

function quoteRule(value) {
    return value ? value.replace(/%/g, "%%") : value;
}

function unquoteRule(value) {
    return value ? value.replace(/%%/g, "%") : value;
}

/**
 * Return the first numeric and non-negative argument after the first,
 * which is returned if none of the subsequent arguments qualify. */
function nonNegative(base, ...args) {
    for (let ii = 0; ii < args.length; ++ii)
        if (!isNaN(args[ii]) && (args[ii] >= 0))
            return args[ii];
    return base;
}

/**
 * Accepts strings or string arrays and returns an array of strings. */
function forceStringArray(value) {
    let result = undefined;
    if (Array.isArray(value) &&
        value.every(v => (typeof(v) === "string"))) {
        result = value;
    } else if (typeof(value) === "string") {
        result = [value];
    }
    return result;
}

/**
 * Check whether value at index current matches and if so return
 * the position after the match.  Otherwise return a negative
 * number to signal the lack of a match.
 *
 * @param match string to check against value
 * @param current index of characters in value already consumed
 * @param value string to check for a match
 * @returns integer index after a match or negative if no match */
function matchString(match, value, index) {
    return ((index + match.length <= value.length) &&
            (value.indexOf(match, index) === index)) ?
           (index + match.length) : -1;
}

class ParseError extends Error {
    constructor(message, options) {
        super(message, options);
    }
}

/**
 * An alternative is a single possible expansion for a production rule.
 * Every alternative is a sequence of terminals and references to
 * other rules.  There's no need to be concerned with weights here. */
class Alternative {
    constructor(rules, value) {
        this.__elements = forceStringArray(value);

        if (this.__elements) {
            this.__weight = 1;
        } else if ((typeof(value) === "object") && value.rule) {
            this.__elements = forceStringArray(value.rule);
            if (this.__elements) {
                this.__weight = nonNegative(1, value.weight, value.w);
            } else throw new TypeError(
                "Unrecognized object rule (" + typeof(value.rule) +
                "): " + value.rule);
        } else if ((typeof(value) === "object") && value.r) {
            this.__elements = forceStringArray(value.r);
            if (this.__elements) {
                this.__weight = nonNegative(1, value.weight, value.w);
            } else throw new TypeError(
                "Unrecognized object r (" + typeof(value.r) +
                "): " + value.r);
        } else throw new TypeError(
            "Unrecognized alternative (" + typeof(value) +
            "): " + value);

        this.__elements.forEach(element => {
            if (isReference(element) && !(getRule(element) in rules))
                throw new TypeError(
                    "Missing rule for reference: " + element);
        }, this);
    }

    static create(rules, value) {
        return (value instanceof Alternative) ?
               value : new Alternative(rules, value);
    }

    getWeight() { return this.__weight; }

    generate(rules) {
        const result = [];
        this.__elements.forEach(element => {
            if (isReference(element)) {
                const production = Production.create(
                    rules, rules[getRule(element)]);
                result.push(production.generate(rules));
            } else result.push(unquoteRule(element));
        });
        return result.join("");
    }

    parse(rules, rule, value, index) {
        const entries = [];
        let current = index;

        this.__elements.forEach(element => {
            if (current < 0) { // skip element
            } else if (isReference(element)) {
                const subrule = getRule(element);
                const parsed = rules[subrule].parse(
                    rules, subrule, value, current);
                if (parsed && parsed.rule.startsWith("@")) {
                    entries.push(value.substring(current, parsed.stop));
                    current = parsed.stop;
                } else if (parsed) {
                    entries.push(parsed);
                    current = parsed.stop;
                } else current = -1;
            } else {
                const entry = unquoteRule(element);
                entries.push(entry);
                current = matchString(entry, value, current);
            }
        }, this);
        return (current >= 0) ? {
            rule: rule, entries: entries,
            start: index, stop: current } : false;
    }

    toJSON() {
        return (this.__weight == 1) ? this.__elements :
               {weight: this.__weight, rule: this.__elements};
    }
}

class Production {
    constructor(rules, value) {
        if (Array.isArray(value))
            this.__alternatives = value.map(
                alt => Alternative.create(rules, alt));
        else if (value && (typeof(value) === "object") &&
                 Array.isArray(value.alts)) {
            this.__alternatives = value.alts.map(
                alt => Alternative.create(rules, alt));
            // :TODO: more features here
        } else throw new TypeError(
            "Unrecognized production: " + typeof(value));
    }

    static create(rules, value) {
        return (value instanceof Production) ?
               value : new Production(rules, value);
    }

    generate(rules) {
        const result = [];
        let choice = Math.random();
        let total = 0;
        this.__alternatives.forEach(alternative =>
            { total += alternative.getWeight(); });
        choice *= total;
        this.__alternatives.forEach(alternative => {
            const weight = alternative.getWeight();

            if (choice < 0) { // skip
            } else if (choice < weight) {
                result.push(alternative.generate(rules));
                choice = -1;
            } else choice -= weight;
        });
        return result.join("");
    }

    parse(rules, rule, value, index) {
        let result = false;

        this.__alternatives.forEach(alt => {
            if (!result)
                result = alt.parse(rules, rule, value, index);
        }, this);
        return result;
    }

    toJSON() {
        return this.__alternatives;
    }
}


class Grammar {
    /**
     * Create a grammar that matches specified rules.
     *
     * @param rules an object which maps rule names to productions */
    constructor(rules) {
        if (!rules || (typeof(rules) !== "object"))
            throw new TypeError("Rules must be an object");
        this.__rules = {};
        Object.keys(rules).forEach(rule => {
            const production = rules[rule];
            this.__rules[rule] =
                (production instanceof Production) ?
                production : new Production(rules, production);
        }, this);
    }

    eachRule(fn, context) {
        let index = 0;
        Object.keys(this.__rules).forEach(rule => {
            if (!rule.startsWith("@"))
                fn.call(context, rule, index++, this.__rules[rule]);
        });
    }

    /**
     * Create a string in the grammar using production weights to
     * influence the probability of selecting branches.
     *
     * @param rule a string indicating the starting rule
     * @returns a string selected from the grammar. */
    generate(rule) {
        if (typeof(rule) !== "string")
            throw new TypeError("Rule must be a string (not " +
                                typeof(rule) + ")");
        else if (!(rule in this.__rules))
            throw new RangeError("Unknown rule: \"" + rule + "\"");

        return this.__rules[rule].generate(this.__rules);
    }

    /**
     * Parse a string in one step
     *
     * @param rule a string indicating the starting rule
     * @returns a parse tree */
    parse(rule, value) {
        if (typeof(rule) !== "string")
            throw new TypeError("Rule must be a string (not " +
                                typeof(rule) + ")");
        else if (!(rule in this.__rules))
            throw new RangeError("Unknown rule: " + rule);
        // :TODO: detect (and correct?) left recursion
        // :TODO: detect non-determinism?

        const result = this.__rules[rule].parse(
            this.__rules, rule, value, 0);
        if (!result || (result.stop !== value.length))
            throw new ParseError("Parsing failed (" +
                                 JSON.stringify(result) + ")");
        return result;
    }
}

export default {
    createGrammar: rules => new Grammar(rules),
    ParseError
};
