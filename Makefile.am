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
	Dockerfile \
	scripts/@PACKAGE@.spec \
	scripts/@PACKAGE@.dpkg \
	META-INF/MANIFEST.MF \
	WEB-INF/web.xml \
	$(JAVA_DISTSRC) \
	$(J2EE_DISTSRC) \
	source/random.py \
	source/match.py
docdir        = $(datadir)/doc/@PACKAGE@-@VERSION@
dist_doc_DATA = README.md LICENSE

uninstall-local:
	rm -rf $(DESTDIR)$(docdir)

JAVA_DISTSRC = \
	$(srcdir)/source/Options.java \
	$(srcdir)/source/FractionLayout.java \
	$(srcdir)/source/Juju.java \
	$(srcdir)/source/Standalone.java \
	$(srcdir)/source/Matrix.java \
	$(srcdir)/source/Vector.java \
	$(srcdir)/source/Jarbles.java \
	$(srcdir)/source/Board.java \
	$(srcdir)/source/Player.java \
	$(srcdir)/source/AutoPlayer.java \
	$(srcdir)/source/GraphicPlayer.java \
	$(srcdir)/source/Aqua.java \
	$(srcdir)/source/HexagonGrid.java \
	$(srcdir)/source/Octahedron.java

J2EE_DISTSRC = \
	$(srcdir)/source/servlet/RippleServlet.java

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
CLEANFILES       = *.pem .docker-build

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
# Names of macros such as JCC, JAR_ROOT and JAVA_SRCFILES have been
# chosen to avoid the broken and unmaintained autoconf support for
# Java.  Possible improvement:
# http://www.freesoftwaremagazine.com/articles/autotools_example
if HAVE_JAVA
javadir = $(datadir)/@PACKAGE@
java_DATA = @PACKAGE@-@VERSION@.jar

JCC     = "$(JAVA_HOME)/bin/javac"
JAVADOC = "$(JAVA_HOME)/bin/javadoc"
JAR     = "$(JAVA_HOME)/bin/jar"

JAVA_SRCFILES = $(JAVA_DISTSRC) $(top_builddir)/source/Ripple.java
JAR_ROOT = $(top_builddir)/classes
WAR_ROOT = $(top_builddir)/WEB-INF/classes

$(JAR_ROOT)/.classes: $(JAVA_SRCFILES)
	$(MKDIR_P) $(JAR_ROOT)
	$(JCC) -d $(JAR_ROOT) -source 1.7 -target 1.7 \
	    -Xlint:-options $(JAVA_SRCFILES)
	find $(JAR_ROOT) -name \*.class | \
	    sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	    sort -u > $@

.javadoc: $(JAVA_SRCFILES)
	$(JAVADOC) -docencoding utf-8 -public \
	    -d javadoc $(JAVA_SRCFILES)
	@touch $@

@PACKAGE@-@VERSION@.jar: $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.classes .javadoc
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/resources sounds \
	    -C $(srcdir)/resources images \
	    -C $(top_builddir) javadoc -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.jar: @PACKAGE@-@VERSION@.jar
	rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.jar $@

MVN_REPO_URL = https://repo1.maven.org/maven2
SERVLET_DIR = javax/servlet/javax.servlet-api/4.0.1
SERVLET_URL = $(MVN_REPO_URL)/$(SERVLET_DIR)/javax.servlet-api-4.0.1.jar
JACKSON_DIR = com/fasterxml/jackson/core/jackson-core/2.9.9/
JACKSON_URL = $(MVN_REPO_URL)/$(JACKSON_DIR)/jackson-core-2.9.9.jar

lib/servlet-api.jar:
	$(MKDIR_P) lib
	curl -o $@ $(SERVLET_URL)

lib/jackson-core.jar:
	$(MKDIR_P) lib
	curl -o $@ $(JACKSON_URL)

$(WAR_ROOT)/.classes: $(J2EE_DISTSRC) lib/servlet-api.jar
	$(MKDIR_P) $(WAR_ROOT)
	$(JCC) -classpath lib/*.jar -d $(WAR_ROOT) \
	       -source 8 -target 8 -Xlint:-options $(J2EE_DISTSRC)
	find $(WAR_ROOT) -name \*.class | \
	    sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	    sort -u > $@

@PACKAGE@-@VERSION@.war: .javadoc $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.classes $(WAR_ROOT)/.classes
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/resources sounds \
	    -C $(srcdir)/resources images \
	    -C $(srcdir) WEB-INF/web.xml \
	    -C $(srcdir)/source/servlet index.html \
	    -C $(top_builddir) javadoc WEB-INF/classes/ \
	    -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.war: @PACKAGE@-@VERSION@.war
	@rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.war $@

deploy: @PACKAGE@.war
	@if [ -n "$(CATALINA_BASE)" ]; then \
	    $(SUDO) cp $< $(CATALINA_BASE)/webapps; \
	elif [ -n "$(CATALINA_HOME)" ]; then \
	    $(SUDO) cp $< $(CATALINA_HOME)/webapps; \
	else echo ERROR: no CATALINA_BASE or CATALINA_HOME; fi

install-data-local: javadoc
	$(MKDIR_P) $(DESTDIR)$(docdir)
	cp -R javadoc $(DESTDIR)$(docdir)

scripts/check-java.sh: @PACKAGE@.jar
	$(MKDIR_P) scripts
	echo '#!/bin/sh' > $@
	echo $(JAVA_HOME)/bin/java -jar @PACKAGE@.jar test >> $@
	chmod +x $@

TESTS += scripts/check-java.sh
MOSTLYCLEANFILES += \
	@PACKAGE@-@VERSION@.jar @PACKAGE@.jar \
	@PACKAGE@-@VERSION@.war @PACKAGE@.war
CLEANFILES += \
	scripts/check-java.sh

clean-local-java:
	-rm -rf .javadoc javadoc *.jar *.war

mostlyclean-local-java:
	-rm -rf $(JAR_ROOT) $(WAR_ROOT)

else
clean-local-java:

mostlyclean-local-java:

endif

clean-local: clean-local-java

mostlyclean-local: mostlyclean-local-java

## Certificates ========================================================
OPENSSL = openssl
KEYTOOL = $(JAVA_HOME)/bin/keytool
STOREPASS = 123456
COMMON_NAME = /C=US/O=esclat.net/OU=CA/CN=

ca-key.pem:
	$(OPENSSL) genrsa -out $@ $(KEYSIZE)

ca-cert.pem: ca-key.pem
	$(OPENSSL) req -sha256 -x509 -key $< -out $@ \
	    -days 3650 -subj "$(COMMON_NAME)Root CA"

server-key.pem:
	$(OPENSSL) genrsa -out $@ $(KEYSIZE)

server-req.pem: server-key.pem
	$(OPENSSL) req -new -key server-key.pem \
	    -subj "$(COMMON_NAME)server" -sha256 -out $@

server-cert.pem: server-req.pem ca-key.pem ca-cert.pem
	$(OPENSSL) x509 -CA ca-cert.pem -CAkey ca-key.pem \
	  -req -sha256 -days 730 -extfile resources/ca.conf \
	  -extensions server_role_ext \
	  -CAcreateserial -CAserial ca.srl -in server-req.pem -out $@

server-cert.der: server-cert.pem
	$(OPENSSL) x509 -in server-cert.pem -out $@ -outform der

server-chain.pem: server-cert.pem ca-cert.pem
	if [ ! -e $@ ]; then \
	    cp server-cert.pem $@; cat ca-cert.pem >>$@; \
	else touch $@; fi

tomcat-key.pem:
	$(OPENSSL) genrsa -out $@ $(KEYSIZE)

tomcat-req.pem: tomcat-key.pem
	$(OPENSSL) req -new -key tomcat-key.pem \
	    -subj "$(COMMON_NAME)tomcat" -sha256 -out $@

tomcat-cert.pem: tomcat-req.pem ca-key.pem ca-cert.pem
	$(OPENSSL) x509 -CA ca-cert.pem -CAkey ca-key.pem \
	  -req -sha256 -days 730 -extfile resources/ca.conf \
	  -extensions tomcat_role_ext \
	  -CAcreateserial -CAserial ca.srl -in tomcat-req.pem -out $@

tomcat-cert.der: tomcat-cert.pem
	$(OPENSSL) x509 -in tomcat-cert.pem -out $@ -outform der

tomcat-chain.pem: tomcat-cert.pem ca-cert.pem
	if [ ! -e $@ ]; then \
	    cp tomcat-cert.pem $@; cat ca-cert.pem >>$@; \
	else touch $@; fi

tomcat.p12: tomcat-key.pem tomcat-chain.pem
	$(OPENSSL) pkcs12 -export -name tomcat \
            -out $@ -inkey tomcat-key.pem -keyex \
	    -passout pass:"$(STOREPASS)" \
	    -in tomcat-chain.pem -chain -CAfile ca-cert.pem

## Docker ==============================================================

.docker-build: Dockerfile ca-cert.pem server-chain.pem server-key.pem
	docker build -t @PACKAGE@ .
	@echo > $@

docker: .docker-build
	docker run -d -p 9443:8443/tcp @PACKAGE@

docker-interact: .docker-build
	docker run -ti @PACKAGE@ bash

## Other ===============================================================

.PHONY: clean-local-java mostlyclean-local-java deploy \
	docker docker-interact
