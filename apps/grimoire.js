// grimoire.js
// Character management system for role playing games.

// === Character Actions
//
// This is an attempt to summarize the actions a character can take in
// the context of a game.  The goal is to focus thinking for user
// interface design.  A character doesn't make too much sense without
// a world to give some context.  What can a character do?
// Unfortunately the answer is, "it depends."  There are many
// different kinds of worlds the character can inhabit.  For example,
// the world may be a two dimensional grid or it may be a free form
// three dimensional world.
//
// Ideally Grimoire would support a wide variety of different kinds of
// worlds.  A single character could transition seamlessly between
// them.  Some details will be different.  For example in a three
// dimensional world there are X, Y and Z coordinates.  In a two
// dimensional grid there might only be a row and a column.  This must
// be abstracted somehow but the interface is critical.
//
// That's because we need to give a player the ability to take actions
// using the character.  Actions have to be modal in some sense.  In a
// real-time game most actions are always available but time is always
// advancing.  A character in the middle of combat in a turn based
// game must wait until his or her turn arrives.  However, even in a
// turn based game the character may have long stretches between
// adventures in which time is abundant for things like shopping.
//
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
//
// These are actions that make sense in a particular moment.  However,
// there are times when things must get more abstract.  In particular
// this is true during character creation or other cases when long
// stretches of time are passing.  In this abstract time, actions
// include things such as:
//
// Actions:
// - Training: improving skills using experience points?
// - Shopping: buying and selling equipment
//
// When shopping, the character spends currency such as coins.  When
// training the currency instead is time.  So what if at any moment
// the character is connected to zero or more shops and has zero or
// more hours of down time.  When in combat, there are no shops and
// no down time to be had.  Only combat actions can be taken and then
// only if the character has action points of some kind.  So really
// there are three kinds of currencies, some combination of which
// may be spendable.
//
// So every character has a current context.  (This current context
// needs a better name!)  Each context has zero or more shops associated
// with it.  A shop has an inventory and a cash balance, possibly made
// up of different types of coins.  This same shop may be accessible in
// a real time or even turn based mode, but if it's attached to the
// context a character is in then he or she can conduct an unlimited
// number of transactions.
//
// Likewise the context has a certain amount of down time, which may
// be unlimited.  Each character spends the alloted down time
// independently and can't do more once it's used up.  Visiting a shop
// may cost some down time?  This could be configurable?  A character
// can also train to improve skills and spend experience in down time.
//
// A context might also offer employment possibilities.  These are
// ways for the character to earn money at the expense of down time.
// Another possiblity is background trees, which may be mandatory.
// The player must navigate these to make the character ready for the
// next game session, for example.  Mostly these would be used for
// character creation where they would add various ancillary skills.
// But they could be used to deal with long stretches of time between
// adventures as well.  For instance, a year passes.  What does the
// character do?

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
