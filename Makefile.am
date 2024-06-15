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
	-lSDL2_mixer \
	-lSDL2_ttf \
	-lSDL2_gfx \
	-lSDL2_image -lm
gizmo_SOURCES = \
	source/gizmo/gizmo.c \
	source/gizmo/asteroids.c

play-sdl-asteroids: gizmo
	./gizmo
endif

# Building for Windows on MSYS2.  This works but requires about a
# hundred DLL files to be bundled unless executing from an MSYS2
# command prompt.
#
# $ pacman --noconfirm -S mingw-w64-x86_64-toolchain \
#     mingw64/mingw-w64-x86_64-SDL2 \
#     mingw64/mingw-w64-x86_64-SDL2_{mixer,ttf,gfx,image}
# $ /mingw64/bin/gcc.exe -o gizmo.exe source/gizmo/*.c \
#     `sdl2-config --cflags --static-libs` -lSDL2_{mixer,ttf,gfx,image}

if HAVE_EMCC
# Emscripten is kinda dumb about its ports.  The following may
# be necessary to avoid permission errors:
# $ make gizmo.html EM_CONFIG=$HOME/.emscripten
apps/gizmo.wasm apps/gizmo.js apps/gizmo.html apps/gizmo.data: \
	    source/gizmo/gizmo.c source/gizmo/asteroids.c
	$(EMCC) -o $@ \
	    -sALLOW_MEMORY_GROWTH \
	    --preload-file apps/fonts/ \
	    --preload-file apps/sounds/ \
	    -sUSE_SDL=2 \
	    -sUSE_SDL_MIXER=2 \
	    -sUSE_SDL_TTF=2 \
	    -sUSE_SDL_GFX=2 \
	    -sUSE_SDL_IMAGE=2 -sSDL2_IMAGE_FORMATS='["svg"]' \
	    source/gizmo/gizmo.c \
	    source/gizmo/asteroids.c
endif

TESTS = $(check_PROGRAMS)
MAINTAINERCLEANFILES = *.p12 *.der *.pem *.srl .passwd
MOSTLYCLEANFILES     =
DISTCLEANFILES       =
CLEANFILES           =

## Certificates ========================================================
# Public Key Infrastructure (PKI) using OpenSSL.
# To the extend possible, generic rules are used to reduce repetition.
# Many things can be done this way, but the shape of the PKI has to
# be defined explicitly.
OPENSSL = openssl
DN_BASE = C=US/O=antimeme.net

.passwd:
	umask 077; echo "$(STOREPASS)" > $@

%-key.pem:
	$(OPENSSL) genrsa -out $@ $(KEYSIZE)

%-cert.der: %-cert.pem
	$(OPENSSL) x509 -in $< -out $@ -outform der

%.p12: %-key.pem %-chain.pem .passwd
	LABEL=`echo $@ | sed 's,.p12$$,,'`; \
	$(OPENSSL) pkcs12 -export -out $@ -inkey $< \
	    -in "$$LABEL-chain.pem" -name "$$LABEL" \
	    -passout file:.passwd

# Root certificate authority signs itself.  There's no higher
# authority to vouch for it but it's useful to have a certificate in
# X.509 format to use when referencing it.  This authority is
# intended primarily for signing issuing certificates, which come
# in two forms:
#     *-ca-cert.pem: issuing CAs that can have subordinate authorities
#     *-ca1-cert.pem: issuing CAs that only sign end use certificates
rootca-cert.pem: rootca-key.pem
	$(OPENSSL) req -x509 -key $< -out $@ -sha256 -days 3650 \
	    -subj "/$(DN_BASE)/OU=CA/CN=Root CA"

%-ca-req.pem: %-key.pem
	LABEL=`echo $@ | sed 's,-ca-req.pem$$,,'`; \
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=CA/CN=$$LABEL"

%-ca-cert.pem: %-ca-req.pem rootca-key.pem rootca-cert.pem
	$(OPENSSL) x509 -CA rootca-cert.pem -CAkey rootca-key.pem \
	  -extfile @srcdir@/scripts/ca.conf \
	  -extensions ca_role_ext -req -sha256 -days 730 \
	  -CAcreateserial -CAserial ca.srl -in $< -out $@

%-ca1-cert.pem: %-ca-req.pem rootca-key.pem rootca-cert.pem
	$(OPENSSL) x509 -CA rootca-cert.pem -CAkey rootca-key.pem \
	  -extfile @srcdir@/scripts/ca.conf \
	  -extensions ca1_role_ext -req -sha256 -days 730 \
	  -CAcreateserial -CAserial ca.srl -in $< -out $@

# ServerCA is responsible for signing individual servers.
# This CA is signed but the root, but not authorized to delegate
# to subordinate CAs.
serviceCA-chain.pem: serviceCA-ca1-cert.pem rootca-cert.pem
	cat $^ >$@

%-service-req.pem: %-key.pem
	LABEL=`echo $@ | sed 's,-service-req.pem$$,,'`; \
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=Services/CN=$$LABEL" \
	    -addext "subjectAltName = DNS:$$LABEL, DNS:www.$$LABEL"

%-service-cert.pem: %-service-req.pem serviceCA-ca1-cert.pem \
	            serviceCA-key.pem
	LABEL=`echo $< | sed 's,-service-req.pem$$,,'`; \
	$(OPENSSL) x509 -extfile @srcdir@/scripts/ca.conf \
	    -CA serviceCA-ca1-cert.pem -CAkey serviceCA-key.pem \
	    -CAcreateserial -CAserial serviceCA.srl \
	    -copy_extensions copy \
	    -extensions server_role_ext -req -sha256 -days 730 \
	    -in $< -out $@

# A generic server without a particular purpose.
# A copy of this rule with "server" replaced could be used to
# create a particular server.
server-chain.pem: server-service-cert.pem serviceCA-chain.pem
	cat $^ >$@

antimeme.net-chain.pem: antimeme.net-service-cert.pem \
	                serviceCA-chain.pem
	cat $^ >$@

# ClientCA is responsible for signing certificates for users,
# such as those that might be installed in a web browser.
# This CA is signed but the root, but not authorized to delegate
# to subordinate CAs.
clientCA-chain.pem: clientCA-ca1-cert.pem rootca-cert.pem
	cat $^ >$@

%-client-req.pem: %-key.pem
	LABEL=`echo $@ | sed 's,-client-req.pem$$,,'`; \
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=Users/CN=$$LABEL"

%-client-cert.pem: %-client-req.pem clientCA-ca1-cert.pem \
	           clientCA-key.pem
	$(OPENSSL) x509 -extfile @srcdir@/scripts/ca.conf \
	    -CA clientCA-ca1-cert.pem -CAkey clientCA-key.pem \
	    -extensions client_role_ext -req -sha256 -days 730 \
	    -CAcreateserial -CAserial clientCA.srl -in $< -out $@

# A generic user certificate without a particular purpose.  A copy of
# this rule with "username" replaced can make distinct artifacts (such
# as PKCS#12 files with "make username.p12") for each user.
username-chain.pem: username-client-cert.pem clientCA-chain.pem
	cat $^ >$@

antimeme-chain.pem: antimeme-client-cert.pem clientCA-chain.pem
	cat $^ >$@

## Node.js =============================================================

node-serve: source/js/server.js \
	    server-key.pem server-chain.pem \
	    rootca-cert.pem
	node $<

## Rust ================================================================
RUST_DISTSRC = \
	source/ripple.rs \
	source/expense.rs \
	source/server.rs

rs-serve: Cargo.toml $(RUST_DISTSRC) \
	  server-key.pem server-chain.pem \
	  rootca-cert.pem
	cargo run server

## Python ==============================================================
PYTHON_DISTSRC = source/random.py source/match.py

if HAVE_PYTHON
# Python support is well out of date.  Until everything can be brought
# up to date with Python 3 tests are disabled
#TESTS += source/random.py source/match.py

pkgpython_PYTHON = source/__init__.py $(tests_python)

dist/@PACKAGE@-@VERSION@-py@PYTHON_VERSION@.egg: $(pkgpython_PYTHON)
	$(PYTHON) source/__init__.py bdist_egg

# :TODO: make this part of "make dist" somehow...
egg: dist/@PACKAGE@-@VERSION@-py@PYTHON_VERSION@.egg

endif

## Java ================================================================
# Names of macros such as JCC, JAR_ROOT and JAVA_SRCFILES have been
# chosen to avoid the broken and unmaintained autoconf Java support.
JAVA_DISTSRC = \
	$(srcdir)/source/Applet.java \
	$(srcdir)/source/Camera.java \
	$(srcdir)/source/Options.java \
	$(srcdir)/source/Juju.java \
	$(srcdir)/source/FractionLayout.java \
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
	$(srcdir)/source/Asteroids.java \
	$(srcdir)/source/Dungeon.java

SERVLET_DISTSRC = \
	$(srcdir)/source/servlet/RippleFilter.java \
	$(srcdir)/source/servlet/Tinker.java \
	$(srcdir)/source/servlet/ExpenseServlet.java

if HAVE_JAVA
javadir = $(datadir)/@PACKAGE@
java_DATA = @PACKAGE@-@VERSION@.jar

JCC     = "$(JAVA_HOME)/bin/javac"
JAVADOC = "$(JAVA_HOME)/bin/javadoc"
JAR     = "$(JAVA_HOME)/bin/jar"
KEYTOOL = "$(JAVA_HOME)/bin/keytool"

JAVA_SRCFILES = $(JAVA_DISTSRC) $(builddir)/source/Ripple.java

.javadoc: $(JAVA_SRCFILES)
	$(JAVADOC) -docencoding utf-8 -public \
	    -d javadoc $(JAVA_SRCFILES)
	touch $@

if HAVE_GRADLE

build/libs/@PACKAGE@-@VERSION@.jar: \
	    build.gradle $(JAVA_SRCFILES) \
            $(srcdir)/META-INF/MANIFEST.MF
	$(GRADLE) jar

@PACKAGE@-@VERSION@.jar: build/libs/@PACKAGE@-@VERSION@.jar
	cp $< $@

@PACKAGE@.jar: @PACKAGE@-@VERSION@.jar
	@rm -f $@
	$(LN_S) $< $@

java_DATA += @PACKAGE@-@VERSION@.war

build/libs/@PACKAGE@-@VERSION@.war: \
	    build.gradle \
	    $(JAVA_SRCFILES) \
	    WEB-INF/web.xml \
	    WEB-INF/jetty-env.xml \
	    $(SERVLET_DISTSRC)
	$(GRADLE) war

@PACKAGE@-@VERSION@.war: build/libs/@PACKAGE@-@VERSION@.war
	cp $< $@

@PACKAGE@.war: @PACKAGE@-@VERSION@.war
	@rm -f $@
	$(LN_S) $< $@

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

deploy-jetty: @PACKAGE@.war
	@if [ -n "$(JETTY_HOME)" ]; then \
	    $(SUDO) cp $< $(JETTY_HOME)/webapps; \
	    echo Jetty: deployed to $(JETTY_HOME); \
	else echo Jetty: missing \$$JETTY_HOME; fi

deploy-tomcat: @PACKAGE@.war
	@if [ -n "$(CATALINA_BASE)" ]; then \
	    $(SUDO) cp $< $(CATALINA_BASE)/webapps; \
	    echo Tomcat: deployed to $(CATALINA_BASE); \
	elif [ -n "$(CATALINA_HOME)" ]; then \
	    $(SUDO) cp $< $(CATALINA_HOME)/webapps; \
	    echo Tomcat: deployed to $(CATALINA_HOME); \
	else \
	    echo $(ECHO_N) Tomcat: missing ""; \
	    echo \$$CATALINA_BASE and \$$CATALINA_HOME; \
	fi

deploy: deploy-jetty deploy-tomcat

@PACKAGE@-jetty.ini:
	@echo \#\# @PACKAGE@ configuration >$@
	@echo --module=https >>$@
	@echo jetty.ssl.port=8443 >>$@
	@echo jetty.sslContext.keyStorePath=etc/container.p12 >>$@
	@echo jetty.sslContext.keyStoreType=pkcs12 >>$@
	@echo jetty.sslContext.keyStorePassword=$(STOREPASS) >>$@
	@echo jetty.sslContext.keyManagerPassword=$(STOREPASS) >>$@
	@echo jetty.sslContext.wantClientAuth=true >>$@
	@echo jetty.sslContext.trustStorePath=etc/container.p12 >>$@
	@echo jetty.sslContext.trustStoreType=pkcs12 >>$@
	@echo jetty.sslContext.trustStorePassword=$(STOREPASS) >>$@

install-jetty-https: container.p12 @PACKAGE@-jetty.ini
	@if [ -n "$(JETTY_HOME)" ]; then \
	    chmod go= $^ && \
	    $(SUDO) cp container.p12 $(JETTY_HOME)/etc/ && \
	    $(SUDO) chown jetty:adm $(JETTY_HOME)/etc/container.p12 && \
	    $(SUDO) cp @PACKAGE@-jetty.ini \
	        $(JETTY_HOME)/etc/start.d/ && \
	    $(SUDO) chown jetty:adm \
	        $(JETTY_HOME)/etc/start.d/@PACKAGE@-jetty.ini && \
	    $(SUDO) systemctl restart jetty9; \
	else echo Jetty: missing \$$JETTY_HOME; fi

if HAVE_PODMAN
# Create an OCI container running Jetty with the package WAR file
# installed in the root context.
JETTYPOD_IMAGE = @PACKAGE@-jettypod
JETTYPOD_NAME  = @PACKAGE@-jettypod

.jettypod-image: scripts/container-jettypod @PACKAGE@-jetty.ini \
	         @PACKAGE@.war container.p12
	podman build -f $< --target @PACKAGE@ -t $(JETTYPOD_IMAGE) .
	@echo > $@

jettypod-interact: .jettypod-image
	podman run -it --rm $(JETTYPOD_IMAGE) bash

.jettypod-container: .jettypod-image
	podman run -d -p 9443:8443/tcp \
	    --name $(JETTYPOD_NAME) $(JETTYPOD_IMAGE)
	@echo > $@

jettypod-start: .jettypod-container
	@if ! podman inspect --format '{{.State.Running}}' \
	    "$(JETTYPOD_NAME)" >/dev/null 2>&1; then \
	    podman start $(JETTYPOD_NAME); fi

jettypod-stop:
	podman stop $(JETTYPOD_NAME)

jettypod-destroy: jettypod-stop
	podman rm $(JETTYPOD_NAME)

jettpod-purge: jettypod-destroy
	podman image rm $(JETTPOD_IMAGE)

MAINTAINERCLEANFILES += .jettypod-image .jettypod-container

endif # HAVE_PODMAN

else # !HAVE_GRADLE

JAR_ROOT = $(builddir)/classes

$(JAR_ROOT)/.classes: $(JAVA_SRCFILES)
	$(MKDIR_P) $(JAR_ROOT)
	$(JCC) -d $(JAR_ROOT) -source 8 -target 8 \
	    -Xlint:-options -Xlint:-removal \
	    $(JAVA_SRCFILES)
	find $(JAR_ROOT) -name \*.class | \
	   sed 's,^\./[^/]*/,,;s,/,.,g;s,\(\$$[^.]*\)*\.class,,' | \
	   sort -u > $@

$(JAR_ROOT)/.libs: $(JAR_ROOT)/.classes
	$(MKDIR_P) $(JAR_ROOT)/lib
	cp lib/*.jar $(JAR_ROOT)/lib
	find lib -type f -name \*.jar >$@

@PACKAGE@-@VERSION@.jar: $(srcdir)/META-INF/MANIFEST.MF \
			 $(JAR_ROOT)/.libs $(JAR_ROOT)/.classes
	$(JAR) cvfm $@ $(srcdir)/META-INF/MANIFEST.MF \
	    -C $(srcdir)/apps fonts \
	    -C $(srcdir)/apps images \
	    -C $(srcdir)/apps sounds \
	    -C $(JAR_ROOT) .
	chmod +x $@

@PACKAGE@.jar: @PACKAGE@-@VERSION@.jar
	rm -f $@
	$(LN_S) @PACKAGE@-@VERSION@.jar $@

endif # HAVE_GRADLE

play-java-asteroids: @PACKAGE@.jar
	$(JAVA_HOME)/bin/java -jar $< asteroids

play-java-jarbles: @PACKAGE@.jar
	$(JAVA_HOME)/bin/java -jar $< jarbles

container-self.p12:
	DNAME="`echo $(DN_BASE) | sed 's|/|,|g'`"; \
	$(KEYTOOL) -keystore $@ -storetype pkcs12 \
	    -genkey -keyalg RSA -keysize 2048 -sigalg SHA256withRSA \
	    -alias "$(ALIAS)" -validity 3650 \
	    -dname "$${DNAME},OU=Service,CN=$(ALIAS)" \
	    -ext "SAN=dns:$(HOSTNAME),dns:www.$(HOSTNAME)" \
	    -storepass "$(STOREPASS)"

container-service-req.pem: container-self.p12
	$(KEYTOOL) -certreq -alias $(ALIAS) \
	    -file $@ -keystore $< -storepass $(STOREPASS)

container-chain.pem: container-service-cert.pem serviceCA-chain.pem
	cat $^ > $@

container.p12: container-self.p12 container-chain.pem
	cp $< $@.partial
	$(KEYTOOL) -importcert -alias $(ALIAS) \
	    -file container-chain.pem -noprompt \
	    -keystore $@.partial -storepass $(STOREPASS)
	mv $@.partial $@

install-data-local: .javadoc
	$(MKDIR_P) $(DESTDIR)$(docdir)
	cp -R javadoc $(DESTDIR)$(docdir)

scripts/check-java.sh: @PACKAGE@.jar
	$(MKDIR_P) scripts
	echo '#!/bin/sh' > $@
	echo $(JAVA_HOME)/bin/java -jar @PACKAGE@.jar test >> $@
	chmod +x $@

TESTS += scripts/check-java.sh
CLEANFILES += \
	scripts/check-java.sh .javadoc \
	@PACKAGE@-@VERSION@.jar @PACKAGE@.jar \
	@PACKAGE@-@VERSION@.war @PACKAGE@.war
MOSTLYCLEANFILES += \
	@PACKAGE@-jetty.ini \
	*.p12.partial

clean-local-java:
	-rm -rf .gradle/ javadoc

mostlyclean-local-java:
	-rm -rf $(JAR_ROOT) build/

else # !HAVE_JAVA

clean-local-java:

mostlyclean-local-java:

endif # HAVE_JAVA

## System ==============================================================

clean-local: clean-local-java
	rm -rf target/

mostlyclean-local: mostlyclean-local-java

dist-hook:
	-rm -f `find $(distdir)/apps -name \*~`

docdir        = $(datadir)/doc/@PACKAGE@-@VERSION@
dist_doc_DATA = README.md LICENSE

uninstall-local:
	rm -rf $(DESTDIR)$(docdir)

# Notes on Apache2 HTTPD installation
#   apt install -y apache2
#   a2enmod userdir auth_digest authn_socache authn_dbd
#   vi /etc/apache2/mods-available/userdir.conf
#       AllowOverride ... Options=ExecCGI,MultiViews
#   systemctl enable apache2
#   systemctl restart apache2

HOSTNAME  = localhost
ALIAS     = $(HOSTNAME)
STOREPASS = 123456

EXTRA_DIST = \
	bootstrap \
	apps/images/ \
	apps/fonts/ \
	apps/sounds/ \
	scripts/@PACKAGE@.spec \
	scripts/@PACKAGE@.dpkg \
	scripts/ca.conf \
	scripts/container-jettypod \
	source/gizmo/gizmo.h \
	source/gizmo/asteroids.h \
	META-INF/MANIFEST.MF \
	WEB-INF/web.xml \
	WEB-INF/jetty-env.xml \
	$(JAVA_DISTSRC) \
	$(SERVLET_DISTSRC) \
	$(RUST_DISTSRC)
	$(PYTHON_DISTSRC)

.SECONDARY: serviceCA-key.pem clientCA-key.pem

.PHONY: clean-local-java mostlyclean-local-java \
	node-serve rs-serve \
	deploy deploy-jetty deploy-tomcat \
	install-jetty-https \
	jettypod-interact \
	jettypod-start jettypod-stop \
	jettypod-destroy jettypod-purge
