#!/usr/bin/node
"use strict";
var sqlite3 = require('../node_modules/sqlite3').verbose();
var db = new sqlite3.Database('./factbook.db3');
var solymos = require('./ripple/solymos.js');
var element = solymos.element;

// Constructs an HTML form to create a new entry.
var createEntryForm = function() {
    // Create an action based on the script name.
    var uri = process.env.SCRIPT_NAME || '';
    var result = element.create('form', {
        method: 'GET' /* FIXME: POST! */,
        action: uri + '/create' })
                        .push(element.create('input', {
                            type: 'text',
                            name: 'name' }))
                        .push(element.create('textarea', {
                            name: 'p1', rows: 3, cols: 60 }))
                        .push(element.create('button').push('Create'));
    return result;
};

// Create a page and a function that returns it to the browser.
// We'll call this function later to complete the response.
var createPage = function() {
    return element.create('html')
                  .push(element.create('title').push('Factbook'))
                  .push(element.create('h1').push('Factbook'))
                  .push(createEntryForm());
}

// Return true iff the current script is being called by a web
// server expecting Common Gateway Interface (CGI) output.
var usingCGI = function() {
    var settings = process.env.GATEWAY_INTERFACE ?
                   process.env.GATEWAY_INTERFACE.split('/') : [];
    return (settings.length > 0) &&
           (settings[0].toUpperCase() === 'CGI');
};

if (usingCGI()) {
    var page = createPage();
    var respond = function() {
        console.log('Content-Type: text/html');
        console.log();
        console.log('<!DOCTYPE html>');
        console.log(page.emit());
    };

    db.serialize();
    db.run("CREATE TABLE IF NOT EXISTS entries (name TEXT, id INTEGER)");
    db.all("SELECT * FROM entries", function(err, rows) {
        if (err) throw err;
        if (!rows.length) {
            // Prepopulated data
        }
        var nentries = 0;
        var table = element.create('table')
                           .push(element.create('caption')
                                        .push('Entries'));

        db.each("SELECT name, rowid FROM entries", function(err, row) {
            if (err) throw err;
            table.push(element.create('tr')
                              .push(element.create('td')
                                           .push(row.name || 'MISSING'))
                              .push(element.create('td')
                                           .push(row.rowid || 'MISSING')));
        ++nentries;
        }, function(err, nrows) {
            if (nentries > 0)
                page.push(table);
            else page.push(element.create('p').push('No entries yet...'));
            if (process.env.PATH_INFO)
                page.push(element.create('p').push(
                    'Path: ', process.env.PATH_INFO));
            if (process.env.GATEWAY_INTERFACE)
                page.push(element.create('p').push(
                    'Gateway: ', process.env.GATEWAY_INTERFACE));
            respond();
            console.log(process.env);
        });
    });
} else {
    var https = require('http'); /* FIXME: https */
    var fs = require('fs');
    var path = require('path');
    var port = 8080;

    https.createServer(
        //{
        //key: fs.readFileSync('server-key.pem'),
        //cert: fs.readFileSync('server-chain.pem'),
        //ca: fs.readFileSync('ca-certs.pem'),
        //requestCert: true, rejectUnauthorized: false
        //},
        function(request, response) {
        var url = urlify(request.url);
        if (url === '/')
            url = '/index.html';

        // Server implemented services
        if (url === '/time') {
            return respond(response, 200, {
                "Context-Type": "text/plain",
                "Access-Control-Allow-Origin": "https://localhost"},
                           new Date().toString());
        }

        // Otherwise unrecognized URLs are treated as file paths
        fs.readFile(path.join('.', url), function (err, data) {
            if (err) {
                if (err.code === 'ENOENT')
                    return errorpage(response, 404, url);
                else if (err.code === 'EACCES')
                    return errorpage(response, 403, url);
                else throw err;
            }

            var ctype = 'text/plain';
            var tmap = {
                'html': 'text/html',
                'css':  'text/css',
                'png':  'image/png',
                'jpeg': 'image/jpeg',
                'jpg':  'image/jpeg',
            };
            var match = url.match(/\.([^.]*)$/);
            if (match && match[1] in tmap)
                ctype = tmap[match[1]];
            return respond(response, 200, {
                'Content-Type': ctype}, data);
        });
    }).listen(port);
    console.log('Server listening: https://localhost:' + port + '/');
}
