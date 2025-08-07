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
import Ripple    from "../ripple/ripple.mjs";
import Grid      from "../ripple/grid.mjs";
import Pathf     from "../ripple/pathf.mjs";
import Omnivore  from "../ripple/omnivore.mjs";
import Structure from "./structure.mjs";
import Setting, { Character } from "./setting.mjs";

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

export default class App {
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
        if (character)
            this.selectCharacter(character);
        else if (this.#selectedCharacter)
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
