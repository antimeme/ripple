// history.js
// Copyright (C) 2022 by Jeff Gold.
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
(function(history) {
    'use strict';

    
})(typeof exports === 'undefined' ? this.history = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    var history = exports;
    var ripple = require("../../source/ripple.js");
    var fs = require("fs");

    fs.readFile("./history.json", "utf8", function(err, data) {
        if (err) {
            console.log(err);
        } else {
            var structure = JSON.parse(data);
            var ethics = Object.keys(
                structure.schema.types.ethics.options);
            ripple.shuffle(ethics);
            console.log(ethics.join(", "));
        }
    });
}
