import Character from "./character.mjs";
import Structure from "./structure.mjs";

function createPanel() {
    const result = document.createElement("fieldset");
    const contents = document.createElement("div");
    const legend = document.createElement("legend");
    const title = document.createTextNode("Panel");
    const closeBTN = document.createElement("button");
    closeBTN.appendChild(document.createTextNode("X"));
    closeBTN.addEventListener("click", event =>
        { result.style.display = "none"; });
    legend.appendChild(closeBTN);
    legend.appendChild(title);
    document.body.appendChild(result);

    result.appendChild(legend);
    result.appendChild(contents);
    result.style.display = "none";
    result.classList.add("panel");

    return {
        element: result,
        contents: contents,
        setTitle: text => { title.data = text; },
        show: function() { this.element.style.display = "block"; },
        resize: function(width, height) {
            const size = Math.min(width, height);
            const getPixels = value => Math.round(value) + "px";
            this.element.style.top = getPixels(size * 0.05);
            this.element.style.left = getPixels(size * 0.05);
            this.element.style.bottom = getPixels(0.05 * size);
            this.element.style.right = getPixels(0.05 * size);
            this.element.style.borderRadius = getPixels(size * 0.05);
        }
    };
}
const panel = createPanel();

class Gestalt {
    constructor(setting) {
        this.#panel = panel;
        this.#setting = setting;
        this.#player = Character.createRecruit(this.#setting);
        this.#ship = Structure.createSampleShip();

        this.#player.setPosition(
            this.#ship.grid.markCell({x: 0, y: 0}));
        this.#player.setShip(this.#ship);
    }

    #setting;
    #player;
    #ship;
    #panel;

    #float = false;
    active = true;
    autofill = true;
    autozoom = { min: 1, max: 20 };
    autodrag(event) { this.#float = true; };

    resize(event, camera)
    { this.#panel.resize(camera.width, camera.height); }

    dblclick(event, camera) {
        this.#panel.contents.innerHTML = "";
        [0, 1, 2, 3].forEach(index => {
            this.#panel.contents.appendChild(
                Character.createRecruit(this.#setting).getCard()); });
        this.#panel.setTitle("Recruits");
        this.#panel.show();
    }

    #beginClick = undefined;

    mousedown(event, camera) {
        this.#beginClick = camera.getPoint(event);
        this.#player.pointAt(camera.toWorld(camera.getPoint(event)));
    }

    mouseup(event, camera) {
        const point = camera.getPoint(event);
        if (this.#beginClick &&
            (point.x - this.#beginClick.x) *
            (point.x - this.#beginClick.x) +
            (point.y - this.#beginClick.y) *
            (point.y - this.#beginClick.y) < 5 * 5) {
            const node = this.#ship.grid.markCell(
                camera.toWorld(this.#beginClick));
            const cell = this.#ship.getCell(node);
            if (cell && !cell.isObstructed) {
                this.#float = false;
                this.#ship.pathDebug = [];
                this.#player.setPath(this.#ship.createPath(
                    this.#player.position, node));
                this.debugListTime = new Date().getTime();
            }
        }
    }

    lastUpdate = undefined;

    update(now, camera) {
        this.#player.update(this.lastUpdate, now);
        if (!this.#float)
            camera.setPosition(this.#player.position);
        this.lastUpdate = now;
    }

    debugListTime;

    draw(ctx, camera) {
        this.#ship.draw(ctx, this.lastUpdate, camera);

        if (this.debugListTime && this.#ship.pathDebug) {
            this.#ship.pathDebug.forEach((node, index) => {
                const value = Math.floor(
                    127 + 128 * index / this.#ship.pathDebug.length);
                ctx.beginPath();
                if (this.lastUpdate > this.debugListTime + 100 * index)
                    this.#ship.grid.drawNode(
                        ctx, this.#ship.grid.markCenter(node));
                ctx.fillStyle = "rgba(" + value + "," + value + "," +
                                value + ", 0.5)";
                ctx.fill();
            });

            [this.#ship.pathDebug[0],
             this.#ship.pathDebug[this.#ship.pathDebug.length - 1]]
                .forEach((node, index) => {
                    this.#ship.grid.markCenter(node);
                    ctx.beginPath();
                    ctx.moveTo(node.x + 0.5, node.y);
                    ctx.arc(node.x, node.y, 0.5, 0, Math.PI * 2);
                    ctx.lineWidth = 0.1;
                    ctx.strokeStyle = index ? "#4d4" : "#44d";
                    ctx.stroke();
                });
        }

        this.#player.drawTopDown(ctx, this.lastUpdate);
    }

}

export default Gestalt;
