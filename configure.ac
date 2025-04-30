dnl configure.ac
dnl Copyright (C) 2006-2025 by Jeff Gold.
dnl 
dnl This program is free software: you can redistribute it and/or
dnl modify it under the terms of the GNU General Public License as
dnl published by the Free Software Foundation, either version 3 of the
dnl License, or (at your option) any later version.
dnl
dnl This program is distributed in the hope that it will be useful, but
dnl WITHOUT ANY WARRANTY; without even the implied warranty of
dnl MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
dnl General Public License for more details.
dnl
dnl You should have received a copy of the GNU General Public License
dnl along with this program.  If not, see
dnl <http://www.gnu.org/licenses/>.
dnl 
dnl --------------------------------------------------------------------
dnl
dnl A collection of experiments in software development.
dnl
dnl To create a configure script the followng packages are needed:
dnl
dnl $ sudo apt install -y autoconf automake libtool pkgconf make gcc
dnl
dnl Some components are optional and can be built only when their
dnl dependencies are installed.
AC_INIT([ripple], [0.1.1], [Jeff Gold <ripple@antimeme.net>])
AC_CANONICAL_HOST
AC_CONFIG_SRCDIR([configure.ac])
AC_CONFIG_HEADERS([include/ripple/config.h])
AC_SUBST([LIBVERSION], [0:0])
AM_INIT_AUTOMAKE([subdir-objects])

AC_PROG_CC
LT_INIT
AC_PROG_MKDIR_P
AC_PROG_LN_S
AC_PATH_PROG([SUDO], [sudo], )

dnl MinGW can be used to compile Win32 programs on Unix platforms.
dnl We will need both the cross compiler and windres to build.
dnl In addition, --with-win32-vorbis=PATH can be used to provide a
dnl cross-compiled library for playing compressed sounds.
AC_PATH_PROG([MINGW],        [i686-w64-mingw32-gcc])
AC_PATH_PROG([WINDRES],      [i686-w64-mingw32-windres])
AM_CONDITIONAL([HAVE_MINGW], [test -n "$MINGW" -a -n "$WINDRES"])
AC_ARG_WITH([win32-vorbis],
            [AS_HELP_STRING([--with-win32-vorbis=PATH],
            [Path to win32 cross-compiled libvorbis install prefix])],
            [win32_vorbis_path="$withval"], [win32_vorbis_path=""])
AM_CONDITIONAL([HAVE_WIN32_VORBIS], [test -n "$win32_vorbis_path"])
AS_IF([test -n "$win32_vorbis_path"], [
    WIN32_CPPFLAGS_VORBIS="-I$win32_vorbis_path/include"
    WIN32_LDFLAGS_VORBIS="-L$win32_vorbis_path/lib" ])
AC_SUBST([WIN32_CPPFLAGS_VORBIS])
AC_SUBST([WIN32_LDFLAGS_VORBIS])

dnl SDL2 with gfx, ttf, mixer and image allow constructing gizmo
PKG_CHECK_MODULES([SDL2],
    [sdl2 SDL2_gfx SDL2_ttf SDL2_mixer SDL2_image],
    [HAVE_SDL2=true], [HAVE_SDL2=false])
AM_CONDITIONAL([HAVE_SDL2], [test "$HAVE_SDL2" = true])
AC_SUBST([SDL2_CFLAGS])
AC_SUBST([SDL2_LIBS])

AC_PATH_PROG([EMCC], [emcc], [false])
AM_CONDITIONAL([HAVE_EMCC], [test "$EMCC" != false])

dnl Conditionally build Python
AC_ARG_ENABLE(python,
[  --enable-python         Create Python library if python found],
[case "${enableval}" in
  yes|y|true|t|1) enable_python=1 ;;
  no|n|false|f|0) enable_python=0 ;;
  *) AC_MSG_ERROR(bad value ${enableval} for --enable-python) ;;
esac], [enable_python=1])
AM_PATH_PYTHON(2.4,, :)
if test "x$enable_python" = x1 && test "x$PYTHON" != x:]; then
   AM_CONDITIONAL([HAVE_PYTHON], [true])
   AC_SUBST([HAVE_PYTHON], [1])
else
   AM_CONDITIONAL([HAVE_PYTHON], [false])
   AC_SUBST([HAVE_PYTHON], [0])
fi

dnl Conditionally build Java
AC_ARG_ENABLE(java,
[  --enable-java           Create Java library if JAVA_HOME found],
[case "${enableval}" in
  yes|y|true|t|1) enable_java=1 ;;
  no|n|false|f|0) enable_java=0 ;;
  *) AC_MSG_ERROR(bad value ${enableval} for --enable-java) ;;
esac], [enable_java=1])
if test "x$enable_java" = x1; then
    AC_PATH_PROG([JAVA_PATH_NAME], [java])
    if test "x$JAVA_HOME" != x; then
        true # Don't question a user supplied JAVA_HOME
    elif test -d /etc/alternatives/java_sdk; then
        JAVA_HOME=/etc/alternatives/java_sdk
    elif test -x /etc/alternatives/javac; then
        JAVA_HOME=`readlink /etc/alternatives/javac | \
                   sed 's,/bin/javac,,'`
    elif test -x /usr/libexec/java_home; then
        # Apple OSX 10.5 and later have a JAVA_HOME finder:
        # http://developer.apple.com/library/mac/#qa/qa2001/qa1170.html
        JAVA_HOME=`/usr/libexec/java_home`
    fi
    AC_MSG_CHECKING([for JAVA_HOME])
    if test -n "$JAVA_HOME"; then
        export JAVA_HOME
        AC_MSG_RESULT([$JAVA_HOME])
    else AC_MSG_RESULT([missing]); fi
    AM_CONDITIONAL([HAVE_JAVA], [test -n "$JAVA_HOME"])
    AM_COND_IF([HAVE_JAVA], AC_SUBST([JAVA_HOME], [$JAVA_HOME]))
    AC_PATH_PROG([GRADLE], [gradle], [false])
    AM_CONDITIONAL([HAVE_GRADLE], [test "x$GRADLE" != "xfalse"])
else
    AM_CONDITIONAL([HAVE_JAVA], [false])
    AM_CONDITIONAL([HAVE_GRADLE], [false])
fi

AC_PATH_PROG([PODMAN], [podman], [false])
AM_CONDITIONAL([HAVE_PODMAN], [test "x$PODMAN" != "xfalse"])

AC_CONFIG_FILES([
    Makefile
    build.gradle
    Cargo.toml
    package.json
    source/__init__.py
    source/Ripple.java
    source/gizmo/gizmo.rc
    scripts/ripple.spec
    scripts/ripple.dpkg
], [test -e ripple/__init__.py && chmod +x ripple/__init__.py])
AC_OUTPUT
