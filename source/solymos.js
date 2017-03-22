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

    // Adapted from http://stackoverflow.com/a/9756789
    // Replace characters that would be invalid in an HTML or XML
    // attribute value.
    solymos.quoteAttr = function(s, preserveCR) {
        preserveCR = preserveCR ? '&#13;' : '\n';
        return ('' + s) /* Force conversion to string. */
            .replace(/&/g, '&amp;') /* MUST be first */
            .replace(/'/g, '&apos;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\r\n/g, preserveCR)
            .replace(/[\r\n]/g, preserveCR);
    }

    // Represents an HTML or XML element.  Use the emit method
    // to create a formatted string.  Use the toString method to
    // create a string with minimal white space.
    solymos.element = {
        create: function(name, attrs) {
            var result = Object.create(this);
            result.name = name;
            result.attrs = attrs ? attrs : {};
            result.contents = [];
            return result;
        },
        setAttr: function(attr, value) {
            this.attrs[attr] = value;
            return this;
        },
        push: function(value) {
            this.contents.push(value);
            return this;
        },
        add: function(value) {
            this.contents.push(value);
            return value;
        },
        toString: function() {
            return this.emit().replace(/\s+/g, ' ');
        },
        emit: function(indent) {
            var result = [];
            var self = this;
            var first = true;
            var attrval = '';
            var pos;

            if (!indent)
                indent = '';
            pos = indent.length + self.name.length + 1;

            Object.keys(self.attrs).sort().forEach(function(attr) {
                var value = solymos.quoteAttr(self.attrs[attr]);
                if (!first && pos + value.length + 1 > 72) {
                    attrval += '\n' + indent + ' ' +
                               self.name.replace(/./g, ' ');
                    pos = indent.length + self.name.length + 1;
                }
                first = false;
                attrval += ' ' + attr + '="' + value + '"';
                pos += attr.length + value.length + 4;
            });
            if (self.contents) {
                result.push(indent + '<' + self.name +
                            attrval + '>');
                self.contents.forEach(function(thing) {
                    if (solymos.element.isPrototypeOf(thing))
                        result.push(thing.emit(indent + '  '));
                    else result.push(indent + thing); // FIXME wrap
                });
                result.push(indent + '</' + self.name + '>');
            } else result.push(indent + '<' + self.name +
                               attrval + ' />');
            return result.join('\n' + indent);
        }
    };

    solymos.comment = function() {};
    solymos.iecomment = function() {};
    solymos.form = function() {};
    solymos.link = function() {};
    solymos.request = function() {};
    solymos.response = function() {};
})(typeof exports === 'undefined' ? window['solymos'] = {} : exports);

// Library routines that apply only to Node.js applications
if (typeof exports !== 'undefined') (function(solymos) {
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
                        } else server.warning("UNCERTAIN:", entry);
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
                                data, fileName, response, ext);
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
        server.info('request', target.path);

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
            return service.call(server, target, request, response);

        // Serving files can be disabled using false or null
        // but undefined means use the current directory
        if (server.directory === false || server.directory === null)
            return server.errorPage(response, 404, target.fileName);

        // Otherwise unrecognized URLs are treated as file paths
        fs.readFile(target.fileName, function (err, data) {
            var match;
            if (err) {
                if (err.code === 'ENOENT') {
                    if ((match = request.url.match(/\/[^.]*/)))
                        return negotiateAccept(
                            request.headers['accept']).start(
                                server, target.fileName, response);
                    else return server.errorPage(
                        response, 404, fileName);
                } else if (err.code === 'EACCES')
                    return server.errorPage(response, 403, fileName);
                return server.errorPage(
                    response, 500, fileName, err.code);
            } else server.serveData(data, target.fileName, response);
        });
    };

    var serveCGI = function(server) {
        var request  = {
            url: process.env.REQUEST_URI || '/',
            headers: {
                'host': process.env.HTTP_HOST,
                'user-agent': process.env.HTTP_USER_AGENT,
                'accept': process.env.HTTP_ACCEPT,
                'accept-charset': process.env.HTTP_ACCEPT_CHARSET,
                'accept-encoding': process.env.HTTP_ACCEPT_ENCODING,
                'accept-language': process.env.HTTP_ACCEPT_LANGUAGE,
            }
        };
        var response = {
            __headers: {},
            setHeader: function(name, value) {
                this.__headers[name] = value;
            },
            writeHead: function(code) {
                var self = this;
                if (code !== 200)
                    console.log('HTTP/1.0', code, 'FIXME'); // FIXME
                if (!this.__headers['Content-Type']) // FIXME
                    this.__headers['Content-Type'] = 'text/html';
                Object.keys(this.__headers).forEach(function (header) {
                    console.log(header + ':', self.__headers[header]);
                });
                console.log();
            },
            end: function(data) {
                console.log(data); // FIXME
            }
        };
        var target = solymos.sanitizeURL(
            request.url, this.defaultPage, this.directory);

        this.defaultService(target, request, response);
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
                    if (server.defaultService)
                        serveCGI.call(server);
                    else {
                        console.log('content-type: text/plain');
                        console.log();
                        console.log('no services defined');
                    }
                } else if (iface === 'HTTP') {
                    http.createServer(function(request, response) {
                        handleRequest(server, request, response);
                    }).listen(server.portHTTP);
                    server.info(server.serverName,
                                'HTTP server active on port',
                                server.portHTTP, '...');
                } else if (iface === 'HTTPS') {
                    httpsOptions = {
                        key: fs.readFileSync(server.privateKey),
                        cert: fs.readFileSync(server.certificate)
                    }; // FIXME: support automatic certificates?

                    https.createServer(httpsOptions, function(
                        request, response) {
                        handleRequest(server, request, response);
                    }).listen(server.portHTTPS);
                    server.info(server.serverName,
                                'HTTPS server active on port',
                                server.portHTTPS, '...');
                } else if (iface) {
                    server.error('unknown interface:', iface);
                    iface = null;
                }
                return !!iface;
            },

            __log: function(level, message) {
                message.unshift(level);
                message.unshift(new Date().toISOString());
                console.error.apply(console, message);
            },
            info: function() {
                this.__log('INFO', Array.prototye.slice.call(
                    arguments));
            },

            warning: function() {
                this.__log('WARNING', Array.prototye.slice.call(
                    arguments));
            },

            error: function() {
                this.__log('ERROR', Array.prototye.slice.call(
                    arguments));
            },

            serveData: function(data, fileName, response, ext) {
                var match, ctype = 'text/html';
                var tmap = {
                    'txt':   'text/plain',
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
                response.setHeader(
                    'Content-Type', ctype || 'text/html');
                response.writeHead(200);
                response.end(data);
                this.info('sending', fileName +
                           (ext ? ('[.' + ext + ']') : ''),
                          data.length, 'bytes');
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
                    server.error(code, fileName,
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
                        server.error(code, fileName);
                    });
            }
        };
    };
})(exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var http = require('http');
    var solymos = exports;
    var server = solymos.createServer(
        { portHTTP: 8080, portHTTPS: 8443 });

    server.activate();
}
