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
    constructor(width, height) {
        this.resize(width, height);
        this.position = { x: 0, y: 0 };
        this.scale = 1;
        this.spin = 0;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.radius = Math.min(width, height) / 2;
    }

    configureContext(ctx) {
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.save();
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.radius / this.scale, -this.radius / this.scale);
        ctx.rotate(this.spin);
        ctx.translate(this.position.x, this.position.y);
        return ctx;
    }
    restoreContext(ctx) { ctx.restore(); return ctx; }

    getRadius() { return this.radius; }

    /**
     * Convert a point from world space to screen space.
     * An input here should come from the world being
     * represented by the program, such as the position or
     * a character or resource. */
    toScreen(point) {
        point.x += this.position.x;
        point.y += this.position.y;

        if (this.spin) {
            let cos = Math.cos(this.spin);
            let sin = Math.sin(this.spin);
            point = {
                x: point.x * cos - point.y * sin,
                y: point.x * sin + point.y * cos };
        }

        point.x *= this.radius / this.scale;
        point.y *= -this.radius / this.scale;

        point.x += this.width / 2;
        point.y += this.height / 2;
        return point;
    }

    /**
     * Convert a point from screen space to world space.
     * An input here might be a mouse click or some other
     * display oriented coordinate. */
    toWorld(point) {
        point.x -= this.width / 2;
        point.y -= this.height / 2;

        point.x *= this.scale / this.radius;
        point.y *= -this.scale / this.radius;

        if (this.spin) {
            let cos = Math.cos(this.spin);
            let sin = Math.sin(this.spin);
            point = {
                x: point.y * sin + point.x * cos,
                y: point.y * cos - point.x * sin };
        }

        point.x -= this.position.x;
        point.y -= this.position.y;
        return point;
    }

    /**
     * Move the camera to the world space position provided. */
    setPosition(point) {
        this.position.x = point.x;
        this.position.y = point.y;
        return this;
    }

    /**
     * Slide the camera along the world space vector. */
    pan(vector) {
        this.position.x += vector.x;
        this.position.y += vector.y;
        return this;
    }

    setScale(factor, min, max) {
        if (!isNaN(factor)) {
            if (!isNaN(max) && (factor > max))
                factor = max;
            if (!isNaN(min) && (factor < min))
                factor = min;
            this.scale = factor;
        }
        return this;
    }

    zoom(factor, min, max) {
        return this.setScale(this.scale * factor, min, max);
    }
    
}

export default Camera;
