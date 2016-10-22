// Solymos
// Copyright (C) 2013-2016 by Jeff Gold.
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

    /**
     * Process a URL from an untrusted source.  Consolidates path
     * components and ensures that the path does not move above the
     * current directory (which might allow accesss to unexpected
     * files). */
    solymos.sanitizeURL = function(target, index, dir) {
        var result = {};
        var components = [], ii, current;
        var urlObj = url.parse(target, true);
        var s = querystring.unescape(
            urlObj.pathname.replace(/\+/g, ' ')).split('/');

        for (ii = 0; ii < s.length; ++ii) {
            current = s[ii].trim();
            if (!current || current === '.')
                continue;
            else if (current === '..')
                components.pop();
            else components.push(current);
        }

        if (!components.length && index)
            components.push(index);
        result.path = components.join('/');
        components.unshift(dir || '.');
        result.fileName = components.join(path.sep);
        return result;
    };

    /**
     * Choses a file by adding an extension according to which MIME
     * types are preferred. */
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
            wildcard: false,
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
                        } else if (entry === 'application/xml') {
                            extensions['xml'] = true;
                        } else if (entry === 'text/css') {
                            extensions['css'] = true;
                        } else if (entry === 'application/json') {
                            extensions['json'] = true;
                        } else if (entry === 'text/javascript') {
                            extensions['js'] = true;
                        } else if (entry === 'image/jpeg') {
                            extensions['jpg'] = true;
                            extensions['jpeg'] = true;
                        } else if (entry === 'image/gif') {
                            extensions['gif'] = true;
                        } else if (entry === 'image/png') {
                            extensions['png'] = true;
                        } else if (entry === 'image/*') {
                            extensions['jpg'] = true;
                            extensions['jpeg'] = true;
                            extensions['gif'] = true;
                            extensions['png'] = true;
                        } else if (entry === '*/*') {
                            self.wildcard = true;
                            extensions['html']  = true;
                            extensions['xhtml'] = true;
                            extensions['xml']    = true;
                            extensions['css']   = true;
                            extensions['json']  = true;
                            extensions['js']    = true;
                            extensions['jpg']   = true;
                            extensions['jpeg']  = true;
                            extensions['gif']   = true;
                            extensions['png']   = true;
                        } else console.log("UNCERTAIN:", entry);
                    });
                } else return server.errorPage(
                    response, this.wildcard ? 404 : 406, fileName);

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
            request.url, server.defaultPage, server.directory);
        console.log(new Date().toISOString(),
                    'INFO: request', target.path);

        // Allow application to handle designated services
        Object.keys(server.services).forEach(
            function(key) {
                if (matchService(target.path, key))
                    service = server.services[target.path];
            });
        if (!service && server.defaultService && matchService(
            target.path, path.basename(process.argv[1])))
            service = server.defaultService;
        if (service)
            return service.call(server, target.fileName,
                                request, response);

        // Serving files can be disabled using false or null
        if (server.directory === false || server.directory === null)
            return server.errorPage(response, 404, target.fileName);

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
            certificate: ((options && options.certificate) ?
                          options.certificate : 'certificate.pem'),
            privteKey: ((options && options.privateKey) ?
                        options.privateKey : 'private-key.pem'),
            directory: ((options && options.directory) ?
                        options.directory : undefined),
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
                    console.log('CGI'); // FIXME: implement!
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
                        key: fs.readFileSync(this.privateKey),
                        cert: fs.readFileSync(this.certificate)
                    }; // FIXME: support automatic certificates?

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
                        'gif':   'image/gif',
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
                else this.errorPage(response, 500, fileName, err.code);
            },

            errorPage: function(response, code, fileName, message) {
                var server = this;
                var explainError = function(err) {
                    var errtable = {
                        400: 'Bad Request',
                        401: 'Unauthorized',
                        403: 'Forbidden',
                        404: 'Not Found',
                        406: 'Not Acceptable',
                        500: 'Internal Server Error',
                    };
                    var description = (
                        errtable[code] || 'No Description Available');
                    var data = [
                        '<!doctype html>', '<meta charset="utf-8">',
                        '<h1>HTTP Error ' + code + ': ' +
                        description + '</h1>',
                        (message ? '<p>' + message + '</p>' : ''),
                        '<p>Attempt to access error page got ' +
                        err.code + '</p>',
                        '<hr />', '<p>' + server.serverName + '</p>'];
                    response.setHeader('Content-Type', 'text/html');
                    response.writeHeader(code);
                    response.end(data.join('\r\n'));
                    console.log(new Date().toISOString(),
                                'ERROR:', code, fileName,
                                '(errpage: ' + err.code + ')');
                }

                fs.readFile(
                    'errorpages/page' + code + '.html',
                    function(err, data) {
                        if (err)
                            return explainError(err);
                        response.setHeader(
                            'Content-Type', 'text/html');
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
