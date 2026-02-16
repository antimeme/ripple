#!/bin/sh
qemu-system-x86_64 \
    -m 4G -smp 4 -vga virtio -display gtk -enable-kvm \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -drive file=$(dirname $0)/reactos.qcow2,format=qcow2
