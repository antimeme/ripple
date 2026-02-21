---
title: Matryoshka QEMU Scripts
---

This document contains the steps necessary to create virtual machines
for a variety of free software operating systems as well as
instructions for setting up a common set of features.

### Debian Host

```sh
$ sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils
```

## ReactOS

### Create Virtual Machine (Debian host)

```sh
$ qemu-img create -f qcow2 reactos.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=reactos.qcow2,format=qcow2 \
    -cdrom ~/Downloads/ReactOS-0.4.15-release-1-gdbb43bbaeb2-x86.iso
```

### Run ReactOS

```sh
$ qemu-system-x86_64 -m 4G -smp 4 -vga virtio -display gtk -enable-kvm \
    -drive file=reactos.qcow2,format=qcow2 \
    -netdev user,id=net0 -device e1000,netdev=net0
```

## FreeBSD

FreeBSD is a stable and well supported operating system derived from
the Berkley Software Distribution.

TODO: explain how to encrypt drive

### Create Virtual Machine (Debian host)

```sh
$ qemu-img create -f qcow2 freebsd.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=freebsd.qcow2,format=qcow2 \
    -cdrom ~/Downloads/FreeBSD-15.0-RELEASE-amd64-disc1.iso
```

### Run FreeBSD with SSH server on local port 2222

```sh
$ qemu-system-x86_64 -m 4G -smp 4 -vga virtio -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22 \
    -device e1000,netdev=net0 \
    -drive file=freebsd.qcow2,format=qcow2
```

### FreeBSD Notes

Install some basic packages and make the user an administrator.

```sh
$ su
# pkg install -y sudo bash
# pw groupmod wheel -m $USER
# visudo
# chsh $USER
```

Common package management commands:

```sh
$ sudo pkg update
$ pkg info # list installed packages
$ pkg search $term # list packages that match a search term
$ pkg info -l $package # list files owned by package
$ pkg which /path/to/file # find package that owns a file
$ sudo pkg delete $package # remove an installed package
```

Install packages useful for development:

```sh
$ sudo pkg install -y curl vim emacs git gmake gcc \
                      gmake gcc autoconf automake libtool pkgconf \
                      python3 openjdk8
```

  - \# pkg install -y gdb valgrind \
           \
           sdl2 sdl2_{mixer,ttf,gfx,image}} \
           nodejs npm emscripten \
           java-latest-openjdk gradle
  - \# pkg install -y sdl2 sdl_{mixer,ttf,gfx,image}


Install a web server:

```sh
$ sudo pkg install -y apache24
$ sudo sysrc apache24_enable="YES"
$ sudo vi /usr/local/etc/apache24/httpd.conf
$ sudo vi /usr/local/etc/apache24/extra/httpd-userdir.conf
$ sudo service apache24 start
```

Edit `ServerName` in `httpd.conf` to reduce warning message clutter.
Ensure that the following lines are not commented out:

```
LoadModule userdir_module libexec/apache24/mod_userdir.so
Include etc/apache24/extra/httpd-userdir.conf
```

Change `httpd-userdir.conf` to comment out the line that disables
user directories:

```
#UserDir disabled
```

Here are the steps necessary to run a graphical desktop:

```sh
$ sudo pkg install -y xorg xfce
$ sudo sysrc dbus_enable="YES"
$ sudo service dbus start
$ echo "proc /proc procfs rw 0 0" | sudo tee -a /etc/fstab
$ sudo mount /proc
$ cp /usr/local/etc/xdg/xfce4/xinitrc ~/.xinitrc
$ startx
```

The following will configure graphical desktop on boot:

```sh
$ sudo pkg install -y lightdm lightdm-gtk-greeter
$ sudo sysrc lightdm_enable="YES"
$ sudo vi /usr/local/etc/lightdm/lightdm.conf
```

Consider setting autologin-user and autologin-user-timeout so that
the system boots into a user account.

# NetBSD

NetBSD is a free software operating system derived from Berkley
System Distribution.  It is focused on portability.

### Create Virtual Machine (Debian host)

```sh
$ qemu-img create -f qcow2 netbsd.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=netbsd.qcow2,format=qcow2 \
    -cdrom ~/Downloads/NetBSD-10.1-amd64.iso
```

TODO: explain how to encrypt drive

### Run NetBSD with SSH server on local port 2222

In contrast to other operating systems described in this document,
NetBSD 10.1 gets a kernel panic when `-vga virtio` is specified.
So maybe don't do that.

```sh
$ qemu-system-x86_64 -m 4G -smp 4 -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22 \
    -device e1000,netdev=net0 \
    -drive file=netbsd.qcow2,format=qcow2
```

### NetBSD Notes

Apparently NetBSD doesn't always set up DHCP automatically?  Maybe
I just missed something in the installation process but I got
creative below and wrote a script to fix this if missing.  Fun fact:
`netstat -an` will show listening ports.  It's not quite as good as
`netstat -ltpn` on Linux but it'll do in a pinch.

Also, NetBSD doesn't seem to prompt for a host name during
installation so that has to get configured as well.

Unlike other BSD variants, the NetBSD default package manager seems
to need to be explicitly configured to use the system package
repository.  Also, there seems to be a better quality package manager
named `pkgin` recommended by the internet.  So.

Note that adding a user to the `operator` group allows shutting down
the virtual machine from the desktop.

Configure sudo for easier access to root account (allow sudo use
by wheel group and add user to that group):

```sh
$ su
# if [ ! -e /etc/myname ]; then \
    echo matryoshka > /etc/myname; \
    hostname matryoshka; fi
# if ! grep dhcpcd /etc/rc.conf; then \
    echo dhcpcd=YES >> /etc/rc.conf; dhcpcd; \
  elif grep dhcpcd=NO /etc/rc.conf; then \
    sed s/dhcpcd=NO/dhcpcd=YES/ /etc/rc.conf > /tmp/rc.conf &&
    mv /tmp/rc.conf; dhcpcd;
  fi
# URL="https://cdn.NetBSD.org/pub/pkgsrc/packages/NetBSD"
# PKG_PATH="$URL/$(uname -p)/$(uname -r | cut -d_ -f1)/All" \
    pkg_add sudo bash pkgin
# chsh $USER
# usermod -G wheel $USER
# usermod -G operator $USER # allows desktop shutdown
# visudo
```

Common package management commands:

```sh
$ sudo pkgin upgrade # update packages
$ sudo pkgin upgrade # update installed packages
$ pkgin list # list installed packages
$ pkgin search $term # list packages that match a search term
$ pkg_info -L $package # list files owned by package
$ pkg_info -Fe /path/to/file # find package that owns a file
$ sudo pkgin remove $package # remove an installed package
```

Install some useful packages:

```sh
$ sudo pkgin -y install curl vim emacs git \
  gcc gmake autoconf automake libtool pkgconf \
  SDL2 SDL2_{gfx,image,mixer,ttf}
```

Install XFCE:

```sh
$ sudo pkgin -y install xfce4 dbus
$ echo dbus=YES | sudo tee -a /etc/rc.conf
$ echo hal=YES | sudo tee -a /etc/rc.conf
$ sudo service start dbus
$ sudo service start hal
$ echo "exec startxfce4" > ~/.xsession
```

# OpenBSD

OpenBSD is a security focused operating system derived from Berkley
System Distribution.  This is quirky and less feature rich compared to
Debian but is useful when security is a critical priority.

### Create Virtual Machine (Debian host)

```sh
$ qemu-img create -f qcow2 openbsd.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=openbsd.qcow2,format=qcow2 \
    -cdrom ~/Downloads/install78.iso
```

### Run OpenBSD with SSH server on local port 2222

```sh
$ qemu-system-x86_64 -m 4G -smp 4 -vga virtio -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22 \
    -device e1000,netdev=net0 \
    -drive file=openbsd.qcow2,format=qcow2
```

### OpenBSD notes

Note that adding a user to the `_shutdown` group allows shutting down
the virtual machine from the desktop.

Configure sudo for easier access to root account (add user to
wheel group and allow wheel members to act as root):

```sh
$ /usr/bin/su
# pkg_add -v sudo bash
# chsh $USER
# usermod -G wheel $USER
# usermod -G _shutdown $USER
# visudo
```

Common package management commands:

```sh
$ sudo pkg_add -Uu # update packages
$ sudo pkg_add -u # update installed packages
$ pkg_info # list installed packages
$ pkg_info -Q $term # list packages that match a search term
$ pkg_info -L $package # list files owned by package
$ pkg_info -E /path/to/file # find package that owns a file
$ sudo pkg_delete $package # remove an installed package
```

Install some useful packages:

```sh
$ sudo pkg_add -v vim emacs curl git \
  gmake autoconf automake libtool devel/pkgconf \
  sdl2 sdl2-{gfx,image,mixer,ttf}
```

TODO: figure out where pkgconf is hiding

Install and start a web server:

```sh
$ sudo pkg_add -v apache-httpd
$ sudo vi /etc/apache2/httpd2.conf
$ sudo vi /etc/apache2/extra/httpd-userdir.conf
$ sudo rcctl enable apache2
$ sudo rcctl start apache2
```

Edit `ServerName` in `httpd2.conf` to reduce warning message clutter.
Ensure that the following lines are not commented out:

```
LoadModule userdir_module /usr/local/lib/apache2/mod_userdir.so
Include /etc/apache2/extra/httpd-userdir.conf
```

Change `httpd-userdir.conf` to comment out the line that disables
user directories:

```
#UserDir disabled
```

Install XFCE:

```sh
$ sudo pkg_add -v xfce
$ echo "exec startxfce4" > ~/.xsession
```

If you didn't ask for `xenodm` during installation, it can be set
up this way:

```sh
$ sudo pkg_add -v xenodm
$ sudo rcctl enable xenodm
$ sudo rcctl -f start xenodm
$ sudo vi /etc/X11/xenodm/xenodm-config
```

Create a line that looks like this:

```
DisplayManager*autoLogin: username
```
