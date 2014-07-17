## Makefile.am
## Copyright (C) 2006-2014 by Jeff Gold.
##
## This program is free software: you can redistribute it and/or
## modify it under the terms of the GNU General Public License as
## published by the Free Software Foundation, either version 3 of the
## License, or (at your option) any later version.
##
## This program is distributed in the hope that it will be useful, but
## WITHOUT ANY WARRANTY; without even the implied warranty of
## MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
## General Public License for more details.
##
## You should have received a copy of the GNU General Public License
## along with this program.  If not, see <http://www.gnu.org/licenses/>.
##
## ---------------------------------------------------------------------
EXTRA_DIST = bootstrap META-INF/MANIFEST.MF @PACKAGE@.spec

docdir        = $(datadir)/doc/@PACKAGE@-@VERSION@
dist_doc_DATA = README LICENSE

uninstall-local:
	rm -rf $(DESTDIR)$(docdir)

## C ===================================================================
lib_LTLIBRARIES          = lib@PACKAGE@.la
lib@PACKAGE@_la_LDFLAGS  = -version-info $(LIBVERSION)
lib@PACKAGE@_la_CPPFLAGS = -I$(srcdir)/include
lib@PACKAGE@_la_SOURCES  = \
	source/context.c \
	source/stream.c \
	source/option.c \
	source/random.c \
	source/juju.c
pkginclude_HEADERS = include/ripple/*.h

check_PROGRAMS = check-@PACKAGE@
check_@PACKAGE@_CPPFLAGS = -I$(srcdir)/include
check_@PACKAGE@_LDADD    = lib@PACKAGE@.la
check_@PACKAGE@_SOURCES  = \
	source/check-@PACKAGE@.c \
	source/check-tree.c \
	source/check-context.c \
	source/check-stream.c \
	source/check-option.c \
	source/check-random.c \
	source/check-juju.c

## Python ==============================================================
if HAVE_PYTHON
tests_python = source/random.py source/match.py
pkgpython_PYTHON = source/__init__.py $(tests_python)

# :FIXME: figure out why egg doesn't work with pip
#         Python packaging hates me!  And him!  And her!  And you too!
dist/@PACKAGE@-@VERSION@-py@PYTHON_VERSION@.egg: $(pkgpython_PYTHON)
	$(PYTHON) $(srcdir)/source/__init__.py bdist_egg
endif

## Java ================================================================
# Automake support for Java is limited and almost useless, but it gets
# in the way enough to make it inconvenient to avoid... for now.
# See /usr/share/automake-${AM_VERSION}/am/java.am for details.
if HAVE_JAVA
JAVAROOT = $(top_builddir)/classes-@PACKAGE@
JAVAC    = ${JAVA_HOME:+$JAVA_HOME/bin/}javac
JAR      = ${JAVA_HOME:+$JAVA_HOME/bin/}jar
javadir = $(datadir)/@PACKAGE@
dist_@PACKAGE@java_JAVA = $(srcdir)/source/*.java
dist_@PACKAGE@java_DATA = @PACKAGE@-@VERSION@.jar
@PACKAGE@javadir = $(libdir)/@PACKAGE@

@PACKAGE@-@VERSION@.jar: $(srcdir)/META-INF/MANIFEST.MF \
	                 class@PACKAGE@java.stamp javadoc
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(top_builddir) javadoc -C $(JAVAROOT) .
	chmod +x $@

class@PACKAGE@java.stamp: $(am__java_sources)
	mkdir -p $(JAVAROOT)
	@list1='$?'; list2=; if test -n "$$list1"; then \
	  for p in $$list1; do \
	    if test -f $$p; then d=; else d="$(srcdir)/"; fi; \
	    list2="$$list2 $$d$$p"; \
	  done; \
	  echo '$(CLASSPATH_ENV) $(JAVAC) -d $(JAVAROOT) \
	        $(AM_JAVACFLAGS) $(JAVACFLAGS) '"$$list2"; \
	  $(CLASSPATH_ENV) $(JAVAC) -d $(JAVAROOT) \
	        $(AM_JAVACFLAGS) $(JAVACFLAGS) $$list2; \
	else :; fi
	echo timestamp > $@

javadoc: $(dist_@PACKAGE@java_JAVA)
	javadoc -docencoding utf-8 -public -d javadoc $^
	@touch $@

install-dist_@PACKAGE@javaJAVA: javadoc
	$(MKDIR_P) $(DESTDIR)$(docdir)
	cp -R $^ $(DESTDIR)$(docdir)

clean-@PACKAGE@javaJAVA:
	-rm -rf class@PACKAGE@java.stamp javadoc \
	    $(top_builddir)/classes-@PACKAGE@ @PACKAGE@-@VERSION@.jar

endif HAVE_JAVA
# :FIXME: run some Java tests

TESTS = $(check_PROGRAMS) $(tests_python) $(tests_java)
