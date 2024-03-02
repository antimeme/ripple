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

Before attempting to build be sure to install dependencies.  Ripple
attempts to be robust in the face of missing dependencies, which
means it should be possible to build any outputs for which all
dependencies are present.  It's usually safe to leave out anything
not desired.  This is an attempt to capture everything:

  - Autotools: libtool autoconf automake make
  - C Development: gcc gdb valgrind
    + SDL: libsdl2{,-gfx,-ttf,-image}-dev
  - Python Development: python2 (code needs updating)
  - Java Development: default-jdk
    + Servlets: gradle jetty9 tomcat10
  - JavaScript Development: nodejs npm emscripten
  - Rust Development: rustc cargo

If you've checked ripple out of a source repository (such as git)
execute `./bootstrap` to begin the build process.  If you've
downloaded this package as a tar file run `./configure` instead.
Either way, the next step is to run `make` to build compiled
components.  Executing `make check` will run some tests to confirm
that things work correctly on your platform.  Use `sudo make install`
to make the library available to everyone on the system.

Ripple can be assembled into an RPM package for distributions which
support them.  A `ripple.spec` file is included in the tar file so
commands like `rpmbuild -ta ripple-$VERSION.tar.gz` should work.  The
spec file uses a reasonable build root so it should be possible to
construct an RPM without root privileges.  (Building an RPM is a good
overall test because DESTDIR and BUILDROOT stress assumptions about
file locations.)

Ripple can also be assembled into Debian packages using the
`ripple.dpkg` script, but this script is currently experimental and
isn't as full featured as the RPM spec file.

## Debian

Debian is community driven and free.  There are straightforward
procedures for upgrading.  These things make it an excelleng choice
for most purposes.

#### Upgrade to Next Release

  - \# for file in /etc/apt/sources.list /etc/apt/sources.list.d/*; do
        sed s,\b$old\b,$new,g $file > $file.edited
        mv $file.edited $file
      done
  - \# for target in clean update upgrade full-upgrade autoremove; do \
        apt-get $target; done

#### Package Utilities

  - \# apt update && apt upgrade -y
  - $ apt list # list installed packages
  - $ apt list $term # list packages that match a search term
  - $ dpkg -L $package # list files owned by package
  - $ dpkg -S /path/to/file # find package that owns a file
  - \# apt remove $package # remove an installed package

#### Useful Packages

  - \# apt install -y emacs curl \
           build-essential gdb valgrind git \
           autoconf automake libtool \
           libsdl2{,-gfx,-ttf,-image}-dev \
           nodejs npm emscripten \
           default-jdk gradle
  - \# apt install -y apache2 jetty9 tomcat10

## RedHat Enterprise Linux

RedHat Enterprise Linux is reasonably stable and popular among
corporations, making it important to keep up with.  RockyLinux is a
good choice for a compatible distribution without licensing fees and
other encumberance.

#### Package Utilities

  - \# dnf update -y
  - $ rpm -qa # list installed packages
  - $ rpm -q $term # list packages that match a search term
  - $ rpm -ql $package # list files owned by package
  - $ rpm -qf /path/to/file # find package that owns a file
  - \# rpm -e $package # remove an installed package

#### Useful Packages

  - \# dnf config-manager --set-enabled crb
  - \# dnf install epel-release
  - \# dnf groupinstall 'Development Tools'
  - \# dnf install -y emacs curl \
           gcc make gdb valgrind git \
           autoconf automake libtool \
           SDL2{,_gfx,_ttf,_image}-devel \
           nodejs npm emscripten \
           java-latest-openjdk gradle
  - \# dnf install -y httpd jetty tomcat

## MSYS2

MSYS2 is easy to install on Microsoft Windows, giving that platform
essential tools that make it nearly tolerable.  The package manager is
from Arch Linux so the instructions below may be applicable there.

#### Package Utilities

  - $ pacman --noconfirm -Su
  - $ pacman -Q # list installed packages
  - $ pacman -Qs $term # list packages that match a search term
  - $ pacman -Ql $package # list files owned by package
  - $ pacman -Qo /path/to/file # find package that owns a file
  - $ pacman -R $package # remove an installed package

#### Useful Packages

  - $ pacman --noconfirm -S \
             mingw-w64-x86_64-emacs curl \
             gcc make git \
             autoconf automake libtool \
             mingw-w64-x86_64-toolchain \
             mingw-w64-x86_64-SDL2{,_gfx,_ttf,_image}

## License

Copyright (C) 2006-2024 by Jeff Gold.

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
