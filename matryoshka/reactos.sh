#!/bin/sh
DRIVE=$(dirname $0)/reactos.qcow2
ISO=`ls ~/Downloads/ReactOS-*.iso | tail -1`
VGA=virtio

if [ -e $DRIVE ]; then
    qemu-system-x86_64 \
        -m 4G -smp 4 -vga $VGA -display gtk -enable-kvm \
        -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
        -device ac97,audiodev=snd0 \
        -netdev user,id=net0 -device e1000,netdev=net0 \
        -drive file=$DRIVE,format=qcow2
elif [ -e "$ISO" ]; then
    qemu-img create -f qcow2 $DRIVE 32G
    qemu-system-x86_64 -m 4G -smp 4 -boot d -cdrom "$ISO" \
        -netdev user,id=net0 -device e1000,netdev=net0 \
        -drive file=$DRIVE,format=qcow2
else echo "ERROR: no ISO detected in ~/Downloads"; fi
