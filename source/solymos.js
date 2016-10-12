// Solymos
// Copyright (C) 2013 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
// A framework for building web applications.

(function(solymos) {
    'use strict';
    solymos.element = function(name, attrs) {
        return {
            name: name,
            attrs: attrs,
            contents: [],
            push: function() {},
            toString: function() {},
            emit: function() {},
        };
    };

    solymos.comment = function() {};
    solymos.iecomment = function() {};
    solymos.form = function() {};
    solymos.link = function() {};
    solymos.request = function() {};
    solymos.response = function() {};
})(typeof exports === 'undefined' ? window['solymos'] = {} : exports);

// Library routines that apply only to Node.js applications
if (typeof require !== 'undefined') (function(solymos) {
    'use strict';
    var fs    = require('fs');
    var path  = require('path');
    var http  = require('http');
    var https = require('https');
    var url   = require('url');
    var querystring = require('querystring');

    solymos.sanitizeURL = function(target, index) {
        var result = {};
        var segments = [], ii, current;
        var urlObj = url.parse(target, true);
        var s = querystring.unescape(urlObj.pathname).split('/');
        for (ii = 0; ii < s.length; ++ii) {
            current = s[ii].trim();
            if (!current || current === '.')
                continue;
            else if (current === '..')
                segments.pop();
            else segments.push(current);
        }
        if (!segments.length && index)
            segments.push(index);
        result.path = segments.join('/');
        segments.unshift('.');
        result.fileName = segments.join(path.sep);
        return result;
    };

    var negotiateAccept = function(accept) {
        var ordered = [], unordered = {};
        var ii, entry, mtype, qvalue, quality = '1';
        var entries = accept ? accept.split(',') : [];

        for (ii in entries) {
            entry = entries[ii].split(';');
            mtype = entry[0];
            if (entry.length > 1) {
                qvalue = entry[1].split('=');
                if (qvalue.length > 1)
                    qvalue = parseFloat(qvalue[1]);
                if (!isNaN(qvalue))
                    quality = qvalue.toFixed(6).replace(/\.?0*$/,'');
            }

            if (!unordered[quality])
                unordered[quality] = [];
            unordered[quality].push(mtype.trim());
        }

        Object.keys(unordered).sort(function(a, b) {
            return parseFloat(b) - parseFloat(a);
        }).forEach(function(key) { ordered.push(unordered[key]); });
        return {
            outstanding: 0, done: false,
            stages: ordered,
            start: function(server, fileName, response) {
                var extensions = {};
                var stage = this.stages.shift();
                var self = this;

                if (stage) {
                    stage.forEach(function(entry) {
                        if (entry === 'text/html') {
                            extensions['html'] = true;
                        } else if (entry === 'application/xhtml+xml') {
                            extensions['xhtml'] = true;
                        } else if (entry === 'application/json') {
                            extensions['js'] = true;
                        } else if (entry === 'text/javascript') {
                            extensions['json'] = true;
                        } else if (entry === '*/*') {
                            extensions['xhtml'] = true;
                            extensions['html']  = true;
                            extensions['js']    = true;
                            extensions['json']  = true;
                        } else console.log("UNCERTAIN:", entry);
                    });
                } else return server.errorPage(response, 404, fileName);

                if (Object.keys(extensions).length === 0)
                    return server.errorPage(response, 500, fileName);
                Object.keys(extensions).forEach(function(ext) {
                    ++self.outstanding;
                    fs.readFile(fileName + '.' + ext, function(
                        err, data) {
                        if (self.done)
                            return;
                        if (!err) {
                            response.setHeader('Vary', 'accept');
                            server.serveData(
                                err, data, fileName, response, ext);
                            self.done = true;
                        } else if (--self.outstanding <= 0) {
                            self.start(server, fileName, response);
                        }
                    });
                });
            }
        };
    };

    var matchService = function(target, serviceName) {
        return (target.startsWith(serviceName) &&
                (target.length === serviceName.length ||
                 target[serviceName.length] === '/'));
    };

    var handleRequest = function(server, request, response) {
        var key, service = null, target = solymos.sanitizeURL(
            request.url, server.defaultPage);
        console.log(new Date().toISOString(),
                    'INFO: request', target.path);

        // Allow application to handle designated services
        Object.keys(server.services).forEach(
            function(key) {
                if (matchService(target.path, key))
                    service = server.services[target.path];
            });
        if (!service && server.defaultService &&
            matchService(target.path, path.basename(process.argv[1])))
            service = server.defaultService;
        if (service)
            return service(server, request, response, target.fileName);

        // Otherwise unrecognized URLs are treated as file paths
        fs.readFile(target.fileName, function (err, data) {
            var match;
            if (err && err.code === 'ENOENT' &&
                (match = request.url.match(/\/[^.]*/)))
                return negotiateAccept(
                    request.headers['accept']).start(
                        server, target.fileName, response);
            server.serveData(err, data, target.fileName, response);
        });
    };

    solymos.createServer = function(options) {
        return {
            defaultPage: ((options && options.defaultPage) ?
                          options.defaultPage : 'index.html'),
            serverName: ((options && options.serverName) ?
                         options.serverName : 'Solymos'),
            portHTTP: ((options && options.portHTTP) ?
                       options.portHTTP : 80),
            portHTTPS: ((options && options.portHTTPS) ?
                        options.portHTTPS : 443),
            defaultService: options && options.defaultService,
            services: ((options && options.services) ?
                       options.services : {}),

            activate: function(options) {
                var server = this;
                var gateway = process.env.GATEWAY_INTERFACE;
                var iface, httpsOptions;
                if (gateway)
                    gateway = gateway.split('/');
                iface = ((gateway && gateway[0]) ?
                         gateway[0].toUpperCase() :
                         ((options && options.fallback) ?
                          null : 'HTTP'));

                if (iface === 'CGI') {
                    console.log('CGI'); // FIXME
                } else if (iface === 'HTTP') {
                    http.createServer(function(request, response) {
                        handleRequest(server, request, response);
                    }).listen(this.portHTTP);
                    console.log(this.serverName,
                                'HTTP server active on port',
                                this.portHTTP, '...');
                } else if (iface === 'HTTPS') {
                    const https = require('https');
                    httpsOptions = {
                        key: fs.readFileSync('grimoire-key.pem'),
                        cert: fs.readFileSync('grimoire-cert.pem')
                    }; // FIXME

                    https.createServer(httpsOptions, function(
                        request, response) {
                        handleRequest(server, request, response);
                    }).listen(this.portHTTPS);
                    console.log(this.serverName,
                                'HTTPS server active on port',
                                this.portHTTPS, '...');
                } else if (iface) {
                    console.log(this.serverName,
                                'unknown interface:', iface);
                    iface = null;
                }
                return !!iface;
            },

            serveData: function(err, data, fileName, response, ext) {
                if (!err) {
                    var match, ctype = 'text/plain';
                    var tmap = {
                        'html':  'text/html',
                        'css':   'text/css',
                        'png':   'image/png',
                        'jpeg':  'image/jpeg',
                        'jpg':   'image/jpeg',
                        'js':    'text/javascript',
                        'json':  'application/json',
                        'xhtml': 'application/xhtml+xml',
                    };
                    if (!ext) {
                        match = fileName.match(/\.([^.]*)$/);
                        if (match && match[1] in tmap)
                            ctype = tmap[match[1]];
                    } else if (ext in tmap)
                        ctype = tmap[ext];
                    response.setHeader('Content-Type', ctype);
                    response.writeHead(200);
                    response.end(data);
                    console.log(new Date().toISOString(),
                                'INFO: sending', fileName +
                                (ext ? ('[.' + ext + ']') : ''),
                                data.length, 'bytes');
                } else if (err.code === 'ENOENT')
                    this.errorPage(response, 404, fileName);
                else if (err.code === 'EACCES')
                    this.errorPage(response, 403, fileName);
                else this.errorPage(response, 500, fileName);
            },

            errorPage: function(response, code, fileName) {
                fs.readFile(
                    'errorpages/page' + code + '.html',
                    function(err, data) {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                // TODO: error explanation strings
                                response.setHeader(
                                    'Content-Type', 'text/html');
                                response.writeHeader(code);
                                response.end(
                                    '<h1>HTTP ERROR ' + code + '</h1>');
                                console.log(
                                    new Date().toISOString(),
                                    'ERROR:', code, fileName, '(NOPAGE)');
                            } else {
                                response.setHeader(
                                    'Content-Type', 'text/html');
                                response.writeHeader(500);
                                response.end(err.toString());
                                console.log(
                                    new Date().toISOString(),
                                    'ERROR: 500', fileName, err.code);
                            }
                            return;
                        }
                        response.setHeader('Content-Type', 'text/html');
                        response.writeHeader(code);
                        response.end(data.toString().replace(
                            /:PATH:/g, fileName));
                        console.log(new Date().toISOString(),
                                    'ERROR:', code, fileName);
                    });
            }
        };
    };
})(typeof exports === 'undefined' ? window['solymos'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var http = require('http');
    var solymos = exports;
    var server = solymos.createServer(
        { portHTTP: 8080, portHTTPS: 8443 });

    server.activate();
}
