// streya/app.mjs
// Copyright (C) 2024-2026 by Jeff Gold.
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
// :TODO: create interactable locker with stuff in it
// :TODO: create structure editor
import Ripple from "../ripple/ripple.mjs";
import Pathf  from "../ripple/pathf.mjs";
import Camera from "../ripple/camera.mjs";
import Setting, { Character, Structure } from "./setting.mjs";

class Scenario {
    #playerFaction;
    #structure;
    #structures;
    #characters;
    #movingCharacters;
    #selectedCharacter;
    #reachableSpaces;
    #destination;
    #slide;
    #displayPath;

    constructor(scenario, setting) {
        if (!scenario)
            throw new Error("scenario is required");
        else if (!setting)
            throw new Error("setting is requried");
        else if (!(setting instanceof Setting))
            throw new Error("setting must be correct type");

        this.#selectedCharacter = null; // who is receiving orders
        this.#reachableSpaces   = null; // where can they go
        this.#destination       = null; // proposed place to go
        this.#slide = 0;
        this.#movingCharacters = [];

        this.#structures = scenario.structures.reduce(
            (structures, structure) => Object.assign(structures, {
                [structure.name]: new Structure(
                    structure, setting) }), {});
        if (!scenario.stucture)
            this.#structure = this.#structures[
                Ripple.chooseKey(this.#structures)];
        else if (Object.keys(this.#structures)
                       .includes(scenario.structure))
            this.#structure = this.#structures[scenario.structure];
        else throw new Error(
            "No match for structure: " + scenario.structure);

        if (this.#structure)
            this.clearDisplayPath();

        this.#playerFaction = scenario.playerFaction;
        this.#characters = scenario.characters ?
                           scenario.characters.map(
                               character => new Character(
                                   character, setting)) : [];
    }

    toJSON() {
        const result = {};
        if (this.#playerFaction)
            result.playerFaction = this.#playerFaction;
        if (this.#structures)
            result.structures = Object.keys(this.#structures).map(
                name => this.#structures[name].toJSON());
        if (this.#structure)
            result.structure = this.#structure.name;
        if (this.#characters)
            result.characters = this.#characters.map(
                character => character.toJSON());
        return result;
    }

    toString() { return JSON.stringify(this.toJSON()); }

    eachCharacter(fn, context) {
        return this.#characters.map(character =>
            fn.call(context, character));
    }

    get playerFaction() { return this.#playerFaction; }

    getReachable(character) {
        return this.#structure.reachable(
            character.position, character.movement,
            node => this[Structure.getNodeIndex(node)] = true, {});
    }

    getNode(point) {
        if (isNaN(point?.row) || isNaN(point?.col)) {
            if (!isNaN(point?.x) && !isNaN(point?.y))
                point = this.#structure.getCell(point);
            else throw new Error(
                "Argument must provide a location: " +
                JSON.stringify(point));
        }
        return point;
    }

    getFactionCharacters(faction) {
        if (!faction)
            faction = this.#playerFaction;
        return this.#characters.filter(
            character => character.faction === faction);
    }

    selectCharacter(character) {
        if (character && (character.faction === this.playerFaction)) {
            this.#selectedCharacter = character;
            this.#reachableSpaces = getReachable(character);
            this.clearDisplayPath();
        } else {
            this.#selectedCharacter = null;
            this.#reachableSpaces   = null;
        }
        return this.#selectedCharacter;
    }

    get selectedCharacter() { return this.#selectedCharacter; }

    get destination() { return this.#destination; }

    // Set a highlighted path from the specified character to the
    // specified point
    setPath(point) {
        if (this.#selectedCharacter &&
            (this.#selectedCharacter.faction === this.#playerFaction)) {
            const path = Pathf.createPath({
                start: this.#selectedCharacter.position,
                goal: this.getNode(point),
                getNodeIndex: (node) => Ripple.pair(node.col, node.row),
                heuristic: (node, goal) =>
                    Math.hypot(node.row - goal.row,
                               node.col - goal.col),
                eachNeighbor: (node, fn, context) => {
                    // Must collect all neighbors up front to make
                    // it possible to look forward and back when
                    // considering whether diagonal nodes are blocked
                    const neighbors = this.#structure.grid
                                          .eachNeighbor(node);
                    neighbors.forEach((neigh, index, neighbors) => {
                        if (this.#structure.getCell(neigh) &&
                            !this.getCharacterAt(neigh) &&
                            (!neigh.diagonal ||
                             (this.#structure.getCell(neighbors[
                                 (index ? index :
                                  neighbors.length) - 1]) &&
                              this.#structure.getCell(neighbors[
                                  (index + 1) % neighbors.length]))))
                            fn.call(context, neigh, neigh.cost);
                    });
                },
            });

            this.#destination = path ? path[path.length - 1] : null;
            this.#structure.setDisplayPath(path);
        } else {
            this.#destination = null;
            this.clearDisplayPath();
        }
    }

    moveSelected(point) {
        if (this.#selectedCharacter &&
            (this.#selectedCharacter.faction === this.#playerFaction) &&
            this.#movingCharacters.every(([other, path]) =>
                other !== this.#selectedCharacter)) {
            this.clearDisplayPath();
            const path = this.#structure.createPath(
                this.#selectedCharacter.position,
                this.#structure.getCell(point));
            if (path && (path.reduce(
                (total, step) => total + step.cost, 0) <=
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
        this.#slide = ((this.#slide * 2000 + elapsed) % 2000) / 2000;

        const movingNext = [];
        this.#movingCharacters.forEach(([character, path]) => {
            const animationSpeed = 800;
            let remaining = elapsed;
            while (path?.length && (remaining > 0)) {
                const next = path[0];
                if (isNaN(next.x) || isNaN(next.y))
                    this.#structure.grid.markCenter(next);
                if (isNaN(next.remain))
                    next.remain = animationSpeed;
                if (remaining > next.remain) {
                    remaining -= next.remain;
                    character.position.row = next.row;
                    character.position.col = next.col;
                    character.position.x = next.x;
                    character.position.y = next.y;
                    character.movement -= next.cost;
                    if (this.#selectedCharacter === character)
                        this.#reachableSpaces = getReachable(character);
                    path.shift();
                } else {
                    const prev = this.#structure.grid.getCenter(
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

    drawTopDown(ctx, camera, now) {
        this.#structure.drawTopDown(
            ctx, camera, now, this.drawCellTopDown, this);
        if (this.#displayPath) {
            /* let prev = this.getNode(this.#pathCharacter.position);
             * let cost = 0;

             * ctx.beginPath();
             * ctx.moveTo(prev.x, prev.y);
             * this.#path.forEach(node => {
             *     node = this.#grid.getCenter(node);
             *     ctx.lineTo(node.x, node.y);
             *     Camera.drawArrow(ctx, prev, node, {
             *         absolute: this.#grid.edge,
             *         slide: this.#slide });
             *     ctx.moveTo(node.x, node.y);
             *     prev = node;
             * });
             * ctx.lineWidth = 0.1;
             * ctx.lineCap = ctx.lineJoin = "round";
             * ctx.strokeStyle = "#666";
             * ctx.stroke();

             * prev = this.#pathCharacter.position;
             * ctx.beginPath();
             * ctx.moveTo(prev.x, prev.y);
             * this.#path.forEach(node => {
             *     cost += node.cost;
             *     if (cost <= this.#pathCharacter.movement) {
             *         node = this.#grid.getCenter(node);
             *         ctx.lineTo(node.x, node.y);
             *         Camera.drawArrow(ctx, prev, node, {
             *             absolute: this.#grid.edge,
             *             slide: this.#slide });
             *         ctx.moveTo(node.x, node.y);
             *         prev = node;
             *     }
             * });
             * ctx.lineWidth = 0.1;
             * ctx.lineCap = ctx.lineJoin = "round";
             * ctx.strokeStyle = "#993";
             * ctx.stroke(); */
        }
    }

    drawCellTopDown(ctx, camera, node, now) {
        if (this.#reachableSpaces &&
            Object.keys(this.#reachableSpaces).includes(
                Structure.getNodeIndex(node))) {
            ctx.beginPath();
            this.#structure.grid.drawNode(ctx, node);
            ctx.fillStyle = "#aae4";
            ctx.fill();
        }

        this.#characters.forEach(character => {
            if (Structure.getNodeIndex(character.position) ==
                Structure.getNodeIndex(node)) {
                ctx.save();
                ctx.translate(character.position.x,
                              character.position.y);
                ctx.scale(this.#structure.grid.radius,
                          this.#structure.grid.radius);
                character.drawTopDown(ctx, camera, now);
                ctx.restore();
            }
        });
    }

    setDisplayPath(path) { this.#displayPath = path; }

    clearDisplayPath() { this.setDisplayPath(undefined); }
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
                    } catch (err) { Camera.setToast(err); }
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
                            Camera.setToast(err);
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

        this.#panel.show(
            this.#selectedCharacter.fullname, stats,
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
        // All of the most important user interface actions can
        // happen here.  These are:
        // - Click to select a character to give orders to
        // - Click selected character to open the inventory dialog
        // - Click an empty space to plot a path from selected character
        // - Click a path destination to move selected character there
        const point = camera.toWorld(camera.getPoint(event));
        const character = this.#scenario.getCharacterAt(point);
        if (character) {
            if (character === this.#scenario.selectedCharacter)
                this.showCharacter(this.#scenario.selectedCharacter);
            else this.selectCharacter(character);
        } else if (this.#scenario.selectedCharacter) {
            if (Structure.getNodeIndex(
                this.#scenario.getNode(point)) ===
                    Structure.getNodeIndex(this.#scenario.destination))
                this.#scenario.moveSelected(point);
            else this.#scenario.setPath(point);
        }
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

    draw(ctx, camera) {
        this.#scenario.drawTopDown(ctx, camera, this.#lastUpdate);
    }

}
