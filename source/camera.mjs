// camera.mjs
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
// A simple two-dimensional camera abstraction.

class Camera {
    constructor(screen) {
        if (!(screen instanceof HTMLElement))
            throw new TypeError("Camera screen must be a DOM element");
        this.#screen = screen;
        this.#position = { x: 0, y: 0 };
        this.resize();
    }

    #screen; // Where the drawing happens
    #bounds; // Location of screen within client frame
    #position; // Location of camera in world space
    #radius; // Radius of largest circle that fits in center screen
    #scale = 1; // Distance of camera from world space
    #spin = 0; // Rotation of camera in world space
    #draw_id = 0;
    #listeners = false;
    #app = undefined;

    get width() { return this.#screen.width; }
    get height() { return this.#screen.height; }
    get radius() { return this.#radius; }

    resize() {
        this.#bounds = this.#screen.getBoundingClientRect();
        this.#radius = Math.min(this.#screen.width,
                                this.#screen.height) / 2;
    }

    getPoint(point) {
        return {x: point.clientX - this.#bounds.x,
                y: point.clientY - this.#bounds.y};
    }

    configureContext(ctx) {
        ctx.clearRect(0, 0, this.#screen.width, this.#screen.height);
        ctx.save();
        ctx.translate(this.#screen.width / 2, this.#screen.height / 2);
        ctx.scale(this.#radius / this.#scale,
                 -this.#radius / this.#scale);
        ctx.rotate(this.#spin);
        ctx.translate(this.#position.x, this.#position.y);
        return ctx;
    }

    restoreContext(ctx) { ctx.restore(); return ctx; }

    /**
     * Convert a point from world space to screen space.
     * An input here should come from the world being
     * represented by the program, such as the position or
     * a character or resource. */
    toScreen(point) {
        point.x += this.#position.x;
        point.y += this.#position.y;

        if (this.#spin) {
            let cos = Math.cos(this.#spin);
            let sin = Math.sin(this.#spin);
            point = {
                x: point.x * cos - point.y * sin,
                y: point.x * sin + point.y * cos };
        }

        point.x *= this.#radius / this.#scale;
        point.y *= -this.#radius / this.#scale;

        point.x += this.#screen.width / 2;
        point.y += this.#screen.height / 2;
        return point;
    }

    /**
     * Convert a point from screen space to world space.
     * An input here might be a mouse click or some other
     * display oriented coordinate. */
    toWorld(point) {
        point.x -= this.#screen.width / 2;
        point.y -= this.#screen.height / 2;

        point.x *= this.#scale / this.#radius;
        point.y *= -this.#scale / this.#radius;

        if (this.#spin) {
            let cos = Math.cos(this.#spin);
            let sin = Math.sin(this.#spin);
            point = {
                x: point.y * sin + point.x * cos,
                y: point.y * cos - point.x * sin };
        }

        point.x -= this.#position.x;
        point.y -= this.#position.y;
        return point;
    }

    /**
     * Move the camera to the world space position provided. */
    setPosition(point) {
        this.#position.x = point.x;
        this.#position.y = point.y;
        return this;
    }

    /**
     * Slide the camera along the world space vector. */
    pan(vector) {
        this.#position.x += vector.x;
        this.#position.y += vector.y;
        return this;
    }

    getScale() { return this.#scale; }
    setScale(factor, min, max) {
        if (!isNaN(factor)) {
            if (!isNaN(max) && (factor > max))
                factor = max;
            if (!isNaN(min) && (factor < min))
                factor = min;
            this.#scale = factor;
        }
        return this;
    }

    zoom(factor, min, max) {
        return this.setScale(this.#scale * factor, min, max);
    }

    manage(app) {
        this.#app = app;

        if (!this.#listeners) {
            ["touchstart", "touchmove", "touchend",
             "mousedown", "mousemove", "mouseup",
             "click", "dblclick", "wheel"].forEach(evtype => {
                 this.#screen.addEventListener(evtype, event => {
                     if (typeof(this.#app[evtype]) === "function")
                         this.#app[evtype].call(this.#app, event, this);
                 });
             });
            window.addEventListener("resize", event => {
                this.#screen.height =
                    window.innerHeight || window.clientHeight;
                this.#screen.width =
                    window.innerWidth || window.clientWidth;
                this.resize(screen.width, screen.height);
                if (typeof(this.#app.resize) === "function")
                    this.#app.resize.call(this.#app,
                                          this.#screen.width,
                                          this.#screen.height);
                return this.redraw();
            });
            window.dispatchEvent(new Event("resize"));
            this.#listeners = true;
        }
        return this;
    }

    #draw() {
        if (!this.#screen.getContext)
            throw Error("screen has no getContext");
        const ctx = this.#screen.getContext("2d");
        this.configureContext(ctx);
        if (this.#app && typeof(this.#app.draw) === "function")
            this.#app.draw.call(this.#app, ctx, this)
        this.restoreContext(ctx);
        this.#draw_id = 0;
        if (this.#app &&
            ((typeof(this.#app.active) === "function") ?
             this.#app.active.call(this.#app) : this.#app.active))
            this.redraw();
    }

    redraw() {
        if (!this.#draw_id)
            this.#draw_id = requestAnimationFrame(
                () => { this.#draw(); });
    }
}

export default Camera;
