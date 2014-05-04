// grimoire.js
// Character management system for role playing games.

var Grimoire = (function() {
    var tomes = {};

    /**
     * Each key in this object is a tome name.  The value for a key is
     * an array of strings which are the names of tomes which refer to
     * the key named tome as a parent. */
    var tome_children = {};

    /**
     * Returns a replacement for a child tome which is linked to
     * its parent. */
    var tome_link = function(parent, child, report) {
        var new_child = Object.create(parent);
        for (var tome_field in child) {
            if (tome_field == 'races') {
                var races = {}, __races = {};
                for (race_name in parent.races)
                    __races[race_name] = parent.races[race_name];
                for (race_name in child.races)
                    __races[race_name] = child.races[race_name];

                // Parent tomes must be linked before their children
                // so that the inheritance chain is correct.  This is
                // done recursively but depending on the input order
                // may end up happening more than once.
                var race_link = function(name, race) {
                    if (name in races)
                        return;
                    if (race.parent && race.parent in __races) {
                        race_link(race.parent, __races[race.parent]);
                        var replace = Object.create(races[race.parent]);
                        for (var field in race)
                            replace[field] = race[field];
                        races[name] = replace;
                    } else races[name] = race;
                };
                for (var name in __races)
                    race_link(name, __races[name]);
                new_child[tome_field] = races;
            } else new_child[tome_field] = child[tome_field];
        }
        return new_child;
    }

    /**
     * Fetch or load a single tome.  Applications should treat
     * tome objects as opaque and not attempt to modify them.
     *
     * @param name identifier for the desired tome
     * @param data opaque data structure which represents a tome
     * @param report optional function takes level and log message
     * @returns an opaque tome structure to be stored */
    var tome_load = function(tome_name, data, report) {
        if (!report) // Create a sensible default report function
            report = function(level, message) {
                console.log(level + ' ' + message); };
        if (data) {
            var this_tome = {
                races: data.races || {},
                characters: data.characters || {},
            };

            // Parent and child tomes may be loaded in any order.  If
            // the parent has already been loaded, we can link the
            // child as it comes in.
            if (data.parent) {
                var siblings = tome_children[data.parent] || [];
                siblings.push(this_tome);
                tome_children[data.parent] = dangles;

                if (data.parent in tomes)
                    this_tome = tome_link(
                        tomes[data.parent], this_tome);
            }
            var link_tomes = function(name) {
                for (index in tome_children[name]) {
                    var current = tome_children[name];
                    tomes[current.tome_name] =
                        tome_link(this_tome, current);
                    link_tomes(current);
                }
            };

            if (tome_children[tome_name]) {
                for (index in tome_children[tome_name]) {
                    var current = tome_children[tome_name];
                    tomes[current.tome_name] =
                        tome_link(this_tome, current);
                    // This is broken.  Suppose tome A is a parent of
                    // B which is a parent of C.  Now we import C
                    // followed by B.  C will have been on the dangles
                    // list for B so it will get replaced here.  So
                    // fare so good.  Now A gets loaded so B gets
                    // replaced.  However, C now inherits from some
                    // old object B which never did inherit from A.
                    // Races defined in A will never be visible in C,
                    // for example.
                }
            }
            this_tome.raw = rawtomes[tome_name] = data;
            tomes[tome_name] = this_tome;
        }
        return rawtomes[tome_name];
    };

    return {
        tomes: tomes,
        tome_load: tome_load,
    };
})();

// Entry point for command line use.
if ((typeof require !== 'undefined') && (require.main === module)) {
    var result = 0;
    var fs = require('fs');
    var tomes = [];
    var path = process.argv[1].substring(
        0, process.argv[1].lastIndexOf('/'));

    // Process command line options
    for (index = 2; index < process.argv.length; ++index) {
        if (process.argv[index] == '--')
            break;
        else if (process.argv[index].indexOf('--') == 0) {
            var setting = process.argv[index].substring(2);
            var value = undefined, eqsign = setting.indexOf('=');
            if (eqsign > -1) {
                value = setting.substring(eqsign + 1);
                setting = setting.substring(0, eqsign);
            }
            if (setting == 'tome' && value)
                tomes.push(value);
        }
    }

    // Load any relevant tomes
    if (!tomes.length) {
        var end = '.tome';
        var names = fs.readdirSync(path + '/tomes');
        names.forEach(function(name) {
            if (name.indexOf(end, name.length - end.length) !== -1)
                tomes.push(name.substring(0, name.length - end.length));
        });
    }
    tomes.forEach(function (name) {
        console.log('Loading ' + name + '...');
        var data = fs.readFileSync(path + '/tomes/' + name + '.tome',
                                   {encoding: 'utf8'});
        Grimoire.tome_load(name, JSON.parse
                           (data.replace(/\s+/gm, ' ')));
    });

    for (tome_name in Grimoire.tomes) {
        var tome = Grimoire.tomes[tome_name];
        if (tome.characters) {
            console.log('Tome: ' + tome_name);
            for (var index = 0; index < tome.characters.length;
                 ++index) {
                var character = tome.characters[index];
                console.log('  ' + character.fname + ' ' +
                            character.lname);
            }
        }
    }
    process.exit(result);
}
