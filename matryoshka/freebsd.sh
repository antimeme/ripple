#!/bin/sh
qemu-system-x86_64 \
    -m 4G -smp 4 -vga virtio -display gtk -enable-kvm \
    -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
    -device ac97,audiodev=snd0 \
    -netdev user,id=net0,hostfwd=tcp::7022-:22 \
    -device e1000,netdev=net0 \
    -drive file=$(dirname $0)/freebsd.qcow2,format=qcow2
