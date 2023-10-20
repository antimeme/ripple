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

class Character {
    constructor(config) {}

    drawFace(ctx) {}
    drawTopDown(ctx) {
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
}

class HumanCharacter extends Character {
    constructor(config) {
        super(config);

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
}

export default Character;
