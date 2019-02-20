(function(tantalus) {
    if (typeof require !== 'undefined') {
        this.ripple   = require('./ripple/ripple.js');
        this.random   = require('./ripple/random.js');
        this.terrain  = require('./ripple/terrain.js');
        this.grid     = require('./ripple/grid.js');
        this.pathf    = require('./ripple/pathf.js');
        this.multivec = require('./ripple/multivec.js');
        this.fascia   = require('./ripple/fascia.js');
    }

    tantalus.create = function(preloads) {
        return {
            isActive: function() { return true; },
            init: function(camera, canvas, container, redraw) {},
            resize: function(camera) {},
            draw: function(ctx, camera, now, last) {
                
            },
            tap: function(event, camera) {},
            doubleTap: function(event, camera) {},
            drag: function(event, camera) {},
            swipe: function(event, camera) {},
            pinchStart: function(event, camera) {},
            pinchMove: function(event, camera) {},
            wheel: function(event, camera) {},
        };
    };
})(typeof exports === 'undefined'? this['tantalus'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    console.log('Test!');
}
