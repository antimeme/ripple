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
// :TODO: make player exist
// :TODO: path finding when click
// :TODO: create button menu
// :TODO: create end turn button
// :TODO: create inventory button
// :TODO: create interactable locker with stuff in it
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

    function finishStep(ctx, step, colors) {
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
 * A race is a kind of creature that a character can be.
 * Race defines what limbs a character has and how to determine
 * which has been hit on a successful attack. */
class Race {
    #inherit = null;
    #parent;
    #ignore;
    #limbs;
    #draw;
    #default;

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

    connect(races)
    {
        if (typeof(this.#parent) === "string")
            this.#inherit = races[this.#parent];
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

    toJSON() {
        const result = {};
        if (this.#parent)
            result.parent = this.#parent;
        if (this.#ignore)
            result.ignore = true;
        if (this.#default)
            result["default"] = true;
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
    #inherit = null;
    #parent;
    #mass;
    #ignore;
    #uses;

    constructor(itemdef) {
        this.#parent = itemdef.parent;
        this.#mass   = itemdef.mass;
        this.#ignore = itemdef.ignore;
        this.#uses   = itemdef.uses;
    }

    connect(itemdefs) {
        if (this.#parent && (typeof(this.#parent) === "string"))
            this.#inherit = itemdefs[this.#parent];
    }

    get mass() {
        return (this.#mass) ? this.#mass : this.#inherit ?
               this.#inherit.mass : 0;
    }

    toJSON() {
        const result = {};
        if (this.#parent)
            result["parent"] = this.#parent;
        if (this.#ignore)
            result["ignore"] = this.#ignore;
        if (this.#uses)
            result["uses"] = this.#uses;
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

    connect(facilities) {
        if (this.#parent && (typeof(this.#parent) === "string"))
            this.#inherit = facilities[this.#parent];
    }

    get mass() {
        return (this.#mass) ? this.#mass : this.#inherit ?
               this.#inherit.mass : 0;
    }

    toJSON() {
        const result = {};
        if (this.#parent)
            result["parent"] = this.#parent;
        if (this.#ignore)
            result["ignore"] = this.#ignore;
        if (this.#uses)
            result["uses"] = this.#uses;
        return result;
    }
    toString() { return JSON.stringify(this.toJSON()); }
}

class Setting {
    #races;
    #itemdefs;
    #facilities;

    constructor(setting) {
        // Set up character race definitions
        this.#races = Object.fromEntries(
            Object.keys(setting.races).map(
                race => [race, new Race(setting.races[race])]));
        Object.entries(this.#races).forEach(
            ([name, race]) => { race.connect(this.#races); });

        // Set up item definitions
        this.#itemdefs = Object.fromEntries(
            Object.keys(setting.itemdefs).map(
                item => [item, new ItemDefinition(
                    setting.itemdefs[item])]));
        Object.entries(this.#itemdefs).forEach(
            ([name, itemdef]) => { itemdef.connect(this.#itemdefs); });

        // Set up facility definitions
        this.#facilities = Object.fromEntries(
            Object.keys(setting.facilities).map(
                facility => [facility, new Facility(
                    setting.facilities[facility])]));
        Object.entries(this.#facilities).forEach(
            ([name, facility]) => {
                facility.connect(this.#facilities); });
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

}

class Item {
    #name;
    #mass = undefined;
    #definition = null;

    constructor(item, setting) {
        if (typeof(item) === "string") {
            this.#name = item;
        } else if (item && (typeof(item) === "object")) {
            this.#name = item.name;
            this.#mass = item.mass;
            // :TODO: allow custom properties
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

    toJSON() {
        // :TODO: reduce to a string if apporpriate
        const result = { "name": this.#name };
        if (!isNaN(this.#mass))
            result.mass = this.#mass;
        return result;
    }
    toString() { return JSON.stringify(this.toJSON()); }
}

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
        this.#wearing   = Array.isArray(character.wearing) ?
                          character.wearing.map(
                              item => new Item(item)) : [];
        this.#carrying  = Array.isArray(character.carrying) ?
                          character.wearing.map(
                              item => new Item(item)) : [];

        this.#phase = Math.random();

        if (setting && (setting instanceof Setting))
            this.connect(setting);
    }

    connect(setting) {
        this.#race = setting.findRace(this.#raceName);
        if (!this.#race)
            this.#race = Race.defaultRace;
        this.#wearing.forEach(item => item.connect(setting));
        this.#carrying.forEach(item => item.connect(setting));
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
    #defaultLevel = 0;
    #cellData;
    #floorColor;
    #grid;

    constructor(structure, grid) {
        this.#grid = grid;
        this.#name = structure.name;
        this.#floorColor = structure.floorColor;

        this.#cellData = {};
        if (Array.isArray(structure.cellData))
            structure.cellData.forEach(
                node => this.setCell(node, node));
    }

    toJSON() {
        const result = {};
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

    drawTopDown(ctx, camera, now) {
        ctx.fillStyle = this.#floorColor ? this.#floorColor : "gray";
        ctx.beginPath();

        this.#grid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            (node, index, grid) => {
                const cell = this.getCell(node);
                if (cell && !cell.hull) {
                    if (cell.floorColor) {
                        ctx.fill();
                        ctx.beginPath();
                        grid.drawNode(ctx, node);
                        ctx.fillStyle = cell.floorColor;
                        ctx.fill();

                        ctx.fillStyle = this.#floorColor ?
                                        this.#floorColor : "gray";
                        ctx.beginPath();
                    } else grid.drawNode(ctx, node);
                }
            }, this);
        ctx.fill();

        // :TODO: draw walls
        // :TODO: draw hull

        this.#grid.mapRectangle(
            camera.toWorld({x: 0, y: 0}),
            camera.toWorld({x: camera.width, y: camera.height}),
            (node, index, grid) => {
                const cell = this.getCell(node);
                if (cell) {
                    // :TODO:
                }
            }, this);
        ctx.fill();
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

    draw(ctx, camera, now) {
        this.#structures.forEach(structure => {
            structure.drawTopDown(ctx, camera, now); });
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
        this.#element.style.position = "absolute";
        this.#element.style.bottom = "10px";
        this.#element.style.left = "50%";
        this.#element.style.transform = "translateX(-50%)";
        this.#element.style.zIndex = "5";

        this.setButtons(buttons);
        document.body.appendChild(this.#element);
    }

    setButtons(buttons) {
        this.#element.innerHTML = "";
        if (buttons)
            buttons.forEach(({ text, onClick }) => {
                const button = document.createElement("button");
                button.textContent = text;
                button.style.margin = "0 5px";
                button.style.padding = "10px 15px";
                button.style.cursor = "pointer";
                button.addEventListener("click", onClick);
                this.#element.appendChild(button);
            });
    }
}

function createFieldSet(legend, contents) {
    const result = document.createElement("fieldset");
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
    #fieldset;
    #legend;
    #body;
    #close;

    constructor(buttons) {
        this.#fieldset = document.createElement("fieldset");
        this.#fieldset.style.position = "absolute";
        this.#fieldset.style.top = "50%";
        this.#fieldset.style.left = "50%";
        this.#fieldset.style.transform = "translate(-50%, -50%)";
        this.#fieldset.style.zIndex = "7";
        this.#fieldset.style.border = "2px solid #ccc";
        this.#fieldset.style.borderRadius = "10px";
        this.#fieldset.style.background = "#aaa";

        this.#close = document.createElement("button");
        this.#close.append("x");
        this.#close.addEventListener("click", () => this.hide());

        this.#fieldset.appendChild(
            this.#legend = document.createElement("legend"));
        this.#legend.style.padding = ".3em";
        this.#legend.style.background = "#aaa";
        this.#legend.style.border = "2px solid #eee";
        this.#legend.style.borderRadius = "9px";
        this.#fieldset.appendChild(
            this.#body = document.createElement("div"));
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

    createCharacterPane(character) {
        function createDraggableItems(view, items) {
            view.innerHTML = "";
            items.forEach((item, index) => {
                const itemdiv = document.createElement("div");
                itemdiv.setAttribute("draggable", true);
                itemdiv.setAttribute("data-index", index);
                itemdiv.append(item.name);
                itemdiv.addEventListener("dragstart", event => {
                    // :TODO:
                    event.dataTransfer.effectAllowed = "move";
                    event.target.classList.add("dragging");
                });
                itemdiv.addEventListener("dragend", event => {
                    // :TODO:
                    console.log("DEBUG dragend");
                    event.target.classList.remove("dragging");
                });
                itemdiv.addEventListener("click", event => {
                    itemdiv.classList.toggle("selected");
                })
                view.appendChild(itemdiv);
            });
        }

        const stats = document.createElement("fieldset");
        // :TODO: put stats here

        const carrying = document.createElement("div");
        createDraggableItems(carrying, character.carrying);

        const otherContents = document.createElement("div");
        const otherSelect = document.createElement("select");
        const otherActions = {};
        [{
            name: "Wearing",
            onChange: () => createDraggableItems(
                otherContents, character.wearing)
        }, {
            name: "Floor", onChange: () => {
                otherContents.innerHTML = ""; /* FIXME */ }
        }].forEach(inventory => {
            const option = document.createElement("option");
            option.value = inventory.name;
            option.append(inventory.name);
            otherActions[inventory.name] = inventory.onChange;
            otherSelect.append(option);
        });
        otherSelect.addEventListener("change", event => {
            const action = otherActions[event.target.value];
            if (typeof(action) === "function")
                action.call();
        });
        otherSelect.dispatchEvent(new Event("change"));
        return [
            stats, createFieldSet("Carrying", carrying),
            createFieldSet(otherSelect, otherContents)];
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
                    this.#panel.show(
                        this.#selectedCharacter.fullname,
                        ...this.createCharacterPane(
                            this.#selectedCharacter));
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
            this.#panel.show(
                this.#selectedCharacter.fullname,
                ...this.createCharacterPane(
                    this.#selectedCharacter));
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
