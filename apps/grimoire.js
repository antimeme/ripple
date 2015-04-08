// grimoire.js
// Character management system for role playing games.
// TODO:
// - automatically load parent tomes

// === Manipulators
// Characters have one or more manipulator slots.  These are things
// like hands for humans which can be used to manipulate objects.
// When empty these have the following possibilities:
//
// Empty:
// - Take: pick up an item from nearby or another character
// - Fetch: get an item from another slot or container
// - Attack: perform an unarmed attack
//
// Once a manipulater has an item (due to Take or Fetch) the following
// actions are possible:
//
// Item:
// - Give: hold the item out for another character to take
// - Drop: put an item down
// - Throw: hurl an item
// - Stow: put the item into another slot or container
// - Consume*: eat the item or drink from it (if appropriate)
// - Use*: perform some item specific task
// - Attack*: use the item to harm another character

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
     * Convert raw data to an integrated tome. */
    grimoire.load = function(name, data) {
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
                grimoire.tomes[child] = grimoire.load(
                    child, grimoire.tomes[child].raw);
        tome.raw = data;
        return tome;
    };

    /**
     * Automatically load tomes based on index with a fallback. */
    grimoire.loadAjax = function($, tomes, complete) {
        var index, loading = 0, loaded = function() {
            loading -= 1;
            if (loading == 0)
                complete();
        };
        var load = function(name) {
            loading += 1;
            $.ajax({
                url: 'tomes/' + name, dataType: "json",
                cache: false}).done(function(data) {
                    console.log('Loaded: ' + name);
                    grimoire.load(name, data);
                    if (data.parent && !(data.parent in grimoire.tomes))
                        load(data.parent);
                }).always(function() { loaded(); });
        };

        if (tomes && tomes.length > 0) {
            for (index in tomes)
                load(tomes[index]);
        } else $.getJSON('tomes/index').fail(function() {
            load('grimoire');
        }).done(function(data) {
            var index;
            for (index = 0; index < data.length; ++index)
                load(data[index]);
        });
        return $;
    }
})(typeof exports === 'undefined'? this['grimoire'] = {}: exports);

// Entry point for command line use.
if ((typeof require !== 'undefined') && (require.main === module)) {
    var result = 0;
    var fs = require('fs');
    var grimoire = exports;
    var tomes = []; // names of tomes to load

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

    /**
     * Emulates jQuery Ajax but uses file operations instead.
     * This allows us to use grimoire.loadAjax directly. */
    var fjax = {
        getJSON: function(url) { return this.ajax({url: url}); },
        ajax: function(options) {
            var result = {
                base: this, cbs: [],
                url: options.url,
                done: function(fn) {
                    this.cbs.push({which: 'done', fn: fn});
                    return this;
                },
                fail: function(fn) {
                    this.cbs.push({which: 'fail', fn: fn});
                    return this;
                },
                always: function(fn) {
                    this.cbs.push({which: null, fn: fn});
                return this;
                },
            };
            if (!this.pending)
                this.pending = [];
            this.pending.push(result);
            return result;
        },
        execute: function() {
            var path = process.argv[1].substring(
                0, process.argv[1].lastIndexOf('/'));
            var data = null, mode = 'done', status = 'success';
            var index, jndex, current, request, request, callback;
            while (this.pending) {
                current = this.pending;
                this.pending = undefined;

                for (index = 0; index < current.length; ++index) {
                    request = current[index];
                    try {
                        data = JSON.parse(fs.readFileSync(
                            path + '/' + request.url + '.json',
                            {encoding: 'utf8'}));
                    } catch (error) { mode = 'fail'; status = 'error'; }

                    for (jndex = 0; jndex < request.cbs.length;
                         ++jndex) {
                        callback = request.cbs[jndex];
                        if (!callback.which || callback.which === mode)
                            callback.fn(data, status, null);
                    }
                }
            }
        }
    };
    grimoire.loadAjax(fjax, tomes, function() {}).execute();

    for (tome_name in grimoire.tomes) {
        var tome = grimoire.tomes[tome_name];
        var index, character, race;

        if (tome.races && Object.keys(tome.races).length) {
            console.log('Races: ' + tome_name);
            for (index in tome.races) {
                race = tome.races[index];
                if (race.player)
                    console.log('  ' + index);
            }
        }

        if (tome.characters && tome.characters.length) {
            console.log('Characters: ' + tome_name);
            for (index = 0; index < tome.characters.length; ++index) {
                character = tome.characters[index];
                console.log('  ' + character.fname + ' ' +
                            character.lname);
            }
        }
    }
    process.exit(result);
}
