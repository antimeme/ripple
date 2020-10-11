// Habitat is a science fiction video game for web browsers.  Players
// control a rotating space station with space for habitation.  The
// game takes place in the Kuiper Belt around 2220 CE and confines
// itself to scientifically plausible technologies.
(function(habitat) {
    "use strict";
    if (typeof require === 'function') {
        this.ripple   = require("./ripple/ripple.js");
        this.fascia   = require("./ripple/fascia.js");
        this.multivec = require("./ripple/multivec.js");
        this.grid     = require("./ripple/grid.js");
        this.pathf    = require("./ripple/pathf.js");
    }

    habitat.game = function(preloads) {
        return {
            init: function(camera, canvas, container, redraw) {
            }
        };
    };

}).call(this, typeof exports === 'undefined'?
        (this.habitat = {}) : ((typeof module !== undefined) ?
                              (module.exports = exports) : exports));

if ((typeof require !== 'undefined') && (require.main === module)) {}
