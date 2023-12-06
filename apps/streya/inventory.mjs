// inventory.mjs
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
// A library for managing collections of items in an inventory for
// role playing games.  The elements of this system are inventories,
// item types and items.  An inventory usually contains one or more
// items.  Each item must reference an item type, which contains
// defaults for most properties.
//
// An item type has some or all of the following properties:
// - name: (required) a clear description of the item
// - mass: amount of matter in an item, usually measured in grams,
//         which defaults to one if not specified
// - wear: indicates the kind of slot needed to wear the item
//
// Some inventories have slots, which means items can only be stored
// in the inventory if they have a non-empty wear property (usually
// on the item type rather than the item itself).  Usually a slot
// is described by the boolean value true, which means only a single
// item can occupy that slot at one time.
//
// An inventory without slots can hold any item.

class ItemType {
    constructor(name, config) {
        this.name = name;
        this.mass = (config && config.mass) ? config.mass : 1;
        this.wear = (config && config.wear) ? config.wear : undefined;
        ItemType.__knownItemTypes[name] = this;
    }

    static load(itemtypes) {
        Object.keys(itemtypes).forEach((name) => {
            this.__knownItemTypes[name] =
                new ItemType(name, itemtypes[name]);
        }, this);
    }
    static __knownItemTypes = {};
    static fetch(name) {
        return (name in this.__knownItemTypes) ?
               this.__knownItemTypes[name] : null;
    }
}

class Item {
    constructor(config) {
        this.itemtype = ItemType.fetch(config.itemtype);
    }

    __getProperty(name, fallback) {
        return this[name] ? this[name] : (
            (this.itemtype && this.itemtype[name]) ?
            this.itemtype[name] : fallback);
    }

    getName() { return this.__getProperty("name", "Unknown"); }
    getMass() { return this.__getProperty("mass", 0); }
    getWear() { return this.__getProperty("wear"); }
}

class Inventory {
    constructor(contents, config) {
        if (typeof(config) === "string")
            config = { name: config };
        this.name = (config && config.name) ? config.name : null;
        this.slots = (config && config.slots) ? config.slots : null;
        this.contents = contents ?
                        contents.map((item) => new Item(item)) : [];
    }

    /**
     * Call specified function on each item in this inventory. */
    eachItem(fn, context) {
        let index = 0;
        this.contents.forEach((item) =>
            fn.call(context, item, index++));
        return this;
    }

    /**
     * Return the total mass of items in this inventory. */
    getMass() { return this.contents.reduce(
        (acc, item) => acc + item.getMass(), 0); }

    add(item) { this.contents.push(item); }

    getItem(index) {
        if (isNaN(index))
            throw new Error("index must be a number");
        else if ((index < 0) || (index >= this.contents.length))
            throw new Error("index out of range");
        return this.contents[index];
    }

    takeItem(index) {
        if (isNaN(index))
            throw new Error("index must be a number");
        else if ((index < 0) || (index >= this.contents.length))
            throw new Error("index out of range");
        const result = this.contents[index];
        this.contents.splice(index, 1);
        return result;
    }

    getWearing(slot) {
        let result = undefined;
        this.eachItem((item, index) => {
            if (item.getWear() === slot)
                result = index;
        });
        return result;
    }

    acceptable(other, index) {
        const item = (other instanceof Inventory) ?
                     other.getItem(index) : other;
        return item && (item instanceof Item) && (
            !this.slots || (item.getWear() in this.slots));
    }

    accept(other, index) {
        if (this.acceptable(other, index)) {
            const item = other.takeItem(index);
            const wearing = (this.slots && item.getWear()) ?
                            this.getWearing(item.getWear()) : undefined;
            if (!isNaN(wearing))
                other.add(this.takeItem(wearing));
            this.add(item);
        }
        return true;
    }

    static loadItemTypes(itemtypes) { return ItemType.load(itemtypes); }
}

export default Inventory;
