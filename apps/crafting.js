// crafting.js
// An experimental crafting system.  A collection of ingredients can
// be used to make things according to a regular pattern.
//
// A crafting system has a collection of possible ingredients which
// can be combined arbitrarily.  A constellation off effects are
// possible as well.
//
// TODO:
// - Implement imprecise construction, to be improved using
//   skill and equipment factors
// - Implement generation of crafting systems given some names
//   (and maybe support for generating names with some guidance)
//   such that components don't do much on their own
// - Implement rare ingredients with unusual properties that aren't
//   found in common ones -- for example maybe rare ingredients are
//   near the extremes of the space, such as the origin?
// - Implement support for finding useful recepies

(function(exports) {
    "use strict";
    exports.example = {
        properties: ["x", "y", "z"],
        components: {
            "wyrmsroot": {"x": 32, "y": 48, "z": 95},
            "oakmoss": {"x": 67, "y": 94, "z": 64},
            "gomsfoil": {"x": 82, "y": 41, "z": 53},
            "riverleaf": {"x": 17, "y": 19, "z": 43},
            "ashstone": {"x": 47, "y": 76, "z": 64},
            "cinderwort": {"x": 97, "y": 46, "z": 56}},
        effects: {
            "heal": {"x": 43, "y": 84, "z": 22},
            "regeneration": {"x": 35, "y": 20, "z": 96},
            "fireball": {"x": 54, "y": 51, "z": 57},
            "poison": {"x": 86, "y": 14, "z": 68},
            "rage": {"x": 64, "y": 60, "z": 98},
            "invisible": {"x": 66, "y": 19, "z": 64},
            "speed": {"x": 27, "y": 18, "z": 93},
            "jump": {"x": 10, "y": 3, "z": 80},
            "flight": {"x": 66, "y": 40, "z": 87},
            "strength": {"x": 8, "y": 56, "z": 30}}
    };

    exports.craft = function(ingredients, system) {
        var ingredient, index, property, count = 0;
        var result = {"x": 0, "y": 0, "z": 0};
        if (!system)
            system = exports.example;

        for (ingredient in ingredients) {
            if (ingredient in system.components) {
                count += ingredients[ingredient];
                for (index in system.properties) {
                    property = system.properties[index];
                    result[property] += (
                        system.components[ingredient][property] *
                            ingredients[ingredient]);
                }
            }
        }
        if (count > 0) {
            for (index in system.properties) {
                property = system.properties[index];
                result[property] = Math.floor(result[property] / count);
            }
        }
        return result;
    };

    exports.effect = function(crafted, system) {
        if (!system)
            system = exports.example;
        var result = "none", effect, ef, property;
        var current, best, dsquared;
        for (effect in system.effects) {
            ef = system.effects[effect];
            dsquared = 0;
            for (index in system.properties) {
                property = system.properties[index];
                current = crafted[property] - ef[property];
                dsquared += current * current;
            }
            console.log(dsquared, best);

            if ((typeof best === 'undefined') || (dsquared < best)) {
                best = dsquared;
                result = effect;
            }
        }
        return result;
    };

})(typeof exports === 'undefined' ? this['crafting'] = {} : exports);

// Entry point for command line use.
if ((typeof require !== 'undefined') && (require.main === module)) {
    "use strict";
    var crafting = exports;
    var system = crafting.example;
    var ingredients = {}, crafted;

    var path = process.argv[1].substring(
        0, process.argv[1].lastIndexOf('/'));
    var result = 0, index, setting, value, eqsign;

    // Process command line options
    for (index = 2; index < process.argv.length; ++index) {
        if (process.argv[index] === '--')
            break;
        if (process.argv[index].indexOf('--') === 0) {
            setting = process.argv[index].substring(2);
            eqsign = setting.indexOf('=');
            value = undefined;
            if (eqsign > -1) {
                value = setting.substring(eqsign + 1);
                setting = setting.substring(0, eqsign);
            }
            
            if (setting === system) {
                // TODO: ...?
                console.log("Um... er...");
            } else if (setting in system.components) {
                ingredients[setting] = value ? parseInt(value, 10) : 0;
            }
        }
    }

    crafted = crafting.craft(ingredients, system);
    console.log(crafted, crafting.effect(crafted));
    process.exit(result);
}
