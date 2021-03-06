Ripple is a collection of applications and libraries compiled over a
career in software development.  It's eclectic.  Start by having a
look at some of the web [apps](apps/).

The repository itself demonstrates some good practices and can be used
as a guide for other projects.  There are tools for simplifying
common programming tasks as well as reasonable settings for creating
assemblies.

GNU autotools are used to assemble a C shared library as well as a
Java JAR file suitable for use either as a library or direct execution
using the `-jar` option.  Source files for both C and Java are kept in
the `source` directory.  C header files are kept in the
`include/ripple` directory.  The [apps](apps/) directory contains web
applications and associated resources.

### Build

If you've checked ripple out of a source repository (such as git)
execute `./bootstrap` to begin the build process.  If you've
downloaded this package as a tar file run `./configure` instead.
Either way, the next step is to run `make` to build compiled
components.  Executing `make check` will run some tests to confirm
that things work correctly on your platform.  Use `sudo make install`
to make the library available to everyone on the system.

This project is sometimes tested using Cygin with MinGW.  The following
commands may create working Microsoft Windows executables:

    ./configure --host=x86_64-w64-mingw32
    make check

Ripple can be assembled into an RPM package for distributions which
support them.  A `ripple.spec` file is included in the tar file so
commands like `rpmbuild -ta ripple-$VERSION.tar.gz` should work.  The
spec file uses a reasonable build root so it should be possible to
construct an RPM without root privileges.  (Building an RPM is a good
overall test because DESTDIR and BUILDROOT stress assumptions about
file locations.)

Ripple can also be assembled into Debian packages using the
`ripple.dpkg` script, but this script is currently experimental and
isn't as full featured as the RPM spec file.  Suggestions and patches
from knowledgable Debian developers would be welcome.

### License

Copyright (C) 2006-2017 by Jeff Gold.

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
