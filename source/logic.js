// logic.js
// Copyright (C) 2019 by Jeff Gold.
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
// A set of tools for exploring propositional calculus.
//
// A detailed system proving the most important results from a single
// axiom (Łukasiewicz 1961) using single undefined operator and a
// single detatchment rule (a modified form of modus ponens):
//   https://projecteuclid.org/download/pdf_1/euclid.ndjfl/1093958259
// Axiomatization of Propositional Calculus with Sheffer Functors
// by Thomas W. Scharle.
(function(logic) {
    'use strict';

    // Returns true iff the operator matches and either the count
    // is falsy or contains the length of the expression.  This
    // routine assumes the expression argument is an array and that
    // count is either falsy or a positive integer.
    var matchOp = function(expression, operator, count) {
        return (expression.length >= 1) &&
               (expression[0] === operator) &&
               (!count || (expression.length === count));
    };

    var matchExprOp = function(expression, operator, count) {
        return Array.isArray(expression) &&
               matchOp(expression, operator, count);
    };

    // Compute an estimate of an expression value's complexity
    var complexity = function(value) {
        var result = 0;
        if (typeof(value) === 'boolean')
            result = 0;
        else if (typeof(value) === 'string')
            result = 1;
        else if (Array.isArray(value)) {
            value.forEach(function(item, index) {
                if (index > 0) {
                    var current = complexity(item);
                    if (current > result)
                        result = current;
                }
            });
            result += 1;
        }
        return result;
    };

    // Operator mappings. The operators variable is indexed by the
    // operation name ("and", "or", "implies" and so on).  The lnotes
    // table is indexed by Łukasiewicz notation characters ("A", "K",
    // "C" and so on).
    var lnotes = {};
    var operators = {
        nand:  {
            sigil: '&#x22bc;', lnote: 'D',
            deconstant: function(expr) {
                if (expr.length !== 3) {
                } else if (typeof(expr[1]) === 'boolean') {
                    if (typeof(expr[2]) === 'boolean')
                        expr = !(expr[1] && expr[2]);
                    else expr = expr[1] ? ['not', expr[2]] : true;
                } else if (typeof(expr[2]) === 'boolean')
                    expr = expr[2] ? ['not', expr[1]] : true;
                return expr; },
            simplify: function(expr) {
                if (expr.length !== 3) {
                } else if (matchExprOp(expr[1], 'nand', 3) &&
                           matchExprOp(expr[2], 'nand', 3) &&
                           equals(expr[1][1], expr[2][1]) &&
                           equals(expr[1][2], expr[2][2]))
                    expr = ['and', expr[1][1], expr[1][2]];
                else if (equals(expr[1], expr[2]))
                    expr = ['not', expr[1]];
                else {
                    var negate1 = easynegate(expr[1]);
                    var negate2 = easynegate(expr[2]);

                    if (negate1 && negate2)
                        expr = ['or', negate1, negate2];
                    else if (negate1)
                        expr = ['implies', expr[2], negate1];
                    else if (negate2)
                        expr = ['implies', expr[1], negate2];
                }
                return expr; }},
        nor: {sigil: '', lnote: 'S'},
        not: {
            sigil: '&not;', lnote: 'N', unary: true,
            devolve: function(expr) {
                var value = expr[1];
                if (matchExprOp(value, 'and', 3))
                    return ['nand', value[1], value[2]];
                return ['nand', value, value]; },
            deconstant: function(expr) {
                if ((expr.length === 2) &&
                    (typeof(expr[1]) === 'boolean'))
                    expr = !expr[1];
                return expr; },
            simplify: function(expr) {
                if ((expr.length === 2) &&
                    matchExprOp(expr[1], 'nand'))
                    expr = ['and'].concat(expr[1].slice(1));
                return expr; }
        },
        implies: {
            sigil: '&#x27f9;', lnote: 'C',
            devolve: function(expr) {
                // TODO: more than two arguments
                return matchExprOp(expr[2], 'and', 3) ?
                       ['nand', expr[1],
                        ['nand', expr[2][1], expr[2][2]]] :
                       ['nand', expr[1], ['nand', expr[2], expr[2]]]; },
            deconstant: function(expr) {
                if (expr.length === 3) {
                    if (typeof(expr[1]) === 'boolean')
                        expr = expr[1] ? expr[2] : true;
                    else if (typeof(expr[2]) === 'boolean')
                        expr = expr[2] ? true : ['not', expr[1]];
                }
                return expr; },
            simplify: function(expr) {
                return expr; }
        },
        and: {
            sigil: '&and;', lnote: 'A',
            devolve: function(expr) {
                // TODO: more than two arguments
                return ['nand', ['nand', expr[1], expr[2]],
                        ['nand', expr[1], expr[2]]]; },
            deconstant: function(expr) {
                if (expr.length === 3) {
                    if (typeof(expr[1]) === 'boolean')
                        expr = expr[1] ? expr[2] : false;
                    else if (typeof(expr[2]) === 'boolean')
                        expr = expr[2] ? expr[1] : false;
                }
                return expr; },
            simplify: function(expr) {
                if ((expr.length === 3) && equals(expr[1], expr[2]))
                    expr = expr[1];
                return expr; }
        },
        or: {
            sigil: '&or;', lnote: 'K',
            devolve: function(expr) {
                // TODO: more than two arguments
                return ['nand', ['nand', expr[1], expr[1]],
                        ['nand', expr[2], expr[2]]]; },
            deconstant: function(expr) {
                if (expr.length === 3) {
                    if (typeof(expr[1]) === 'boolean')
                        expr = expr[1] ? true : expr[2];
                    else if (typeof(expr[2]) === 'boolean')
                        expr = expr[2] ? true : expr[1];
                }
                return expr; },
            simplify: function(expr) {
                return expr; }
        },
        eq: {
            sigil: '&#x27fa;', lnote: 'E',
            devolve: function(expr) {
                // TODO: more than two arguments
                return operators['and'].devolve(
                    ['and', operators['implies'].devolve(
                        ['implies', expr[1], expr[2]]),
                     operators['implies'].devolve(
                         ['implies', expr[2], expr[1]])]); },
            deconstant: function(expr) {
                if ((expr.length === 3) &&
                    (typeof(expr[1]) === 'boolean') &&
                    (typeof(expr[2]) === 'boolean'))
                    expr = (expr[1] === expr[2]);
                return expr; },
            simplify: function(expr) {
                return expr; }
        }
    };
    Object.keys(operators).forEach(function(op) {
        operators[op].tag = op;
        if (operators[op].lnote)
            lnotes[operators[op].lnote] = operators[op];
    });

    /**
     * Recursively scan an expression and change variables and
     * operators for higher level functions. */
    var transform = function(config, expression) {
        var result = expression;
        if (typeof(expression) === 'string') {
            if (config && config.variable)
                result = config.variable(expression);
        } else if (Array.isArray(expression)) {
            result = [];
            if (config && config.down)
                expression = config.down(expression);

            expression.forEach(function(thing, index) {
                if (index > 0)
                    thing = transform(config, thing);
                result.push(thing);
            });

            if (config && config.up && (result.length > 0))
                result = config.up(result);
        }
        return result;
    };

    /**
     * Returns truthy iff a and b are the same expression.
     * This addresses intensional, not extensional, equality.  That
     * means some expressions that yield the same value for all
     * possible inputs will get false from this. */
    var equals = function(a, b) {
        var result = false;
        if ((typeof(a) === 'string') && (typeof(b) === 'string')) {
            result = (a === b);
        } else if (Array.isArray(a) && Array.isArray(b)) {
            if ((a.length === 3) && (a[0] === 'nand') &&
                (b.length === 3) && (b[0] === 'nand')) {
                result = ((equals(a[1], b[1]) && equals(a[2], b[2])) ||
                          (equals(a[1], b[2]) && equals(a[2], b[1])));
            } else result = a.every(function(element, index) {
                return equals(a[index], b[index]); });
        }
        return result;
    };

    // Returns the negation of an easily negated expression or null.
    // What "easy" means here is a judgement call.  Obviously a "not"
    // expression is easy to negate.  A "nand" expression can be
    // replaced by an "and" expression to negate it.
    var easynegate = function(expression) {
        var result = null;
        if (Array.isArray(expression) && (expression.length > 1)) {
            if (expression[0] === 'not')
                result = expression[1];
            else if (expression[0] === 'nand')
                result = ['and'].concat(expression.slice(1));
        }
        return result;
    };

    // Applies Nicod's modus ponens iff the expression is a nand that
    // matches the premise.  Applies modus ponens iff the expression is
    // an implication that matches the premise.
    var detatch = function(expression, premise) {
        if (matchExprOp(expression, 'nand', 3) &&
            matchExprOp(expression[2], 'nand', 3) &&
            equals(expression[1], premise))
            expression = expression[2][2];
        else if (matchExprOp(expression, 'implies', 3) &&
                 equals(expression[1], premise))
            expression = expression[2];
        return expression;
    };

    var substitute = function(expression, variable, value) {
        var inflate = ((typeof(variable) === 'object') &&
                       (typeof(value) === 'function')) ?
                      value : function(x) { return x; };
        var table;

        if (typeof(variable) !== 'object') {
            table = {};
            table[variable] = value;
        } else table = variable;
        return transform({
            variable: function(current) {
                return (current in table) ?
                       inflate(table[current]) : current;
            }
        }, expression);
    };

    var tokenize = function(value) {
        var states = {
            ready: 1,
        }, state;
        var result = [];
        for (var ii = 0; ii < value.length; ++ii)
            switch (states[state]) {
                case states.ready:
                    if ((value.indexOf(' ', ii) === ii) ||
                        (value.indexOf('\t', ii) === ii) ||
                        (value.indexOf('\r', ii) === ii) ||
                        (value.indexOf('\n', ii) === ii)) {
                    }
                default:
            };
        return result;
    };

    // Converts a string in Łukasiewicz (prefix) notation into a
    // raw expression suitable for use in this system.
    var parseLNotation = function(value) {
        var current;
        var index;
        var last;
        var stack = [];

        var complete = function(entry) {
            return (entry[0] in operators) ?
                   (operators[entry[0]].unary ?
                    (entry.length >= 2) : (entry.length >= 3)) :
                   (entry.length >= 3);
        };

        for (index = 0; index < value.length; ++index) {
            current = value[index];
            if (current in lnotes) {
                stack.push([lnotes[current].tag]);
            } else if ((current >= 'a') && (current <= 'z')) {
                // Complete entries on the way up
                while (stack.length > 0) {
                    last = stack.pop();
                    last.push(current);
                    if (complete(last)) {
                        current = last;
                    } else {
                        stack.push(last);
                        break;
                    }
                }
                last = current;
            } else throw Error("Invalid L Notation (character: " +
                               current + "): " + value);
        }
        if (stack.length > 0)
            throw Error("Invalid L Notation (stack: " +
                        stack.length + "): " + value);
        return last;
    };

    logic.parse = function(value) {
        // TODO parse other expression formats
        return logic.expression(parseLNotation(value));
    };

    logic.expression = function(value, proof) { // Constructor
        if (!(this instanceof logic.expression))
            return new logic.expression(value, proof);

        if (typeof(value) === 'string')
            this.__value = value;
        else if (typeof(value) === 'boolean')
            this.__value = value;
        else if (Array.isArray(value))
            this.__value = value;
        else if (value instanceof logic.expression)
            this.__value = value.__value;
        else throw Error('Unsupported expression: ' + value);

        if (proof)
            this.proof = proof;
    };

    logic.expression.prototype.equals = function() {
        var result = true;
        for (var ii = 0; ii < arguments.length; ++ii)
            if (!equals(this.__value, logic.expression(
                arguments[ii]).__value))
                result = false;
        return result;
    };

    logic.expression.prototype.toString = function(config) {
        var result;

        if (config && config.lnote) {
            if (Array.isArray(this.__value) &&
                (this.__value.length > 0)) {
                var operator = operators[this.__value[0]];
                if (operator.unary) {
                    result = operator.lnote +
                             logic.expression(this.__value[1])
                                     .toString({lnote: true});
                } else {
                    result = [operator.lnote];
                    this.__value.forEach(function(thing, index, arr) {
                        if (index > 0)
                            result.push(logic.expression(thing).toString({
                                lnote: true}));
                    }, this);
                    result = result.join('');
                }
            } else if (typeof(this.__value) === 'string') {
                result = this.__value;
            } else if (typeof(this.__value) === 'boolean') {
                result = this.__value ? 'T' : 'F';
            } else result = '?';
        } else if (Array.isArray(this.__value) &&
                   (this.__value.length > 0)) {
            var operator = operators[this.__value[0]];
            if (operator.unary) {
                result = operator.sigil +
                         logic.expression(this.__value[1]).toString({
                             parens: true});
            } else {
                result = [];
                this.__value.forEach(function(thing, index, arr) {
                    if (index > 1)
                        result.push(operator.sigil);
                    if (index > 0)
                        result.push(logic.expression(thing).toString({
                            parens: true}));
                }, this);

                result = result.join(' ');
                if (config && config.parens)
                    result = '(' + result + ')';
            }
        } else if (typeof(this.__value) === 'string') {
            result = this.__value;
        } else if (typeof(this.__value) === 'boolean') {
            result = this.__value ? 'true' : 'false';
        } else result = 'UNKNOWN';
        return result;
    };

    /**
     * Reduce an expression to a single NAND operator */
    logic.expression.prototype.devolve = function() {
        return logic.expression(transform({
            down: function(expression) {
                var operator = operators[expression[0]];
                if (operator.devolve)
                    expression = operator.devolve(expression);
                return expression;
            }
        }, this.__value)); };

    logic.expression.prototype.deconstant = function(config) {
        return logic.expression(transform({
            up: function(expression) {
                var operator = operators[expression[0]];
                if (operators.deconstant)
                    expression = operator.deconstant(expression);
                return expression;
            }
        }, this.__value)); };

    /**
     * Replace complex constructs in expression with simpler
     * alternatives to make it easier to read. */
    logic.expression.prototype.simplify = function(config) {
        return logic.expression(transform({
            up: function(expression) {
                var operator = operators[expression[0]];
                if (operator.deconstant)
                    expression = operator.deconstant(expression);
                return expression; }
        }, transform({
            up: function(expression) {
                var operator = operators[expression[0]];
                if (operator.simplify)
                    expression = operator.simplify(expression);
                return expression;
            }
        }, this.__value))); };

    /**
     * Return an array of all free variables in the expression */
    logic.expression.prototype.getFree = function() {
        var result = {};
        transform({variable: function(current) {
            result[current] = true;
        }}, this.__value);
        return Object.keys(result).sort();
    };

    /**
     * Replace one or more variables in an expression. */
    logic.expression.prototype.substitute = function(variable, value) {
        return logic.expression(substitute(
            this.__value, variable, value)); };

    var internalLibrary = {
        Meredith: { theorems: { Axiom: "CCCCCpqCNrNsrtCCtpCsp" } },
        Nicod: { theorems: { Axiom: "DDpDqrDDtDttDDsqDDpsDps" } },
        Wajsberg: {
            comment: ["VISE-berg"],
            theorems: { Axiom: "DDpDqrDDDsrDDpsDpsDpDpq" } },
        Łukasiewicz: {
            comment: ["woo-kay-SHAY-vitch"],
            theorems: {
                Axiom: "DDpDqrDDsDssDDsqDDpsDps",
                AxiomAlternate: "DDpDqrDDpDrpDDsqDDpsDps",
                Axiom1: "CCpqCCqrCpr",
                Axiom2: "CCNppp",
                Axiom3: "CpCNpq",
                Theorem4: {
                    rule: "CCCCqrCprsCCpqs",
                    proof: [{
                        source: "Axiom1",
                        sourceSub: {p: "Cpq", q: "CCqrCpr", r: "s"},
                        premise: "Axiom1" }]
                },
            }},
        Scharle: {
            comment: [
                "https://projecteuclid.org/download/pdf_1/" +
                "euclid.ndjfl/1093958259"],
            theorems: {
                Theorem2: {
                    source: "Łukasiewicz:Axiom",
                    premise: "Łukasiewicz:Axiom",
                    subSource: {
                        p: "DpDqr", q: "DsDss", r: "DDsqDDpsDps", s: "t"
                    },
                    rule: "DDtDsDssDDDpDqrtDDpDqrt"
                },
                Theorem3: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem2",
                    subSource: {
                        p: "DtDsDss", q: "DDpDqrt", r: "DDpDqrt", s: "w"
                    }, rule: "DDwDDpDqrtDDDtDsDsswDDtDsDssw"},
                Theorem4: {
                    source: "Theorem3", premise: "Łukasiewicz:Axiom",
                    subSource: {
                        w: "DpDqr", p: "s", q: "s", t: "DDsqDDpsDps"
                    }, rule: "DDDDsqDDpsDpsDtDttDpDqr"},
                Theorem5: {
                    source: "Theorem2", premise: "Theorem4",
                    subSource: {
                        t: "DDDstDDtsDtsDtDtt", s: "t"
                    }, rule: "DDpDqrDDDstDDtsDtsDtDtt"},
                Theorem6: {
                    source: "Theorem5", premise: "Theorem5",
                    subSource: {
                        p: "DpDqr", q: "DDstDDtsDts", r: "DtDtt"
                    }, rule: "DtDtt"},
                Theorem7: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem6",
                    subSource: {
                        p: "t", q: "t", r: "t"
                    }, rule: "DDstDDtsDts"},
                Theorem8: {
                    source: "Theorem7", premise: "Theorem6",
                    subSource: { s: "t", t: "Dtt" }, rule: "DDttt"},
                Theorem9: {
                    source: "Theorem7", premise: "Theorem7",
                    subSource: { s: "Dst", t: "DDtsDts" },
                    rule: "DDDtsDtsDst"},
                Theorem10: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem9",
                    subSource: {
                        p: "DDtsDts", q: "s", r: "t", s: "p"
                    }, rule: "DDpsDDDDtsDtspDDDtsDtsp"},
                Theorem11: {
                    source: "Theorem10", premise: "Theorem8",
                    subSource: {
                        p: "Dpp", s: "p", t: "s"
                    }, rule: "DDDspDspDpp"},
                Theorem12: {
                    source: "Theorem7", premise: "Theorem11",
                    subSource: {
                        s: "DDspDsp", t: "Dpp"
                    }, rule: "DDppDDspDsp"},
                Theorem13: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem12",
                    subSource: {
                        p: "Dpp", q: "Dsp", r: "Dsp", s: "r"
                    }, rule: "DDrDspDDDpprDDppr"},
                Theorem14: {
                    source: "Theorem13", premise: "Łukasiewicz:Axiom",
                    subSource: {
                        r: "DpDqr", s: "DtDtt", p: "DDsqDDpsDps"
                    }, rule: "DDDDsqDDpsDpsDDsqDDpsDpsDpDqr"},
                Theorem15: {
                    source: "Theorem7", premise: "Theorem14",
                    subSource: {
                        s: "DDsqDDpsDps", t: "DpDqr"
                    }, rule: "DDpDqrDDDsqDDpsDpsDDsqDDpsDps"},
                Theorem16: {
                    source: "Theorem15", premise: "Theorem7",
                    subSource: {
                        p: "Dst", q: "Dts", r: "Dts", s: "p"
                    }, rule: "DDpDtsDDDstpDDstp"},
                Theorem17: {
                    source: "Theorem7", premise: "Theorem16",
                    subSource: {
                        s: "DpDts", t: "DDDstpDDstp"
                    }, rule: "DDDDstpDDstpDpDts"},
                Theorem18: {
                    source: "Theorem16", premise: "Theorem17",
                    subSource: {
                        p: "DDDstpDDstp", t: "p", s: "Dts"
                    }, rule: "DDDtspDDDstpDDstp"},
                Theorem19: {
                    source: "Theorem7", premise: "Theorem18",
                    subSource: {
                        s: "DDtsp", t: "DDDstpDDstp"
                    }, rule: "DDDDstpDDstpDDtsp"},
                Theorem20: {
                    source: "Theorem15", premise: "Theorem15",
                    subSource: {
                        p: "DpDqr", q: "DDsqDDpsDps",
                        r: "DDsqDDpsDps", s: "t"
                    }, rule: "DDtDDsqDDpsDpsDDDpDqrtDDpDqrt"},
                Theorem21: {
                    source: "Theorem20", premise: "Theorem19",
                    subSource: {
                        t: "DDDqsDDpsDpsDDqsDDpsDps"
                    }, rule: "DDpDqrDDDqsDDpsDpsDDqsDDpsDps"},
                Theorem22: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem9",
                    subSource: {
                        p: "DDtsDts", q: "s", r: "t", s: "p"
                    }, rule: "DDpsDDDDtsDtspDDDtsDtsp"},
                Theorem23: {
                    source: "Theorem22", premise: "Theorem6",
                    subSource: { s: "Dpp" }, rule: "DDDtDppDtDppp"},
                Theorem24: {
                    source: "Theorem7", premise: "Theorem23",
                    subSource: { s: "DDtDppDtDpp", t: "p" },
                    rule: "DpDDtDppDtDpp"},
                Theorem25: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem18",
                    subSource: {
                        p: "DDtsp", q: "DDstp", r: "DDstp", s: "q"
                    }, rule: "DDqDDstpDDDDtspqDDDtspq"},
                Theorem26: {
                    source: "Theorem25", premise: "Theorem16",
                    subSource: {
                        q: "DpDts", s: "Dst", t: "p", p: "DDstp"
                    }, rule: "DDDpDstDDstpDpDts"},
                Theorem27: {
                    source: "Theorem7", premise: "Theorem26",
                    subSource: {
                        s: "DDpDstDDstp", t: "DpDts"
                    }, rule: "DDpDtsDDpDstDDstp"},
                Theorem28: {
                    source: "Theorem21", premise: "Theorem27",
                    subSource: {
                        p: "DpDts", q: "DpDst", r: "DDstp", s: "q"
                    }, rule: "DDDpDstqDDDpDtsqDDpDtsq"},
                Theorem29: {
                    source: "Theorem28", premise: "Theorem18",
                    subSource: {
                        p: "Dts", q: "DDDstDpqDDstDpq", s: "p", t: "q"
                    }, rule: "DDDtsDqpDDDstDpqDDstDpq"},
                Theorem30: {
                    source: "Łukasiewicz:Axiom", premise: "Theorem29",
                    subSource: {
                        p: "DDtsDqp", q: "DDstDpq", r: "DDstDpq", s: "r"
                    }, rule: "DDrDDstDpqDDDDtsDqprDDDtsDqpr"},
                Theorem31: {
                    source: "Theorem30", premise: "Theorem24",
                    subSource: {
                        p: "t", q: "Dpp", r: "p", t: "Dpp"
                    }, rule: "DDDDppsDDppsp"},
                Theorem32: {
                    source: "Theorem7", premise: "Theorem31",
                    subSource: {
                        s: "DDDppsDDpps", t: "p"
                    }, rule: "DpDDDppsDDpps"},
            },
        },
        Kleene: {
            theorems: {
                "Axiom Implication Introduction": "CpCqp",
                "Axiom Deduction": "CCpqCCpCqrCpr",
                "Axiom Conjunction Introduction": "CpCqApq",
                "Axiom Conjunction Left Elimination": "CApqp",
                "Axiom Conjunction Right Elimination": "CApqq",
                "Axiom Disjunction Elimination": "CCpqCCrqCKprq",
                "Axiom Disjunction Left Introduction": "CpKpq",
                "Axiom Disjunction Right Introduction": "CpKqp",
                "Axiom Contradiction": "CCpqCCpNqNp",
                "Axiom Negation Elimination": "CNNpp",
            },
        }
    };

    var proofStep = function(value) {
        if (!(this instanceof proofStep))
            return new proofStep(value);
        this.value = value;
    };

    /**
     * Given a library entry and the name of a theorem this routine
     * extracts the theorem as an expression object.  Library entries
     * are key-value pairs.  Each value is either a string in
     * Łukasiewicz notation, an internal expression represenation
     * (always an array since atomic propositions can't be tautologies)
     * or an object.  An object value usually has a rule which itself
     * can be a string in Łukasiewicz notation or an internal expression
     * representation (always an array). */
    var getLibraryExpression = function(library, key, proof) {
        var result, entry;

        if (Array.isArray(key)) {
            if (key.length >= 2)
                entry = internalLibrary[key[0]].theorems[key[1]];
            else if (key.length >= 1)
                entry = library.theorems[key[0]];
            else throw Error("Invalid key", key);
        } else entry = library.theorems[key];

        if (typeof(entry) === 'string') {
            result = parseLNotation(entry);
        } else if (Array.isArray(entry)) {
            result = entry;
        } else if (typeof(entry) === 'object') {
            if (entry.rule) {
                if (typeof(entry.rule) === 'string')
                    result = parseLNotation(entry.rule);
                else if (Array.isArray(entry.rule))
                    result = entry.rule;
            } else throw Error("Invalid library entry object", entry);

            if (entry.proof && proof && Array.isArray(proof))
                entry.proof.forEach(function(entry) {
                    proof.push(proofStep(entry)); });
        } else throw Error("Invalid library entry", entry);
        return result;
    };

    proofStep.prototype.toString = function() {
        var result = [];
        result.push(this.value.source);
        if (this.value.premise)
            result.push(this.value.premise);
        return result.join(", ");
    };

    logic.findLibrary = function(name, formula) {
        var proof = [];
        var result = logic.expression(getLibraryExpression(
            internalLibrary[name], formula, proof), proof);
        return result;
    };

    logic.eachThesis = function(name, fn, context) {
        var index = 0;
        Object.keys(internalLibrary[name].theorems).forEach(
            function(formula) {
                var proof = [];
                var expression = logic.expression(
                    getLibraryExpression(
                        internalLibrary[name], formula, proof),
                    proof);
                fn.call(context, expression, {
                    formula: formula, name: name
                }, index++);
            });
    };

    logic.eachLibrary = function(fn, context) {
        Object.keys(internalLibrary).forEach(function(name) {
            logic.eachThesis(name, fn, context);
        });
    };

    var logicBox = function(element) {
        var display = element.querySelector("textarea.display");
        var pdisplay = element.querySelector("textarea.pdisplay");
        var variables = element.querySelector("select.variables");
        var values = element.querySelector("select.values");
        var rawexpr = element.querySelector("input.rawexpr");
        var current;

        var apply = function(expression) {
            current = expression = logic.expression(expression);
            if (variables) {
                var ii;
                for (ii = variables.options.length - 1; ii >= 0; --ii)
                    variables.remove(ii);
                expression.getFree().forEach(function(variable) {
                    variables.appendChild(ripple.createElement(
                        'option', {value: variable,
                                   innerHTML: variable})); });
            }
            if (display)
                display.innerHTML = expression.toString();
            if (rawexpr)
                rawexpr.value = expression.toString({lnote: true});
            if (expression.proof)
                pdisplay.innerHTML = expression.proof.toString();
        };

        element.querySelectorAll(".theses").forEach(function(theses) {
            var name = theses.getAttribute("data-name");
            logic.eachThesis(name, function(expression, details) {
                theses.appendChild(ripple.createElement(
                    'option', {
                        value: details.name + ':' + details.formula},
                    details.name + ' ' + details.formula));
            });
            theses.value = undefined;
            theses.addEventListener("change", function(event) {
                var parts = event.target.value.split(':');
                var proof = [];
                if (parts.length >= 2)
                    apply(logic.findLibrary(parts[0], parts[1]));
            });
        });

        var simplify = element.querySelector("button.simplify");
        if (simplify)
            simplify.addEventListener("click", function(event) {
                if (current)
                    apply(current.simplify()); });

        var deconstant = element.querySelector("button.deconstant");
        if (deconstant)
            deconstant.addEventListener("click", function(event) {
                if (current)
                    apply(current.deconstant()); });

        var devolve = element.querySelector("button.devolve");
        if (devolve)
            devolve.addEventListener("click", function(event) {
                if (current)
                    apply(current.devolve()); });

        var replace = element.querySelector("button.replace");
        if (replace)
            replace.addEventListener("click", function(event) {
                var value = values.value;
                if (value === 'true')
                    value = true;
                else if (value === 'false')
                    value = false;

                if (current) {
                    apply(current.substitute(
                        variables.value, value));
                    element.querySelectorAll(".theses").forEach(
                        function(theses) { theses.value = undefined; });
                }
            });

        var parse = element.querySelector("button.parse");
        if (parse && rawexpr)
            parse.addEventListener("click", function(event) {
                var expression = logic.parse(rawexpr.value.trim());
                if (expression)
                    apply(expression);

                element.querySelectorAll(".theses").forEach(
                    function(theses) { theses.value = undefined; });
            });
    };

    logic.go = function(className) {
        document.querySelectorAll("." + (className || "logic"))
                .forEach(logicBox);
    };
}(typeof exports === 'undefined' ? this.logic = {} : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {
    var logic = exports;

    process.argv.forEach(function(value, index) {
        if (index > 1) {
            var expression = logic.parse(value);
            console.log(expression.toString());
            console.log(" :: ", expression.simplify().toString());
        }
    });
}
