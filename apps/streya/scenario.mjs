// setting.mjs
// Copyright (C) 2023-2025 by Jeff Gold.
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
// A setting is an abstract colleciton of definitions that create the
// world where a game takes place.  This begins with items and item
// definitions but also includes characters and character races.  A
// fantasy setting might have orcs and elves while a science fiction
// setting might have androids and aliens.  The classes in this module
// are agnostic about the details but provide a framework for describing
// them.  JSON formatted data is provided to the Setting constructor
// in order to set everything up.
import Ripple from "../ripple/ripple.mjs";
import Camera from "../ripple/camera.mjs";

