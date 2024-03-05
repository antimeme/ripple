#! /usr/bin/env node
// Copyright (C) 2019-2023 by Jeff Gold.
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
//
// HTTPS Web Server using Node.js
(function() {
    "use strict";
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    let port = 8443;

    /**
     * Santize a URL to prevent attacks. */
    function urlify(url) {
        let result = [], index, pops = 0;
        let s = url.replace(/[^\/a-zA-Z0-9._-]/g, '').split('/');
        for (index = 0; index < s.length; ++index) {
            if (s[index] === '.')
                continue;
            else if (s[index] === '..')
                result.pop();
            else result.push(s[index]);
        }
        return result.join('/');
    };

    /**
     * Collect common name from peer certificate if possible */
    function getPeerCN(request) {
        let result = undefined;
        if (request.socket && request.socket.getPeerCertificate) {
            const chain = request.socket.getPeerCertificate(true);

            // chain.raw is certificate data
            // chain.pubkey is public key
            if (chain.subject)
                result = chain.subject.CN;
        }
        return result;
    }

    /**
     * Create a consistent log message */
    function report(url, method, code, peerCN) {
        const date = new Date().toISOString();
        const peer = peerCN ? `peerCN:${peerCN}` : "";
        if (isNaN(code))
            code = "...";
        console.log(`[${date}] ${method} ${code} ${url} ${peer}`);
    }

    const reasons = {
        200: "OK",
        301: "Moved Permanently",
        307: "Temporary Redirect",
        400: "Bad Request",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        418: "I'm a Teapot",
        500: "Internal Server Error"
    }

    https.createServer({
        key: fs.readFileSync('server-key.pem'),
        cert: fs.readFileSync('server-chain.pem'),
        ca: fs.readFileSync('ca-cert.pem'),
        requestCert: true, rejectUnauthorized: false,
        minVersion: "TLSv1.3"
    }, (request, response) => {
        const url = urlify(request.url);
        const method = request.method.toUpperCase();
        const peerCN = getPeerCN(request);

        report(url, method, undefined, peerCN);
        response.setHeader("CacheControl", "no-cache, no-store");

        function serveError(code) {
            // :TODO: serve error pages if available?
            // :TODO: support additional error information?
            const reason = reasons[code] || "Unknown Reason";
            response.writeHead(code, {
                "Content-Type": "text/html"});
            response.end([
                "<!DOCTYPE html>",
                `<title>Error: ${code} ${reason}</title>`,
                `<h1>Error: ${code} ${reason}</h1>`].join("\r\n"));
            report(url, method, code, peerCN);
        }

        if (method === "GET") {
            // Server implemented services
            if (url === "/time") {
                response.writeHead(200, {
                    "Context-Type": "text/plain",
                    "Access-Control-Allow-Origin":
                    "https://localhost"});
                response.end(new Date().toString());
                report(url, method, 200, peerCN);
            } else fs.readFile(path.join(".", url), function (err, data) {
                if (err) {
                    if (err.code === "EISDIR") {
                        const rurl = url + (
                            url.endsWith("/") ?
                                "index.html" : "/index.html");
                        response.writeHead(307, {"Location": rurl});
                        response.end();
                        report(url, method, 307, peerCN);
                    } else if (err.code === "ENOENT")
                        serveError(404);
                    else if (err.code === "EACCES")
                        serveError(403);
                    else serveError(500);
                    return;
                }

                var ctype = "text/plain";
                var tmap = {
                    "html": "text/html",
                    "css":  "text/css",
                    "png":  "image/png",
                    "jpeg": "image/jpeg",
                    "jpg":  "image/jpeg",
                    "js":   "application/javascript",
                    "mjs":  "application/javascript",
                };
                var match = url.match(/\.([^.]*)$/);
                if (match && match[1] in tmap)
                    ctype = tmap[match[1]];
                response.writeHead(200, {
                    "Content-Type": ctype});
                response.end(data);
                report(url, method, 200, peerCN);
            });
        } else if (method === "POST") {
            serveError(418);
        } else serveError(405);
    }).on("clientError", (err, socket) => {
        // :TODO: incorporate err reason into report
        report("UNKNOWN", "ERROR", 400);
        if (err.code != "ECONNRESET" && socket.writable)
            socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    }).listen(port);
    report("https://localhost:" + port + "/", "START");
})();
