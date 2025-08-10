// camera.mjs
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

/**
 * A simple two-dimensional camera abstraction for HTML canvas.
 * Camera provides a world space where the origin (0, 0) starts at
 * the center of the screen and uses chalkboard coordinates (so
 * positive x goes to the right and positive y goes up). */
export default class Camera {
    constructor(screen) {
        if (!screen)
            screen = document.body.appendChild(
                document.createElement("canvas"));
        else if (!(screen instanceof HTMLElement))
            throw new TypeError("Camera screen must be a DOM canvas");
        this.#position = { x: 0, y: 0 };
        this.#screen = screen;
        this.resize();
    }

    #screen; // Where the drawing happens
    #radius; // Radius of largest circle that fits in center screen
    #bounds; // Location of screen within client frame

    #position; // Location of camera in world space
    #scale = 1; // Distance of camera from world space
    #spin  = 0; // Rotation of camera in world space

    #draw_id = 0; // Used to combine redraw requests
    #listeners = false; // Ensures listeners get registered once
    #app       = undefined; // Handles drawing and interaction

    get width() { return this.#screen.width; }
    get height() { return this.#screen.height; }
    get radius() { return this.#radius; }

    /**
     * Recalculate things that depend on the screen size.  Note
     * that this is called automatically for managed apps. */
    resize() {
        this.#bounds = this.#screen.getBoundingClientRect();
        this.#radius = Math.min(this.#screen.width,
                                this.#screen.height) / 2;
        return this;
    }

    /**
     * Convert an event location to a point relative to the screen */
    getPoint(point) {
        return {x: point.clientX - this.#bounds.x,
                y: point.clientY - this.#bounds.y};
    }

    /**
     * Set up a context for drawing.  After calling this drawing
     * operations are relative to world space rather than screen
     * space.  For example, (0, 0) is no longer the upper left of
     * the screen.  Use toWorld on screen coordinates before
     * drawing with them to make them relative to the screen.
     *
     * This method is called automatically for managed apps (use
     * drawBefore or drawAfter to draw in screen space rather than
     * world space). */
    configureContext(ctx) {
        ctx.save();
        ctx.translate(this.#screen.width / 2, this.#screen.height / 2);
        ctx.scale(this.#radius / this.#scale,
                 -this.#radius / this.#scale);
        ctx.rotate(this.#spin);
        ctx.translate(this.#position.x, this.#position.y);
        return ctx;
    }

    /**
     * Undo context settings.  After this coordinates refer to
     * screen space again. */
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
        this.#position.x = -point.x;
        this.#position.y = -point.y;
        return this;
    }

    /**
     * Slide the camera along the world space vector. */
    pan(vector) {
        this.#position.x += vector.x;
        this.#position.y += vector.y;
        return this;
    }

    get scale() { return this.#scale; }
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

    setScaleNatural() {
        this.#scale = this.#radius;
        return this;
    }

    zoom(factor, min, max) {
        return this.setScale(this.#scale * factor, min, max);
    }

    #update() {
        if (this.#app && typeof(this.#app.update) === "function")
            this.#app.update.call(
                this.#app, Date.now(), this);
        return this;
    }

    #delegate(event) {
        if (this.#app && (typeof(this.#app[event.type]) === "function"))
            this.#update().#app[event.type].call(
                this.#app, event, this);
        return this;
    }

    /**
     * Registers handlers for events and drawing.
     *
     * This is safe to call more than once to change the mode of
     * an application because handlers are applied only once. */
    manage(app) {
        this.#app = app;

        if (!this.#listeners) {
            let pinchScale = undefined;
            function pinchDistance(event) {
                return Math.hypot(
                    event.targetTouches[0].clientX -
                    event.targetTouches[1].clientX,
                    event.targetTouches[0].clientY -
                    event.targetTouches[1].clientY); }

            let dragStart = undefined;
            let dragTouch = undefined;
            const drag = (event, point) => {
                this.pan({x: point.x - dragStart.x,
                          y: point.y - dragStart.y});
                this.redraw();
                if (typeof(this.#app.autodrag) === "function")
                    this.#app.autodrag.call(this.#app, event, this);
            };

            if (this.#app && this.#app.usekeys) {
                this.#screen.tabIndex = 1;
                document.addEventListener("keydown", event =>
                    this.#delegate(event));
                document.addEventListener("keyup", event =>
                    this.#delegate(event));
            }

            this.#screen.addEventListener("click", event =>
                this.#delegate(event));
            this.#screen.addEventListener("dblclick", event =>
                this.#delegate(event));
            this.#screen.addEventListener("mouseenter", event =>
                this.#delegate(event));
            this.#screen.addEventListener("mouseover", event =>
                this.#delegate(event));
            this.#screen.addEventListener("mouseout", event =>
                this.#delegate(event));
            this.#screen.addEventListener("mouseleave", event =>
                this.#delegate(event));
            this.#screen.addEventListener("mousedown", event => {
                if (this.#app && this.#app.autodrag)
                    dragStart = this.toWorld(this.getPoint(event));
                return this.#delegate(event);
            });
            this.#screen.addEventListener("mouseup", event => {
                if (this.#app && this.#app.autodrag)
                    dragStart = undefined;
                return this.#delegate(event);
            });
            this.#screen.addEventListener("mousemove", event => {
                if (this.#app && this.#app.autodrag &&
                    dragStart && !dragTouch)
                    drag(event, this.toWorld(this.getPoint(event)));
                return this.#delegate(event);
            });
            this.#screen.addEventListener("wheel", event => {
                if (this.#app && this.#app.autozoom) {
                    event.preventDefault();
                    this.redraw();
                    this.zoom((event.wheelDeltaY > 0) ? (4/5) : (5/4),
                              this.#app.autozoom.min,
                              this.#app.autozoom.max);
                }
                return this.#delegate(event);
            });
            this.#screen.addEventListener("touchstart", event => {
                if (this.#app && this.#app.autodrag &&
                    (event.targetTouches.length === 1))
                    dragTouch = dragStart = this.toWorld(this.getPoint(
                        event.targetTouches[0]));
                else dragStart = undefined;
                if (this.#app && this.#app.autozoom &&
                    (event.targetTouches.length === 2)) {
                    pinchScale = this.#scale * pinchDistance(event);
                } else pinchScale = undefined;
                return this.#delegate(event);
            });
            this.#screen.addEventListener("touchend", event => {
                if (this.#app && this.#app.autodrag &&
                    (event.targetTouches.length === 1))
                    dragTouch = dragStart = this.toWorld(this.getPoint(
                        event.targetTouches[0]));
                else dragStart = undefined;
                if (this.#app && this.#app.autozoom &&
                    (event.targetTouches.length === 2)) {
                    pinchScale = this.#scale * pinchDistance(event);
                } else pinchScale = undefined;
                return this.#delegate(event);
            });
            this.#screen.addEventListener("touchmove", event => {
                if (this.#app && this.#app.autodrag && dragStart &&
                    (event.targetTouches.length === 1))
                    drag(event, this.toWorld(this.getPoint(
                        event.targetTouches[0])));
                if (this.#app && this.#app.autozoom &&
                    (event.targetTouches.length === 2) &&
                    !isNaN(pinchScale))
                    this.setScale(
                        pinchScale / pinchDistance(event),
                        this.#app.autozoom.min,
                        this.#app.autozoom.max).redraw();
                return this.#delegate(event);
            });

            window.addEventListener("resize", event => {
                if (this.#app && this.#app.autofill) {
                    this.#screen.height =
                        window.innerHeight || window.clientHeight;
                    this.#screen.width =
                        window.innerWidth || window.clientWidth;
                }
                this.resize(screen.width, screen.height);
                this.#delegate(event);
                return this.redraw();
            });
            window.dispatchEvent(new Event("resize"));
            this.#listeners = true;
        }
        this.#screen.focus();
        return this.redraw();
    }

    #draw() {
        if (!this.#update().#screen.getContext)
            throw Error("screen has no getContext");
        const ctx = this.#screen.getContext("2d");
        const style = getComputedStyle(this.#screen);
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.color;
        ctx.clearRect(0, 0, this.#screen.width, this.#screen.height);

        if (this.#app && typeof(this.#app.drawBefore) === "function")
            this.#app.drawBefore.call(this.#app, ctx, this);
        this.configureContext(ctx);
        if (this.#app && typeof(this.#app.draw) === "function")
            this.#app.draw.call(this.#app, ctx, this);
        this.restoreContext(ctx);
        if (this.#app && typeof(this.#app.drawAfter) === "function")
            this.#app.drawAfter.call(this.#app, ctx, this);

        this.#draw_id = 0;
        if (this.#app &&
            ((typeof(this.#app.active) === "function") ?
             this.#app.active.call(this.#app) : this.#app.active))
            this.redraw();
    }

    /**
     * Call this to schedule a redraw as soon as possible.
     * Multiple calls to this method between drawing calls will
     * be condensed so it's safe to call just to be sure.  Note
     * that managed apps with a truthy active field will be
     * redrawn automatically without the need to call this. */
    redraw() {
        if (!this.#draw_id)
            this.#draw_id = requestAnimationFrame(() => this.#draw());
        return this;
    }

    static drawRoundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height,
                             x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
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
    static drawSteps(ctx, steps, config) {
        const now   = (config && !isNaN(config.now)) ? config.now : 0;
        const phase = (config && !isNaN(config.phase)) ?
                      config.phase : 0;
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
     * Draws an arrow from the start point to the end point.  An arrow
     * has a width and a depth, both relative to the length of the
     * line.  To make these absolute, multiply by the desired length
     * and divide by the line length. */
    static drawArrow(ctx, start, end, config) {
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const denom = (config && config.absolute) ? length : 1;
        const depth = config && config.depth || 0.1;
        const width = config && config.width || 0.15;
        const slide = config && config.slide || 1.0;

        const perp = { x: (end.y - start.y) * width / denom,
                       y: (start.x - end.x) * width / denom };
        const top = {
            x: start.x + (end.x - start.x) * (slide + depth / denom),
            y: start.y + (end.y - start.y) * (slide + depth / denom) };
        const bottom = {
            x: start.x + (end.x - start.x) * slide,
            y: start.y + (end.y - start.y) * slide };
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x + perp.x, bottom.y + perp.y);
        ctx.lineTo(bottom.x - perp.x, bottom.y - perp.y);
        ctx.lineTo(top.x, top.y);
    }

    /**
     * Calls a specified function after the page has completely loaded
     * and an array of URLs are fetched using XMLHttpRequest (AJAX). */
    static preload(urls, fn, errfn) {
        const loaded = {};
        let count = 0;

        if (typeof(urls) === "string")
            urls = [urls];
        else if (!Array.isArray(urls))
            urls = [];
        function next(url, content) {
            if (url)
                loaded[url] = content;
            if (++count === urls.length + 1)
                fn(loaded);
        }

        urls.forEach((url) => {
            const request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.addEventListener("load", event => {
                if (count < 0) { // Error already reported
                } else if (request.status === 200) {
                    next(url, JSON.parse(request.responseText));
                } else if (typeof(errfn) === "function") {
                    errfn(event, url, request);
                    count = -1;
                } else console.error("preload failed (" +
                                     request.status + "):", url);
            });
            request.addEventListener("error", event => {
                if (typeof(errfn) === "function") {
                    errfn(event, url, request);
                    count = -1;
                } else console.error("preload failed (" +
                                   request.status + "):", url);
            });
            request.send();
        });
        document.addEventListener("DOMContentLoaded", () => { next() });
    }
}
