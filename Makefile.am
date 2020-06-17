## Makefile.am
## Copyright (C) 2006-2020 by Jeff Gold.
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
EXTRA_DIST = \
	bootstrap resources \
	META-INF/MANIFEST.MF \
	scripts/@PACKAGE@.spec \
	scripts/@PACKAGE@.dpkg \
	source/*.java \
	source/random.py \
	source/match.py
docdir        = $(datadir)/doc/@PACKAGE@-@VERSION@
dist_doc_DATA = README.md LICENSE

uninstall-local:
	rm -rf $(DESTDIR)$(docdir)

## C ===================================================================
lib_LTLIBRARIES = lib@PACKAGE@.la
lib@PACKAGE@_la_LDFLAGS  = -version-info $(LIBVERSION)
lib@PACKAGE@_la_CPPFLAGS = -I$(srcdir)/include
lib@PACKAGE@_la_CFLAGS   = -g -Wall -Werror
lib@PACKAGE@_la_SOURCES  = \
	source/context.c \
	source/stream.c \
	source/option.c \
	source/random.c \
	source/pool.c \
	source/pixie.c \
	source/juju.c
pkginclude_HEADERS = include/@PACKAGE@/*.h

check_PROGRAMS = check-@PACKAGE@
check_@PACKAGE@_CPPFLAGS = -I$(srcdir)/include
check_@PACKAGE@_LDADD    = lib@PACKAGE@.la
check_@PACKAGE@_SOURCES  = \
	source/check/ripple.c \
	source/check/tree.c \
	source/check/context.c \
	source/check/stream.c \
	source/check/option.c \
	source/check/random.c \
	source/check/pool.c \
	source/check/pixie.c \
	source/check/juju.c

TESTS = $(check_PROGRAMS)
MOSTLYCLEANFILES =
DISTCLEANFILES   =
CLEANFILES       =

## Python ==============================================================
if HAVE_PYTHON
pkgpython_PYTHON = source/__init__.py $(tests_python)

dist/@PACKAGE@-@VERSION@-py@PYTHON_VERSION@.egg: $(pkgpython_PYTHON)
	$(PYTHON) source/__init__.py bdist_egg

# :TODO: make this part of "make dist" somehow...
egg: dist/@PACKAGE@-@VERSION@-py@PYTHON_VERSION@.egg

TESTS += source/random.py source/match.py
endif

## Java ================================================================
# Names of macros such as JCC, JAR_ROOT and JAVA_SOURCES have been
# chosen to avoid the broken and unmaintained autoconf support for
# Java Possible improvement:
# http://www.freesoftwaremagazine.com/articles/autotools_example
if HAVE_JAVA
javadir = $(datadir)/@PACKAGE@
java_DATA = @PACKAGE@-@VERSION@.jar
JAR = $(JAVA_HOME)/bin/jar
JCC = $(JAVA_HOME)/bin/javac
JAVADOC = $(JAVA_HOME)/bin/javadoc
JAR_ROOT = $(top_builddir)/.classes
WAR_ROOT = $(top_builddir)/WEB-INF
JAVA_SOURCES = $(srcdir)/source/*.java
J2EE_SOURCES = $(srcdir)/source/j2ee/*.java

@PACKAGE@-@VERSION@.jar: $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.classes javadoc
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/resources sounds \
	    -C $(srcdir)/resources images \
	    -C $(top_builddir) javadoc -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.jar: @PACKAGE@-@VERSION@.jar
	rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.jar $@

$(JAR_ROOT)/.classes: $(JAVA_SOURCES)
	$(MKDIR_P) $(JAR_ROOT)
	$(JCC) -d $(JAR_ROOT) -source 1.6 -target 1.6 $^
	find $(JAR_ROOT) -name \*.class | \
	    sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	    sort -u > $@

javadoc: $(JAVA_SOURCES)
	$(JAVADOC) -docencoding utf-8 -public -d javadoc $^
	@touch $@

@PACKAGE@-@VERSION@.war: javadoc $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.classes $(WAR_ROOT)/.classes
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/resources sounds \
	    -C $(srcdir)/resources images \
	    -C $(top_builddir) javadoc $(WAR_ROOT) \
	    -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.war: @PACKAGE@-@VERSION@.war
	@rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.war $@

$(WAR_ROOT)/.classes: $(J2EE_SOURCES)
	$(MKDIR_P) $(WAR_ROOT)
	$(JCC) -d $(WAR_ROOT) -source 1.6 -target 1.6 $^
	find $(JAR_ROOT) -name \*.class | \
	    sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	    sort -u > $@

install-data-local: javadoc
	$(MKDIR_P) $(DESTDIR)$(docdir)
	cp -R $^ $(DESTDIR)$(docdir)

scripts/check-java.sh:
	$(MKDIR_P) scripts
	echo '#!/bin/sh' > $@
	echo $(JAVA_HOME)/bin/java -jar @PACKAGE@.jar test >> $@
	chmod +x $@

TESTS += scripts/check-java.sh
MOSTLYCLEANFILES += @PACKAGE@-@VERSION@.jar @PACKAGE@.jar
CLEANFILES += scripts/check-java.sh

clean-local-java:
	-rm -rf javadoc

mostlyclean-local-java:
	-rm -rf $(JAR_ROOT)

else
clean-local-java:

mostlyclean-local-java:

endif

clean-local: clean-local-java

mostlyclean-local-java: clean-local-java

## Docker ==============================================================

docker-build:
	sudo docker build -t ripple .

docker: docker-build
	sudo docker run ripple

docker-interact: docker-build
	sudo docker run --tty --interact ripple

.PHONY: clean-local-java mostlyclean-local-java \
	docker-build docker docker-interact
