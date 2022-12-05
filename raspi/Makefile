# Raspberry Pi workshop
# Required packages: wget screen qemu-system

# Consider setting these values from the environment or command line
SDCARD ?= /dev/sda
SDSIZE ?= 32G
SERIAL ?= /dev/ttyUSB0
RPI_MODEL ?= 4
DEBIAN_RELEASE ?= bookworm
DEBIAN_URL ?= https://raspi.debian.net/daily

TARGETS := emulate

all: $(TARGETS)

clean:
	rm sdcard.img

kernel-arm64:
	false # TODO

initrd.img-arm64:
	false # TODO

bcm2837-rpi-3-b.dtb:
	false # TODO

sdcard.img:
	qemu-img create -b $(SDCARD) -f qcow2 sdcard.img $(SDSIZE)

commit: sdcard.img
	qemu-img commit sdcard.img

emulate: sdcard.img kernel-arm64 initrd.img-arm64
	NO_AT_BRIDGE=1 qemu-system-aarch64 \
	  -machine raspi3b -cpu cortex-a72 -m 1G \
	  -kernel ./kernel-arm64 \
	  -initrd ./initrd.img-arm64 \
	  -smp 4 -serial stdio \
	  -dtb ./bcm2837-rpi-3-b.dtb \
	  -drive file=sdcard.img,index=0,media=disk,format=qcow2 \
	  -device usb-net,netdev=net0 \
	  -netdev user,id=net0,hostfwd=tcp::5555-:22 \
	  -append "rw earlyprintk loglevel=8 rootdelay=1 \
	           console=ttyAMA0,115200 root=/dev/mmcblk0p2"

serial:
	screen $(SERIAL) 115200

raspi_${RPI_MODEL}_${DEBIAN_RELEASE}.img.xz:
	wget ${DEBIAN_URL}/$@
	wget ${DEBIAN_URL}/$@.sha256
	sha256sum -c $@.sha256

write: raspi_${RPI_MODEL}_${DEBIAN_RELEASE}.img.xz
	xzcat $* | dd of=${SDCARD} bs=64k oflag=dsync status=progress

mount:
	mkdir -p image
	sudo mount $(SDCARD)2 image
	sudo mount $(SDCARD)1 image/boot

umount:
	sudo umount image/boot; \
	sudo umount image; \
	rmdir image

.PHONY: all clean mount umount emulate commit serial write
