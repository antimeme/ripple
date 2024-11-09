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
{ return Ripple.pair(node.col, node.row); };

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
function drawSteps(ctx, steps, now, phase, colors) {

    function getColor(colors, tag) {
        return (colors && (tag in colors)) ? colors[tag] : tag;
    }

    function finishStep(ctx, step, colors) {
        if (step.fill) {
            ctx.fillStyle = getColor(colors, step.fill);
            ctx.fill();
        }
        if (step.stroke) {
            ctx.strokeStyle = getColor(colors, step.stroke);
            ctx.stroke();
        }
    }

    steps.forEach(step => {
        if (!isNaN(step.period) && !isNaN(step.blink) &&
            (step.blink > Math.floor((
                now + step.period * phase) %
                step.period) / step.period)) {
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
    #inherit; #parent; #ignore; #default; #limbs; #draw;

    static defaultRace = null;

    constructor(race) {
        this.#parent  = race.parent;
        this.#ignore  = race.ignore;
        this.#limbs   = race.limbs;
        this.#draw    = race.draw;
        this.#default = race.default;
        if (this.#default)
            Race.defaultRace = this;
    }

    connect(setting) {
        if (typeof(this.#parent) === "string")
            this.#inherit = setting.findRace(this.#parent);
    }

    get ignore() { return this.#ignore; }

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
            return !!evict;
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

            if (item.wear && (item.wear in this.limbs) &&
                this.limbs[item.wear].alwaysCover)
                throw new Error("Cannot expose " + item.wear);

            if (item.slots) {
                const slots = getSlots(this);
                item.slots.forEach(slotName => {
                    if ((slotName in slots) &&
                        !slots[slotName].available)
                        throw new Error("Need " + item.name +
                                        " for " + slotName); });
            }

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

    toJSON() {
        const result = {};
        if (this.#default)
            result["default"] = true;
        if (this.#parent)
            result.parent = this.#parent;
        if (this.#ignore)
            result.ignore = true;
        if (this.#limbs)
            result.limbs = this.#limbs;
        if (this.#draw)
            result.draw = this.#draw;
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    drawTopDown(ctx, now, phase, colors) {
        if (this.#draw && this.#draw.topDown)
            drawSteps(ctx, this.#draw.topDown, now, phase, colors);
        else if (this.#inherit)
            this.#inherit.drawTopDown(ctx, now, phase, colors);
        else throw new Error("No instructions for top down drawing");
    }
}

/**
 * Item definitions are used to determine properties of items that
 * characters might wear or use. */
class ItemDefinition {
    #inherit; #default; #parent; #ignore; #draw;
    #mass; #bulk; #wear; #slots; #uses;

    static defaultItem = null;

    constructor(itemdef) {
        this.#parent  = itemdef.parent;
        this.#ignore  = itemdef.ignore;
        this.#mass    = itemdef.mass;
        this.#bulk    = itemdef.bulk;
        this.#uses    = itemdef.uses;
        this.#draw    = itemdef.draw;
        this.#wear    = itemdef.wear;
        this.#slots   = Array.isArray(itemdef.slots) ?
                        itemdef.slots.slice() : [];
        this.#default = itemdef["default"];
        if (this.#default)
            ItemDefintion.defaultItem = this;
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
                      now, phase, this.#draw.colors);
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
            result.mass = this.#parent;
        if (this.#bulk)
            result.bulk = this.#parent;
        if (this.#uses)
            result.uses = this.#uses;
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

    constructor(setting) {
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
    #uses; #draw; #wear; #slots;

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

    drawTopDown(ctx, now, phase) {
        if (this.#draw && this.#draw.topDown)
            drawSteps(ctx, this.#draw.topDown,
                      now, phase, this.#draw.colors);
        else if (this.#definition)
            this.#definition.drawTopDown(ctx);
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
 * An inventory is more or less an array of items that may have
 * additional contraints. */
class Inventory {
    #contents;
    #constrainTransfer;
    #constrainGive;
    #constrainTake;
    #element;

    constructor(inventory, setting) {
        if (Array.isArray(inventory))
            this.#contents = inventory.map(
                item => Item.inflate(item, setting));
        else this.#contents = [];
        this.#element = null;
    }

    connect(setting) { this.#contents.forEach(
        item => { item.connect(setting); }); }

    constrain(transfer, give, take) {
        this.#constrainTransfer = transfer;
        this.#constrainGive     = give;
        this.#constrainTake     = take;
    }

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
            inventory.give(evicted);
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

    give(inventory, index) {
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

    toJSON() { return this.#contents.map(item => item.toJSON()); }

    toString() { return JSON.stringify(this.toJSON()); }
};

/**
 * Represents a person of some sort in the game world. */
class Character {
    #name;
    #surname;
    #codename;
    #faction;
    #raceName;
    #race;
    #colors;
    #wearing;
    #carrying;
    #phase;
    #position;

    constructor(character, setting) {
        this.#name      = character.name;
        this.#surname   = character.surname;
        this.#codename  = character.codename;
        this.#faction   = character.faction;
        this.#raceName  = character.race;
        this.#colors    = character.colors || {};
        this.#position  = character.position;
        this.#wearing   = new Inventory(character.wearing);
        this.#carrying  = new Inventory(character.carrying);

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
        if (this.#wearing && this.#wearing.length)
            result.wearing = this.#wearing.map(item => item.toJSON());
        if (this.#carrying && this.#carrying.length)
            result.carrying = this.#carrying.map(item => item.toJSON());
        if (this.#position)
            result.position = this.#position;
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
                ('"' + this.#codename + '"') :
                "", this.#surname].filter(word => word).join(" ");
    }

    get faction() { return this.#faction; }

    get position() { return this.#position; }

    get wearing() { return this.#wearing; }

    get carrying() { return this.#carrying; }

    drawTopDown(ctx, camera, now) {
        if (this.#race)
            this.#race.drawTopDown(
                ctx, now, this.#phase, this.#colors);
    }
}

class Structure {
    #name;
    #offset;
    #defaultLevel = 0;
    #cellData;
    #floorColor;
    #grid;

    constructor(structure, grid) {
        this.#grid = grid;
        this.#name = structure.name;
        this.#offset = structure.offset;
        this.#floorColor = structure.floorColor;

        this.#cellData = {};
        if (Array.isArray(structure.cellData))
            structure.cellData.forEach(
                node => this.setCell(node, node));
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
                    // :TODO: sanitize cell so it contains
                    //        no pointers
                    const cell = this.#cellData[level][index];
                    result.cellData.push(cell);
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

class Scenario {
    #playerFaction;
    #structures;
    #characters;
    #grid;
    #gridConfig;

    constructor(scenario, setting) {
        this.#gridConfig = scenario.grid;
        if (!this.#gridConfig || // Give grid a default size
            (!this.#gridConfig.radius && !this.#gridConfig.edge))
            this.#gridConfig = Object.assign(
                {}, this.#gridConfig, {edge: 1.0});
        this.#grid = Grid.create(this.#gridConfig);

        this.#playerFaction = scenario.playerFaction;
        this.#structures = scenario.structures.map(
            structure => new Structure(structure, this.#grid));
        this.#characters = scenario.characters.map(
            character => new Character(character, setting));
    }

    get characters() { return this.#characters; }

    get playerFaction() { return this.#playerFaction; }

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

    drawTopDown(ctx, camera, now) {
        this.#structures.forEach(structure => {
            const floorColor = structure.floorColor || "gray";
            ctx.fillStyle = floorColor;
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
                            ctx.fill();

                            ctx.beginPath();
                            this.#grid.drawNode(ctx, node);
                            ctx.fillStyle = cell.floorColor;
                            ctx.fill();

                            ctx.fillStyle = floorColor;
                            ctx.beginPath();1
                        } else this.#grid.drawNode(ctx, node);
                    }
                    ctx.fill();
                });
        });

        // :TODO: draw walls
        // :TODO: draw hull

        this.#structures.forEach(structure => {
            this.#grid.mapRectangle(
                camera.toWorld({x: 0, y: 0}),
                camera.toWorld({x: camera.width, y: camera.height}),
                (node, index, grid) => {
                    const cell = structure.getCell(node);
                    if (cell) {
                        // :TODO:
                    }
                }, this);
            ctx.fill();
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

    draw(ctx, camera, now) {
        this.drawTopDown(ctx, camera, now);
    }

    getCharacter(point) {
        let result = null;
        const node = this.#grid.getCell(point);
        this.#characters.forEach(character => {
            if (character.position &&
                (character.position.row === node.row) &&
                (character.position.col === node.col))
                result = character;
        });
        return result;
    }

    getPlayerFaction() {
        return this.#characters.filter(
            character => character.faction === this.#playerFaction);
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
        this.#activeCharacters = this.#scenario.getPlayerFaction();
        this.#selectedCharacter = null;
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
                    });
                }
            });
        }
        populate(carryWidget);

        // Create a drop down allowing the player to select an
        // inventory to manipulate.
        const otherSelect = document.createElement("select");
        const otherOptions = {
            wearing: {label: "Wearing", inventory: character.wearing},
            floor: {label: "Floor", inventory: new Inventory() } };
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

    setButtons() {
        const buttons = [
            this.#activeCharacters.length ?
            { text: "Next", onClick: () => this.nextCharacter() } :
            { text: "End", onClick: () => this.endTurn() }];

        this.#buttonBar.setButtons(
            this.#selectedCharacter ?
            [{
                text: this.#selectedCharacter.displayname,
                onClick: () => {
                    this.showCharacter(this.#selectedCharacter);
            }}].concat(buttons) : buttons);
    }

    endTurn() {
        this.#activeCharacters = this.#scenario.getPlayerFaction();
        this.#selectedCharacter = null;
        this.setButtons();
    }

    nextCharacter() {
        if (this.#selectedCharacter)
            this.#activeCharacters = this.#activeCharacters.filter(
                character => character !== this.#selectedCharacter);
        if (this.#activeCharacters.length)
            this.#selectedCharacter = this.#activeCharacters[0];
        else this.#selectedCharacter = null;
        this.setButtons();
    }

    get active() { return true };
    get autofill() { return true };
    get autozoom() { return { min: 1, max: 20 } };
    autodrag(event) { };

    resize(event, camera) {  }

    dblclick(event, camera) {
        const selected = this.#scenario.getCharacter(
            camera.toWorld(camera.getPoint(event)));
        if (selected && (selected === this.#selectedCharacter))
            this.showCharacter(this.#selectedCharacter);
    }

    mousedown(event, camera) {
        this.#panel.hide();
    }

    mouseup(event, camera) {
        const selected = this.#scenario.getCharacter(
            camera.toWorld(camera.getPoint(event)));
        if (selected && (selected !== this.#selectedCharacter)) {
            this.#selectedCharacter = selected;
            this.setButtons();
        }
    }

    #lastUpdate = undefined;

    update(now, camera) { this.#lastUpdate = now; }

    draw(ctx, camera)
    { this.#scenario.draw(ctx, camera, this.#lastUpdate); }

}
export default App;
