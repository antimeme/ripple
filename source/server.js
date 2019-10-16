#! /usr/bin/env node
// Quick-and-dirty web server using Node.js
(function() {
    'use strict';

    var sys = require('sys');
    var https = require('https');
    var fs = require('fs');
    var path = require('path');
    var port = 8080;

    // Responds to normal requests with control over headers
    var respond = function(response, code, headers, data) {
        response.writeHeader(code, headers);
        response.write(data);
        response.end();
    };

    // Responds to error conditions using a file template
    var errorpage = function(response, code, url) {
        fs.readFile('errorpages/page' + code + '.html',
                    function(err, data) {
                        if (err)
                            throw err;
                        respond(response, code, {
                            'Content-Type': 'text/html'},
                                data.toString()
                                .replace(/:PATH:/g, url)); });
    };

    // Wrapper around HTTP response function that handles exceptions
    var careful = function(fn) {
        return function(request, response) {
            try {
                fn.apply(this, arguments);
            } catch (ex) {
                respond(response, 500, {'Content-Type': 'text/html'},
                        ['<!DOCTYPE html>',
                         '<title>Internal Error</title>',
                         '<h1>Internal Error</h1>',
                         '<p>Oops!  Something went wrong.</p>']
                        .join('\n'));
                console.log(ex);
            }
        };
    };

    // Santize a URL.  There are NPM packages which do this kind of
    // thing better but this is more fun and security stakes are low.
    var urlify = function(url) {
        var result = [], index, pops = 0;
        var s = url.replace(/[^\/a-zA-Z0-9._-]/g, '').split('/');
        for (index = 0; index < s.length; ++index) {
            if (s[index] === '.')
                continue;
            else if (s[index] === '..')
                result.pop();
            else result.push(s[index]);
        }
        return result.join('/');
    };

    https.createServer({
        key: fs.readFileSync('server-key.pem'),
        cert: fs.readFileSync('server-chain.pem'),
        ca: fs.readFileSync('ca-certs.pem'),
        requestCert: true, rejectUnauthorized: false
    }, careful(function(request, response) {
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
    })).listen(port);
    console.log('Server listening: https://localhost:' + port + '/');
})();
