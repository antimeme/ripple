dnl configure.ac
dnl Copyright (C) 2006-2014 by Jeff Gold.
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
AC_INIT([ripple], [0.1.1], [Jeff Gold <ripple@esclat.net>])
AC_CANONICAL_HOST
AC_CONFIG_SRCDIR([configure.ac])
AC_CONFIG_HEADER([include/ripple/config.h])
AC_SUBST([LIBVERSION], [0:0])
AM_INIT_AUTOMAKE

AC_PROG_CC
AC_PROG_LIBTOOL
AC_PROG_MKDIR_P

# Conditionally build Python
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

# Conditionally build Java
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
      # Don't question a user supplied JAVA_HOME
      true
    elif test -d /etc/alternatives/java_sdk; then
        # /etc/alternatives might specify preferred Java installation
        AC_PATH_PROG([READLINK], [readlink])
        if test -n "$READLINK"; then
            JAVA_HOME=`$READLINK /etc/alternatives/java_sdk`
        else JAVA_HOME=/etc/alterntatives/java_sdk; fi
    elif test -x /usr/libexec/java_home; then
        # Apple OSX 10.5 and later have a JAVA_HOME finder:
        # http://developer.apple.com/library/mac/#qa/qa2001/qa1170.html
        JAVA_HOME=`/usr/libexec/java_home`
    # elif test -n "$JAVA_PATH_NAME"; then
    #    # Check for common Java installation locations :FIXME:
    #    JAVA_HOME=`echo $JAVA_PATH_NAME | \
    #        sed "s,\(.*\)\(/bin\)/*java,\1,"`
    fi
    AC_MSG_CHECKING([for JAVA_HOME])
    if test -n "$JAVA_HOME"; then
        export JAVA_HOME
        AC_MSG_RESULT([$JAVA_HOME])
    else AC_MSG_RESULT([missing]); fi
fi
if test "x$enable_java" = x1 && test -d "$JAVA_HOME"; then
   AM_CONDITIONAL([HAVE_JAVA], [true])
   AC_SUBST([HAVE_JAVA], [1])
else
   AM_CONDITIONAL([HAVE_JAVA], [false])
   AC_SUBST([HAVE_JAVA], [0])
fi

AC_CONFIG_FILES([
        Makefile
        ripple.spec
        ripple.dpkg
        source/__init__.py
        source/Ripple.java
], [test -e ripple/__init__.py && chmod +x ripple/__init__.py])
AC_OUTPUT
