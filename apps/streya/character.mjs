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
import Omnivore from "../ripple/omnivore.mjs";

/**
 * Given an object, choose one of its keys,  Without a second argument
 * all keys are equally likely to be chosen.  If provided the second
 * argument must be a function that accepts an object and a key and
 * returns a non-negative number to use as the weight for that key.
 * Keys are chosen with probability equal to their share of the total
 * weight.  So given keys "a"  (weight 3) and "b" (weight 1) this
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

/**
 * Given start and end values in radians, return the number of
 * radians needed to go from one to the other the shortest way.
 * Positive values go counter clockwise. */
function radianDelta(start, end) {
    let result = end - start;
    if (result > Math.PI)
        result -= 2 * Math.PI;
    else if (result < -Math.PI)
        result += 2 * Math.PI;
    return result;
}

class Character {
    constructor(config) {
        const period = 4500;
        this._cycle = {phase: Math.random() * period, period: period};
        this._spin = Math.random() * Math.PI * 2;
    }

    _position = {x: 0, y: 0};
    _spin = 0;
    _cycle; // state of idle animation

    _ship = undefined;
    _path = undefined;
    _pathStep = 0;
    _speed = 0.002;
    _angspeed = 0.002;

    _colors = {base: "blue"};

    get position() { return this._position; }
    setPosition(position) { this._position = position; return this; }

    get ship() { return this._ship; }
    setShip(ship) { this._ship = ship; return this; }

    setPath(path) { this._path = path; return this; }

    drawFace(ctx, now) {
        // TODO
    }

    drawTopDown(ctx, now) {
        ctx.save();
        ctx.translate(this._position.x, this._position.y);
        ctx.rotate(this._spin);
        this._drawTopDown(ctx, now);
        ctx.restore();
    }

    _drawTopDown(ctx, now) {
        const points = [
            {x: 0.9, y: 0.9}, {x: 0.9, y: -0.9},
            {x: -0.9, y: -0.9}, {x: -0.9, y: 0.9}];
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => { ctx.lineTo(point.x, point.y); });
        ctx.closePath();

        ctx.fillStyle = this._colors.base;
        ctx.fill();
    }
    
    update(last, now) {
        if (this.ship && this._path && (this._path.length > 0)) {
            let distance = this._pathStep + this._speed * (now - last);
            let current = this.ship.grid.markCenter(this._position);
            let next = this.ship.grid.markCenter(this._path[0]);

            while (distance > 0) {
                let gap = Math.hypot(current.x - next.x,
                                     current.y - next.y);
                if (distance >= gap) {
                    distance -= gap;
                    current = next;
                    this._path.shift();
                    if (this._path.length)
                        next = this.ship.grid.markCenter(this._path[0]);
                    else distance = 0;
                } else {
                    const fraction = distance / gap;
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
        const recruit = new HumanCharacter();

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
}

class HumanCharacter extends Character {
    constructor(config) {
        super(config);

        const colors = {
            body: ["blue", "green", "red", "purple", "cyan", "yellow"],
            head: ["orange", "red", "purple"],
            eyes: ["blue", "green", "brown"] };
        this._colors.body = colors.body[Math.floor(
            Math.random() * colors.body.length)];
        this._colors.head = colors.head[Math.floor(
            Math.random() * colors.head.length)];
        this._colors.eyes = colors.eyes[Math.floor(
            Math.random() * colors.eyes.length)];

        this.health = 10;
        this.brawn = 10;
        this.agility = 10;
        this.will = 10;
        this.charm = 10;
        this.wounds = [];

        this.stamina = 10;
        this.water = 10;    this.graywater = 0;
        this.food = 10;     this.waste = 0;
        this.exercise = 10; this.filth = 0;
        this.social = 10;   this.boredom = 0;
    }

    _drawTopDown(ctx, now) {
        ctx.beginPath();
        ctx.moveTo(0, 0.4);
        ctx.ellipse(0, 0, 0.4, 0.265, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = this._colors.body;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0.25);
        ctx.arc(0, 0, 0.25, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = this._colors.head;
        ctx.fill();

        const cycle = Math.floor((now + this._cycle.phase) %
            this._cycle.period) / this._cycle.period;
        if (cycle > 0.075) { // Draw eyes except when blinking
            const eyeRadius = 0.05;
            const eyeDist   = 0.1;
            ctx.beginPath();
            ctx.moveTo(-eyeDist + eyeRadius, eyeDist);
            ctx.arc(-eyeDist, eyeDist, eyeRadius, 0, Math.PI * 2);
            ctx.moveTo(eyeDist + eyeRadius, eyeDist);
            ctx.arc(eyeDist, eyeDist, eyeRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = this._colors.eyes;
            ctx.fill();
        }            
    }
}

export default Character;
