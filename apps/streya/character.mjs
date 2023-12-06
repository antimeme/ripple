// character.mjs
// Copyright (C) 2023 by Jeff Gold.
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
// Abstractions for managing characters in a game.
//
/* https://nomnoml.com/
   [Character|
   [<table>Stats|
   name|"|background|a||
   health|#|wounds-|a||
   stamina|#|exhaustion-|#||
   water|#|bladder-|#||
   food|#|waste-|#||
   excercise|#|filth-|#||
   social|#|boredom-|#]
   [Wearing] +-> [Item]
   [Inventory] +-> [Item] ] */
import Inventory from "./inventory.mjs";
import Omnivore from "../ripple/omnivore.mjs";

/**
 * Given an object, choose one of its keys,  Without a second argument
 * all keys are equally likely to be chosen.  If provided the second
 * argument must be a function that accepts an object and a key and
 * returns a non-negative number to use as the weight for that key.
 * Keys are chosen with probability equal to their share of the total
 * weight.  So given keys "a" (weight 3) and "b" (weight 1) this
 * routine will choose "a" three quarters of the time. */
function chooseKey(object, getWeight = (o, k) => 1) {
    const choice = Math.random();
    let result = undefined;
    let total = 0;
    let used = 0;
    Object.keys(object).forEach(key =>
        { total += getWeight(object, key); });
    Object.keys(object).forEach(key => {
         const weight = getWeight(object, key);
        if (!result && (choice * total < used + weight)) {
            result = key;
        } else used += weight;
    });
    return result;
}

function createListItem(text) {
    const result = document.createElement("li");
    result.appendChild(document.createTextNode(text));
    return result;
}

class Radians {

    /**
     * Given a value in radians, returns an equivalent value that
     * is clamped between pi and minus pi. */
    static normalize(value) {
        while (value > Math.PI)
            value -= 2 * Math.PI;
        while (value <= -Math.PI)
            value += 2 * Math.PI;
        return value;
    }

    /**
     * Given start and end vectors or angles, returns the angle in
     * radians necessary to turn from the start to the end. */
    static difference(start, end) {
        let result = 0;
        if (!isNaN(start) && !isNaN(end)) {
            result = Radians.normalize(end - start);
        } else if (start && (typeof(start) === "object") &&
                   !isNaN(start.x) && !isNaN(start.y) &&
                   end && (typeof(end) === "object") &&
                   !isNaN(end.x) && !isNaN(end.y)) {
            const wedge = start.x * end.y - start.y * end.x;
            result = ((wedge > 0) ? 1 : -1) * Math.acos(
                (end.x * start.x + end.y * start.y) /
                Math.sqrt((start.x * start.x + start.y * start.y) *
                    (end.x * end.x + end.y * end.y)));
        } else throw new Error("invalid start or end: " +
                               JSON.stringify(start) + " :: " +
                               JSON.stringify(end));
        return result;
    }
}

function smootherStep(t)
{ return t * t * t * (6 * t * t - 15 * t + 10); }

class Race {
    constructor(racedef) {
        this._slots = racedef.slots ? racedef.slots : {};
        this._draw  = racedef.draw ? racedef.draw : [];
    }

    #finishStep(ctx, step, colors) {
        if (step.fill) {
            ctx.fillStyle = (colors && (step.fill in colors)) ?
                            colors[step.fill] : step.fill;
            ctx.fill();
        }
        if (step.stroke) {
            ctx.strokeStyle = (colors && (step.stroke in colors)) ?
                              colors[step.stroke] : step.stroke;
            ctx.stroke();
        }
    }

    drawTopDown(ctx, colors, now, phase) {
        // Drawing instructions consist of an array of step
        // objects.  Each must have an "op" field that describes
        // what to draw as well as parameters appropriate to that
        // operation.  In addition, there may be "period" and
        // "blink" fields to disable drawing on a periodic basis.
        // Period should be a number of milliseconds.  Blink should
        // be a number between zero and one that specifies how much
        // of the period should be omitted for drawing.

        this._draw.topDown.forEach(step => {
            if (!isNaN(step.period) && !isNaN(step.blink) &&
                (step.blink > Math.floor((
                    now + step.period * phase) %
                    step.period) / step.period)) {
                console.log("DEBUG", phase);
            } else if ((step.op === "ellipse") &&
                       !isNaN(step.x)  && !isNaN(step.y) &&
                       !isNaN(step.rx) && !isNaN(step.ry)) {
                    ctx.beginPath();
                ctx.moveTo(step.x + step.rx, step.y);
                ctx.ellipse(step.x, step.y, step.rx, step.ry,
                            0, 0, 2 * Math.PI);
                this.#finishStep(ctx, step, colors);
            } else if ((step.op === "circle") && !isNaN(step.r) &&
                       !isNaN(step.x) && !isNaN(step.y)) {
                ctx.beginPath();
                ctx.moveTo(step.x + step.r, step.y);
                ctx.arc(step.x, step.y, step.r, 0, 2 * Math.PI);
                this.#finishStep(ctx, step, colors);
            }
        });
    }

    apply(character) {
        character._race = this;
        if (this._draw && this._draw.colors) {
            character._colors = Object.keys(
                this._draw.colors).reduce((colors, name) => {
                    const color = this._draw.colors[name];
                    if (typeof(color) === "string")
                        colors[name] = color;
                    else if (Array.isArray(color))
                        colors[name] = color[
                            Math.floor(Math.random() * color.length)];
                    else throw new TypeError(
                        "Unrecognized color type: " + typeof(color));
                    return colors;
                }, {});
        }
    }

    toJSON()
    { return { slots: this._slots, draw: this._draw }; }
}

class Character {
    constructor(config) {
        const period = 4500;
        this._cycle = {phase: Math.random() * period, period: period};

        this._position = {x: 0, y: 0};
        this._wearing = new Inventory();
        this._carrying = new Inventory();

        this._racename = (config && config.race) ?
                         config.race : undefined;
        if (!Character._races) {
            this._race = undefined;
        } else if (this._racename &&
                   (this._racename in Character._races)) {
            Character._races[this._racename].apply(this);
        } else if (!this._racename) {
            this._racename = chooseKey(Character._races, (o, k) =>
                isNaN(o[k].weight) ? 1 : o[k].weight);
            Character._races[this._racename].apply(this);
        } else this._race = undefined;
    }

    _spin = 0;
    _cycle; // state of idle animation

    _ship = undefined;
    _path = [];
    _pathStep = 0;
    _speed = 0.002;
    _angv  = 0.005;

    _colors = {base: "blue"};

    get position() { return this._position; }
    setPosition(position) { this._position = position; return this; }

    get ship() { return this._ship; }
    setShip(ship) {
        this._ship = ship;
        this._spin     = Math.random() * Math.PI * 2;
        this._spinGoal = Math.random() * Math.PI * 2;
        return this;
    }

    setPath(path) { this._path = path; return this; }

    pointAt(point) {
        this._spinGoal = Radians.difference({x: 0, y: 1}, {
            x: point.x - this._position.x,
            y: point.y - this._position.y });
        return this;
    }

    drawFace(ctx, now) {
        // TODO
    }

    drawTopDown(ctx, now) {
        ctx.save();
        ctx.translate(this._position.x, this._position.y);
        ctx.rotate(this._spin);
        if (!this._race) {
            const points = [
                {x: 0.45, y: 0.45}, {x: 0.45, y: -0.45},
                {x: -0.45, y: -0.45}, {x: -0.45, y: 0.45}];
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach(point => { ctx.lineTo(point.x, point.y); });
            ctx.closePath();

            ctx.fillStyle = this._colors.base;
            ctx.fill();
        } else this._race.drawTopDown(
            ctx, this._colors, now, this._cycle.phase);
        ctx.restore();
    }
    
    update(last, now) {
        const elapsed = isNaN(last) ? 0 : (now - last);

        if (this.ship && this._path && (this._path.length > 0)) {
            let distance = this._pathStep + this._speed * elapsed;
            let current = this.ship.grid.markCenter(this._position);
            let next = this.ship.grid.markCenter(this._path[0]);

            while (distance > 0) {
                let gap = Math.hypot(current.x - next.x,
                                     current.y - next.y);
                if (distance >= gap) {
                    distance -= gap;
                    current = this._path.shift();
                    if (this._path.length > 0) {
                        next = this.ship.grid.markCenter(this._path[0]);
                        this.pointAt(next);
                    } else {
                        this._path = [];
                        distance = 0;
                    }
                } else {
                    const fraction = ((distance / gap) +
                                      smootherStep(distance / gap)) / 2;
                    current = {
                        row: current.row, col: current.col,
                        x: current.x + fraction * (next.x - current.x),
                        y: current.y + fraction * (next.y - current.y) };
                    this._pathStep = distance;
                    distance = 0;
                }
            }
            this._position = current;
        }

        if (this._spin != this._spinGoal) {
            const diff = Radians.difference(this._spin, this._spinGoal);
            const turn = this._angv * elapsed;
            if (turn > Math.abs(diff))
                this._spin = this._spinGoal;
            else this._spin += turn * (diff > 0 ? 1 : - 1);
        }
    }

    getCard() {
        const fieldset = document.createElement("fieldset");
        const contents = document.createElement("ul");
        const legend = document.createElement("legend");
        legend.appendChild(document.createTextNode(this.name));
        fieldset.appendChild(legend);
        fieldset.appendChild(contents);
        fieldset.classList.add("recruit");

        if (this.gender)
            contents.appendChild(createListItem(
                "Gender: " + this.gender));
        if (this.birthplace)
            contents.appendChild(createListItem(
                "Born: " + this.birthplace));
        if (this.culture)
            contents.appendChild(createListItem(
                "Culture: " + this.culture));
        contents.appendChild(document.createElement("hr"));
        this.background.forEach(
            b => { contents.appendChild(createListItem(b)) });

        return fieldset;
    }

    static createRecruit(setting) {
        const recruit = new Character();

        recruit.birthplace = chooseKey(setting.places);
        recruit.gender = chooseKey(
            {"Male": 1, "Female": 1}, (o, k) => o[k]);
        recruit.culture = chooseKey(
            setting.places[recruit.birthplace].population,
            (o, k) => o[k]);
        if (recruit.culture) {
            const namegen = Omnivore.createGrammar(
                setting.cultures[recruit.culture].namegen);
            recruit.name = namegen.generate(
                ((recruit.gender === "Male") ?
                 "fname_male" : "fname_female")) +
                           " " + namegen.generate("surname");
        }

        recruit.background = [];
        let current = chooseKey(setting.backgrounds, (o, k) =>
            o[k].recruit ? 1 : 0);
        while (current) {
            const previous = setting.backgrounds[current]?.previous;
            recruit.background.push(current);

            if (previous)
                current = chooseKey(previous);
            else current = undefined;
        }

        // :TODO: accumulate skills
        // :TODO: create inventory with some items

        return recruit;
    }

    static _races = {};
    static setup(setting) {
        for (const racename in setting.races)
            this._races[racename] = new Race(setting.races[racename]);
    }
}

export default Character;
