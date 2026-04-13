#!/bin/sh
DRIVE=$(dirname $0)/netbsd.qcow2
ISO=`ls ~/Downloads/NetBSD-10.1-amd64.iso | tail -1`
NETCARD=e1000
PORT=7322

# NetBSD 10.1  kernel panics with virtio VGA
VGA=std

if [ -e $DRIVE ]; then
    qemu-system-x86_64 \
        -m 4G -smp 4 -enable-kvm \
        -vga $VGA -display gtk,zoom-to-fit=on \
        -audiodev sdl,id=snd0 -machine pcspk-audiodev=snd0 \
        -device ac97,audiodev=snd0 \
        -netdev user,id=net0,hostfwd=tcp::$PORT-:22 \
        -device $NETCARD,netdev=net0 \
        -drive file=$DRIVE,format=qcow2
elif [ -e "$ISO" ]; then
    qemu-img create -f qcow2 $DRIVE 32G
    qemu-system-x86_64 -m 4G -smp 4 -boot d -cdrom "$ISO" \
        -netdev user,id=net0 -device $NETCARD,netdev=net0 \
        -drive file=$DRIVE,format=qcow2
else echo "ERROR: no ISO detected in ~/Downloads"; fi
