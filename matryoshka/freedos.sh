#!/bin/sh
DRIVE=$(dirname $0)/freedos.qcow2
ISO=`ls ~/Downloads/FD*LIVE.iso | tail -1`
#CDROM=-cdrom ~/Downloads/FD14BNS.iso
CDROM=
VGA=virtio
# e1000 cards aren't supported by FreeDOS 1.4
NETDEV=pcnet

if [ -e $DRIVE ]; then
    qemu-system-x86_64 \
        -m 4G -smp 4 -enable-kvm \
        -vga $VGA -display gtk,zoom-to-fit=on \
        -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
        -device ac97,audiodev=snd0 \
        -netdev user,id=net0 -device $NETDEV,netdev=net0 \
        -drive file=$DRIVE,format=qcow2 $CDROM
elif [ -e "$ISO" ]; then
    qemu-img create -f qcow2 $DRIVE 32G
    qemu-system-x86_64 -m 4G -smp 4 -boot d -cdrom "$ISO" \
        -netdev user,id=net0 -device e1000,netdev=net0 \
        -drive file=$DRIVE,format=qcow2
else echo "ERROR: no ISO detected in ~/Downloads"; fi
