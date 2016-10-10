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
// A web framework in which elements are constructed as objects so that
// quoting can happen automatically.

(function(solymos) {
    var fs   = require('fs');
    var path = require('path');
    var url  = require('url');
    var querystring = require('querystring');

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


    solymos.sanitizeURL = function(target, index) {
        var result = [], ii, current;
        var urlObj = url.parse(target, true);
        var s = querystring.unescape(urlObj.pathname).split('/');
        for (ii = 0; ii < s.length; ++ii) {
            current = s[ii].trim();
            if (!current || current === '.')
                continue;
            else if (current === '..')
                result.pop();
            else result.push(current);
        }
        if (!result.length && index)
            result.push(index);
        result.unshift('.');
        return result.join(path.sep);
    };

    var errorPage = function(response, code, target) {
        fs.readFile(
            'errorpages/page' + code + '.html',
            function(err, data) {
                if (err) {
                    if (err.code === 'ENOENT') {
                        // TODO: put error explanation strings in
                        response.setHeader('Content-Type', 'text/html');
                        response.writeHeader(code);
                        response.end(
                            '<h1>HTTP ERROR ' + code + '</h1>');
                    } else {
                        response.setHeader('Content-Type', 'text/html');
                        response.writeHeader(500);
                        response.end(err.toString());
                    }
                    return;
                }
                response.setHeader('Content-Type', 'text/html');
                response.writeHeader(code);
                response.end(data.toString().replace(
                        /:PATH:/g, target));
            });
    };

    var serveFile = function(response, target, ext, err, data) {
        if (!err) {
            var ctype = 'text/plain';
            var tmap = {
                'html': 'text/html',
                'css':  'text/css',
                'png':  'image/png',
                'jpeg': 'image/jpeg',
                'jpg':  'image/jpeg',
                'js':   'text/javascript',
                'json': 'application/json',
            };
            if (ext)
                ctype = tmap[ext];
            else {
                match = target.match(/\.([^.]*)$/);
                if (match && match[1] in tmap)
                    ctype = tmap[match[1]];
            }
            response.setHeader('Content-Type', ctype);
            response.writeHead(200);
            response.end(data);
            console.log('served', target, data.length);
        } else if (err.code === 'ENOENT')
            errorPage(response, 404, target);
        else if (err.code === 'EACCES')
            errorPage(response, 403, target);
        else errorPage(response, 500, target);
    };

    var parseAccept = function(accept) {
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
            start: function(response, target) {
                var extensions = {};
                var stage = this.stages.shift();
                var self = this;

                if (stage) {
                    stage.forEach(function(entry) {
                        if (entry === 'application/json') {
                            extensions['js'] = true;
                        } else if (entry === 'text/javascript') {
                            extensions['json'] = true;
                        } else if (entry === '*/*') {
                            extensions['html'] = true;
                            extensions['js'] = true;
                            extensions['json'] = true;
                        } else console.log("UNCERTAIN:", entry);
                    });
                } else return errorPage(response, 404, target);

                if (Object.keys(extensions).length === 0)
                    return errorPage(response, 500, target);
                Object.keys(extensions).forEach(function(ext) {
                    ++self.outstanding;
                    fs.readFile(target + '.' + ext, function(
                        err, data) {
                        if (self.done)
                            return;
                        if (!err) {
                            serveFile(response, target, ext, err, data);
                            self.done = true;
                        } else if (--self.outstanding <= 0) {
                            self.start(response, target);
                        }
                    });
                });
            }
        };
    };

    solymos.createHandler = function(options) {
        return {
            handle: function(request, response) {
                var key, target = solymos.sanitizeURL(
                    request.url, 'grimoire.html');
                console.log('===', target);

                // FIXME: create escape hatch for service urls

                // Otherwise unrecognized URLs are treated as file paths
                var fetchFile = function (err, data) {
                    var match;
                    if (err && err.code === 'ENOENT' &&
                        (match = request.url.match(/\/[^.]*/)))
                        return parseAccept(
                            request.headers['accept']).start(
                                response, target);
                    serveFile(response, target, null, err, data);
                };
                fs.readFile(target, fetchFile);
            }
        };
    };

})(typeof exports === 'undefined' ? window['solymos'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {

}
