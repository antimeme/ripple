# Matryoshka

## ReactOS

### Instructions for creating a ReactOS virtual machine on Debian.

```sh
$ sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils
$ qemu-img create -f qcow2 reactos.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=reactos.qcow2,format=qcow2 \
    -cdrom ~/Downloads/ReactOS-0.4.15-release-1-gdbb43bbaeb2-x86.iso
```

### Run ReactOS

```sh
$ qemu-system-x86_64 -m 4G -smp 4 \
    -vga virtio -display gtk -enable-kvm \
    -drive file=reactos.qcow2,format=qcow2 \
    -netdev user,id=net0 -device e1000,netdev=net0
```

## FreeBSD

### Instructions for creating a FreeBSD virtual machine on Debain.

```sh
$ sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils
$ qemu-img create -f qcow2 freebsd.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=freebsd.qcow2,format=qcow2 \
    -cdrom ~/Downloads/FreeBSD-15.0-RELEASE-amd64-disc1.iso
```

### Run FreeBSD with SSH server on local port 2222

```sh
$ qemu-system-x86_64 -m 4G -smp 4 \
    -vga virtio -display gtk -enable-kvm \
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

Install packages useful for development:

```sh
$ sudo pkg install -y curl vim emacs git gmake gcc \
                      gmake gcc autoconf automake libtool pkgconf \
                      python3 openjdk8
```

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

# OpenBSD

## Instructions for creating an OpenBSD virtual machine on Debian.

```sh
$ sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils
$ qemu-img create -f qcow2 openbsd.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=openbsd.qcow2,format=qcow2 \
    -cdrom ~/Downloads/install78.iso
```

## Run OpenBSD with SSH server on local port 2222

```sh
$ qemu-system-x86_64 -m 4G -smp 4 \
    -vga virtio -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::2222-:22 \
    -device e1000,netdev=net0 \
    -drive file=openbsd.qcow2,format=qcow2
```

## OpenBSD notes

Configure sudo for easier access to root account (allow sudo use
by wheel group and add user to that group):

```sh
$ /usr/bin/su
# pkg_add -v sudo bash
# chsh $USER
# usermod -G wheel $USER
# visudo
```

Install some useful packages:

```sh
$ sudo pkg_add -v vim emacs git gmake gcc libtool pkgconf
```

Install and start web server:

```sh
$ sudo pkg_add -v bash vim emacs git gmake gcc apache-httpd
$ sudo rcctl enable apache2
$ sudo rcctl start apache2
```

Starting X is best done using the `rcctl` command.

```sh
$ sudo pkg_add -v xfce
$ echo exec startxfce4 > ~/.xsession
$ sudo rcctl -f start xenodm
```
