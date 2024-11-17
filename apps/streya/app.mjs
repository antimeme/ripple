// streya/app.mjs
// Copyright (C) 2024 by Jeff Gold.
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
// Streya is a character based role playing game engine.
// :TODO: give floor cells an optional inventory
// :TODO: create interactable locker with stuff in it
// :TODO: draw items in character hands
// :TODO: path finding when click
// :TODO: create structure editor
import Ripple   from "../ripple/ripple.mjs";
import Grid     from "../ripple/grid.mjs";
import Pathf    from "../ripple/pathf.mjs";
import Omnivore from "../ripple/omnivore.mjs";

/**
 * Convert a node with numeric row and col fields into a single
 * integer suitable for use as an object key. */
function getNodeIndex(node)
{ return Ripple.pair(node.col, node.row); }

function getIndexNode(index) {
    const pair = Ripple.unpair(index);
    return { col: node.x, row: node.y };
}

function metricPrefix(amount) {
    return (amount >= 1e30)  ? {name: "quetta", symbol: "Q",  e:  30} :
           (amount >= 1e27)  ? {name:  "ronna", symbol: "R",  e:  27} :
           (amount >= 1e24)  ? {name:  "yotta", symbol: "Y",  e:  24} :
           (amount >= 1e21)  ? {name:  "zetta", symbol: "Z",  e:  21} :
           (amount >= 1e18)  ? {name:    "exa", symbol: "E",  e:  18} :
           (amount >= 1e15)  ? {name:   "peta", symbol: "P",  e:  15} :
           (amount >= 1e12)  ? {name:   "tera", symbol: "T",  e:  12} :
           (amount >= 1e9)   ? {name:   "giga", symbol: "G",  e:   9} :
           (amount >= 1e6)   ? {name:   "mega", symbol: "M",  e:   6} :
           (amount >= 1e3)   ? {name:   "kilo", symbol: "k",  e:   3} :
           (amount >= 1e2)   ? {name:  "hecto", symbol: "h",  e:   2} :
           (amount >= 1e1)   ? {name:   "deka", symbol: "da", e:   1} :
           (amount >= 1e0)   ? {name:       "", symbol:  "",  e:   0} :
           (amount >= 1e-1)  ? {name:   "deci", symbol: "d",  e:  -1} :
           (amount >= 1e-2)  ? {name:  "centi", symbol: "c",  e:  -2} :
           (amount >= 1e-3)  ? {name:  "milli", symbol: "m",  e:  -3} :
           (amount >= 1e-6)  ? {
               name: "micro", symbol: "\u00b5", e: -6} :
           (amount >= 1e-9)  ? {name:   "nano", symbol: "n",  e:  -9} :
           (amount >= 1e-12) ? {name:   "pico", symbol: "p",  e: -12} :
           (amount >= 1e-15) ? {name:  "femto", symbol: "f",  e: -15} :
           (amount >= 1e-18) ? {name:   "atto", symbol: "a",  e: -18} :
           (amount >= 1e-21) ? {name:  "zepto", symbol: "z",  e: -21} :
           (amount >= 1e-24) ? {name:  "yocto", symbol: "y",  e: -24} :
           (amount >= 1e-27) ? {name:  "ronto", symbol: "r",  e: -27} :
           {name: "quecto", symbol: "q", e: -30};
}

function displayMetric(value, unit, digits) {
    const details = metricPrefix(value);
    const exp = (details.e % 3) ? 0 : details.e;
    const suffix = (details.e % 3) ? unit : (details.symbol + unit);
    let number = (value / (10 ** exp)).toString();

    if (!isNaN(digits)) {
        const parts = number.split(".");
        if ((parts.length === 2) && (parts[1].length > digits))
            number = (value / (10 ** exp)).toFixed(digits);
    }
    return number + " " + suffix;
}

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

/**
 * Draws an arrow from the start point to the end point.  An arrow
 * has a width and a depth, both relative to the length of the
 * line.  To make these absolute, multiply by the desired length
 * and divide by the line length. */
function drawArrow(ctx, start, end, config) {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const depth = config && config.depth || 0.1;
    const width = config && config.width || 0.15;
    const slide = config && config.slide || 1.0;

    const perp = { x: (end.y - start.y) * width,
                   y: (start.x - end.x) * width };
    const top = {
        x: start.x + (end.x - start.x) * (slide + depth),
        y: start.y + (end.y - start.y) * (slide + depth) };
    const bottom = {
        x: start.x + (end.x - start.x) * slide,
        y: start.y + (end.y - start.y) * slide };
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x + perp.x, bottom.y + perp.y);
    ctx.lineTo(bottom.x - perp.x, bottom.y - perp.y);
    ctx.lineTo(top.x, top.y);
}

/**
 * Carry out instructions encoded as JSON objects.
 *
 * @param ctx a drawing context of the sort provided by canvas
 * @param steps an array of drawing operation objects.
 *        Each step should have an "op" field that specifies the
 *        operation ("circle", "ellipse", "polygon") as well as
 *        parameters appropriate to that operation.  Assume that
 *        the center of the figure is the origin (0.0, 0.0) and
 *        that the boundaries are at one and minus in each dimension.
 *        An optional "period" field should be a number of
 *        milliseconds and an optional "blink" field should be a
 *        number between zero and one specifying how much of the
 *        period for which the drawing operation should be skipped.
 * @param now current time in milliseconds
 * @param phase number between zero and one
 * @param colors map from string to color values */
function drawSteps(ctx, steps, config) {
    const now   = (config && !isNaN(config.now)) ? config.now : 0;
    const phase = (config && !isNaN(config.phase)) ? config.phase : 0;
    const colors = (config && config.colors &&
                    (typeof(config) === "object")) ?
                   config.colors : {};
    const conditions = (config && config.conditions) ?
                       config.conditions : {};

    function getColor(tag) {
        return (tag in colors) ? colors[tag] : tag;
    }

    function finishStep(ctx, step, colors) {
        if (step.fill) {
            ctx.fillStyle = getColor(step.fill);
            ctx.fill();
        }
        if (step.stroke) {
            ctx.strokeStyle = getColor(step.stroke);
            ctx.stroke();
        }
    }

    steps.forEach(step => {
        if (step.condition && !conditions[step.condition]) {
            // Skip step due to condition not being met
        } else if (!isNaN(step.period) && !isNaN(step.blink) &&
                   (step.blink > Math.floor((
                       now + step.period * phase) %
                       step.period) / step.period)) {
            // Skip step because blink is active
        } else if ((step.op === "ellipse") &&
                   !isNaN(step.x)  && !isNaN(step.y) &&
                   !isNaN(step.rx) && !isNaN(step.ry)) {
            ctx.beginPath();
            ctx.moveTo(step.x + step.rx, step.y);
            ctx.ellipse(step.x, step.y, step.rx, step.ry,
                        0, 0, 2 * Math.PI);
            finishStep(ctx, step, colors);
        } else if ((step.op === "circle") && !isNaN(step.r) &&
                   !isNaN(step.x) && !isNaN(step.y)) {
            ctx.beginPath();
            ctx.moveTo(step.x + step.r, step.y);
            ctx.arc(step.x, step.y, step.r, 0, 2 * Math.PI);
            finishStep(ctx, step, colors);
        } else if ((step.op === "polygon") &&
                   Array.isArray(step.points) &&
                   step.points.length) {
            const end = step.points[step.points.length - 1];
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            step.points.forEach(
                point => ctx.lineTo(point.x, point.y));
            finishStep(ctx, step, colors);
        }
    });
}

/**
 * Creates a temporary message to explain a result to the player. */
function setToast(message) {
    const toast = document.createElement("div");
    toast.classList.add("toast");
    toast.innerText = message;
    document.body.append(toast);
    setTimeout(() => toast.classList.add("fade-out"), 2000);
    toast.addEventListener("transitionend", () => toast.remove());
    console.log(message);
}

class Icon {
    #draw;

    constructor(icon) {
        this.#draw = icon.draw;
    }

    connect(setting) {}

    toJSON() {
        const result = {};
        if (this.#draw)
            result.draw = this.#draw;
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }
}

/**
 * A race is a kind of creature that a character can be.
 * Race defines what limbs a character has and how to determine
 * which has been hit on a successful attack.  It also defines
 * what items a character can wear.  Each limb is also a slot
 * to which a single item can be attached.  Items can introduce
 * additional slots. */
class Race {
    #inherit; #parent; #ignore; #default;
    #limbs; #draw;
    #speed; #actionPoints;

    static defaultRace = null;

    constructor(race) {
        this.#parent  = race.parent;
        this.#ignore  = race.ignore;
        this.#speed   = race.speed;
        this.#limbs   = race.limbs;
        this.#draw    = race.draw;
        this.#default = race.default;
        if (this.#default)
            Race.defaultRace = this;
        this.#actionPoints = race.actionPoints;
    }

    connect(setting) {
        if (typeof(this.#parent) === "string")
            this.#inherit = setting.findRace(this.#parent);
        if (isNaN(this.#actionPoints))
            this.#actionPoints = setting.actionPoints;
    }

    toJSON() {
        const result = {};
        if (this.#default)
            result["default"] = true;
        if (this.#parent)
            result.parent = this.#parent;
        if (this.#ignore)
            result.ignore = !!this.#ignore;
        if (this.#speed)
            result.speed = this.#speed;
        if (this.#limbs)
            result.limbs = this.#limbs;
        if (this.#draw)
            result.draw = this.#draw;
        if (this.#actionPoints)
            result.actionPoints = this.#actionPoints;
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    get ignore() { return this.#ignore; }

    get actionPoints() { return this.#actionPoints; }

    get speed() {
        return !isNaN(this.#speed) ? this.#speed :
               this.#inherit ? this.#inherit.speed : 0;
    }

    get limbs() {
        const result = Object.assign(
            {}, this.#inherit ? this.#inherit.limbs : undefined);
        if (this.#limbs)
            Object.entries(this.#limbs).forEach(
                ([name, limb]) => {
                    if (limb.ignore)
                        delete result[name];
                    else result[name] = limb; });
        return result;
    }

    /**
     * Determine which limb is hit by an attack.  Cover should be
     * falsy if no cover applies.  Target is normally falsy but
     * can specify a limb that the attacker is attempting to hit. */
    hitLimb(cover, target) {
        let result = null;
        const totalWeight = Object.keys(this.#limbs).reduce(
            (total, limbName) =>
                total + (this.#limbs[limbName].hitweight || 0), 0);
        let weight = Math.random() * totalWeight;

        Object.keys(this.#limbs).forEach(limbName => {
            const limb = this.#limbs[limbName];
            if (!result && !isNaN(limb.hitWeight)) {
                if (limb.hitWeight < weight) {
                    result = limbName;
                } else weight -= limb.hitWeight;
            }
        });
        return result;
    }

    /**
     * Modify character inventories to enforce game rules specified
     * by limb definitions.  This ensures that:
     * - characters can only wear items for limbs they have
     * - characters can't remove items from alwaysCover limbs
     * - characters can't carry more bulk than allowed */
    inventoryConstrain(wearing, carrying) {
        function getSlots(race) {
            const result = {};
            Object.keys(race.limbs).forEach(limbName => {
                if (limbName in result)
                    result[limbName].available++;
                else result[limbName] = {
                    available: 1, evict: 0, items: [] };
            });
            wearing.forEach(item => {
                if (item.wear) {
                    if (item.wear in result) {
                        const slot = result[item.wear];
                        slot.available--;
                        slot.items.push(item);
                    } else result[item.wear] = {
                        available: -1, evict: 0, items: [item] };
                } else {
                    // TODO: allow low bulk items to fit in pockets
                }

                if (item.slots)
                    item.slots.forEach(slotName => {
                        if (slotName in result)
                            result[slotName].available++;
                        else result[slotName] = {
                            available: 1, evict: 0, items: [] };
                    });
            });
            return result;
        }

        wearing.constrain((wearing, other, index) => {
            const evict = wearing.canGive(other.getItem(index));
            if (Array.isArray(evict) &&
                !evict.every(item => other.canGive(item)))
                throw new Error("No way to dispose of items: " +
                                evict.filter(
                                    item => !other.canGive(item))
                                     .map(item => item.name)
                                     .join(", "));
            else if ((evict instanceof Item) &&
                     !other.canGive(item))
                throw new Error("No way to dispose of item: " +
                                item.name);
            return evict;
        }, (wearing, item) => {
            if (!item.wear)
                throw new Error("Item is not wearable: " + item.name);

            const slots = getSlots(this);
            const slot = slots[item.wear];
            if (!slot)
                throw new Error("No way to wear item: " + item.name);
            if (!slot.available && slot.items.length) {
                const evict = [];
                const replace = slot.items[slot.evict++];

                evict.push(replace);
                if (replace.slots)
                    replace.slots.forEach(slotName => {
                        const oslot = slots[slotName];
                        if (!oslot.available)
                            evict.push(oslot.items[oslot.evict++]);
                    });
                return evict;
            } else return (slot.available > 0);
        }, (wearing, index) => {
            // Some limbs must always be covered (usually for
            // decency).  Taking items from this limb is not allowed
            // but giving items for the same slot will replace it.
            const item = wearing.getItem(index);
            const slots = getSlots(this);

            if (item.wear && (item.wear in this.limbs) &&
                this.limbs[item.wear].alwaysCover &&
                (slots[item.wear].available === 0))
                throw new Error("Cannot expose " + item.wear);

            if (item.slots)
                item.slots.forEach(slotName => {
                    if ((slotName in slots) &&
                        !slots[slotName].available)
                        throw new Error("Need " + item.name +
                                        " for " + slotName); });

            return true;
        });

        carrying.constrain((carrying, other, index) => {
            // :TODO: implement bulk constraints based on
            //        prehensile limbs
            return true;
        }, (carrying, item) => {
            // :TODO: implement bulk constraints based on
            //        prehensile limbs
            return true;
        }, (carrying, index) => true);
    }

    drawTopDown(ctx, character, now) {
        if (this.#draw && this.#draw.topDown) {
            const conditions = {};
            const placedItems = [];
            Object.entries(this.#limbs).forEach(([limbName, limb]) => {
                if (limb.prehensile && limb.display &&
                    !isNaN(limb.display.x) && !isNaN(limb.display.y) &&
                    !isNaN(limb.display.priority)) {
                    const priority = (!isNaN(limb.display.southpaw) &&
                                      character.southpaw) ?
                                     limb.display.southpaw :
                                     limb.display.priority;
                    if (character.carrying.length >= priority) {
                        conditions[limbName] = true;
                        placedItems.push({
                            x: limb.display.x, y: limb.display.y,
                            item: character.carrying.getItem(
                                priority - 1) });
                    }
                }
            });

            drawSteps(ctx, this.#draw.topDown, {
                now: now, phase: character.phase,
                colors: character.colors,
                conditions: conditions });
            placedItems.forEach(descriptor => {
                ctx.save();
                ctx.translate(descriptor.x, descriptor.y);
                ctx.scale(0.25, 0.25);
                descriptor.item.drawTopDown(ctx, now);
                ctx.restore();
            });
        } else if (this.#inherit)
            this.#inherit.drawTopDown(ctx, character, now);
        else throw new Error("No instructions for top down drawing");
    }
}

/**
 * Item definitions are used to determine properties of items that
 * characters might wear or use. */
class ItemDefinition {
    #inherit; #default; #parent; #ignore; #draw;
    #mass; #bulk; #wear; #slots; #uses;
    #armor;

    static defaultItem = null;

    constructor(itemdef) {
        this.#parent  = itemdef.parent;
        this.#ignore  = itemdef.ignore;
        this.#mass    = itemdef.mass;
        this.#bulk    = itemdef.bulk;
        this.#uses    = itemdef.uses;
        this.#draw    = itemdef.draw;
        this.#armor   = itemdef.armor;
        this.#wear    = itemdef.wear;
        this.#slots   = Array.isArray(itemdef.slots) ?
                        itemdef.slots.slice() : [];
        this.#default = itemdef["default"];
        if (this.#default)
            ItemDefinition.defaultItem = this;
    }

    connect(setting) {
        if (this.#parent && (typeof(this.#parent) === "string"))
            this.#inherit = setting.findItemDefinition(this.#parent);
        if (!this.#inherit && (this !== ItemDefinition.defaultItem))
            this.#inherit = ItemDefinition.defaultItem;
    }

    get mass() {
        return (this.#mass) ? this.#mass : this.#inherit ?
               this.#inherit.mass : 0;
    }

    get bulk() {
        return (this.#bulk) ? this.#bulk : this.#inherit ?
               this.#inherit.bulk : 0;
    }

    get wear() {
        return (this.#wear) ? this.#wear :
               this.#inherit ? this.#inherit.wear : 0;
    }

    get slots() {
        return (this.#slots) ? this.#slots :
               this.#inherit ? this.#inherit.slots : [];
    }

    drawTopDown(ctx, now, phase) {
        if (this.#draw && this.#draw.topDown)
            drawSteps(ctx, this.#draw.topDown,
                      { now: now, phase: phase,
                        colors: this.#draw.colors });
        else if (this.#inherit)
            this.#inherit.drawTopDown(ctx, now, phase);
        else throw new Error("No way to draw item type");
    }

    toJSON() {
        const result = {};
        if (this.#parent)
            result.parent = this.#parent;
        if (this.#ignore)
            result.ignore = this.#ignore;
        if (this.#mass)
            result.mass = this.#mass;
        if (this.#bulk)
            result.bulk = this.#bulk;
        if (this.#uses)
            result.uses = this.#uses;
        if (this.#armor)
            result.armor = this.#armor;
        if (this.#draw)
            result.draw = this.#draw;
        if (this.#wear)
            result.wear = this.#wear;
        if (this.#slots.length)
            result.wear = this.#slots.slice();
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }
}

/**
 * A facility is a large structure that a character might interact
 * with on a ship or in a building. */
class Facility {
    #inherit = null;
    #parent;
    #mass;
    #ignore;
    #uses;

    constructor(facility) {
        this.#parent = facility.parent;
        this.#mass   = facility.mass;
        this.#ignore = facility.ignore;
        this.#uses   = facility.uses;
    }

    connect(setting) {
        if (this.#parent && (typeof(this.#parent) === "string"))
            this.#inherit = setting.findFacility(this.#parent);
    }

    get mass() {
        return (this.#mass) ? this.#mass : this.#inherit ?
               this.#inherit.mass : 0;
    }

    toJSON() {
        const result = {};
        if (this.#parent)
            result.parent = this.#parent;
        if (this.#ignore)
            result.ignore = this.#ignore;
        if (this.#uses)
            result.uses = this.#uses;
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }
}

class Setting {
    #icons; #races; #itemdefs; #facilities;
    #actionPoints;

    constructor(setting) {
        this.#actionPoints = setting.actionPoints;

        this.#icons = setting.icons ? Object.fromEntries(
            Object.keys(setting.icons).map(iconName =>
                [iconName, new Icon(setting.icons[iconName])])) : {};
        this.#races = setting.races ? Object.fromEntries(
            Object.keys(setting.races).map(raceName =>
                [raceName, new Race(setting.races[raceName])])) : {};
        this.#itemdefs = setting.itemdefs ? Object.fromEntries(
            Object.keys(setting.itemdefs).map(itemName =>
                [itemName, new ItemDefinition(
                    setting.itemdefs[itemName])])) : {};
        this.#facilities = Object.fromEntries(
            Object.keys(setting.facilities).map(
                facility => [facility, new Facility(
                    setting.facilities[facility])]));

        Object.keys(this.#icons).forEach(iconName =>
            this.#icons[iconName].connect(this));
        Object.keys(this.#races).forEach(raceName =>
            this.#races[raceName].connect(this));
        Object.keys(this.#itemdefs).forEach(itemName =>
            this.#itemdefs[itemName].connect(this));
        Object.keys(this.#facilities).forEach(facilityName =>
            this.#facilities[facilityName].connect(this));
    }

    toJSON() {
        const result = {};
        if (!isNaN(this.#actionPoints))
            result.actionPoints = this.#actionPoints;
        if (this.#icons && Object.keys(this.#icons))
            result.icons = Object.fromEntries(
                Object.entries(this.#icons).map(
                    ([iconName, icon]) => [iconName, icon.toJSON()]));
        if (this.#races && Object.keys(this.#races))
            result.races = Object.fromEntries(
                Object.entries(this.#races).map(
                    ([raceName, race]) => [raceName, race.toJSON()]));
        if (this.#itemdefs && Object.keys(this.#itemdefs))
            result.itemdefs = Object.fromEntries(
                Object.entries(this.#itemdefs).map(
                    ([itemName, itemdef]) =>
                        [itemName, itemdef.toJSON()]));
        if (this.#facilities && Object.keys(this.#facilities))
            result.facilities = Object.fromEntries(
                Object.entries(this.#facilities).map(
                    ([facilityName, facility]) =>
                        [facilityName, facility.toJSON()]));
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    get actionPoints() { return this.#actionPoints; }

    findRace(raceName) { return this.#races[raceName]; }

    eachRace(fn, context) {
        Object.entries(this.#races).forEach(([name, race]) => {
            if (!race.ignore)
                fn.call(context, name, race);
        });
    }

    findItemDefinition(name) { return this.#itemdefs[name]; }

    eachItemDefinition(fn, context) {
        Object.entries(this.#itemdefs).forEach(([name, itemdef]) => {
            if (!itemdef.ignore)
                fn.call(context, name, itemdef);
        });
    }

    findFacility(name) { return this.#facilities[name]; }

}

class Item {
    #name; #mass; #bulk; #definition;
    #uses; #draw; #wear; #slots; #phase;

    constructor(item, setting) {
        if (typeof(item) === "string") {
            this.#name = item;
        } else if (item && (typeof(item) === "object")) {
            this.#name  = item.name;
            this.#mass  = item.mass;
            this.#bulk  = item.bulk;
            this.#uses  = item.uses;
            this.#draw  = item.draw;
            this.#wear  = item.wear;
            this.#slots = item.slots;
            this.#phase = Math.random();
        } else throw new TypeError("Invalid type for item");

        if (setting instanceof Setting)
            this.connect(setting);
    }

    connect(setting) {
        this.#definition = setting.findItemDefinition(this.#name);
    }

    get name() { return this.#name; }

    get mass() {
        return !isNaN(this.#mass) ? this.#mass :
               this.#definition ? this.#definition.mass : 0;
    }

    get bulk() {
        return !isNaN(this.#bulk) ? this.#bulk :
               this.#definition ? this.#definition.bulk : 0;
    }

    get wear() {
        return this.#wear ? this.#wear :
               this.#definition ? this.#definition.wear : null;
    }

    get slots() {
        return this.#slots ? this.#slots :
               this.#definition ? this.#definition.slots : [];
    }

    get uses() {
        return this.#uses ? this.#uses :
               this.#definition ? this.#definition.uses : [];
    }

    get definition() { return this.#definition; }

    get phase() { return this.#phase; }

    drawTopDown(ctx, now) {
        if (this.#draw && this.#draw.topDown)
            drawSteps(ctx, this.#draw.topDown,
                      { now: now, phase: this.#phase,
                        colors: this.#draw.colors });
        else if (this.#definition)
            this.#definition.drawTopDown(ctx, this.#phase);
        else throw Error("No way to draw " + this.#name);
    }

    toJSON() {
        const result = { "name": this.#name };
        if (!isNaN(this.#mass))
            result.mass = this.#mass;
        if (!isNaN(this.#bulk))
            result.bulk = this.#bulk;
        if (!isNaN(this.#uses))
            result.uses = this.#uses;
        if (!isNaN(this.#draw))
            result.draw = this.#draw;
        if (!isNaN(this.#wear))
            result.wear = this.#wear;
        if (!isNaN(this.#slots))
            result.slots = this.#slots;
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    static inflate(item, setting)
    { return (item instanceof(Item)) ? item : new Item(item, setting); }
}

/**
 * An inventory is more or less an array of items.
 *
 * An inventory may have constraints.  A take constraint returns
 * true if the item at the given index can be removed from the
 * inventory.  A give constraint is similar except that when it
 * succeeds it may return one or more items that must be evicted
 * for the item to be accepted.  A transfer constraint builds on
 * a give constraint by returning true only if destination
 * inventory can accept the item while putting any evicted items
 * in the source inventory.  These contraint throw an error when
 * they cannot succeed, which facilitates explaining the problem
 * to players. */
class Inventory {
    #contents;
    #constrainTransfer;
    #constrainGive;
    #constrainTake;

    constructor(inventory, setting) {
        if (Array.isArray(inventory))
            this.#contents = inventory.map(
                item => Item.inflate(item, setting));
        else this.#contents = [];
    }

    connect(setting) { this.#contents.forEach(
        item => { item.connect(setting); }); }

    toJSON() { return this.#contents.map(item => item.toJSON()); }

    toString() { return JSON.stringify(this.toJSON()); }

    constrain(transfer, give, take) {
        this.#constrainTransfer = transfer;
        this.#constrainGive     = give;
        this.#constrainTake     = take;
    }

    get mass() { return this.#contents.reduce(
        (mass, item) => mass + item.mass, 0); }

    get length() { return this.#contents.length; }

    forEach(fn, context) {
        this.#contents.forEach((item, index) =>
            fn.call(context, item, index, this));
    }

    getItem(index) { return this.#contents[index]; }

    /**
     * Similar to @ref{canGive}, but will fail if the opposing
     * inventory cannot accept the items without eviction. */
    canTransfer(inventory, index) {
        return ((typeof(this.#constrainTransfer) !== "function") ||
                this.#constrainTransfer(this, inventory, index));
    }

    /**
     * Transfers items from the given inventory to this one.
     * In contrast to give, any items evicted from this inventory
     * are placed in the other. */
    transfer(inventory, index) {
        const evicted = this.canTransfer(inventory, index);
        if (Array.isArray(evicted)) {
            this.#contents = this.#contents.filter(
                item => !evicted.includes(item));
            evicted.forEach(item => inventory.give(item));
        } else if (evicted instanceof Item) {
            this.#contents = this.#contents.filter(
                item => evicted !== item);
            this.give(evicted);
        }
        if (evicted)
            this.#contents.push(inventory.take(index));
        return !!evicted;
    }

    /**
     * Returns true or an item if this inventory can accept the
     * item specified and false otherwise.  When an item is
     * returned, that item has been ejected from the inventory
     * and should be stored somewhere. */
    canGive(item) {
        return ((typeof(this.#constrainGive) !== "function") ||
                this.#constrainGive(this, item));
    }

    #throwError(message) { throw new Error(message); }

    give(thing, index) {
        const item = (
            (thing instanceof Inventory) ? thing.getItem(index) :
            (thing instanceof Item) ? thing :
            this.#throwError("Cannot accept type " + typeof(thing)));
        const replaced = this.canGive(item);

        if (Array.isArray(replaced)) {
            this.#contents = this.#contents.filter(
                thing => !replaced.includes(thing));
            this.#contents.push(item);
        } else if (replaced instanceof Item) {
            this.#contents = this.#contents.filter(
                thing => thing !== replaced);
            this.#contents.push(item);
        } else if (replaced)
            this.#contents.push(item);
        return replaced;
    }

    /**
     * Returns truthy iff the item at the given index an be
     * removed from this inventory. */
    canTake(index) {
        return ((index >= 0) && (index < this.#contents.length) &&
                ((typeof(this.#constrainTake) !== "function") ||
                 this.#constrainTake(this, index)));
    }

    take(index) {
        if (this.canTake(index)) {
            const item = this.#contents[index];
            this.#contents.splice(index, 1);
            return item;
        } else return null;
    }
};

/**
 * Represents a person of some sort in the game world. */
class Character {
    #name; #surname; #codename; #raceName; #race;
    #wearing; #carrying; #faction; #colors; #phase;
    #position; #speed; #movement; #action; #southpaw;

    constructor(character, setting) {
        this.#name     = character.name;
        this.#surname  = character.surname;
        this.#codename = character.codename;
        this.#raceName = character.race;
        this.#colors   = character.colors || {};
        this.#position = character.position;
        if (!this.#position || isNaN(this.#position.row) ||
            isNaN(this.#position.col))
            throw new Error("Invalid position for character " +
                            this.displayname + ": " +
                            JSON.stringify(this.#position));
        this.#speed    = character.speed;
        this.#movement = character.movement;
        this.#action   = character.action;
        this.#southpaw = !!character.southpaw;
        this.#wearing  = new Inventory(character.wearing);
        this.#carrying = new Inventory(character.carrying);
        this.#faction  = character.faction;

        this.#phase = Math.random();

        if (setting && (setting instanceof Setting))
            this.connect(setting);
    }

    connect(setting) {
        this.#wearing.connect(setting);
        this.#carrying.connect(setting);

        this.#race = setting.findRace(this.#raceName);
        if (!this.#race)
            this.#race = Race.defaultRace;
        if (this.#race)
            this.#race.inventoryConstrain(
                this.#wearing, this.#carrying);
    }

    toJSON() {
        const result = {};
        if (this.#name)
            result.name = this.#name;
        if (this.#surname)
            result.surname = this.#surname;
        if (this.#codename)
            result.codename = this.#codename;
        if (this.#faction)
            result.faction = this.#faction;
        if (this.#raceName)
            result.race = this.#raceName;
        if (this.#colors)
            result.colors = this.#colors;
        if (this.#position)
            result.position = this.#position;
        if (this.#speed)
            result.speed = this.#speed;
        if (this.#movement)
            result.movement = this.#movement;
        if (this.#action)
            result.action = this.#action;
        if (this.#southpaw)
            result.southpaw = !!this.#southpaw;
        if (this.#wearing && this.#wearing.length)
            result.wearing = this.#wearing.toJSON();
        if (this.#carrying && this.#carrying.length)
            result.carrying = this.#carrying.toJSON();
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    get displayname() {
        if (this.#codename)
            return '"' + this.#codename + '"';
        else return [this.#name, this.#surname].filter(
            word => word).join(" ");
    }

    get fullname() {
        return [this.#name, this.#codename ?
                ('"' + this.#codename + '"') : "",
                this.#surname].filter(word => word).join(" ");
    }

    get faction() { return this.#faction; }

    get position() { return this.#position; }

    get wearing() { return this.#wearing; }

    get carrying() { return this.#carrying; }

    get speed() {
        return !isNaN(this.#speed) ? this.#speed :
               this.#race ? this.#race.speed : 0;
    }

    get movement() { return this.#movement; }
    set movement(value) { this.#movement = value; }

    get action() { return this.#action; }
    set action(value) { this.#action = value; }

    get colors() { return this.#colors; }

    get phase() { return this.#phase; }

    get southpaw() { return this.#southpaw; }

    drawTopDown(ctx, camera, now) {
        if (!this.#race)
            throw new Error("No way to draw " + this.displayname);
        this.#race.drawTopDown(ctx, this, now);
    }
}

class Structure {
    #name;
    #offset;
    #defaultLevel = 0;
    #cellData;
    #floorColor;

    constructor(structure, setting) {
        this.#name       = structure.name;
        this.#offset     = structure.offset;
        this.#floorColor = structure.floorColor;
        this.#cellData   = {};
        if (Array.isArray(structure.cellData))
            structure.cellData.forEach(node =>
                this.setCell(node, {
                    floorColor: node.floorColor,
                    inventory: new Inventory(
                        node.inventory, setting) }));
    }

    connect(setting) {
        Object.keys(this.#cellData).forEach(level =>
            Object.keys(this.#cellData[level]).forEach(index =>
                this.#cellData[level][index]
                    .inventory.connect(setting)));
    }

    toJSON() {
        const result = {};
        if (this.#offset)
            result.offset = this.#offset;
        if (this.#floorColor)
            result.floorColor = this.#floorColor;
        if (this.#cellData) {
            result.cellData = [];
            Object.keys(this.#cellData).forEach(level => {
                Object.keys(this.#cellData[level]).forEach(index => {
                    const cell = this.#cellData[level][index];
                    const node = getIndexNode(index);
                    if (cell.inventory && cell.inventory.length)
                        node.inventory = cell.inventory.toJSON();
                    if (cell.floorColor)
                        node.floorColor = cell.floorColor;
                    result.cellData.push(node);
                });
            });
        }
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }    

    get floorColor() { return this.#floorColor; }

    get offset() { return this.#offset; }

    /**
     * Retrieves the contents of a specified node. */
    getCell(node) {
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("first argument must have numeric " +
                            "row and col fields");
        const level = isNaN(node.level) ?
                      this.#defaultLevel : node.level;
        return (level in this.#cellData) ?
               this.#cellData[level][getNodeIndex(node)] : undefined;
    }

    /**
     * Replaces the contents at specified node with the value given. */
    setCell(node, value) {
        if (!node || isNaN(node.row) || isNaN(node.col))
            throw new Error("row and col must be numeric");
        const index = getNodeIndex(node);
        const level = isNaN(node.level) ?
            this.#defaultLevel : level;

        if (!(level in this.#cellData))
            this.#cellData[level] = {};

        if (typeof(value) === "undefined")
            delete this.#cellData[level][index];
        else this.#cellData[level][index] = value;
        return this;
    }
}

class Scenario extends Pathf.Pathable {
    #playerFaction;
    #structures;
    #characters;
    #movingCharacters;
    #grid;
    #gridConfig;
    #pathCharacter;
    #path;
    #pathReachable;
    #slide;

    constructor(scenario, setting) {
        super();
        this.#path = this.#pathCharacter = this.#pathReachable;
        this.#slide = 0;
        this.#movingCharacters = [];

        this.#gridConfig = scenario.grid;
        if (!this.#gridConfig || // Give grid a default size
            (!this.#gridConfig.radius && !this.#gridConfig.edge))
            this.#gridConfig = Object.assign(
                {}, this.#gridConfig, {edge: 1.0, diagonal: true});
        this.#grid = Grid.create(this.#gridConfig);

        this.#playerFaction = scenario.playerFaction;
        this.#structures = scenario.structures.map(
            structure => new Structure(structure, setting));
        this.#characters = scenario.characters.map(
            character => new Character(character, setting));
    }

    connect(setting) {
        this.#characters.forEach(character =>
            character.connect(setting));
        this.#structures.forEach(character =>
            structure.connect(setting));
    }

    toJSON() {
        const result = {};
        if (this.#gridConfig)
            result.grid = this.#gridConfig;
        if (this.#playerFaction)
            result.playerFaction = this.#playerFaction;
        if (this.#structures)
            result.structures = this.#structures;
        if (this.#characters)
            result.characters = this.#characters.map(
                character => character.toJSON());
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    // === Implementaiton of path finding interface

    pathNeighbor(node, fn, context) {
        const neighbors = this.#grid.eachNeighbor(node);
        neighbors.forEach((neighbor, index, neighbors) => {
            if (this.getCell(neighbor) &&
                !this.getCharacterAt(neighbor) &&
                (!neighbor.diagonal ||
                 (this.getCell(neighbors[
                     (index ? index : neighbors.length) - 1]) &&
                  this.getCell(neighbors[
                      (index + 1) % neighbors.length]))))
                fn.call(context, neighbor, neighbor.cost);
        });
    }

    pathNodeIndex(node) { return Ripple.pair(node.col, node.row); }

    pathHeuristic(node, goal)
    { return Math.hypot(node.row - goal.row, node.col - goal.col); }

    pathCost(node, previous) { return node.cost; }

    pathSameNode(nodeA, nodeB) // TODO: deal with levels
    { return (nodeA.row === nodeB.row) && (nodeA.col === nodeB.col); }

    // === Public attributes

    get grid() { return this.#grid; }

    get characters() { return this.#characters; }

    get playerFaction() { return this.#playerFaction; }

    #checkNode(node) {
        if (isNaN(node.row) || isNaN(node.col)) {
            if (!isNaN(node.x) && !isNaN(node.y))
                node = this.#grid.getCell(node);
            else throw new Error(
                "Argument must provide a location: " +
                JSON.stringify(node));
        }
        return node;
    }

    getCell(node) {
        node = this.#checkNode(node);
        return this.#structures.reduce((current, structure) =>
            structure.getCell(node) || current, null);
    }

    getCharacterAt(node) {
        let result = null;
        node = this.#checkNode(node);
        this.#characters.forEach(character => {
            if (character.position &&
                (character.position.row === node.row) &&
                (character.position.col === node.col))
                result = character;
        });
        return result;
    }

    getFactionCharacters(faction) {
        return this.#characters.filter(
            character => character.faction === this.#playerFaction);
    }

    setCharacter(character) {
        if (character && (character.faction === this.playerFaction)) {
            this.#path = null;
            this.#pathReachable = this.reachable(
                character.position, character.movement);
        } else this.#pathReachable = null;
        return character;
    }

    setPath(character, point) {
        this.#pathCharacter = character;
        if (this.#pathCharacter &&
            (this.#pathCharacter.faction === this.#playerFaction)) {
            this.#path = this.createPath(
                character.position, this.#checkNode(point));
        } else this.#path = null;
    }

    moveCharacter(character, point) {
        if (character && (character.faction === this.#playerFaction) &&
            this.#movingCharacters.every(([other, path]) =>
                other !== character)) {
            this.#pathCharacter = character;
            this.#path = null;
            const path = this.createPath(
                character.position, this.#grid.getCell(point));
            if (path && (path.reduce(
                (total, step) =>  total + step.cost, 0) <=
                    character.movement)) {
                this.#movingCharacters.push([character, path]);
            }
        }
    }

    endTurn() {
        this.#characters.forEach(character =>
            character.movement = character.speed);
    }

    update(elapsed) {
        this.#slide = (this.#slide + elapsed) % 2000;

        const movingNext = [];
        this.#movingCharacters.forEach(([character, path]) => {
            const animationSpeed = 800;
            let remaining = elapsed;
            while (path && path.length && (remaining > 0)) {
                const next = path[0];
                if (isNaN(next.x) || isNaN(next.y))
                    this.#grid.markCenter(next);
                if (isNaN(next.remain))
                    next.remain = animationSpeed;
                if (remaining >= next.remain) {
                    remaining -= next.remain;
                    character.position.row = next.row;
                    character.position.col = next.col;
                    character.position.x = next.x;
                    character.position.y = next.y;
                    character.movement -= next.cost;
                    if (this.#pathCharacter === character)
                        this.#pathReachable = this.reachable(
                            character.position, character.movement);
                    path.shift();
                } else {
                    const prev = this.#grid.getCenter(
                        character.position);
                    const fraction =
                        (next.remain - remaining) / animationSpeed;
                    next.remain -= remaining;
                    remaining = 0;

                    character.position.x = next.x + (
                        prev.x - next.x) * fraction;
                    character.position.y = next.y + (
                        prev.y - next.y) * fraction;
                    movingNext.push([character, path]);
                }
            }
        });
        this.#movingCharacters = movingNext;
    }

    drawTopDown(ctx, camera, now, character) {
        this.#structures.forEach(structure => {
            const floorColors = {};
            const floorColor = structure.floorColor || "gray";
            ctx.beginPath();
            this.#grid.mapRectangle(
                camera.toWorld({x: 0, y: 0}),
                camera.toWorld({x: camera.width, y: camera.height}),
                (node, index, grid) => {
                    const offsetNode = {
                        row: node.row + structure.offset.row,
                        col: node.col + structure.offset.col };
                    const cell = structure.getCell(offsetNode);
                    if (cell && !cell.hull) {
                        if (cell.floorColor) {
                            if (cell.floorColor in floorColors)
                                floorColors[cell.floorColor].push(node);
                            else floorColors[cell.floorColor] = [node];
                        } else grid.drawNode(ctx, node);
                    }
            });
            ctx.fillStyle = floorColor;
            ctx.fill();

            Object.keys(floorColors).forEach(color => {
                ctx.beginPath();
                floorColors[color].forEach(node =>
                    this.#grid.drawNode(ctx, node));
                ctx.fillStyle = color;
                ctx.fill();
            });
        });

        if (this.#pathReachable) {
            ctx.beginPath();
            this.#pathReachable.forEach(node =>
                this.#grid.drawNode(ctx, node));
            ctx.fillStyle = "#aae4";
            ctx.fill();
        }

        if (this.#path && this.#pathCharacter) {
            let prev = this.#checkNode(this.#pathCharacter.position);
            let cost = 0;

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            this.#path.forEach(node => {
                node = this.#grid.getCenter(node);
                ctx.lineTo(node.x, node.y);
                drawArrow(ctx, prev, node, {
                    slide: this.#slide / 2000});
                ctx.moveTo(node.x, node.y);
                prev = node;
            });
            ctx.lineWidth = 0.1;
            ctx.lineCap = ctx.lineJoin = "round";
            ctx.strokeStyle = "#666";
            ctx.stroke();

            prev = this.#pathCharacter.position;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            this.#path.forEach(node => {
                cost += node.cost;
                if (cost <= this.#pathCharacter.movement) {
                    node = this.#grid.getCenter(node);
                    ctx.lineTo(node.x, node.y);
                    drawArrow(ctx, prev, node, {
                        slide: this.#slide / 2000});
                    ctx.moveTo(node.x, node.y);
                    prev = node;
                }
            });
            ctx.lineWidth = 0.1;
            ctx.lineCap = ctx.lineJoin = "round";
            ctx.strokeStyle = "#993";
            ctx.stroke();
        }

        // :TODO: draw walls
        // :TODO: draw hull

        this.#structures.forEach(structure => {
            this.#grid.mapRectangle(
                camera.toWorld({x: 0, y: 0}),
                camera.toWorld({x: camera.width, y: camera.height}),
                (node, index, grid) => {
                    const offsetNode = {
                        row: node.row + structure.offset.row,
                        col: node.col + structure.offset.col };
                    const cell = structure.getCell(offsetNode);
                    if (cell) {
                        cell.inventory.forEach((item, index) => {
                            const angle = (
                                index / cell.inventory.length *
                                2 * Math.PI) + Math.PI * 3 / 4;
                            const ray = {
                                x: Math.sin(angle),
                                y: Math.cos(angle) };
                            ctx.save();
                            ctx.translate(node.x + ray.x * 0.25,
                                          node.y + ray.y * 0.25);
                            ctx.scale(0.25, 0.25);
                            item.drawTopDown(ctx, now, 0 /* phase */);
                            ctx.restore();

                            // :TODO: draw facilities if present
                        });
                    }
                }, this);
        });

        this.#characters.forEach(character => {
            if (character.position &&
                !isNaN(character.position.row) &&
                !isNaN(character.position.col)) {
                if (isNaN(character.position.x) ||
                    isNaN(character.position.y))
                    this.#grid.markCenter(character.position);
                ctx.save();
                ctx.translate(character.position.x,
                              character.position.y);
                ctx.scale(this.#grid.radius, this.#grid.radius);
                character.drawTopDown(ctx, camera, now);
                ctx.restore();
            }
        });
    }
}

class ButtonBar {
    #element;

    constructor(buttons) {
        this.#element = document.createElement("div");
        this.#element.classList.add("buttonbar");

        this.setButtons(buttons);
        document.body.appendChild(this.#element);
    }

    setButtons(buttons) {
        this.#element.innerHTML = "";
        if (buttons)
            buttons.forEach(({ text, onClick }) => {
                const button = document.createElement("button");
                button.textContent = text;
                button.addEventListener("click", onClick);
                this.#element.appendChild(button);
            });
    }
}

function createFieldSet(legend, contents, styleClass) {
    const result = document.createElement("fieldset");
    if (styleClass)
        result.classList.add(styleClass);
    if (legend) {
        const legendElement = document.createElement("legend");
        if (Array.isArray(legend))
            legendElement.append(...legend);
        else legendElement.append(legend);
        result.append(legendElement);
    }
    if (Array.isArray(contents))
        result.append(...contents);
    else result.append(contents);
    return result;
}

class Panel {
    #fieldset; #legend; #body; #close;

    constructor(buttons) {
        this.#fieldset = document.createElement("fieldset");
        this.#fieldset.classList.add("panel");

        this.#close = document.createElement("button");
        this.#close.append("x");
        this.#close.addEventListener("click", () => this.hide());

        this.#body = document.createElement("div");
        this.#fieldset.appendChild(
            this.#legend = document.createElement("legend"));
        this.#fieldset.appendChild(this.#body);
        this.hide();
        document.body.appendChild(this.#fieldset);
    }

    hide() { this.#fieldset.style.display = "none"; return this; }

    show(title) {
        this.hide();
        this.#legend.innerHTML = "";
        this.#legend.append(this.#close);
        this.#legend.append(title);

        this.#body.innerHTML = "";
        for (let ii = 1; ii < arguments.length; ++ii)
            this.#body.append(arguments[ii]);
        this.#fieldset.style.display = "block";
        return this;
    }
}

class App {
    #setting;
    #scenario;
    #activeCharacters;
    #selectedCharacter;
    #panel;
    #buttonBar;

    constructor(setting, scenario) {
        this.#panel = new Panel();
        this.#buttonBar = new ButtonBar([
            { text: "Next", onClick: () => this.nextCharacter() }]);
        this.#setting = (setting instanceof Setting) ?
                        setting : new Setting(setting);
        this.#scenario = (scenario instanceof Scenario) ?
                         scenario : new Scenario(
                             scenario, this.#setting);
        this.#activeCharacters = this.#scenario.getFactionCharacters(
            this.#scenario.playerFaction);
        this.#selectedCharacter = null;
    }

    setButtons() {
        const buttons = [
            this.#activeCharacters.length ?
            { text: "Next", onClick: () => this.nextCharacter() } :
            { text: "End", onClick: () => this.endTurn() }];
        if (this.#selectedCharacter)
            buttons.push({
                text: this.#selectedCharacter.displayname,
                onClick: () => {
                    this.showCharacter(this.#selectedCharacter);
            }})
        this.#buttonBar.setButtons(buttons);
    }

    endTurn() {
        this.#scenario.endTurn();
        this.#activeCharacters = this.#scenario.getFactionCharacters(
            this.#scenario.playerFaction);
        this.#selectedCharacter = null;
        this.setButtons();
    }

    selectCharacter(character) {
        this.#selectedCharacter = character;
        this.#scenario.setCharacter(character);
        this.setButtons();
    }

    nextCharacter() {
        if (this.#selectedCharacter)
            this.#activeCharacters = this.#activeCharacters.filter(
                character => character !== this.#selectedCharacter);
        if (this.#activeCharacters.length)
            this.selectCharacter(this.#activeCharacters[0]);
        else this.selectCharacter(null);
        this.setButtons();
    }

    showCharacter(character) {
        const stats = document.createElement("fieldset");
        stats.append("Faction: " + character.faction,
                     document.createElement("br"),
                     "Teeth: blue",
                     document.createElement("br"),
                     "Hair: pickles");

        let sourceWidget = null;
        const carryWidget = {
            view: document.createElement("div"),
            inventory: character.carrying };
        const otherWidget = {
            view: document.createElement("div"),
            inventory: character.wearing };
        [carryWidget, otherWidget].forEach(widget => {
            widget.view.classList.add("container");
            widget.view.addEventListener("dragenter", event => {
                if (sourceWidget && (sourceWidget !== widget)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    widget.view.classList.add("over");
                }
            });
            widget.view.addEventListener("dragover", event => {
                if (sourceWidget && (sourceWidget !== widget)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                }
            });
            widget.view.addEventListener("dragleave", event => {
                widget.view.classList.remove("over");
            });
            widget.view.addEventListener("drop", event => {
                widget.view.classList.remove("over");
                if (sourceWidget && (sourceWidget !== widget)) {

                    const index = parseInt(
                        event.dataTransfer.getData("text/plain"));
                    try {
                        widget.inventory.transfer(
                            sourceWidget.inventory, index);
                        populate(widget);
                        populate(sourceWidget);
                        sourceWidget = null;
                    } catch (err) { setToast(err); }
                }
            });
        });

        const playerFaction = this.#scenario.playerFaction;
        function populate(widget) {
            widget.view.innerHTML = "";
            widget.inventory.forEach((item, index) => {
                const itemWidget = document.createElement("div");
                itemWidget.classList.add("item");
                itemWidget.append(item.name);
                widget.view.append(itemWidget);

                if (character.faction === playerFaction) {
                    itemWidget.classList.add("itemActive");
                    itemWidget.setAttribute("data-index", index);
                    itemWidget.setAttribute("draggable", true);
                    itemWidget.addEventListener("dragstart", event => {
                        try {
                            widget.inventory.canTake(index);
                            sourceWidget = widget;
                            event.dataTransfer.effectAllowed = "move";
                            event.target.classList.add("dragging");
                            event.dataTransfer.setData(
                                "text/plain", index.toString());
                        } catch (err) {
                            setToast(err);
                            event.preventDefault();
                        }
                    });
                    itemWidget.addEventListener("dragend", event => {
                        sourceWidget = null;
                        event.target.classList.remove("dragging");
                    });
                    itemWidget.addEventListener("click", event => {
                        event.target.classList.toggle("selected");
                        console.log("DEBUG item", item.toString(),
                                    item.definition.toString());
                    });
                }
            });
        }
        populate(carryWidget);

        // Create a drop down allowing the player to select an
        // inventory to manipulate.
        const otherSelect = document.createElement("select");
        const otherOptions = {
            wearing: {label: "Wearing", inventory: character.wearing} };
        const floor = this.#scenario.getCell(character.position);
        if (floor)
            otherOptions.floor = {
                label: "Floor", inventory: floor.inventory };
        Object.keys(otherOptions).forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.append(otherOptions[name].label);
            otherSelect.append(option);
        });
        otherSelect.addEventListener("change", event => {
            otherWidget.inventory = otherOptions[
                event.target.value].inventory;
            populate(otherWidget);
        });
        otherSelect.dispatchEvent(new Event("change"));

        this.#panel.show(this.#selectedCharacter.fullname, stats,
                         createFieldSet("Carrying", carryWidget.view),
                         createFieldSet(otherSelect, otherWidget.view));
    }

    get active() { return true };
    get autofill() { return true };
    get autozoom() { return { min: 1, max: 20 } };
    autodrag(event) { };

    resize(event, camera) {  }

    dblclick(event, camera) {
        const point = camera.toWorld(camera.getPoint(event));
        const character = this.#scenario.getCharacterAt(point);
        if (character && (character === this.#selectedCharacter))
            this.showCharacter(this.#selectedCharacter);
        else if (!character && this.#selectedCharacter)
            this.#scenario.moveCharacter(
                this.#selectedCharacter, point);
    }

    mousedown(event, camera) {
        this.#panel.hide();
    }

    mouseup(event, camera) {
        const point = camera.toWorld(camera.getPoint(event));
        const character = this.#scenario.getCharacterAt(point);
        if (character && (character !== this.#selectedCharacter)) {
            this.selectCharacter(character);
        } else if (!character && this.#selectedCharacter)
            this.#scenario.setPath(this.#selectedCharacter, point);
    }

    usekeys = true;
    keydown(event, camera) {
        if (event.keyCode === 27)
            this.#panel.hide();
    }

    #lastUpdate = undefined;

    update(now, camera) {
        const elapsed = isNaN(this.#lastUpdate) ? 0 :
                        (now - this.#lastUpdate);
        this.#lastUpdate = now;
        this.#scenario.update(elapsed);
    }

    draw(ctx, camera)
    { this.#scenario.drawTopDown(ctx, camera, this.#lastUpdate,
                                 this.#selectedCharacter); }

}
export default App;
