// Sterya Editor
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

    var menu = document.createElement('ul');
    var menuframe = ripple.createElement(
        'fieldset', {'class': 'editor-menu', style: {}},
        ripple.createElement(
            'legend', null, 'Streya Editor'), menu);
    menuframe.addEventListener('click', function(event) {
        if (event.target.tagName.toLowerCase() === 'legend')
            ripple.toggleVisible(menu);
    });
    menu.appendChild(ripple.createElement(
        "li", {"data-action": "one"}, "One"));
    menu.appendChild(ripple.createElement(
        "li", {"data-action": "two"}, "Two"));

    ripple.export("editorMode", {
        init: function(camera, canvas, container, redraw) {
            console.log("DEBUG init");
            container.appendChild(menuframe);
            ripple.show(menuframe);
            console.log("DEBUG shown", canvas.style["z-index"]);
        },

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
    });
}).call(this);

if ((typeof require !== 'undefined') && (require.main === module)) {}
