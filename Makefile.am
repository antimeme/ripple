## Makefile.am
## Copyright (C) 2006-2024 by Jeff Gold.
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
	WEB-INF/web.xml WEB-INF/jetty-env.xml \
	$(JAVA_DISTSRC) \
	$(SERVLET_DISTSRC) \
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
	$(srcdir)/source/Octahedron.java \
	$(srcdir)/source/Asteroids.java

SERVLET_DISTSRC = \
	$(srcdir)/source/servlet/RippleServlet.java \
	$(srcdir)/source/servlet/ExpenseServlet.java

EMPTY =
SPACE = $(EMPTY) $(EMPTY)
SEPARATOR = :

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

bin_PROGRAMS =

if HAVE_SDL2
# Before attempting to compile Gizmo, install the necessary
# libraries so that configure can find them:
# $ apt install -y libsdl2-dev libsdl2-gfx-dev \
#                  libsdl2-ttf-dev libsdl2-image-dev
# $ guix install sdl2 sdl2-ttf sdl2-gfx sdl2-image
bin_PROGRAMS += gizmo
gizmo_CFLAGS = `sdl2-config --cflags`
gizmo_LDFLAGS = `sdl2-config --libs` \
	-lSDL2_gfx \
	-lSDL2_ttf \
	-lSDL2_image -lm
gizmo_SOURCES = \
	source/gizmo/gizmo.c \
	source/gizmo/asteroids.c
endif

# Building for Windows on MSYS2.  This works but requires about a
# hundred DLL files to be bundled unless executing from an MSYS2
# command prompt.
#
# $ pacman --noconfirm -S mingw-w64-x86_64-toolchain \
#     mingw64/mingw-w64-x86_64-SDL2{,_gfx,_ttf,_image}
# $ /mingw64/bin/gcc.exe -o gizmo.exe source/gizmo/*.c \
#     `sdl2-config --cflags --static-libs` -lSDL2_{gfx,ttf,image}

if HAVE_EMCC
# Emscripten is kinda dumb about its ports.  The following may
# be necessary to avoid permission errors:
# $ make gizmo.html EM_CONFIG=$HOME/.emscripten
apps/gizmo.wasm apps/gizmo.js apps/gizmo.html apps/gizmo.data: \
	    source/gizmo/gizmo.c source/gizmo/asteroids.c
	$(EMCC) -o $@ \
	    --preload-file apps/fonts/ \
	    -sALLOW_MEMORY_GROWTH \
	    -sUSE_SDL=2 -sUSE_SDL_GFX=2 -sUSE_SDL_TTF=2 \
	    -sUSE_SDL_IMAGE=2 -sSDL2_IMAGE_FORMATS='["svg"]' \
	    source/gizmo/gizmo.c \
	    source/gizmo/asteroids.c
endif

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

## Rust ================================================================

rs-serve: Cargo.toml server-cert.pem
	cargo run server

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
KEYTOOL = "$(JAVA_HOME)/bin/keytool"

JAVA_SRCFILES = $(JAVA_DISTSRC) $(top_builddir)/source/Ripple.java
JAR_ROOT = $(top_builddir)/classes

$(JAR_ROOT)/.classes: $(JAVA_SRCFILES)
	$(MKDIR_P) $(JAR_ROOT)
	$(JCC) -d $(JAR_ROOT) -source 8 -target 8 \
	    -Xlint:-options -Xlint:-removal \
	    $(JAVA_SRCFILES)
	find $(JAR_ROOT) -name \*.class | \
	   sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	   sort -u > $@

.javadoc: $(JAVA_SRCFILES)
	$(JAVADOC) -docencoding utf-8 -public \
	    -d javadoc $(JAVA_SRCFILES)
	touch $@

@PACKAGE@-@VERSION@.jar: $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.classes .javadoc
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/apps/sounds sounds \
	    -C $(srcdir)/apps/images images \
	    -C $(srcdir)/apps/fonts  fonts \
	    -C $(top_builddir) javadoc -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.jar: @PACKAGE@-@VERSION@.jar
	rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.jar $@

if HAVE_GRADLE
build/libs/@PACKAGE@-@VERSION@.war: \
	    build.gradle \
	    WEB-INF/web.xml \
	    WEB-INF/jetty-env.xml \
	    $(JAR_ROOT)/.classes \
	    source/servlet/*.java
	$(GRADLE) -b $< war

@PACKAGE@-@VERSION@.war: build/libs/@PACKAGE@-@VERSION@.war
	cp $< $@

@PACKAGE@.war: @PACKAGE@-@VERSION@.war
	@rm -f $@
	$(LN_S) $< $@

deploy: @PACKAGE@.war
	@if [ -n "$(JETTY_HOME)" ]; then \
	    $(SUDO) cp $< $(JETTY_HOME)/webapps; \
	elif [ -n "$(CATALINA_BASE)" ]; then \
	    $(SUDO) cp $< $(CATALINA_BASE)/webapps; \
	elif [ -n "$(CATALINA_HOME)" ]; then \
	    $(SUDO) cp $< $(CATALINA_HOME)/webapps; \
	else echo ERROR: no Java server container detected; fi
endif

# Configure Jetty for TLS:
# - Copy ripple.ks to $JETTY_HOME/etc/localhost.ks
# - Edit $JETTY_HOME/etc/jetty-ssl-context.xml
#   <Set name="CertAlias">
#     <Property name="jetty.keystore.alias" default="localhost"/>
#   </Set>
# - Edit $JETTY_HOME/start.ini
#   --module=[...],https,[...]
#   jetty.ssl.port=8443
#   jetty.sslContext.keyStorePath=etc/localhost.ks
#   jetty.sslContext.keyStoreType=pkcs12
#   jetty.sslContext.keyStorePassword=secret
#   jetty.sslContext.wantClientAuth=true
#   jetty.sslContext.trustStorePath=etc/localhost.ks
#   jetty.sslContext.trustStoreType=pkcs12
#   jetty.sslContext.trustStorePassword=secret

# Configure Tomcat for TLS:
# - Copy ripple.ks to $CATALINA_HOME/etc/localhost.ks
# - Edit $CATALINA_HOME/etc/server.xml
#   <Connector port="8443" maxThreads="150" SSLEnabled="true"
#              protocol="org.apache.coyote.http11.Http11NioProtocol">
#     <SSLHostConfig certificateVerification="optional"
#                    truststoreFile="etc/localhost.ks"
#                    truststoreType="pkcs12"
#                    truststorePassword="secret">
#       <Certificate certificateKeystoreFile="etc/localhost.ks"
#                    certificateKeystoreType="pkcs12"
#                    certificateKeyAlias="localhost"
#                    certificateKeystorePassword="secret"
#                    type="RSA" />
#     </SSLHostConfig>
#   </Connector>

localhost.ks:
	$(KEYTOOL) -keystore $@ -storetype pkcs12 \
	    -genkey -keyalg RSA -keysize 2048 -sigalg SHA256withRSA \
	    -alias localhost -dname CN=localhost -validity 3650 \
	    -ext "SAN=dns:$$HOSTNAME,dns:*.$$HOSTNAME"

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
	-rm -rf .gradle/ .javadoc javadoc *.jar *.war *.ks

mostlyclean-local-java:
	-rm -rf $(JAR_ROOT) build/

else
clean-local-java:

mostlyclean-local-java:

endif

clean-local: clean-local-java
	rm -rf target/

mostlyclean-local: mostlyclean-local-java

## Certificates ========================================================
OPENSSL = openssl
STOREPASS = 123456
COMMON_NAME = /C=US/O=antimeme.net/OU=CA/CN=

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

serve: source/server.js server-key.pem server-chain.pem ca-cert.pem
	node $<

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
