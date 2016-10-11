#!/usr/bin/env node
// grimoire.cgi
// Character management system for role playing games.

if ((typeof require !== 'undefined') && (require.main === module)) {
    var fs = require('fs');
    var path = require('path');
    var url = require('url');
    var ripple = require('./ripple/ripple');
    var grimoire = require('./grimoire');
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

    var service = function(request, response) {
    };

    grimoire.loadAJAX(ripple.fakejax, tomes, function() {
        const fs = require('fs');
        const solymos = require('./ripple/solymos');
        var server = solymos.createServer({
            serverName: 'Grimoire',
            portHTTP: 8080, portHTTPS: 8443,
            defaultPage: 'grimoire.html',
            privateKey: 'grimoire-key.pem',
            certificate: 'grimoire-cert.pem'});

        if (!server.activate({fallback: true})) {

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
                    for (index = 0; index < tome.characters.length;
                         ++index) {
                        character = tome.characters[index];
                        console.log('  ' + character.fname + ' ' +
                                    character.lname);
                    }
                }
            }
        }
    }).sync();
}