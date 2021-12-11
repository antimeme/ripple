// Sterya Editor
// Copyright (C) 2021 by Jeff Gold.  All rights reserved.
// A user interface for editing ships, buildings and other structures.
(function() {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("../ripple/ripple.js");
        this.fascia   = require("../ripple/fascia.js");
        this.multivec = require("../ripple/multivec.js");
        this.grille   = require("../ripple/grille.js");
        this.pathf    = require("../ripple/pathf.js");

        //this.Structure = require("./structure.js");
    }

    var Structure = {
        create: function() {},
        draw: function(ctx, camera) {},
        toJSON: function() {},
    };

    var mode = {
        structure: Structure.create(),
        zoomMin: function(camera) {
            return Math.min(camera.width, camera.height) / 300;
        },
        zoomMax: function(camera) {
            return Math.min(camera.width, camera.height) / 3;
        },
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y,
                        this.zoomMin(camera),
                        this.zoomMax(camera)); },
        pinchStart: function(event, camera) {
            this._pinchScale = camera.scale; },
        pinchMove: function(event, camera) {
            camera.setScale(this._pinchScale * event.length,
                            this.zoomMin(camera),
                            this.zoomMax(camera)); },
        drag: function(event, camera) {
            camera.pan({
                x: (event.last.x - event.current.x) / camera.scale,
                y: (event.last.y - event.current.y) / camera.scale });
        },
        tap: function(event, camera, now) {
            var point = camera.toWorldFromScreen(event.point);

            console.log("DEBUG-tap", point); },
        draw: function(ctx, camera, now) {}
    };

    // This library exports only one object.
    if (typeof(module) !== "undefined") {
        module.exports = mode;
    } else if (typeof(exports) !== "undefined") {
        exports = mode;
    } else window['editorMode'] = mode;
}).call(this);

if ((typeof require !== 'undefined') && (require.main === module)) {}
