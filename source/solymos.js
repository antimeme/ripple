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

(function(exports) {

    exports.element = function(name, attrs) {
        return {
            name: name,
            attrs: attrs,
            contents: [],
            push: function() {},
            toString: function() {},
            emit: function() {},
        };
    };

    exports.comment = function() {};
    exports.iecomment = function() {};
    exports.form = function() {};
    exports.link = function() {};
    exports.request = function() {};
    exports.response = function() {};
})(typeof exports === 'undefined' ? window['solymos'] = {} : exports);

if ((typeof require !== 'undefined') && (require.main === module)) {

}
