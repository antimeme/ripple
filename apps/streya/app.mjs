import Structure from "./structure.mjs";

class Editor {
}

class App {
    constructor(setting) {
        this.#setting = setting;
    }

    #setting;

    get active() { return true };
    get autofill() { return true };
    get autozoom() { return { min: 1, max: 20 } };
    autodrag(event) { };

    resize(event, camera) {  }

    dblclick(event, camera) { }

    mousedown(event, camera) {
    }

    mouseup(event, camera) { }

    #lastUpdate = undefined;

    update(now, camera) {
        this.#lastUpdate = now;
    }

    draw(ctx, camera) {
    }

}

export default App;
