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
//     var language = {
//         ws: [" ", "\t", "\r", "\n"],
//         wsp: ["%ws", ["%ws", "%wsp"]],
//         digit: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         digits: ["%digit", ["%digit", "%digits"]],
//         number: ["%digits", ["%digits", ".", "%digits"]],
//     };
//
// A production must be a string, an array or an object.
//
// A production string is either a literal or a rule reference.  The
// difference is that a rule reference starts with a single '%' followed
// by at least one other character that is not '%'.  A reference refers
// is replaced by the result of following the rule it refers to.  A
// literal either starts with a character that isn't '%' or starts with
// two '%' characters (in which case these are unquoted to a single
// one).  Literals refer directly to characters in the language.
//
// A production array is a series of alternatives, any one of which
// can be used to satisfy the rule.  When an array appears as a member
// of a production array, this represents a sequence of production
// that must match in order.  Otherwise the array entries may be either
// literal strings or objects.
//
// A production can also be an object for advanced use.  The rule for
// an object is given by its "rule" property and its weight is given
// by the "weight property if present.
//
// Here is an example grammar that parses arithmetic expressions:
//
//   const arithmetic = omnivore.create({
//     "nzdigit": ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//     "digit": ["0", "%nzdigit"],
//     "digits": ["", ["%digit", "%digits"]],
//     "number": [["%nzdigit", "%digits"]],
//     "term": [["%number"], ["%number", " * ", "%term"]],
//     "expression": [["%term"], ["%term", " + ", "%expression"]]
//   });
//
// Notice that the way this grammar is defined creates no left
// recursion and no ambiguity.  An expression like "2 * 3 + 4" can
// only be parsed one way because factors take precedence over terms.
// Grammars defined less carefully make create unexpected results.

function quoteRule(value) {
    return value ? value.replace(/%/g, "%%") : value;
}

function unquoteRule(value) {
    return value ? value.replace(/%%/g, "%") : value;
}

/**
 * Returns true iff value represents a rule reference */
function isReference(value) {
    return (typeof(value) === "string") && (value.length >= 2) &&
           (value[0] === '%') && (value[1] !== '%');
}

function getProductionWeight(production) {
    return (!Array.isArray(production) &&
            (typeof production === "object")) ?
           production.weight : 1;
}

function getRule(value) { return value.substring(1); }

/**
 * Returns a sequence of steps for a single production as an array. */
function getProduction(production) {
    return (Array.isArray(production) ? production :
            ((typeof production === "object") ?
             getProduction(production.rule) : [production]));
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
function matchString(match, current, value) {
    return ((current + match.length <= value.length) &&
            (value.indexOf(match, current) === current)) ?
           (current + match.length) : -1;
}

class ParseError extends Error {
    constructor(message, options) {
        super(message, options);
    }
}

class Grammar {
    /**
     * Create a grammar that matches specified rules.
     *
     * @param rules an object which maps rule names to productions */
    constructor(rules) {
        if (typeof(rules) !== "object")
            throw new TypeError("rules must be an object");
        else if (!Object.keys(rules).every(
            (rule) => Array.isArray(rules[rule])))
            throw new TypeError("all rule entries must be arrays");
        this.__rules = rules;
    }

    /**
     * Create a string in the grammar using production weights to
     * influence the probability of selecting branches.
     *
     * @param rule a string indicating the starting rule
     * @returns a string selected from the grammar. */
    generate(rule) {
        let value = '', total = 0, choice;
        let current = this.__rules[rule];

        if (current) {
            current.forEach(production => {
                total += getProductionWeight(production); });
            choice = Math.random() * total;
            current.forEach(production => {
                const weight = getProductionWeight(production);

                if (choice < 0) { // skip
                } else if (choice < weight) {
                    getProduction(production)
                        .forEach(function(component) {
                            if (isReference(component))
                                value += this.generate(
                                    getRule(component));
                            else value += unquoteRule(component);
                        }, this);
                    choice = -1;
                } else choice -= weight;
            }, this);
        } else value = "ERROR-missing-%" + rule;
        return value;
    }

    __parseRule(rule, start, end, value) {
        // A recursive descent parser must either support backtracking
        // or exclude non-deterministic grammars.  This parser does
        // neither.  Instead it simply finds the first production
        // rule that matches and stops there.  This means it might
        // reject members of the language in such cases.  It's up
        // to the caller to provide an unambigous grammar, which may
        // be enforced by other parts of the code.
        const productions = this.__rules[rule];

        productions.forEach(production => {
            let matched = start;

            getProduction(production).forEach(element => {
                if (matched < 0) {
                    // Match failed on previous step
                } else if (isReference(element)) {
                    matched = this.__parseRule(getRule(element))
                } else if (typeof(element) === "string") {
                    matched = matchString(element, matched, value);
                } else if ((typeof(element) === "object") &&
                           isReference(element.rule)) {
                    matched = this.__parseRule(getRule(element.rule))
                } else if ((typeof(element) === "object") &&
                           (typeof(element.rule) === "string")) {
                    matched = matchString(element.rule, matched, value);
                } else {
                    matched = -1;
                    throw new TypeError(
                        "Unknown type for production " +
                        "element: " + typeof(element));
                }
            }, this);
        });
    }

    /**
     * Parse a string in one step
     *
     * @param rule a string indicating the starting rule
     * @returns a parse tree */
    parse(rule, value) {
        // :TODO: detect (and correct?) left recursion
        // :TODO: detect non-determinism
        const matched = this.__parseRule(rule, 0, value.length, value);
        if (matched != value.length)
            throw new ParseError("Parsing failed: " + matched);
    }

}

export default {
    create: function(rules) { return new Grammar(rules); }
};
