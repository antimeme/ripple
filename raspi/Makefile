# Raspberry Pi workshop
#
# Raspberry Pi Hardware
# - Ibis: PiZeroW2 512MB LXDE Raspian 12 32bit 64GB black case
# - Mockingbird: Pi4B 4GB LXDE Raspian 12 64bit 128GB screen case
# - Thrush: Pi4B 8GB LXDE Raspian 12 64bit 64GB black case (upstairs)
# - Blackbird: Pi5B 8GB LXDE Raspian 12 64bit 64GB black case
# - Vireo: Pi500 8GB LXDE Raspian 12 64bit 64GB keyboard
# - Cardinal: Pi400 4GB LXDE Raspian 12 64bit 64GB keyboard
# - Warbler: Pi4B 4GB LXDE Raspian 11 64bit 32GB screen case
# - Finch: [Pi4B] [???]GB LXDE Raspian 12 32bit 64GB kano screen
# - Kestral: Pi4B 4GB LXDE Raspian 12 64bit 32GB red/white case
# - Kite: Pi4B [???]GB LXDE Raspian 12 64bit 32GB TFT case
# - Dove: PiB 450MB LXDE Raspian 12 32bit 64GB translucent blue case
# - Bluebird: [unused]
# - Starling: [unused]
# - Robin: [unused]
#
# Raspberry Pi Cluster
# - Hafnium(Hf/72): Pi3B ?? LXDE Raspian 12 64bit 8GB
# - Tantalum(Ta/73): Pi3B ?? LXDE Raspian 12 64bit 8GB
# - Tungsten(W/74): Pi3B ?? LXDE Raspian 12 64bit 8GB
# - Rhenium(Re/75): Pi3B ?? LXDE Raspian 12 64bit 8GB
# - Osmium(Os/76): [unused]
#
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
