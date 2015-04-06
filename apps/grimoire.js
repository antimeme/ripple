// grimoire.js
// Character management system for role playing games.
(function(grimoire) {
    "use strict";
    // All tomes that we know about are kept in an object, refrenced
    // by the tome name.  Each tome has a raw field which matches the
    // format expected in a file, meaning there are no direct
    // references to other tomes.  This is useful when saving.
    grimoire.tomes = {};

    /**
     * Character races can have parents from which they inherit any
     * properties not directly specified. In JSON this means a
     * "parent" attribute but to make this work the object heirarcy
     * must be constructed. */
    var race_setup = function(races, data, name) {
        var race, base, field;
        var parent = data.races[name].parent;

        // We must set up parents before their children so when our
        // parent is in the same tome we set it up before proceeding.
        // If we are the parent and a child has already set us up
        // we can skip this step.
        if (races.hasOwnProperty(name))
            return races[name];
        if ((parent in data) && !races.hasOwnProperty(parent))
            races[parent] = race_setup(races, data, parent);
        if (parent in races)
            base = races[parent];
        else base = {};

        race = Object.create(base)
        for (field in data.races[name])
            if (data.races[name].hasOwnProperty(field))
                race[field] = data.races[name][field];
        return race;
    };

    /**
     * Sets up a single tome. */
    var tome_setup = function(name, data) {
        var tome, field, child, races, race_name;
        var parent = {};
        if (data.parent in grimoire.tomes)
            tome = Object.create(parent = grimoire.tomes[data.parent]);
        else tome = {};

        for (field in data) {
            if (!data.hasOwnProperty(field))
                continue;
            if (field === 'races') {
                races = parent.races ? Object.create(parent.races) : {}
                for (race_name in data.races || {})
                    races[race_name] = race_setup(
                        races, data, race_name);
                tome[field] = races;
            } else tome[field] = data[field];
        }

        grimoire.tomes[name] = tome;
        for (child in grimoire.tomes)
            if (name !== child &&
                name === grimoire.tomes[child].parent)
                grimoire.tomes[child] = tome_setup(
                    child, grimoire.tomes[child].raw);
        tome.raw = data;
        return tome;
    };

    grimoire.load = function(name, data, report)
    { return tome_setup(name, data); }
})(typeof exports === 'undefined'? this['grimoire'] = {}: exports);

// Entry point for command line use.
if ((typeof require !== 'undefined') && (require.main === module)) {
    var result = 0;
    var fs = require('fs');
    var grimoire = exports;
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
        var data = fs.readFileSync(path + '/tomes/index.json',
                                   {encoding: 'utf8'});
        tomes = JSON.parse(data);
        // var end = '.tome';
        // var names = fs.readdirSync(path + '/tomes');
        // names.forEach(function(name) {
        //     if (name.indexOf(end, name.length - end.length) !== -1)
        //         tomes.push(name.substring(
        //             0, name.length - end.length));
        // });
    }
    tomes.forEach(function(name) {
        var data = fs.readFileSync(path + '/tomes/' + name + '.tome',
                                   {encoding: 'utf8'});
        var tome = grimoire.load(name, JSON.parse(
            data.replace(/\s+/gm, ' ')));
        console.log('Loaded ' + name + ': ' + tome.description);
    });

    for (tome_name in grimoire.tomes) {
        var tome = grimoire.tomes[tome_name];
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
