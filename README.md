Copyright (C) 2006-2014 by Jeff Gold.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at
your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

### Ripple

Ripple is a collection of tools for simplifying programming.  This
file documentats the structure of this repository and is intended for
experienced software developers.

GNU autotools are used to assemble a C shared library.  Header files
are kept in `include/ripple` and source files in the `source`
directory.  If you've checked ripple out of a source repository (such
as git) execute `./bootstrap` to begin.  If you've downloaded this
package as a tar file run `./configure` instead.  Either way, the next
step is to run `make` to build compiled components.  To make the
library available system wide use `sudo make install`.

Ripple can be assembled into an RPM package for distributions which
support that.  A `ripple.spec` file is included in the tar file so
commands like `rpmbuild -ta ripple-$VERSION.tar.gz` should work.  The
spec file uses a reasonable build root so it should be possible to
construct an RPM without root privileges.  (Building an RPM is a good
overall test because DESTDIR and BUILDROOT stress assumptions about
file locations.)

Ripple can also be assembled into Debian packages using the
`ripple.dpkg` script, but this script is currently experimental and
isn't as full featured as the RPM spec file.  Suggestions and patches
from knowledgable Debian developers would be welcome.
