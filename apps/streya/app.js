// Streya App
// Copyright (C) 2021-2022 by Jeff Gold.  All rights reserved.
//
// Streya is a science fiction video game for web browsers.  Players
// control a character and possibly one or more ships or space
// stations that rotate for gravity.  The game takes place in the Kuiper
// Belt around 2220 CE and attempts to use scientifically plausible
// technologies.
(function(app) {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("../ripple/ripple.js");
        this.fascia   = require("../ripple/fascia.js");
        this.multivec = require("../ripple/multivec.js");
        this.grille   = require("../ripple/grille.js");
        this.pathf    = require("../ripple/pathf.js");
        this.structure   = require("./structure.js");
        this.editorMode  = require("./editorMode.js");
        this.stationMode = require("./stationMode.js");
    }
    var rules = undefined;

    app.create = function(preloads) {
        rules = preloads["app.json"];

        stationMode.setup(rules);
        return {
            mode: ripple.param("mode", {default: "station"}),
            modes: {
                station:  stationMode,
                editor:   editorMode,
            }
        };
    };

}).call(this, (typeof exports === 'undefined') ?
        (this.app = {}) : ((typeof module !== undefined) ?
                           (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {}
