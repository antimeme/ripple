#!/bin/sh
# Other scripts use "-vga virtio" here but that causes a kernel panic
# for NetBSD 10.1.  Maybe later versions will accept it.
qemu-system-x86_64 -m 4G -smp 4 -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::7322-:22 \
    -device e1000,netdev=net0 \
    -drive file=$(dirname $0)/netbsd.qcow2,format=qcow2
