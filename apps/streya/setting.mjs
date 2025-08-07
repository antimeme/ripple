// setting.mjs
// Copyright (C) 2023-2025 by Jeff Gold.
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
// A setting is an abstract colleciton of definitions that create the
// world where a game takes place.  This begins with items and item
// definitions but also includes characters and character races.  A
// fantasy setting might have orcs and elves while a science fiction
// setting might have androids and aliens.  The classes in this module
// are agnostic about the details but provide a framework for describing
// them.  JSON formatted data is provided to the Setting constructor
// in order to set everything up.
import Ripple from "../ripple/ripple.mjs";
import Camera from "../ripple/camera.mjs";

/**
 * Item definitions are used to determine properties of items that
 * characters might wear or use. */
export class ItemDefinition {
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
            Camera.drawSteps(ctx, this.#draw.topDown,
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

export class Item {
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
export class Inventory {
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
 * A race is a kind of creature that a character can be.
 * Race defines what limbs a character has and how to determine
 * which has been hit on a successful attack.  It also defines
 * what items a character can wear.  Each limb is also a slot
 * to which a single item can be attached.  Items can introduce
 * additional slots. */
export class Race {
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

            Camera.drawSteps(ctx, this.#draw.topDown, {
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

/**
 * Represents a person of some sort in the game world. */
export class Character {
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

export default class Setting {
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
