## Makefile.am
## Copyright (C) 2006-2025 by Jeff Gold.
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

CLEANFILES           =
MOSTLYCLEANFILES     =
DISTCLEANFILES       =
MAINTAINERCLEANFILES = *.p12 *.der *.pem *.srl .passwd

## C ===================================================================
bin_PROGRAMS =
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

if HAVE_MINGW
# MinGW is a GCC variant that creates executables intended for
# Microsoft Windows.  Combined with Wine this makes it possible to
# build and run programs which can be provided to Windows users.
# Instructions in this section use resource files to pack an icon, a
# font and sound files into a single executable file.
#
# Note that the ImageMagick convert utility is used to create a
# Windows icon file from an SVG source, but that is not checked by
# the configure.ac for the moment.
#
# Playing sounds is optional but requires cross compiling libvorbis.
#
# $ sudo apt install -y imagemagick mingw-w64
# $ URL=https://ftp.osuosl.org/pub/xiph/releases
# $ curl -O $URL/ogg/libogg-1.3.5.tar.gz
# $ curl -O $URL/vorbis/libvorbis-1.3.7.tar.gz
# $ tar xzf libogg-1.3.5.tar.gz
# $ tar xzf libvorbis-1.3.7.tar.gz
# $ mkdir -p ~/.install/mingw
# $ (cd libogg-1.3.5/ && ./configure --host=i686-w64-mingw32 \
#    --prefix=$HOME/.install/mingw && make && make install)
# $ (cd libvorbis-1.3.7 && ./configure --host=i686-w64-mingw32 \
#    --prefix=$HOME/.install/mingw --with-ogg=$HOME/.install/mingw && \
#    make CPPFLAGS=-I$HOME/.install/mingw && make install)
# $ ./configure --with-win32-vorbis=$HOME/.install/mingw
# $ make gizmo.exe
#
# Run the program using Wine:
#
# $ sudo dpkg --add-architecture i386 && sudo apt update
# $ sudo apt install -y wine win32:i386
# $ winecfg
# $ make play-win32-asteroids

GIZMO_CPPFLAGS_WIN32 = $(WIN32_CPPFLAGS_VORBIS) \
	-I $(srcdir)/source/gizmo \
	-DPATH_SOUND="$(srcdir)/apps/sounds/%s.ogg" \
	-DPATH_FONT="$(srcdir)/apps/fonts/%s.ttf"
GIZMO_LDFLAGS_WIN32  = $(WIN32_LDFLAGS_VORBIS) \
	-ldsound -lole32 -lwinmm -mwindows
GIZMO_SOURCES_WIN32  = \
	$(srcdir)/source/gizmo/gizmo-win32.c \
	$(srcdir)/source/gizmo/asteroids.c
if HAVE_WIN32_VORBIS
GIZMO_CPPFLAGS_WIN32 += -DHAVE_WIN32_VORBIS
GIZMO_LDFLAGS_WIN32  += -lvorbisfile -lvorbis -logg -static
endif

gizmo.ico: $(srcdir)/apps/images/asteroids.svg
	convert $< -define icon:auto-resize=256,128,64,48,32,16 $@

gizmo.res: ./source/gizmo/gizmo.rc gizmo.ico
	$(WINDRES) $< -O coff -o $@

gizmo.exe: gizmo.res $(GIZMO_SOURCES_WIN32)
	$(MINGW) $(GIZMO_CPPFLAGS_WIN32) -o $@ $^ $(GIZMO_LDFLAGS_WIN32)

play-win32-asteroids: gizmo.exe
	wine $<

MOSTLYCLEANFILES += gizmo.res gizmo.ico
CLEANFILES += gizmo.exe
bin_PROGRAMS += gizmo.exe

endif

if HAVE_SDL2
# Debian SDL2:
# $ sudo apt install -y libsdl2-dev libsdl2-{gfx,ttf,image,mixer}-dev
# RedHat SDL2
# $ sudo dnf install -y SDL2{,_{gfx,ttf,image,mixer}}-devel
# Guix SDL2
# $ guix install sdl2 sdl2-ttf sdl2-gfx sdl2-image
# MSYS2 on Windows SDL2
# $ pacman --noconfirm -S mingw-w64-x86_64-toolchain \
#   mingw-w64-x86_64-SDL2{,_{gfx,ttf,image,mixer}}
bin_PROGRAMS += gizmo
gizmo_CPPFLAGS =  \
	-DPATH_SOUND="$(srcdir)/apps/sounds/%s.ogg" \
	-DPATH_FONT="$(srcdir)/apps/fonts/%s.ttf"
gizmo_CFLAGS = $(SDL2_CFLAGS)
gizmo_LDFLAGS = $(SDL2_LIBS) -lm
gizmo_SOURCES = \
	source/gizmo/gizmo-sdl.c \
	source/gizmo/asteroids.c

play-sdl-asteroids: gizmo
	./gizmo

# Building for Windows on MSYS2 can be done this way:
# $ CC=/mingw64/bin/gcc ./configure && make gizmo.exe && ./gizmo.exe
#
# Here's how to do this without autotools:
# $ /mingw64/bin/gcc.exe -o gizmo.exe source/gizmo/*.c \
#   `pkgconf --cflags --static --libs sdl2 SDL2_{mixer,ttf,gfx,image}`
#
# Unfortunately both methods use about 70 DLL dependencies, all of
# which must be shipped along with apps/fonts and apps/sounds.
endif

# Some notes on Mono and C#
# $ sudo apt install -y mono-complete
# $ git clone https://github.com/flibitijibibo/SDL2-CS
# $ (cd SDL2-CS && make)
# $ mcs -r:SDL2-CS/bin/Debug/SDL2-CS.dll Asteroids.cs -out:Asteroids.exe
# $ MONO_PATH=./SDL2-CS/bin/Debug mono Asteroids.exe

# Some notes on Dotnet and C#
# Download from https://github.com/libsdl-org/SDL/releases
# c:\> git clone https://github.com/flibitijibibo/SDL2-CS
# c:\> cd SDL2-CS
# c:\SDL2-CS\> csc /target:library /out:SDL2-CS.dll /unsafe SDL2.cs
# c:\SDL2-CS\> cd ..
# c:\> csc /r:SDL2-CS\SDL2-CS.dll /out: Asteroids.exe Asteroids.cs
# c:\> Asteroids.exe

if HAVE_EMCC
# Emscripten is kinda dumb about its ports.  The following may
# be necessary to avoid permission errors:
# $ sudo apt install -y emscripten
# $ export EM_CONFIG=$HOME/.emscripten
# $ [ ! -e "$EM_CONFIG" ] && emcc --generate-config
# $ make apps/gizmo.html
apps/gizmo.wasm apps/gizmo.js apps/gizmo.html apps/gizmo.data: \
	    source/gizmo/gizmo-sdl.c source/gizmo/asteroids.c
	$(EMCC) -o $@ \
	    -sALLOW_MEMORY_GROWTH \
	    --preload-file apps/fonts/ \
	    --preload-file apps/sounds/ \
	    -sUSE_SDL=2 \
	    -sUSE_SDL_MIXER=2 -sUSE_SDL_TTF=2 -sUSE_SDL_GFX=2 \
	    -sUSE_SDL_IMAGE=2 -sSDL2_IMAGE_FORMATS='["svg"]' \
	    source/gizmo/gizmo-sdl.c \
	    source/gizmo/asteroids.c
endif

## Public Key Infrastructure ===========================================
# To the extent possible, generic rules are used to reduce repetition.
# Many things can be done this way, but the shape of the PKI has to
# be defined explicitly.
DN_BASE  = C=US/O=Example
#ALG_PKEY = ed25519
ALG_PKEY = rsa \
	-pkeyopt rsa_keygen_bits:2048 \
	-pkeyopt rsa_keygen_pubexp:65537
OPENSSL  = openssl

%CA/key.pem:
	$(MKDIR_P) $(@D)
	$(OPENSSL) genpkey -algorithm $(ALG_PKEY) -out $@
	touch $(@D)/db.txt
	echo 01 > $(@D)/serial.txt

# Root certificate authority signs itself.  There's no higher
# authority to vouch for it but it's useful to have a certificate in
# X.509 format to use when referencing it.  This authority is
# intended primarily for signing issuing certificates.
rootCA/cert.pem: rootCA/key.pem
	$(OPENSSL) x509 -new -key $< -out $@ -sha256 -days 3650 \
	    -subj "/$(DN_BASE)/OU=CA/CN=Root CA"

%CA/req.pem: %CA/key.pem
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=CA/CN=$(@D)"

# Creates an intermediate certificate authority which can sign end
# entities but cannot sign subordinate authorities.
%CA/cert.pem: %CA/req.pem rootCA/key.pem rootCA/cert.pem
	OPENSSL_CONF=@srcdir@/scripts/ca.conf \
	$(OPENSSL) ca -in $< -out $@ -batch -rand_serial \
	    -name CA_root -extensions ca1_role_ext

# When necessary revoke a certifcate using:
#     openssl ca -revoke compromised-cert.pem
# Then recreate the CRL using this target
%CA/crl.pem: %CA/key.pem %CA/cert.pem %CA/db.txt
	OPENSSL_CONF=@srcdir@/scripts/ca.conf \
	$(OPENSSL) ca -gencrl -out $@

# Client Certificates ==================================================

# Given a label for a client certificate we would like to look up a
# full name.  The /etc/passwd file usually has this information so
# we'll use that.  Set the USERFILE make variable to point this at
# a different source if necessary.
USERFILE = /etc/passwd

%-key.pem:
	$(OPENSSL) genpkey -algorithm $(ALG_PKEY) -out $@

%-cli-req.pem: %-key.pem
	LABEL=`echo $< | sed 's,-key.pem$$,,'`; \
	NAME=`grep ^$$LABEL: $(USERFILE) | \
	      cut -d : -f 5 | cut -d , -f 1`; \
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=Users/CN=$${NAME:-$$LABEL}"

%-cli-cert.pem: %-cli-req.pem clientCA/cert.pem clientCA/key.pem
	OPENSSL_CONF=@srcdir@/scripts/ca.conf \
	$(OPENSSL) ca -in $< -out $@ -batch -rand_serial \
	    -name CA_client -extensions client_role_ext

%-cert.der: %-cert.pem
	$(OPENSSL) x509 -in $< -out $@ -outform der

# Certificate chain for a single client.
%-client.pem: %-cli-cert.pem clientCA/cert.pem
	@cat $^ >$@.in
	@mv $@.in $@

# PKCS#12 ==============================================================
# Bundled private key and certificate chain.

# (Consider https://xkcd.com/936/)
P12PASS = $${P12PASS:-123456}

.passwd:
	umask 077; echo "$(P12PASS)" > $@

%-client.p12: %-key.pem %-client.pem .passwd
	LABEL=`echo $< | sed 's,-key.pem$$,,'`; \
	NAME=`grep $$LABEL $(USERFILE) | \
	      cut -d : -f 5 | cut -d , -f 1`; \
	$(OPENSSL) pkcs12 -export -out $@ -inkey $< \
	    -in "$$LABEL-client.pem" -passout file:.passwd \
	    -name "$${NAME:-$$LABEL}"

## Service Certificates ================================================

%-svc-req.pem: %-key.pem
	LABEL=`echo $< | sed 's,-key.pem$$,,'`; \
	$(OPENSSL) req -new -key $< -out $@ -sha256 \
	    -subj "/$(DN_BASE)/OU=Services/CN=$$LABEL" \
	    -addext "subjectAltName = DNS:$$LABEL, DNS:www.$$LABEL"

%-svc-cert.pem: %-svc-req.pem serviceCA/cert.pem serviceCA/key.pem
	LABEL=`echo $< | sed 's,-svc-req.pem$$,,'` \
	OPENSSL_CONF=@srcdir@/scripts/ca.conf \
	$(OPENSSL) ca -in $< -out $@ -batch -rand_serial \
	    -name CA_service -extensions server_role_ext

%-svc.pem: %-svc-cert.pem serviceCA/cert.pem
	cat $^ >$@.in
	mv $@.in $@

server-key.pem: localhost.localdomain-key.pem
	cp $< $@

server-chain.pem: localhost.localdomain-svc.pem
	cp $< $@

## Node.js =============================================================

node-serve: source/js/server.js \
	    server-key.pem server-chain.pem rootca-cert.pem
	node $<

## Rust ================================================================
RUST_DISTSRC = \
	$(srcdir)/source/ripple.rs \
	$(srcdir)/source/expense.rs \
	$(srcdir)/source/server.rs

rs-serve: Cargo.toml $(srcdir)/source/build.rs $(RUST_DISTSRC) \
	  server-key.pem server-chain.pem rootCA/cert.pem
	cargo run --bin server

rs-asteroids: Cargo.toml $(srcdir)/source/build.rs \
	      $(srcdir)/source/asteroids.rs
	cargo run --bin asteroids

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
	@echo jetty.sslContext.keyStorePassword=$(P12PASS) >>$@
	@echo jetty.sslContext.keyManagerPassword=$(P12PASS) >>$@
	@echo jetty.sslContext.wantClientAuth=true >>$@
	@echo jetty.sslContext.trustStorePath=etc/container.p12 >>$@
	@echo jetty.sslContext.trustStoreType=pkcs12 >>$@
	@echo jetty.sslContext.trustStorePassword=$(P12PASS) >>$@

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
	rm -f $@; $(LN_S) @PACKAGE@-@VERSION@.jar $@

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
	    -storepass "$(P12PASS)"

container-svc-req.pem: container-self.p12
	$(KEYTOOL) -certreq -alias $(ALIAS) \
	    -file $@ -keystore $< -storepass $(P12PASS)

container.p12: container-self.p12 container-svc.pem
	cp $< $@.partial
	$(KEYTOOL) -importcert -alias $(ALIAS) \
	    -file container-svc.pem -noprompt \
	    -keystore $@.partial -storepass $(P12PASS)
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

# Debian Apache HTTPD installation
# $ sudo apt install -y apache2
# $ sudo a2enmod userdir auth_digest authn_socache authn_dbd
# $ sudo vi /etc/apache2/mods-available/userdir.conf
#       AllowOverride ... Options=ExecCGI,MultiViews
# $ sudo systemctl enable apache2
# $ sudo systemctl restart apache2
# $ chmod +x ~
# $ mkdir ~/public_html

HOSTNAME  = localhost
ALIAS     = $(HOSTNAME)

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

.PRECIOUS: %CA/key.pem %CA/cert.pem %-key.pem

.PHONY: clean-local-java mostlyclean-local-java \
	node-serve rs-serve rs-asteroids \
	deploy deploy-jetty deploy-tomcat \
	install-jetty-https \
	jettypod-interact \
	jettypod-start jettypod-stop \
	jettypod-destroy jettypod-purge \
	play-win32-asteroids \
	play-sdl-asteroids
