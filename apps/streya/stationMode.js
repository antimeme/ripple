// Sterya Station Mode
// Copyright (C) 2021-2022 by Jeff Gold.  All rights reserved.
// A user interface for editing ships, buildings and other structures.
(function() {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("../ripple/ripple.js");
        this.fascia   = require("../ripple/fascia.js");
        this.multivec = require("../ripple/multivec.js");
        this.grille   = require("../ripple/grille.js");
        this.pathf    = require("../ripple/pathf.js");

        this.structure = require("./structure.js");
    }

    ripple.export("stationMode", {
        setup: function(rules) {
            this.rules = rules;
            this.station = structure.Station.create({rules: rules});
        },

        zoomMin: function(camera) {
            // A zoom value smaller than this would show one or more
            // rows more than once, since the cylinder wraps around.
            return Math.min(camera.width, camera.height) / (
                structure.District.cellCount * this.station.rows);
        },
        zoomMax: function(camera) {
            // A zoom value larger than this would make a single
            // character cell take up more than a third of the screen
            // along its shortest dimension.  Getting that close
            // serves no purpose other than to confuse the user.
            return 1/3 * Math.min(camera.width, camera.height);
        },
        wheel: function(event, camera) {
            camera.zoom(1 + 0.1 * event.y,
                        this.zoomMin(camera), this.zoomMax(camera)); },
        pinchStart: function(event, camera) {
            this._pinchScale = camera.scale; },
        pinchMove: function(event, camera) {
            camera.setScale(this._pinchScale * event.length,
                            this.zoomMin(camera),
                            this.zoomMax(camera)); },
        drag: function(event, camera) { camera.drag(event); },
        tap: function(event, camera, now) {
            var point = this.station.cellGrid.markCell(
                camera.toWorldFromScreen(event.point));

            console.log("DEBUG-tap", point); },
        draw: function(ctx, camera, now) {
            this.station.draw(ctx, camera, now); }
    });

}).call(this);

if ((typeof require !== 'undefined') && (require.main === module)) {}
