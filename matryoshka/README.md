# Matryoshka

## Instructions for creating a ReactOS virtual machine on Debian.

```sh
$ sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils
$ qemu-img create -f qcow2 reactos.qcow2 32G
$ qemu-system-x86_64 -m 4G -smp 4 -boot d \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=reactos.qcow2,format=qcow2 \
    -cdrom ~/Downloads/ReactOS-0.4.15-release-1-gdbb43bbaeb2-x86.iso
```

## Run ReactOS

```sh
$ qemu-system-x86_64 -m 4G -smp 4 \
    -vga virtio -display gtk -enable-kvm \
    -drive file=reactos.qcow2,format=qcow2 \
    -netdev user,id=net0 -device e1000,netdev=net0
```

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
$ su
# pkg_add -v sudo
# visudo
# usermod -G wheel $USER
```

Install some useful packages and start web server:

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
