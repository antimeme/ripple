/* winj.c
 * Copyright (C) 2026 by Jeff Gold.
 * 
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * ---------------------------------------------------------------------
 * A simplistic Java Virtual Machine.  The interface is based on the
 * Java Native Interface Specification from Java 25.
 *
 * Use the WASI SDK to compile this to WebAssembly:
 *
 *     https://github.com/WebAssembly/wasi-sdk/releases
 *
 * Here is an example compiler command line:
   $ /opt/wasi-sdk/bin/clang \
     -Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined \
     -Wl,--import-memory -Wl,--initial-memory=131072 \
     -nostartfiles -Iinclude -O2 \
     -o winj.wasm source/winj.c
 *
 * After that it should be possible to invoke in a browser, after
 * an enormous amount of effort to backfill all the native methods. */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include "ripple/config.h"
#include "ripple/winj.h"

typedef uint8_t  u1;
typedef uint16_t u2;
typedef uint32_t u4;
typedef uint64_t u8;

const u4 WINJ_MAGIC = 0xcafebabe; /* stay classy, Java */
const u2 WINJ_VERSION_LEAST = 45; /* smallest acceptable major version */
const u2 WINJ_VERSION_MAJOR = 69; /* largest acceptable major version */
const u2 WINJ_VERSION_MINOR = 0;  /* largest acceptable minor version */

enum winj_opcode {
  WINJ_OPCODE_NOP             = 0x00,
  WINJ_OPCODE_ACONST_NULL     = 0x01,
  WINJ_OPCODE_ICONST_M1       = 0x02,
  WINJ_OPCODE_ICONST_0        = 0x03,
  WINJ_OPCODE_ICONST_1        = 0x04,
  WINJ_OPCODE_ICONST_2        = 0x05,
  WINJ_OPCODE_ICONST_3        = 0x06,
  WINJ_OPCODE_ICONST_4        = 0x07,
  WINJ_OPCODE_ICONST_5        = 0x08,
  WINJ_OPCODE_LCONST_0        = 0x09,
  WINJ_OPCODE_LCONST_1        = 0x0a,
  WINJ_OPCODE_FCONST_0        = 0x0b,
  WINJ_OPCODE_FCONST_1        = 0x0c,
  WINJ_OPCODE_FCONST_2        = 0x0d,
  WINJ_OPCODE_DCONST_0        = 0x0e,
  WINJ_OPCODE_DCONST_1        = 0x0f,
  WINJ_OPCODE_BIPUSH          = 0x10,
  WINJ_OPCODE_SIPUSH          = 0x11,
  WINJ_OPCODE_LDC             = 0x12,
  WINJ_OPCODE_LDC_W           = 0x13,
  WINJ_OPCODE_LDC2_W          = 0x14,
  WINJ_OPCODE_ILOAD           = 0x15,
  WINJ_OPCODE_LLOAD           = 0x16,
  WINJ_OPCODE_FLOAD           = 0x17,
  WINJ_OPCODE_DLOAD           = 0x18,
  WINJ_OPCODE_ALOAD           = 0x19,
  WINJ_OPCODE_ILOAD_0         = 0x1a,
  WINJ_OPCODE_ILOAD_1         = 0x1b,
  WINJ_OPCODE_ILOAD_2         = 0x1c,
  WINJ_OPCODE_ILOAD_3         = 0x1d,
  WINJ_OPCODE_LLOAD_0         = 0x1e,
  WINJ_OPCODE_LLOAD_1         = 0x1f,
  WINJ_OPCODE_LLOAD_2         = 0x20,
  WINJ_OPCODE_LLOAD_3         = 0x21,
  WINJ_OPCODE_FLOAD_0         = 0x22,
  WINJ_OPCODE_FLOAD_1         = 0x23,
  WINJ_OPCODE_FLOAD_2         = 0x24,
  WINJ_OPCODE_FLOAD_3         = 0x25,
  WINJ_OPCODE_DLOAD_0         = 0x26,
  WINJ_OPCODE_DLOAD_1         = 0x27,
  WINJ_OPCODE_DLOAD_2         = 0x28,
  WINJ_OPCODE_DLOAD_3         = 0x29,
  WINJ_OPCODE_ALOAD_0         = 0x2a,
  WINJ_OPCODE_ALOAD_1         = 0x2b,
  WINJ_OPCODE_ALOAD_2         = 0x2c,
  WINJ_OPCODE_ALOAD_3         = 0x2d,
  WINJ_OPCODE_IALOAD          = 0x2e,
  WINJ_OPCODE_LALOAD          = 0x2f,
  WINJ_OPCODE_FALOAD          = 0x30,
  WINJ_OPCODE_DALOAD          = 0x31,
  WINJ_OPCODE_AALOAD          = 0x32,
  WINJ_OPCODE_BALOAD          = 0x33,
  WINJ_OPCODE_CALOAD          = 0x34,
  WINJ_OPCODE_SALOAD          = 0x35,
  WINJ_OPCODE_ISTORE          = 0x36,
  WINJ_OPCODE_LSTORE          = 0x37,
  WINJ_OPCODE_FSTORE          = 0x38,
  WINJ_OPCODE_DSTORE          = 0x39,
  WINJ_OPCODE_ASTORE          = 0x3a,
  WINJ_OPCODE_ISTORE_0        = 0x3b,
  WINJ_OPCODE_ISTORE_1        = 0x3c,
  WINJ_OPCODE_ISTORE_2        = 0x3d,
  WINJ_OPCODE_ISTORE_3        = 0x3e,
  WINJ_OPCODE_LSTORE_0        = 0x3f,
  WINJ_OPCODE_LSTORE_1        = 0x40,
  WINJ_OPCODE_LSTORE_2        = 0x41,
  WINJ_OPCODE_LSTORE_3        = 0x42,
  WINJ_OPCODE_FSTORE_0        = 0x43,
  WINJ_OPCODE_FSTORE_1        = 0x44,
  WINJ_OPCODE_FSTORE_2        = 0x45,
  WINJ_OPCODE_FSTORE_3        = 0x46,
  WINJ_OPCODE_DSTORE_0        = 0x47,
  WINJ_OPCODE_DSTORE_1        = 0x48,
  WINJ_OPCODE_DSTORE_2        = 0x49,
  WINJ_OPCODE_DSTORE_3        = 0x4a,
  WINJ_OPCODE_ASTORE_0        = 0x4b,
  WINJ_OPCODE_ASTORE_1        = 0x4c,
  WINJ_OPCODE_ASTORE_2        = 0x4d,
  WINJ_OPCODE_ASTORE_3        = 0x4e,
  WINJ_OPCODE_IASTORE         = 0x4f,
  WINJ_OPCODE_LASTORE         = 0x50,
  WINJ_OPCODE_FASTORE         = 0x51,
  WINJ_OPCODE_DASTORE         = 0x52,
  WINJ_OPCODE_AASTORE         = 0x53,
  WINJ_OPCODE_BASTORE         = 0x54,
  WINJ_OPCODE_CASTORE         = 0x55,
  WINJ_OPCODE_SASTORE         = 0x56,
  WINJ_OPCODE_POP             = 0x57,
  WINJ_OPCODE_POP2            = 0x58,
  WINJ_OPCODE_DUP             = 0x59,
  WINJ_OPCODE_DUP_X1          = 0x5a,
  WINJ_OPCODE_DUP_X2          = 0x5b,
  WINJ_OPCODE_DUP2            = 0x5c,
  WINJ_OPCODE_DUP2_X1         = 0x5d,
  WINJ_OPCODE_DUP2_X2         = 0x5e,
  WINJ_OPCODE_SWAP            = 0x5f,
  WINJ_OPCODE_IADD            = 0x60,
  WINJ_OPCODE_LADD            = 0x61,
  WINJ_OPCODE_FADD            = 0x62,
  WINJ_OPCODE_DADD            = 0x63,
  WINJ_OPCODE_ISUB            = 0x64,
  WINJ_OPCODE_LSUB            = 0x65,
  WINJ_OPCODE_FSUB            = 0x66,
  WINJ_OPCODE_DSUB            = 0x67,
  WINJ_OPCODE_IMUL            = 0x68,
  WINJ_OPCODE_LMUL            = 0x69,
  WINJ_OPCODE_FMUL            = 0x6a,
  WINJ_OPCODE_DMUL            = 0x6b,
  WINJ_OPCODE_IDIV            = 0x6c,
  WINJ_OPCODE_LDIV            = 0x6d,
  WINJ_OPCODE_FDIV            = 0x6e,
  WINJ_OPCODE_DDIV            = 0x6f,
  WINJ_OPCODE_IREM            = 0x70,
  WINJ_OPCODE_LREM            = 0x71,
  WINJ_OPCODE_FREM            = 0x72,
  WINJ_OPCODE_DREM            = 0x73,
  WINJ_OPCODE_INEG            = 0x74,
  WINJ_OPCODE_LNEG            = 0x75,
  WINJ_OPCODE_FNEG            = 0x76,
  WINJ_OPCODE_DNEG            = 0x77,
  WINJ_OPCODE_ISHL            = 0x78,
  WINJ_OPCODE_LSHL            = 0x79,
  WINJ_OPCODE_ISHR            = 0x7a,
  WINJ_OPCODE_LSHR            = 0x7b,
  WINJ_OPCODE_IUSHR           = 0x7c,
  WINJ_OPCODE_LUSHR           = 0x7d,
  WINJ_OPCODE_IAND            = 0x7e,
  WINJ_OPCODE_LAND            = 0x7f,
  WINJ_OPCODE_IOR             = 0x80,
  WINJ_OPCODE_LOR             = 0x81,
  WINJ_OPCODE_IXOR            = 0x82,
  WINJ_OPCODE_LXOR            = 0x83,
  WINJ_OPCODE_IINC            = 0x84,
  WINJ_OPCODE_I2L             = 0x85,
  WINJ_OPCODE_I2F             = 0x86,
  WINJ_OPCODE_I2D             = 0x87,
  WINJ_OPCODE_L2I             = 0x88,
  WINJ_OPCODE_L2F             = 0x89,
  WINJ_OPCODE_L2D             = 0x8a,
  WINJ_OPCODE_F2I             = 0x8b,
  WINJ_OPCODE_F2L             = 0x8c,
  WINJ_OPCODE_F2D             = 0x8d,
  WINJ_OPCODE_D2I             = 0x8e,
  WINJ_OPCODE_D2L             = 0x8f,
  WINJ_OPCODE_D2F             = 0x90,
  WINJ_OPCODE_I2B             = 0x91,
  WINJ_OPCODE_I2C             = 0x92,
  WINJ_OPCODE_I2S             = 0x93,
  WINJ_OPCODE_LCMP            = 0x94,
  WINJ_OPCODE_FCMPL           = 0x95,
  WINJ_OPCODE_FCMPG           = 0x96,
  WINJ_OPCODE_DCMPL           = 0x97,
  WINJ_OPCODE_DCMPG           = 0x98,
  WINJ_OPCODE_IFEQ            = 0x99,
  WINJ_OPCODE_IFNE            = 0x9a,
  WINJ_OPCODE_IFLT            = 0x9b,
  WINJ_OPCODE_IFGE            = 0x9c,
  WINJ_OPCODE_IFGT            = 0x9d,
  WINJ_OPCODE_IFLE            = 0x9e,
  WINJ_OPCODE_IF_ICMPEQ       = 0x9f,
  WINJ_OPCODE_IF_ICMPNE       = 0xa0,
  WINJ_OPCODE_IF_ICMPLT       = 0xa1,
  WINJ_OPCODE_IF_ICMPGE       = 0xa2,
  WINJ_OPCODE_IF_ICMPGT       = 0xa3,
  WINJ_OPCODE_IF_ICMPLE       = 0xa4,
  WINJ_OPCODE_IF_ACMPEQ       = 0xa5,
  WINJ_OPCODE_IF_ACMPNE       = 0xa6,
  WINJ_OPCODE_GOTO            = 0xa7,
  WINJ_OPCODE_JSR             = 0xa8,
  WINJ_OPCODE_RET             = 0xa9,
  WINJ_OPCODE_TABLESWITCH     = 0xaa,
  WINJ_OPCODE_LOOKUPSWITCH    = 0xab,
  WINJ_OPCODE_IRETURN         = 0xac,
  WINJ_OPCODE_LRETURN         = 0xad,
  WINJ_OPCODE_FRETURN         = 0xae,
  WINJ_OPCODE_DRETURN         = 0xaf,
  WINJ_OPCODE_ARETURN         = 0xb0,
  WINJ_OPCODE_RETURN          = 0xb1,
  WINJ_OPCODE_GETSTATIC       = 0xb2,
  WINJ_OPCODE_PUTSTATIC       = 0xb3,
  WINJ_OPCODE_GETFIELD        = 0xb4,
  WINJ_OPCODE_PUTFIELD        = 0xb5,
  WINJ_OPCODE_INVOKEVIRTUAL   = 0xb6,
  WINJ_OPCODE_INVOKESPECIAL   = 0xb7,
  WINJ_OPCODE_INVOKESTATIC    = 0xb8,
  WINJ_OPCODE_INVOKEINTERFACE = 0xb9,
  WINJ_OPCODE_INVOKEDYNAMIC   = 0xba,
  WINJ_OPCODE_NEW             = 0xbb,
  WINJ_OPCODE_NEWARRAY        = 0xbc,
  WINJ_OPCODE_ANEWARRAY       = 0xbd,
  WINJ_OPCODE_ARRAYLENGTH     = 0xbe,
  WINJ_OPCODE_ATHROW          = 0xbf,
  WINJ_OPCODE_CHECKCAST       = 0xc0,
  WINJ_OPCODE_INSTANCEOF      = 0xc1,
  WINJ_OPCODE_MONITORENTER    = 0xc2,
  WINJ_OPCODE_MONITOREXIT     = 0xc3,
  WINJ_OPCODE_WIDE            = 0xc4,
  WINJ_OPCODE_MULTIANEWARRAY  = 0xc5,
  WINJ_OPCODE_IFNULL          = 0xc6,
  WINJ_OPCODE_IFNONNULL       = 0xc7,
  WINJ_OPCODE_GOTO_W          = 0xc8,
  WINJ_OPCODE_JSR_W           = 0xc9,
  WINJ_OPCODE_BREAKPOINT      = 0xca,
  WINJ_OPCODE_IMPDEP1         = 0xfe,
  WINJ_OPCODE_IMPDEP2         = 0xff,
};

/**
 * It's not an accident that some of these have the same value.
 * Duplicate values are applied differently depending on the context.
 * Fields can be TRANSIENT but methods have VARARGS.  Go figure. */
enum winj_access_flags {
  WINJ_ACCESS_PUBLIC       = 0x0001,
  WINJ_ACCESS_PRIVATE      = 0x0002,
  WINJ_ACCESS_PROTECTED    = 0x0004,
  WINJ_ACCESS_STATIC       = 0x0008,
  WINJ_ACCESS_FINAL        = 0x0010,
  WINJ_ACCESS_SYNCHRONIZED = 0x0020,
  WINJ_ACCESS_SUPER        = 0x0020,
  WINJ_ACCESS_VOLATILE     = 0x0040,
  WINJ_ACCESS_BRIDGE       = 0x0040,
  WINJ_ACCESS_TRANSIENT    = 0x0080,
  WINJ_ACCESS_VARARGS      = 0x0080,
  WINJ_ACCESS_NATIVE       = 0x0100,
  WINJ_ACCESS_INTERFACE    = 0x0200,
  WINJ_ACCESS_ABSTRACT     = 0x0400,
  WINJ_ACCESS_STRICT       = 0x0800,
  WINJ_ACCESS_SYNTHETIC    = 0x1000,
  WINJ_ACCESS_ANNOTATION   = 0x2000,
  WINJ_ACCESS_ENUM         = 0x4000,
  WINJ_ACCESS_MODULE       = 0x8000,
};

enum winj_const_tags {
  WINJ_CONST_CLASS              = 7,
  WINJ_CONST_FIELDREF           = 9,
  WINJ_CONST_METHODREF          = 10,
  WINJ_CONST_INTERFACEMETHODREF = 11,
  WINJ_CONST_STRING             = 8,
  WINJ_CONST_INTEGER            = 3,
  WINJ_CONST_FLOAT              = 4,
  WINJ_CONST_LONG               = 5,
  WINJ_CONST_DOUBLE             = 6,
  WINJ_CONST_NAMEANDTYPE        = 12,
  WINJ_CONST_UTF8               = 1,
  WINJ_CONST_METHODHANDLE       = 15,
  WINJ_CONST_METHODTYPE         = 16,
  WINJ_CONST_DYNAMIC            = 17,
  WINJ_CONST_INVOKEDYNAMIC      = 18,
  WINJ_CONST_MODULE             = 19,
  WINJ_CONST_PACKAGE            = 20,
};

enum winj_cpool_flags {
  WINJ_CPOOLF_LOADABLE = 1<<0,
};

struct winj_cpool_version {
  u1 tag;
  u2 major;
  u2 minor;
  unsigned flags;
} winj_cpool_versions[] = {
  { WINJ_CONST_UTF8,               45, 3 },
  { WINJ_CONST_INTEGER,            45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_FLOAT,              45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_LONG,               45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_DOUBLE,             45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_CLASS,              45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_STRING,             45, 3, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_FIELDREF,           45, 3 },
  { WINJ_CONST_METHODREF,          45, 3 },
  { WINJ_CONST_INTERFACEMETHODREF, 45, 3 },
  { WINJ_CONST_NAMEANDTYPE,        45, 3 },
  { WINJ_CONST_METHODHANDLE,       51, 0, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_METHODTYPE,         51, 0, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_DYNAMIC,            55, 0, WINJ_CPOOLF_LOADABLE },
  { WINJ_CONST_INVOKEDYNAMIC,      51, 0 },
  { WINJ_CONST_MODULE,             53, 0 },
  { WINJ_CONST_PACKAGE,            53, 0 },
};

struct winj_bytes {
  unsigned count;
  unsigned offset;
  unsigned char *value;
};

union winj_cpool_info {
  u2 const_class;
  struct cpool_const_fieldref {
    u2 class_index;
    u2 nameandtype_index;
  } const_fieldref;
  struct cpool_const_methodref {
    u2 class_index;
    u2 nameandtype_index;
  } const_methodref;
  struct cpool_const_interfacemethodref {
    u2 class_index;
    u2 nameandtype_index;
  } const_interfacemethodref;
  u2 const_string;
  int32_t const_int;
  float const_float;
  int64_t const_long;
  double const_double;
  struct cpool_const_nameandtype {
    u2 name_index;
    u2 descriptor_index;
  } const_nameandtype;
  struct cpool_const_utf8 {
    u2 length;
    u1 *bytes;
  } const_utf8;
  struct cpool_const_methodhandle {
    u2 reference_kind;
    u2 reference_index;
  } const_methodhandle;
  u2 const_methodtype;
  struct cpool_const_dynamic {
    u2 bootstrap_method_attr_index;
    u2 nameandtype_index;
  } const_dynamic;
  struct cpool_const_invokedynamic {
    u2 bootstrap_method_attr_index;
    u2 nameandtype_index;
  } const_invokedynamic;
  u2 const_module;
  u2 const_package;
};

struct winj_cpool {
  u1 tag;
  union winj_cpool_info info;
};

struct winj_attribute {
  u2 name_index;
  u4 length;
  u1 *info;
};

struct winj_field_file {
  u2 access_flags;
  u2 name_index;
  u2 descriptor_index;
  u2 attributes_count;
  struct winj_attribute *attributes;
};

struct winj_exception_table {
  u2 start_pc;
  u2 end_pc;
  u2 handler_pc;
  u2 catch_type;
};

struct winj_method_code {
  u2 max_stack;
  u2 max_locals;
  u4 code_length;
  struct winj_bytes code;
  u2 exception_table_length;
  struct winj_exception_table *exception_table;
  u2 attributes_count;
  struct winj_attribute *attributes;
};

struct winj_method_file {
  u2 access_flags;
  u2 name_index;
  u2 descriptor_index;
  u2 attributes_count;
  struct winj_attribute *attributes;

  struct winj_method_code code;
  u2 number_of_exceptions;
  u2 *exception_index_table;
};

/**
 * Represents a single class file. */
struct winj_class_file {
  u2 major_version;
  u2 minor_version;

  /* Constant pools are accessed using two byte index values (zero is
   * invalid so values range from 1 to n).  Unfortunately, these don't
   * cleanly correspond to entry numbers because long and double
   * consume two entries each.  To accomodate this, we have an array
   * of pointers (cpool) and an array of two byte index values
   * (cpool_idx).  To access a constant requires looking up the
   * value of cpool[cpool_idx[index]].  Class definition should
   * guarantee that all such entries are either zero or a valid
   * position in the cpool array. */
  u2 cpool_size;
  struct winj_cpool *cpool;
  u2 cpool_count;
  u2 *cpool_idx;

  u2 access_flags;
  u2 this_class;
  u2 super_class;

  u2 iface_count;
  u2 *ifaces;

  u2 fields_count;
  struct winj_field_file *fields;

  u2 methods_count;
  struct winj_method_file *methods;

  u2 attributes_count;
  struct winj_attribute *attributes;

  struct winj_bytes bytes;
};

enum winj_type {
  WINJ_TYPE_VOID    = 0,
  WINJ_TYPE_BYTE    = 1,
  WINJ_TYPE_BOOLEAN = 2,
  WINJ_TYPE_CHAR    = 3,
  WINJ_TYPE_SHORT   = 4,
  WINJ_TYPE_INT     = 5,
  WINJ_TYPE_LONG    = 6,
  WINJ_TYPE_FLOAT   = 7,
  WINJ_TYPE_DOUBLE  = 8,
  WINJ_TYPE_OBJECT  = 9,
};

struct winj_stack_frame {
  struct winj_class  *winj;
  struct winj_method *method;
};

enum winj_thread_flags {
  winj_thread_active    = 1<<0,
  winj_thread_daemon    = 1<<1,
  winj_thread_interrupt = 1<<2,
};

/**
 * Represents a single thread of execution.
 *
 * Each thread has one operand stack and one local variable stack. */
struct winj_thread {
  struct JNINativeInterface *jni_env; /* must be first */
  struct winj_vm *vm;
  unsigned flags;
  unsigned program_counter;

  unsigned frame_count;
  struct winj_stack_frame *frames;

  unsigned operand_count;
  u4 *operands;

  unsigned local_count;
  u4 *locals;
};

struct winj_field {
  unsigned name_len;
  const char *name;
  u2 access_flags;
  enum winj_type type;
  unsigned index;
};

struct winj_vm_paras; /* parameters for system customization */
struct winj_vm;       /* a virtual machine instance */
struct winj_class;    /* something from which objects can be created */
struct winj_object;   /* an instance of some class */

typedef void *winj_thread_t;
typedef void *winj_mutex_t;
typedef void *winj_cond_t;

/**
 * Routines for managing threads.  These are expected to have
 * semantics identical to pthreads -- actual pthread routines should
 * be easily assignable.  Attribute pointers not used (they are always
 * given NULL by the VM). */
struct winj_thread_params {
  int (JNICALL *thread_create)(winj_thread_t *thread, void *attr,
                       void *(JNICALL *func)(void*), void* arg);
  int (JNICALL *thread_join)(winj_thread_t thread, void **retval);
  int (JNICALL *thread_detach)(winj_thread_t thread);

  int (JNICALL *mutex_init)(winj_mutex_t *mutex, void *attr);
  int (JNICALL *mutex_destroy)(winj_mutex_t *mutex);
  int (JNICALL *mutex_lock)(winj_mutex_t *mutex);
  int (JNICALL *mutex_unlock)(winj_mutex_t *mutex);

  int (JNICALL *cond_init)(winj_cond_t *cond, void *attr);
  int (JNICALL *cond_destroy)(winj_cond_t *cond);
  int (JNICALL *cond_wait)(winj_cond_t *cond, winj_mutex_t *mutex);
  int (JNICALL *cond_signal)(winj_cond_t *cond);
  int (JNICALL *cond_broadcast)(winj_cond_t *cond);
};

enum winj_log_levels {
  WINJ_LEVEL_FATAL   = 1,
  WINJ_LEVEL_ERROR   = 2,
  WINJ_LEVEL_WARNING = 3,
  WINJ_LEVEL_INFO    = 4,
  WINJ_LEVEL_DEBUG   = 5,
};

struct winj_vm_params {
  void *context;
  unsigned level; /* applies only to default log implementation */

  char *(*getenv)(void *context, const char *name);
  void *(*realloc)(void *context, void *ptr, size_t size);
  int   (*logv)(void *context, const char *file, unsigned line,
                const char *func, unsigned level,
                const char *format, va_list args);
  struct winj_thread_params *thread_params;

  int (*find_class)(void *context, struct winj_vm_params *params,
                    size_t name_len, const char *name,
                    struct winj_bytes *bytes);

  /* TODO: provide a hook for uncaught exceptions */
  /* TODO: provide integer return code from System.exit(int) */
  /* TODO: provide hooks for native methods */  
};


struct winj_argument {
  enum winj_type argtype;
  const char *class_name;
  unsigned class_name_len;
  unsigned array_count;
  jvalue value;
};

/* A method might be implemented in one of three ways:
 * - opcodes from a class file
 * - C code for built in methods of system classes
 * - C code for native methods
 *
 * Method name is a concatenation of the actual name and the
 * descriptor.  This allows a binary search to operate on a
 * single string when searching for a method. */
struct winj_method {
  unsigned name_len;
  char    *name;
  u2 access_flags;

  int (*call)(struct winj_thread *thread, struct winj_method *method,
              jvalue *result, jobject self, unsigned arg_count,
              struct winj_argument *args);
  struct winj_method_file *method_file;
};

struct winj_objlist {
  struct winj_object *head;
  struct winj_object *tail;
  unsigned count;
};

struct winj_object {
  struct winj_class *cls;
  unsigned value_count;
  jvalue  *values;

  struct winj_object *next;
  struct winj_object *prev;
};

struct winj_array {
  struct winj_object self; /* must be first */
  unsigned count;
  enum winj_type type;
  struct winj_class *element_class;
  union winj_elements {
    struct winj_object *jobject;
    jbyte    *jbyte;
    jboolean *jboolean;
    jchar    *jchar;
    jshort   *jshort;
    jint     *jint;
    jfloat   *jfloat;
    jlong    *jlong;
    jdouble  *jdouble;
  } *elements;
};

struct winj_class {
  struct winj_object self; /* must be first */
  struct winj_class *super;

  char *name;
  unsigned name_len;
  u2 access_flags;

  unsigned field_count;
  struct winj_field *fields;

  unsigned method_count;
  struct winj_method *methods;

  unsigned static_field_count;
  struct winj_field *static_fields;

  unsigned static_method_count;
  struct winj_method *static_methods;

  struct winj_class_file *class_file;
};

struct winj_vm {
  struct JNIInvokeInterface *jni_invoke; /* must be first */
  struct JNIInvokeInterface table_invoke;
  struct JNINativeInterface table_env;
  struct winj_vm_params params;
  unsigned flags;

  struct winj_class *class_class;
  struct winj_class *class_array;

  u4 class_count;
  struct winj_class **classes;

  struct winj_objlist objects;

  u4 thread_count;
  struct winj_thread **threads;
};

/**
 * Reallocate a block of memory.
 *
 * @param params parameters for system customization
 * @param ptr existing memory or NULL
 * @param size desired size of allocation
 * @return allocation with equivalent contents (possibly same as ptr) */
void *
winj_realloc(struct winj_vm_params *params, void *ptr, size_t size)
{
  return (params && params->realloc) ?
    params->realloc(params->context, ptr, size) : realloc(ptr, size);
}

/**
 * Allocate and zero a block of memory
 *
 * @param params parameters for system customization
 * @param nmemb number of members
 * @param size of each member
 * @return allocation filled with zero bytes */
void *
winj_calloc(struct winj_vm_params *params, size_t nmemb, size_t size)
{
  void *result = winj_realloc(params, NULL, nmemb * size);
  if (result)
    memset(result, 0, nmemb * size);
  return result;
}

/**
 * Allocate a block of memory.
 *
 * @param params parameters for system customization
 * @param size number of bytes to allocate
 * @return allocation with undefined contents */
void *
winj_malloc(struct winj_vm_params *params, size_t size)
{
  return (params && params->realloc) ?
    params->realloc(params->context, NULL, size) : malloc(size);
}

/**
 * Reclaim a previously allocated block of memory
 *
 * @param params parameters for system customization
 * @param ptr previously allocated memory to reclaim */
void
winj_free(struct winj_vm_params *params, void *ptr)
{
  if (params && params->realloc)
    params->realloc(params->context, ptr, 0);
  else free(ptr);
}

/**
 * Basic logging routine.  All other logging routines call this one.
 *
 * @param vm virtual machine for params
 * @param file source code file where message was sent
 * @param line source line number where message was sent
 * @param level severity of log message
 * @param format contents of message
 * @param args things to fill in format
 * @return number of bytes written or EXIT_FAILURE on WINJ_LOG_ERROR */
int
winj_vlog_capture(struct winj_vm_params *params, const char *file,
                   unsigned line, const char *func, unsigned level,
                   const char *format, va_list args)
{
  int result = -1;
  if (params && params->logv) {
    result = params->logv(params->context, file, line, func,
                          level, format, args);
  } else if ((params && params->level && (params->level >= level)) ||
             ((!params || !params->level) &&
              (level <= WINJ_LEVEL_INFO))) {
    const char *basefile = strrchr(file, '/');
    const char *prefix = "UNKNOWN";

    switch (level) {
    case WINJ_LEVEL_FATAL:   prefix = "FATAL";   break;
    case WINJ_LEVEL_ERROR:   prefix = "ERROR";   break;
    case WINJ_LEVEL_WARNING: prefix = "WARNING"; break;
    case WINJ_LEVEL_INFO:    prefix = "INFO";    break;
    case WINJ_LEVEL_DEBUG:   prefix = "DEBUG";   break;
    default:
      break;
    }

    if (basefile)
      basefile++;
    else basefile = file;

    fprintf(stderr, "%s (%s:%u %s): ", prefix, basefile, line, func);
    result = vfprintf(stderr, format, args);
    fprintf(stderr, "\n");
  }
  if (level == WINJ_LEVEL_FATAL)
    exit(EXIT_FAILURE);
  else if (level == WINJ_LEVEL_ERROR)
    result = EXIT_FAILURE;
  return result;
}
#define winj_vlog(params, level, format, args)                        \
  winj_vlog_capture(params, __FILE__, __LINE__, __func__,             \
                     level, format, args)

int
winj_log_capture(struct winj_vm_params *params, const char *file,
                  unsigned line, const char *func, unsigned level,
                  const char *format, ...)
{
  int result;
  va_list args;
  va_start(args, format);
  result = winj_vlog_capture(params, file, line, func, level,
                              format, args);
  va_end(args);
  return result;
}

#define winj_log(params, level, format, ...)                          \
  winj_log_capture(params, __FILE__, __LINE__, __func__, level,       \
                    format, ## __VA_ARGS__)

#define winj_error(params, format, ...)                               \
  winj_log_capture(params, __FILE__, __LINE__, __func__,              \
                    WINJ_LEVEL_ERROR, format, ## __VA_ARGS__)

#define winj_warn(params, format, ...)                                \
  winj_log_capture(params, __FILE__, __LINE__, __func__,              \
                    WINJ_LEVEL_WARNING, format, ## __VA_ARGS__)

#define winj_info(params, format, ...)                                \
  winj_log_capture(params, __FILE__, __LINE__, __func__,              \
                    WINJ_LEVEL_INFO, format, ## __VA_ARGS__)

#define winj_debug(params, format, ...)                                \
  winj_log_capture(params, __FILE__, __LINE__, __func__,               \
                    WINJ_LEVEL_DEBUG, format, ## __VA_ARGS__)

static int
winj_string_concat
(struct winj_vm_params *params, unsigned aa_len, const char *aa,
 unsigned bb_len, const char *bb, unsigned *str_len, char **str_out)
{
  int result = EXIT_SUCCESS;
  char *str = NULL;

  if (aa && !aa_len)
    aa_len = strlen(aa);
  if (bb && !bb_len)
    bb_len = strlen(bb);

  if (!(str = winj_malloc(params, aa_len + bb_len + 1))) {
    result = winj_error
      (params, "failed to allocate %u bytes for string",
       aa_len + bb_len + 1);
  } else if (str_out) {
    memcpy(str, aa, aa_len);
    memcpy(str + aa_len, bb, bb_len);
    str[aa_len + bb_len] = '\0';

    *str_out = str;
    str = NULL;

    if (str_len)
      *str_len = aa_len + bb_len;
  }
  winj_free(params, str);
  return result;
}

static int
winj_string_copy
(struct winj_vm_params *params, unsigned aa_len, const char *aa,
 unsigned *str_len, char **str_out)
{
  return winj_string_concat
    (params, aa_len, aa, 0, NULL, str_len, str_out);
}

static struct winj_object *
winj_objlist_append
(struct winj_objlist *list, struct winj_object *obj)
{
  if (!list) {
  } else if (list->tail) {
    obj->prev = list->tail;
    obj->next = NULL;
    list->tail = list->tail->next = obj;
    list->count++;
  } else {
    obj->next = obj->prev = NULL;
    list->head = list->tail = obj;
  }
  return obj;
}

static struct winj_object *
winj_objlist_remove
(struct winj_objlist *list, struct winj_object *obj)
{
  if (!list || !obj) {
  } else {
    if (list->head == obj) {
      list->head = obj->next;
      if (list->head)
        list->head->prev = NULL;
    }
    if (list->tail == obj) {
      list->tail = obj->prev;
      if (list->tail)
        list->tail->next = NULL;
    }
    list->count--;
  }
  if (obj)
    obj->next = obj->prev = NULL;
  return obj;
}

/**
 * Copy a collection of bytes
 *
 * @param params parameters for system customization
 * @param src bytes to copy from
 * @param dest place to copy bytes
 * @return EXIT_SUCCESS unless something went wrong */
int
winj_bytes_copy
(struct winj_vm_params *params, const struct winj_bytes *src,
 struct winj_bytes *dest)
{
  int result = EXIT_SUCCESS;
  unsigned char *buffer = NULL;

  if (!src || !dest) {
    result = winj_error
      (params, "missign arguments (src=%p, dest=%p)", src, dest);
  } else if (!(buffer = winj_malloc
               (params, src->count - src->offset))) {
    result = winj_error(params, "failed to allocate %u bytes",
                         src->count - src->offset);
  } else {
    memcpy(buffer, src->value + src->offset, src->count - src->offset);
    dest->value = buffer;
    dest->count = src->count - src->offset;
    dest->offset = 0;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

/**
 * Copy a single byte from a byte stream, advancing the offset.
 *
 * @param params parameters for system customization
 * @param bytes byte array structure to read from
 * @param out destinatin for byte
 * @param format <code>winj_error()</code> message on failure
 * @param args format arguments for failure message
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_bytes_unpack_byte
(struct winj_vm_params *params, struct winj_bytes *bytes, u1 *out,
 const char *file, unsigned line, const char *func,
 const char *format, va_list args)
{
  int result = EXIT_SUCCESS;
  if (bytes->count - bytes->offset < sizeof(u1)) {
    result = winj_vlog_capture
      (params, file, line, func, WINJ_LEVEL_ERROR, format, args);
  } else if (out) {
    *out = bytes->value[bytes->offset++];
  }
  return result;
}

/**
 * Copy a single byte from a byte array.
 *
 * @param params parameters for system customization
 * @param bytes byte array structure to read from
 * @param out destination for copied byte
 * @param format <code>winj_error()</code> message in case of failure
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_bytes_unpack_u1_capture
(struct winj_vm_params *params, struct winj_bytes *bytes, u1 *out,
 const char *file, unsigned line, const char *func,
 const char *format, ...)
{
  int result = EXIT_SUCCESS;
  va_list args;
  va_start(args, format);
  result = winj_bytes_unpack_byte
    (params, bytes, out, file, line, func, format, args);
  va_end(args);
  return result;
}
#define winj_bytes_unpack_u1(params, bytes, out, format, ...)          \
  winj_bytes_unpack_u1_capture                                         \
  (params, bytes, out, __FILE__, __LINE__, __func__,                   \
   format, # __VA_ARGS__)

/**
 * Copy a two-byte unsigned short integer from a byte array.
 *
 * @param params paramters for system customization
 * @param bytes byte array structure to read from
 * @param out destination for copied short
 * @param format <code>winj_error()</code> message in case of failure
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_bytes_unpack_u2_capture
(struct winj_vm_params *params, struct winj_bytes *bytes, u2 *out,
 const char *file, unsigned line, const char *func,
 const char *format, ...)
{
  int result = EXIT_SUCCESS;
  u1 b1 = 0, b2 = 0;
  va_list args;
  va_start(args, format);

  if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                       (params, bytes, &b1, file, line, func,
                        format, args))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                              (params, bytes, &b2, file, line, func,
                               format, args))) {
  } else if (out) {
    *out = (b1 << 8) | b2;
  }
  va_end(args);
  return result;
}
#define winj_bytes_unpack_u2(params, bytes, out, format, ...)          \
  winj_bytes_unpack_u2_capture                                         \
  (params, bytes, out, __FILE__, __LINE__, __func__,                   \
   format, # __VA_ARGS__)

/**
 * Copy a single four byte unsigned word from a byte array.
 *
 * @param params parameters for system customization
 * @param bytes byte array structure to read from
 * @param out destination for copied word
 * @param format <code>winj_error()</code> message in case of failure
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_bytes_unpack_u4_capture
(struct winj_vm_params *params, struct winj_bytes *bytes, u4 *out,
 const char *file, unsigned line, const char *func,
 const char *format, ...)
{
  int result = EXIT_SUCCESS;
  u1 b1 = 0, b2 = 0, b3 = 0, b4 = 0;
  va_list args;
  va_start(args, format);

  if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                       (params, bytes, &b1, file, line, func,
                        format, args))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                              (params, bytes, &b2, file, line, func,
                               format, args))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                              (params, bytes, &b3, file, line, func,
                               format, args))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_byte
                              (params, bytes, &b4, file, line, func,
                               format, args))) {
  } else if (out) {
    *out = (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
  }
  va_end(args);
  return result;
}
#define winj_bytes_unpack_u4(params, bytes, out, format, ...)          \
  winj_bytes_unpack_u4_capture                                         \
  (params, bytes, out, __FILE__, __LINE__, __func__,                   \
   format, # __VA_ARGS__)

/**
 * Encode a single Unicode code point to UTF.
 *
 * @param params parameters for system customization
 * @param codep_in code point to encode
 * @param position points to starting location and incremented
 * @param buffer optional destination for encoded bytes
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_utf8_encode
(struct winj_vm_params *params, uint32_t codep_in,
 unsigned *position, char *buffer)
{
  int result = EXIT_SUCCESS;

  if (!position) {
    result = winj_error(params, "missing position pointer");
  } else if (codep_in <= 0x7F) {
    if (buffer)
      buffer[(*position)++] = codep_in;
    else (*position) += 1;
  } else if (codep_in <= 0x07FF) {
    if (buffer) {
      buffer[(*position)++] = 0xC0 | (codep_in >> 6);
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >> 0));
    } else (*position) += 2;
  } else if (codep_in <= 0xFFFF) {
    if (buffer) {
      buffer[(*position)++] = 0xE0 | (codep_in >> 12);
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >> 6));
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >> 0));
    } else (*position) += 3;
  } else if (codep_in <= 0x10FFFF) {
    if (buffer) {
      buffer[(*position)++] = 0xE0 | (codep_in >> 16);
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >> 12));
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >>  6));
      buffer[(*position)++] = 0x80 | (0x3F & (codep_in >>  0));
    } else (*position) += 4;
  } else {
    result = winj_error(params, "invalid code point: %04x", codep_in);
  }
  return result;
}

/**
 * Decode a single unicode code point from an array of bytes.
 *
 * @param params paramters for system customization
 * @param src bytes from which to decode
 * @param size maximum byte index to consider
 * @param position optional pointer to initial position which will
 *        be updated to point to start of next character on success
 * @param codep_out code point computed
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_utf8_decode
(struct winj_vm_params *params, unsigned size, const u1 *src,
 unsigned *position, uint32_t *codep_out)
{
  int result = EXIT_SUCCESS;
  unsigned index = position ? *position : 0;
  uint32_t codep = 0;

  if ((src[index] & 0x80) == 0) { /* 0xxxxxxx */
    codep = src[index++];
  } else if ((src[index] & 0xC0) == 0x80) { /* 10xxxxxx */
    result = winj_error
      (params, "UTF-8 continuation at start (index=%u)", index);
  } else if ((((src[index] & 0xE0) == 0xC0) && (index + 1 >= size)) ||
             (((src[index] & 0xF0) == 0xE0) && (index + 2 >= size)) ||
             (((src[index] & 0xF8) == 0xF0) && (index + 3 >= size))) {
    result = winj_error
      (params, "UTF-8 incomplete character (index=%u)", index);
  } else if ((((src[index] & 0xE0) == 0xC0) ||
              ((src[index] & 0xF0) == 0xE0) ||
              ((src[index] & 0xF8) == 0xF0)) &&
             ((src[index + 1] & 0xC0) != 0x80))  {
    result = winj_error
      (params, "UTF-8 incomplete character (index=%u)", index);
  } else if ((((src[index] & 0xF0) == 0xE0) ||
              ((src[index] & 0xF8) == 0xF0)) &&
             ((src[index + 2] & 0xC0) != 0x80))  {
    result = winj_error
      (params, "UTF-8 incomplete character (index=%u)", index);
  } else if (((src[index] & 0xF8) == 0xF0) &&
             ((src[index + 3] & 0xC0) != 0x80))  {
    result = winj_error
      (params, "UTF-8 incomplete character (index=%u)", index);
  } else if ((src[index] == 0xC0) || (src[index] == 0xC1)) {
    winj_warn(params, "UTF-8 overlong encoding (index=%u)", index);
    codep = 0xFFFD; /* unicode replacement character */
    index += 2;
  } else if ((src[index] == 0xE0) && (src[index + 1] < 0xA0)) {
    winj_warn(params, "UTF-8 overlong encoding (index=%u)", index);
    codep = 0xFFFD; /* unicode replacement character */
    index += 3;
  } else if ((src[index] == 0xF0) && (src[index + 1] < 0x90)) {
    codep = 0xFFFD; /* unicode replacement character */
    index += 4;
    winj_warn(params, "UTF-8 overlong encoding (index=%u)", index);
  } else if ((src[index] == 0xF4) && (src[index + 1] >= 0x90)) {
    codep = 0xFFFD; /* unicode replacement character */
    index += 4;
    winj_warn(params, "UTF-8 invalid code point (index=%u)", index);
  } else if ((src[index] & 0xF8) == 0xF0) { /* 11110xxx */
    codep = 0x07 & src[index++];
    codep = (codep << 6) | (0xC0 & src[index++]);
    codep = (codep << 6) | (0xC0 & src[index++]);
    codep = (codep << 6) | (0xC0 & src[index++]);
  } else if ((src[index] & 0xF0) == 0xE0) { /* 1110xxxx */
    codep = 0x0F & src[index++];
    codep = (codep << 6) | (0xC0 & src[index++]);
    codep = (codep << 6) | (0xC0 & src[index++]);
  } else if ((src[index] & 0xE0) == 0xC0) { /* 110xxxxx */
    codep = 0x1F & src[index++];
    codep = (codep << 6) | (0xC0 & src[index++]);
  } else result = winj_error
           (params, "UTF-8 too many bytes (index=%u)", index);

  if (result == EXIT_SUCCESS) {
    if (codep_out)
      *codep_out = codep;
    if (position)
      *position = index;
  }
  return result;
}

/* FIXME static */ int
winj_utf8_java_encode
(struct winj_vm_params *params, uint32_t codep_in,
 unsigned *position, char *buffer)
{
  int result = EXIT_SUCCESS;

  if (!position) {
    result = winj_error(params, "missing position pointer");
  } else if (codep_in == 0) {
    if (buffer) {
      buffer[(*position)++] = 0xC0;
      buffer[(*position)++] = 0x80;
    } else *position += 2;
  } else if (codep_in >= 0x10000) {
    uint32_t codep_high =
      0xD800 | (0x3FF & ((codep_in - 0x10000) >> 10));
    uint32_t codep_low  =
      0xDC00 | (0x3FF & ((codep_in - 0x10000) >> 0));

    if (EXIT_SUCCESS != (result = winj_utf8_encode
                         (params, codep_high, position, buffer))) {
    } else result = winj_utf8_encode
             (params, codep_low, position, buffer);
  } else result = winj_utf8_encode(params, codep_in, position, buffer);
  return result;
}

/**
 * Decode the unusual not-quite-UTF-8 format used by Java.
 *
 * One of a few things is going to happen here.  We may have an
 * encoded null character, in which case we must process that before
 * doing proper unicode decoding.  We may have a Basic Mulitlingual
 * Plane value, in which case we can just encode that normally.  Or we
 * may have a pair of UTF-16 surrogate code points, in which case we
 * have to recombine them before enoding to get a sane result.
 *
 * @param params paramters for system customization
 * @param length maximum byte index to consider
 * @param src bytes from which to decode
 * @param position optional pointer to initial position which will
 *        be updated to point to start of next character on success
 * @param codep_out code point computed
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_utf8_java_decode
(struct winj_vm_params *params, unsigned length, const u1 *src,
 unsigned *position, uint32_t *codep_out)
{
  int result = EXIT_SUCCESS;
  unsigned index = position ? *position : 0;
  uint32_t codep = 0;

  if ((src[index] == 0xC0) && (index + 1 < length) &&
      (src[index + 1] == 0x80)) { /* allow two byte null */
    codep = 0;
    index += 2;
  } else if (EXIT_SUCCESS != (result = winj_utf8_decode
                              (params, length, src, &index, &codep))) {
  } else if ((codep >= 0xD800) && (codep <= 0xDFFF)) {
    uint32_t codep_low = 0;

    if (index + 3 >= length) {
      result = winj_error
        (params, "missing low surrogate (index=%u)", index);
    } else if (EXIT_SUCCESS !=
               (result = winj_utf8_decode
                (params, length, src, &index, &codep_low))) {
    } else if ((codep_low < 0xDC00) || (codep_low > 0xDFFF)) {
      result = winj_error
        (params, "invalid low surrogate %04x (index=%u)",
         codep_low, index);
    } else codep = 0x10000 + ((codep - 0xD800) << 10) +
             (codep_low - 0xDC00);
  }

  if (result == EXIT_SUCCESS) {
    if (codep_out)
      *codep_out = codep;
    if (position)
      *position = index;
  }
  return result;
}

const char *
winj_strnchr(const char *str, int cc, unsigned size)
{
  const char *result = NULL;
  if (str) {
    unsigned ii;
    for (ii = 0; !result && (ii < size) && str[ii]; ++ii)
      if (str[ii] == cc)
        result = &str[ii];
  }
  return result;
}

static const u1 *
winj_u1_strnchr(const u1 *str, int cc, unsigned size)
{
  return (const u1 *)winj_strnchr((const char *)str, cc, size);
}

/**
 * Advance a counter and optionally write the bytes of a string to
 * a specified location.  This routine is designed to fit easily
 * into a more complex task that assembles a string.
 *
 * @param params parameters for system customization
 * @param count number of bytes in source string (strlen() used if zero)
 * @param str source string to conisider
 * @param size points to initial position to increment
 * @param buffer optional destination for copying characters
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_string_place
(struct winj_vm_params *params, unsigned count, const char *str,
 unsigned *position, char *buffer)
{
  unsigned index = position ? *position : 0;

  if (!count && str)
    count = strlen(str);

  if (buffer && str)
    memcpy(&buffer[index], str, count);
  index += count;

  if (position)
    *position = index;
  return EXIT_SUCCESS;
}

static void
winj_class_file_cleanup
(struct winj_vm_params *params, struct winj_class_file *class_file)
{
  if (class_file) {
    unsigned ii;

    winj_free(params, class_file->cpool_idx);
    winj_free(params, class_file->cpool);
    winj_free(params, class_file->ifaces);

    for (ii = 0; ii < class_file->fields_count; ++ii)
      winj_free(params, class_file->fields[ii].attributes);
    winj_free(params, class_file->fields);

    for (ii = 0; ii < class_file->methods_count; ++ii) {
      struct winj_method_file *method = &class_file->methods[ii];
      winj_free(params, method->exception_index_table);
      winj_free(params, method->attributes);
      winj_free(params, method->code.attributes);
      winj_free(params, method->code.exception_table);
    }
    winj_free(params, class_file->methods);

    winj_free(params, class_file->attributes);
    winj_free(params, class_file->bytes.value);
  }
}

/**
 * Reclaim resources used by a class.
 *
 * @param params paramaters for system customization
 * @param cls class to reclaim */
void
winj_class_cleanup
(struct winj_vm_params *params, struct winj_class *cls)
{
  if (cls) {
    unsigned ii;

    for (ii = 0; ii < cls->method_count; ++ii)
      winj_free(params, cls->methods[ii].name);
    winj_free(params, cls->methods);
    for (ii = 0; ii < cls->static_method_count; ++ii)
      winj_free(params, cls->static_methods[ii].name);
    winj_free(params, cls->static_methods);
    winj_free(params, cls->name);
    winj_class_file_cleanup(params, cls->class_file);
  }
  winj_free(params, cls);
}

static int
winj_cpool_unpack_index
(struct winj_vm_params *params, struct winj_bytes *bytes,
 u1 tag, const char *tag_name, const char *index_name,
 struct winj_class_file *class_file, u2 *index_out)
{
  int result = EXIT_SUCCESS;
  u2 index = 0;

  if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                       (params, bytes, &index, "no bytes for %s %s",
                        tag_name, index_name))) {
  } else if (index > class_file->cpool_count) {
    result = winj_error(params, "invalid index %hu for %s %s",
                         index, tag_name, index_name);
  } else if (tag && index &&
             (tag != class_file->cpool
              [class_file->cpool_idx[index]].tag)) {
    result = winj_error
      (params, "at index %hu constant is %u but should be %u for %s %s",
       index, class_file->cpool[class_file->cpool_idx[index]].tag, tag,
       tag_name, index_name);
  } else if (index_out)
    *index_out = index;
  return result;
}

static int
winj_cpool_get
(struct winj_vm_params *params, struct winj_class_file *class_file,
 u2 index, u1 *tag, union winj_cpool_info **out)
{
  int result = EXIT_SUCCESS;

  if ((index == 0) || (index >= class_file->cpool_count)) {
    result = winj_error
      (params, "invalid constant pool index %hu", index);
  } else if (class_file->cpool_idx[index] > class_file->cpool_size) {
    result = winj_error
      (params, "out-of-bounds constant pool index %hu -> %hu",
       index, class_file->cpool_idx[index]);
  } else if (tag && *tag &&
             (*tag != class_file->cpool
              [class_file->cpool_idx[index]].tag)) {
    result = winj_error
      (params, "unexpected tag %u (expected %u) at index %hu",
       (unsigned)class_file->cpool[class_file->cpool_idx[index]].tag,
       (unsigned)*tag, index);
  } else if (out)
    *out = &class_file->cpool[class_file->cpool_idx[index]].info;

  if ((result == EXIT_SUCCESS) && tag && !*tag)
    *tag = class_file->cpool[class_file->cpool_idx[index]].tag;
  return result;
}

/**
 * Convert the crazy Java version of UTF8 into the real thing.
 *
 * @param params parameters for system customization
 * @param class_file class to get constant from
 * @param index position in clazz constant pool for UTF8 string
 * @params size place to store number of bytes necessary for conversion
 * @params buffer optional place to write converted bytes -- must be
 *         large enough (call with NULL to find necessary size)
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_cpool_utf8
(struct winj_vm_params *params, struct winj_class_file *class_file,
 u2 index, unsigned *size, char *buffer)
{
  int result = EXIT_SUCCESS;
  union winj_cpool_info *info = NULL;
  u1 tag_utf8  = WINJ_CONST_UTF8;
  unsigned count = size ? *size : 0;

  if (EXIT_SUCCESS != winj_cpool_get
      (params, class_file, index, &tag_utf8, &info)) {
  } else {
    const u1 *src = info->const_utf8.bytes;
    unsigned length = info->const_utf8.length;
    unsigned ii = 0;
    uint32_t codep;

    while ((result == EXIT_SUCCESS) && (ii < length)) {
      if (EXIT_SUCCESS != (result = winj_utf8_java_decode
                           (params, length, src, &ii, &codep))) {
      } else result = winj_utf8_encode(params, codep, &count, buffer);
    }
  }

  if ((result == EXIT_SUCCESS) && size)
    *size = count;
  return result;
}

static int
winj_cpool_get_class_name
(struct winj_vm_params *params, struct winj_class_file *class_file,
 u2 index, unsigned *length, const char **name)
{
  int result = EXIT_SUCCESS;
  union winj_cpool_info *info = NULL;
  u1 tag_class = WINJ_CONST_CLASS;
  u1 tag_utf8  = WINJ_CONST_UTF8;

  if (EXIT_SUCCESS != winj_cpool_get
      (params, class_file, index, &tag_class, &info)) {
    result = winj_error
      (params, "not actually a class constant: %hu", index);
  } else if (EXIT_SUCCESS != winj_cpool_get
             (params, class_file, info->const_class,
              &tag_utf8, &info)) {
  } else {
    if (name)
      *name = (char *)info->const_utf8.bytes;
    if (length)
      *length = info->const_utf8.length;
  }
  return result;
}

static int
winj_cpool_create
(struct winj_vm_params *params, struct winj_bytes *bytes,
 struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 1; (result == EXIT_SUCCESS) &&
         (ii < class_file->cpool_count); ++ii) {
    struct winj_cpool *next = NULL;
    struct winj_cpool *entry = NULL;
    union winj_cpool_info *info = NULL;

    if (!(next = winj_realloc
          (params, class_file->cpool, sizeof(*class_file->cpool) *
           (class_file->cpool_size + 1)))) {
      result = winj_error
        (params, "failed to allocate %u bytes for cpool",
         sizeof(*class_file->cpool) * (class_file->cpool_size + 1));
    } else {
      class_file->cpool = next;
      class_file->cpool_idx[ii] = class_file->cpool_size;
      entry = &class_file->cpool[class_file->cpool_size++];
      info = &entry->info;
    }

    if ((EXIT_SUCCESS != result) ||
        (EXIT_SUCCESS != (result = winj_bytes_unpack_u1
                          (params, bytes, &entry->tag,
                           "cpool no byte for tag"))))
      break;

    switch (entry->tag) {
    case WINJ_CONST_CLASS:
      result = winj_cpool_unpack_index
        (params, bytes, 0, "class", "name",
         class_file, &info->const_class);
      break;
    case WINJ_CONST_FIELDREF:
      winj_debug(params, "[%u] fieldref", ii);
      if (EXIT_SUCCESS !=
          (result = winj_cpool_unpack_index
           (params, bytes, 0, "fieldref", "class", class_file,
            &info->const_fieldref.class_index))) {
      } else if (EXIT_SUCCESS !=
                 (result = winj_cpool_unpack_index
                  (params, bytes, 0,
                   "fieldref", "nameandtype", class_file,
                   &info->const_fieldref.nameandtype_index))) {
      }
      break;
    case WINJ_CONST_METHODREF:
      if (EXIT_SUCCESS !=
          (result = winj_cpool_unpack_index
           (params, bytes, 0, "methodref", "class", class_file,
            &info->const_methodref.class_index))) {
      } else result = winj_cpool_unpack_index
               (params, bytes, 0, "methodref", "nameandtype", class_file,
                &info->const_methodref.nameandtype_index);
      break;
    case WINJ_CONST_INTERFACEMETHODREF:
      winj_debug(params, "[%u] interfacemethodref", ii);
      if (EXIT_SUCCESS !=
          (result = winj_cpool_unpack_index
           (params, bytes, 0, "interfacemethodref", "class",
            class_file, &info->const_interfacemethodref. class_index))) {
      } else if (EXIT_SUCCESS !=
                 (result = winj_cpool_unpack_index
                  (params, bytes, 0, "interfacemethodref",
                   "nameandtype", class_file,
                   &info->const_interfacemethodref.
                   nameandtype_index))) {
      }
      break;
    case WINJ_CONST_STRING:
      result = winj_cpool_unpack_index
        (params, bytes, WINJ_CONST_UTF8, "string", "index",
         class_file, &info->const_string);
      break;
    case WINJ_CONST_INTEGER: {
      u4 value = 0;

      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value, "cpool no bytes for int"))) {
      } else {
        memcpy(&info->const_int, &value, sizeof(info->const_int));
        winj_debug(params, "[%u] integer %d", ii, info->const_int);
      }
    } break;
    case WINJ_CONST_FLOAT: {
      u4 value = 0;

      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value, "cpool no bytes for float"))) {
      } else {
        memcpy(&info->const_float, &value, sizeof(info->const_float));
        winj_debug(params, "[%u] float %f", ii, info->const_float);
      }
    } break;
    case WINJ_CONST_LONG: {
      u4 value_high = 0;
      u4 value_low = 0;
      uint64_t value;

      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value_high, "cpool no bytes for long high"))) {
      } else if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value_low, "cpool no bytes for long low"))) {
      } else {
        value = ((uint64_t)value_high << 32) | value_low;
        memcpy(&info->const_long, &value, sizeof(info->const_long));
        winj_debug(params, "[%u] long %ld", ii, info->const_long);

        ++ii; /* skip an entry */
      }
    } break;
    case WINJ_CONST_DOUBLE: {
      u4 value_high = 0;
      u4 value_low = 0;
      uint64_t value;

      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value_high, "cpool no bytes for long high"))) {
      } else if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u4
           (params, bytes, &value_low, "cpool no bytes for long low"))) {
      } else {
        value = ((uint64_t)value_high << 32) | value_low;
        memcpy(&info->const_double, &value, sizeof(info->const_double));
        winj_debug(params, "[%u] double %lf", ii, info->const_double);

        ++ii; /* skip an entry */
      }
    } break;
    case WINJ_CONST_NAMEANDTYPE:
      if (EXIT_SUCCESS !=
          (result = winj_cpool_unpack_index
           (params, bytes, 0, "nameandtype", "name",
            class_file, &info->const_nameandtype.name_index))) {
      } else result = winj_cpool_unpack_index
               (params, bytes, 0,
                "nameandtype", "descriptor", class_file,
                &info->const_nameandtype.descriptor_index);
      break;
    case WINJ_CONST_UTF8:
      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u2
           (params, bytes, &info->const_utf8.length,
            "cpool no bytes for utf8 length"))) {
      } else if (bytes->count - bytes->offset <
                 info->const_utf8.length) {
        result = winj_error
          (params, "cpool need %hu bytes for utf8 string",
           info->const_utf8.length);
      } else {
        info->const_utf8.bytes = &bytes->value[bytes->offset];
        bytes->offset += info->const_utf8.length;
      }
      break;
    case WINJ_CONST_METHODHANDLE:
      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u2
           (params, bytes, &info->const_methodhandle.reference_kind,
            "cpool no bytes for methodhandle reference kind"))) {
      } else if ((info->const_methodhandle.reference_kind < 1) ||
                 (info->const_methodhandle.reference_kind > 9)) {
        result = winj_error
          (params, "invalid methodhandle reference kind: "
           "%hu", info->const_methodhandle.reference_kind);
      } else if (EXIT_SUCCESS !=
                 (result = winj_cpool_unpack_index
                  (params, bytes, 0, "methodhandle", "reference",
                   class_file, &info->const_methodhandle.
                   reference_index))) {
      } else {
        winj_debug(params, "[%u] methodhandle", ii);
      }
      break;
    case WINJ_CONST_METHODTYPE:
      result = winj_cpool_unpack_index
        (params, bytes, WINJ_CONST_UTF8, "methodtype", "descriptor",
         class_file, &info->const_methodtype);
      if (result == EXIT_SUCCESS)
        winj_debug(params, "[%u] methodtype", ii);
      break;
    case WINJ_CONST_DYNAMIC:
      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u2
           (params, bytes, &info->const_dynamic.
            bootstrap_method_attr_index, "cpool no bytes for dynamic "
            "bootstrap method attribute"))) {
      } else if (EXIT_SUCCESS !=
                 (result = winj_cpool_unpack_index
                  (params, bytes, 0, "dynamic", "nameandtype",
                   class_file, &info->const_dynamic.
                   nameandtype_index))) {
      } else {
        winj_debug(params, "[%u] dynamic", ii);
      }
      break;
    case WINJ_CONST_INVOKEDYNAMIC:
      winj_debug(params, "cpool invokedynamic");
      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u2
           (params, bytes, &info->const_invokedynamic.
            bootstrap_method_attr_index, "cpool no bytes for "
            "invokedynamic bootstrap method attribute"))) {
      } else if (EXIT_SUCCESS !=
                 (result = winj_cpool_unpack_index
                  (params, bytes, 0, "invokedynamic", "nameandtype",
                   class_file, &info->const_invokedynamic.
                   nameandtype_index))) {
      } else {
        winj_debug(params, "[%u] invokedynamic", ii);
      }
      break;
    case WINJ_CONST_MODULE:
      result = winj_cpool_unpack_index
        (params, bytes, 0, "module", "name",
         class_file, &info->const_module);
      if (result == EXIT_SUCCESS)
        winj_debug(params, "[%u] module %hu", ii, info->const_module);
      break;
    case WINJ_CONST_PACKAGE:
      result = winj_cpool_unpack_index
        (params, bytes, 0, "package", "name",
         class_file, &info->const_package);
      if (result == EXIT_SUCCESS)
        winj_debug(params, "[%u] package %hu", ii,
                    info->const_package);
      break;
    default:
      result = winj_error(params, "unrecognized constant type: %u/%x",
                           (unsigned)entry->tag, (unsigned)entry->tag);
    }
  }
  return result;
}

struct winj_access_label {
  u2 flag; const char *label;
};

struct winj_access_label winj_class_access[] = {
  { WINJ_ACCESS_PUBLIC,    "public" },
  { WINJ_ACCESS_PRIVATE,   "private" },
  { WINJ_ACCESS_PROTECTED, "protected" },
  { WINJ_ACCESS_STATIC,    "static" },
};

struct winj_access_label winj_field_access[] = {
  { WINJ_ACCESS_PUBLIC,    "public" },
  { WINJ_ACCESS_PRIVATE,   "private" },
  { WINJ_ACCESS_PROTECTED, "protected" },
  { WINJ_ACCESS_STATIC,    "static" },
};

struct winj_access_label winj_method_access[] = {
  { WINJ_ACCESS_PUBLIC,    "public" },
  { WINJ_ACCESS_PRIVATE,   "private" },
  { WINJ_ACCESS_PROTECTED, "protected" },
  { WINJ_ACCESS_STATIC,    "static" },
};

static int
winj_describe_access
(struct winj_vm_params *params, struct winj_access_label *labels,
 unsigned n_labels, u2 access_flags, unsigned *position, char *buffer)
{
  unsigned ii;
  unsigned index = position ? *position : 0;

  for (ii = 0; ii < n_labels; ++ii) {
    if (access_flags & labels[ii].flag) {
      const char *label = labels[ii].label;
      unsigned length = strlen(label);

      if (buffer) {
        memcpy(&buffer[index], label, length);
        buffer[index + length] = ' ';
      }
      index += length + 1;
    }
  }

  if (position)
    *position = index;
  return EXIT_SUCCESS;
}

/**
 * Create an allocated string with the Java name of a class.
 * This will be something like <code>java.lang.Object</code>
 *
 * @param params parameters for system customization
 * @param class_file class for which to create label
 * @param size points at start position to increment
 * @param buffer optional destination for wrting bytes
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_describe_class_file
(struct winj_vm_params *params, struct winj_class_file *class_file,
 u2 class_index, u2 access_flags, unsigned *position, char *buffer)
{
  int result = EXIT_SUCCESS;
  union winj_cpool_info *info = NULL;
  u1 tag_class = WINJ_CONST_CLASS;
  unsigned start = position ? *position : 0;
  unsigned index = position ? *position : 0;

  if (EXIT_SUCCESS != winj_cpool_get
      (params, class_file, class_index, &tag_class, &info)) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_access
              (params, winj_class_access, sizeof(winj_class_access) /
               sizeof(*winj_class_access),
               class_file->access_flags, &index, buffer))) {
  } else if (EXIT_SUCCESS != winj_cpool_utf8
             (params, class_file, info->const_class, &index, buffer)) {
  } else {
    if (buffer) {
      unsigned ii;

      for (ii = start; ii < index; ++ii)
        if (buffer[ii] == '/')
          buffer[ii] = '.';
    }
    if (position)
      *position = index;
  }
  return result;
}

static int
winj_describe_class_file_alloc
(struct winj_vm_params *params, struct winj_class_file *class_file,
 u2 index, u2 access_flags, char **label)
{
  int result = EXIT_SUCCESS;
  char *buffer = NULL;
  unsigned size_used = 0;
  unsigned size = 0;

  if (EXIT_SUCCESS !=
      (result = winj_describe_class_file
       (params, class_file, index, access_flags, &size, buffer))) {
  } else if (!(buffer = winj_malloc(params, size + 1))) {
    result = winj_error
      (params, "failed to allocate %u bytes for class", size + 1);
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_class_file
              (params, class_file, index, access_flags,
               &size_used, buffer))) {
  } else if (label) {
    buffer[size_used] = '\0';
    *label = buffer;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

static int
winj_describe_descriptor
(struct winj_vm_params *params, unsigned desc_len, const u1 *desc,
 unsigned *desc_used, unsigned *size, char *buffer)
{
  int result = EXIT_SUCCESS;
  const char *type_desc = NULL;
  const u1 *end = NULL;
  unsigned index = size ? *size : 0;

  if (!desc_len || !desc) {
    result = winj_error
      (params, "empty descriptor %u/%p", desc_len, desc);
  } else if ((desc[0] == '(') &&
             !(end = winj_u1_strnchr(&desc[1], ')', desc_len))) {
    result = winj_error(params, "missing parameter terminator");
  } else if (desc[0] == '(') { /* parameters */
    unsigned skip = (end - desc) + 1;
    result = winj_describe_descriptor
      (params, desc_len - skip, &end[1], desc_used, &index, buffer);
  } else if ((desc[0] == 'L') &&
             !(end = winj_u1_strnchr(&desc[1], ';', desc_len))) {
    result = winj_error(params, "missing reference terminator");
  } else if (desc[0] == 'L') { /* reference */
    uint32_t codep;
    unsigned ii = 1;

    while ((result == EXIT_SUCCESS) && (desc + ii < end)) {
      if (EXIT_SUCCESS !=
          (result = winj_utf8_java_decode
           (params, desc_len, desc, &ii, &codep))) {
      } else result = winj_utf8_encode
               (params, (codep == '/') ? '.' : codep, &index, buffer);
    }

    if (desc_used)
      *desc_used += (end - desc) + 1;
  } else if (desc[0] == 'V') { type_desc = "void";
  } else if (desc[0] == 'Z') { type_desc = "boolean";
  } else if (desc[0] == 'S') { type_desc = "short";
  } else if (desc[0] == 'I') { type_desc = "int";
  } else if (desc[0] == 'J') { type_desc = "long";
  } else if (desc[0] == 'F') { type_desc = "float";
  } else if (desc[0] == 'D') { type_desc = "double";
  } else if (desc[0] == '[') {
    if (desc_used)
      *desc_used += 1;

    if (EXIT_SUCCESS !=
        (result = winj_describe_descriptor
         (params, desc_len - 1, &desc[1], desc_used, &index, buffer))) {
    } else if (buffer) {
      buffer[index++] = '[';
      buffer[index++] = ']';
    } else index += 2;
  }

  if (EXIT_SUCCESS == result) {
    if (type_desc) {
      if (desc_used)
        *desc_used += 1;
      if (buffer)
        strcpy(&buffer[index], type_desc);
      index += strlen(type_desc);
    }

    if (size)
      *size = index;
  }
  return result;
}

static int
winj_describe_args
(struct winj_vm_params *params, unsigned desc_len, const u1 *desc,
 unsigned *position, char *buffer)
{
  int result = EXIT_SUCCESS;
  unsigned index = position ? *position : 0;
  unsigned desc_idx = 1;

  if (!desc || !desc_len || (desc[0] != '('))
    result = winj_error
      (params, "invalid descriptor (%u/%p/%02x)",
       desc_len, desc, (desc && desc_len) ? desc[0] : 0);

  while ((result == EXIT_SUCCESS) && (desc_idx < desc_len) &&
         (desc[desc_idx] != ')')) {
    unsigned desc_used = 0;

    if ((desc_idx > 1) &&
        (EXIT_SUCCESS != (result = winj_string_place
                          (params, 0, ", ", &index, buffer)))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_describe_descriptor
                (params, desc_len - desc_idx, &desc[desc_idx],
                 &desc_used, &index, buffer))) {
    } else desc_idx += desc_used;
  }

  if ((EXIT_SUCCESS == result) && position)
    *position = index;
  return result;
}

static int
winj_describe_field_alloc
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_field_file *field, char **label)
{
  int result = EXIT_SUCCESS;
  char *buffer = NULL;
  union winj_cpool_info *desc = NULL;
  u1 tag_utf8 = WINJ_CONST_UTF8;
  unsigned size_used = 0;
  unsigned size = 0;

  if (EXIT_SUCCESS !=
      (result = winj_cpool_get
       (params, class_file, field->descriptor_index,
        &tag_utf8, &desc))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_access
              (params, winj_field_access, sizeof(winj_field_access) /
               sizeof(*winj_field_access),
               field->access_flags, &size, buffer))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_descriptor
              (params, desc->const_utf8.length, desc->const_utf8.bytes,
               NULL, &size, buffer))) {
  } else if (EXIT_SUCCESS != (result = winj_string_place
                              (params, 1, " ", &size, buffer))) {
  } else if (EXIT_SUCCESS !=
      (result = winj_cpool_utf8
       (params, class_file, field->name_index, &size, buffer))) {
  } else if (!(buffer = winj_malloc(params, size + 1))) {
    result = winj_error
      (params, "failed to allocate %u bytes for label", size + 1);
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_access
              (params, winj_field_access, sizeof(winj_field_access) /
               sizeof(*winj_field_access),
               field->access_flags, &size_used, buffer))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_descriptor
              (params, desc->const_utf8.length,
               desc->const_utf8.bytes, NULL, &size_used, buffer))) {
  } else if (EXIT_SUCCESS != (result = winj_string_place
                              (params, 1, " ", &size_used, buffer))) {
  } else if (EXIT_SUCCESS !=
      (result = winj_cpool_utf8
       (params, class_file, field->name_index, &size_used, buffer))) {
  } else if (label) {
    buffer[size_used] = 0;

    *label = buffer;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

static int
winj_describe_method
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_method_file *method, unsigned *size, char *buffer)
{
  int result = EXIT_SUCCESS;
  union winj_cpool_info *info = NULL;
  u1 tag_utf8 = WINJ_CONST_UTF8;

  if (EXIT_SUCCESS != (result = winj_cpool_get
                       (params, class_file, method->descriptor_index,
                        &tag_utf8, &info))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_access
              (params, winj_method_access,
               sizeof(winj_method_access) /
               sizeof(*winj_method_access),
               method->access_flags, size, buffer))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_descriptor
              (params, info->const_utf8.length, info->const_utf8.bytes,
               NULL, size, buffer))) {
  } else if (EXIT_SUCCESS != (result = winj_string_place
                              (params, 1, " ", size, buffer))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_cpool_utf8
              (params, class_file, method->name_index,
               size, buffer))) {
  } else if (EXIT_SUCCESS != (result = winj_string_place
                              (params, 1, "(", size, buffer))) {
  } else if (EXIT_SUCCESS !=
              (result = winj_describe_args
               (params, info->const_utf8.length,
                info->const_utf8.bytes, size, buffer))) {
  } else if (EXIT_SUCCESS != (result = winj_string_place
                              (params, 1, ")", size, buffer))) {
  }
  return result;
}

static int
winj_describe_method_alloc
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_method_file *method, char **label)
{
  int result = EXIT_SUCCESS;
  char *buffer = NULL;
  unsigned size = 0;
  unsigned size_used = 0;

  if (EXIT_SUCCESS != (result = winj_describe_method
                       (params, class_file, method, &size, buffer))) {
  } else if (!(buffer = winj_malloc(params, size + 1))) {
    result = winj_error
      (params, "failed to allocate %u bytes for method", size + 1);
  } else if (EXIT_SUCCESS !=
             (result = winj_describe_method
              (params, class_file, method, &size_used, buffer))) {
  } else if (label) {
    buffer[size_used] = '\0';

    *label = buffer;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

static int
winj_describe_bytes_alloc
(struct winj_vm_params *params, struct winj_bytes *bytes, char **label)
{
  int result = EXIT_SUCCESS;
  char *buffer = NULL;
  unsigned size = bytes->count * 6 + bytes->count / 8 + 1;

  if (!(buffer = winj_malloc(params, size))) {
    result = winj_error(params, "failed to allocate %u bytes");
  } else {
    unsigned position = 0;
    unsigned ii;

    for (ii = 0; (position < size) && (ii < bytes->count); ++ii) {
      int written;

      written = snprintf(&buffer[position], size - position,
                         " 0x%02x,", (unsigned)bytes->value[ii]);
      if (written >= 0)
        position += written;
      if (!((ii + 1) % 8)) {
        written = snprintf(&buffer[position], size - position, "\n");
        if (written >= 0)
          position += written;
      }
    }

    if (position < size)
      buffer[position] = '\0';
    else result = winj_error(params, "mismatched size");
  }

  if ((EXIT_SUCCESS == result) && label) {
    *label = buffer;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

static int
winj_class_ifaces_create
(struct winj_vm_params *params, struct winj_bytes *bytes,
 struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) &&
         (ii < class_file->iface_count); ++ii) {
    result = winj_cpool_unpack_index
      (params, bytes, WINJ_CONST_CLASS, "interface", "index",
       class_file, &class_file->ifaces[ii]);
  }
  return result;
}

static int
winj_class_attributes_create
(struct winj_vm_params *params, struct winj_bytes *bytes,
 struct winj_class_file *class_file, u2 attributes_count,
 struct winj_attribute *attributes)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; ii < attributes_count; ++ii) {
    struct winj_attribute *attribute = &attributes[ii];

    if (EXIT_SUCCESS !=
        (result = winj_cpool_unpack_index
         (params, bytes, WINJ_CONST_UTF8, "attribute", "index",
          class_file, &attribute->name_index))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_unpack_u4
                (params, bytes, &attribute->length,
                 "no bytes for attriubte %u length", ii))) {
    } else if (bytes->count - bytes->offset < attribute->length) {
      result = winj_error(params, "no bytes for attribute contents "
                           "%u", attribute->length);
    } else {
      attribute->info = &bytes->value[bytes->offset];
      bytes->offset += attribute->length;
    }
  }
  return result;
}

static int
winj_class_attribute_name
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_attribute *attribute, unsigned *found,
 unsigned length, const char *name)
{
  int result = EXIT_SUCCESS;
  u1 tag_utf8 = WINJ_CONST_UTF8;
  union winj_cpool_info *info = NULL;
  
  if (!length)
    length = strlen(name);

  if (EXIT_SUCCESS != (result = winj_cpool_get
                       (params, class_file, attribute->name_index,
                        &tag_utf8, &info))) {
  } else if ((length != info->const_utf8.length) ||
             memcmp(info->const_utf8.bytes, name, length)) {
    /* Some attribute other than "Exceptions" found */
  } else if (found)
    *found = 1;
  return result;
}

static int
winj_class_fields_create
(struct winj_vm_params *params, struct winj_bytes *bytes,
 struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; ii < class_file->fields_count; ++ii) {
    struct winj_field_file *field = &class_file->fields[ii];

    if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                         (params, bytes, &field->access_flags,
                          "no bytes for field %u access flags", ii))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_unpack_index
                (params, bytes, WINJ_CONST_UTF8, "field", "name",
                 class_file, &field->name_index))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_unpack_index
                (params, bytes, WINJ_CONST_UTF8, "field", "descriptor",
                 class_file, &field->descriptor_index))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_unpack_u2
                (params, bytes, &field->attributes_count,
                 "no bytes for field %u attriubte count", ii))) {
    } else if (!(field->attributes = winj_calloc
                 (params, field->attributes_count,
                  sizeof(*field->attributes)))) {
      result = winj_error
        (params, "failed to allocate %u bytes for field attributes",
         field->attributes_count * sizeof(*field->attributes));
    } else result = winj_class_attributes_create
             (params, bytes, class_file, field->attributes_count,
              field->attributes);
  }
  return result;
}

static int
winj_method_attribute_exceptions
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_attribute *attribute, struct winj_method_file *method)
{
  int result = EXIT_SUCCESS;
  unsigned found = 0;
  const char attr_name[] = "Exceptions";
  unsigned   attr_length = sizeof(attr_name) - 1;
  struct winj_bytes attr_info =
    { attribute->length, 0, attribute->info };

  if (EXIT_SUCCESS !=
      (result = winj_class_attribute_name
       (params, class_file, attribute, &found, attr_length, attr_name))) {
  } else if (!found) {
  } else if (method->exception_index_table) {
    result = winj_error(params, "more than one Exceptions attribute");
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, &attr_info, &method->number_of_exceptions,
               "no bytes for number of exceptions"))) {
  } else if (!(method->exception_index_table = winj_calloc
               (params, method->number_of_exceptions,
                sizeof(*method->exception_index_table)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for exception index table",
       method->number_of_exceptions,
       sizeof(*method->exception_index_table));
  } else {
    unsigned ii;

    for (ii = 0; (EXIT_SUCCESS == result) &&
           (ii < method->number_of_exceptions); ++ii) {
      if (EXIT_SUCCESS !=
          (result = winj_bytes_unpack_u2
           (params, &attr_info, &method->exception_index_table[ii],
            "no bytes for exception index %u", (unsigned)ii))) {
      }
    }
  }
  return result;
}

static int
winj_class_exception_table_create
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_bytes *bytes, u2 exception_table_length,
 struct winj_exception_table *exception_table)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; (result == EXIT_SUCCESS) &&
         (ii < exception_table_length); ++ii) {
    struct winj_exception_table *table = &exception_table[ii];
    if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                         (params, bytes, &table->start_pc,
                          "no bytes for start program counter"))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_unpack_u2
                (params, bytes, &table->end_pc,
                 "no bytes for end program counter (%u/%u)",
                 bytes->offset, bytes->offset))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_unpack_u2
                (params, bytes, &table->handler_pc,
                 "no bytes for handler program counter"))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_unpack_index
                (params, bytes, WINJ_CONST_CLASS,
                 "exception_table", "catch_type",
                 class_file, &exception_table->catch_type))) {
    }
  }
  return result;
}

static int
winj_method_attribute_code
(struct winj_vm_params *params, struct winj_class_file *class_file,
 struct winj_attribute *attribute, struct winj_method_code *code)
{
  int result = EXIT_SUCCESS;
  struct winj_bytes attr_info =
    { attribute->length, 0, attribute->info };
  const char attr_name[] = "Code";
  unsigned   attr_length = sizeof(attr_name) - 1;
  unsigned found = 0;

  if (EXIT_SUCCESS !=
      (result = winj_class_attribute_name
       (params, class_file, attribute, &found, attr_length, attr_name))) {
  } else if (!found) {
  } else if (code->code.value) {
    result = winj_error(params, "more than one code attribute");
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                              (params, &attr_info, &code->max_stack,
                               "no bytes for max stack"))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                              (params, &attr_info, &code->max_locals,
                               "no bytes for max locals"))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_u4
                              (params, &attr_info, &code->code.count,
                               "no bytes for code length"))) {
  } else if (code->code.count > (attr_info.count - attr_info.offset)) {
    result = winj_error
      (params, "code length %u exceeds attribute length %u",
       (unsigned)code->code.count,
       (unsigned)(attr_info.count - attr_info.offset));
  } else {
    code->code.offset = 0;
    code->code.value = attr_info.value + attr_info.offset;
    attr_info.offset += code->code.count;

    if (params->level >= WINJ_LEVEL_DEBUG) {
      char *buffer = NULL;
      if (!winj_describe_bytes_alloc(params, &code->code, &buffer))
        winj_debug(params, "Code:\n%s", buffer);
      winj_free(params, buffer);
    }
  }

  if ((EXIT_SUCCESS != result) || !found) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, &attr_info, &code->exception_table_length,
               "no bytes for exception table length"))) {
  } else if (!(code->exception_table = winj_calloc
               (params, code->exception_table_length,
                sizeof(*code->exception_table)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for exception table",
       code->exception_table_length, sizeof(*code->exception_table));
  } else if (EXIT_SUCCESS !=
             (result = winj_class_exception_table_create
              (params, class_file, &attr_info, code->exception_table_length,
               code->exception_table))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, &attr_info, &code->attributes_count,
               "no bytes for attributes count"))) {
  } else if (!(code->attributes = winj_calloc
               (params, code->attributes_count,
                sizeof(*code->attributes)))) {
    result = winj_error(params, "failed to allocate %u bytes for "
                        "attribute count", code->attributes_count,
                        sizeof(*code->attributes));
  } else if (EXIT_SUCCESS !=
             (result = winj_class_attributes_create
              (params, &attr_info, class_file, code->attributes_count,
               code->attributes))) {
  }
  return result;
}

static int
winj_class_methods_create
  (struct winj_vm_params *params, struct winj_bytes *bytes,
   struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; (EXIT_SUCCESS == result) &&
         (ii < class_file->methods_count); ++ii) {
    struct winj_method_file *method = &class_file->methods[ii];

    if (EXIT_SUCCESS !=
        (result = winj_bytes_unpack_u2
         (params, bytes, &method->access_flags,
          "no bytes for method %u access flags", ii))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_unpack_index
                (params, bytes, WINJ_CONST_UTF8, "method", "name",
                 class_file, &method->name_index))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_unpack_index
                (params, bytes, WINJ_CONST_UTF8, "method", "descriptor",
                 class_file, &method->descriptor_index))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_unpack_u2
                (params, bytes, &method->attributes_count,
                 "no bytes for method %u attriubte count", ii))) {
    } else if (!(method->attributes = winj_calloc
                 (params, method->attributes_count,
                  sizeof(*method->attributes)))) {
      result = winj_error
        (params, "failed to allocate %u bytes for method attributes",
         method->attributes_count * sizeof(*method->attributes));
    } else if (EXIT_SUCCESS !=
               (result = winj_class_attributes_create
                (params, bytes, class_file, method->attributes_count,
                 method->attributes))) {
    } else {
      unsigned jj;

      for (jj = 0; (EXIT_SUCCESS == result) &&
             (jj < method->attributes_count); ++jj) {
        struct winj_attribute *attribute = &method->attributes[jj];

        if (EXIT_SUCCESS !=
            (result = winj_method_attribute_code
             (params, class_file, attribute, &method->code))) {
        } else if (EXIT_SUCCESS !=
                   (result = winj_method_attribute_exceptions
                    (params, class_file, attribute, method))) {
        }
      }
    }
  }
  return result;
}

int
winj_class_file_create
(struct winj_vm_params *params, struct winj_bytes *bytes,
 struct winj_class_file *class_out)
{
  int result = EXIT_SUCCESS;
  u4 maybe_magic = 0;
  unsigned offset = bytes ? bytes->offset : 0;
  struct winj_class_file defined;
  memset(&defined, 0, sizeof(defined));

  if (EXIT_SUCCESS != (result = winj_bytes_unpack_u4
                       (params, bytes, &maybe_magic,
                        "not enough bytes for magic"))) {
  } else if (WINJ_MAGIC != maybe_magic) {
    result = winj_error(params, "incorrect magic bytes (%04x)",
                         maybe_magic);
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.minor_version,
               "not enough bytes for minor version"))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.major_version,
               "not enough bytes for major version"))) {
  } else if (defined.major_version < WINJ_VERSION_LEAST) {
    result = winj_error(params, "unsupported major class verison: %d",
                         defined.major_version);
  } else if (defined.major_version > WINJ_VERSION_MAJOR) {
    result = winj_error(params, "unsupported major class verison: %d",
                         defined.major_version);
  } else if ((defined.major_version == WINJ_VERSION_MAJOR) &&
             (defined.minor_version > WINJ_VERSION_MINOR)) {
    result = winj_error(params, "unsupported minor class verison: %d",
                         defined.minor_version);
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.cpool_count,
               "not enough bytes for cpool count"))) {
  } else if (!defined.cpool_count) {
    result = winj_error(params, "invalid constant pool count (zero)");
  } else if (!(defined.cpool_idx = winj_calloc
               (params, defined.cpool_count,
                sizeof(*defined.cpool_idx)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for constant pool indices",
       sizeof(*defined.cpool_idx) * defined.cpool_count);
  } else if (EXIT_SUCCESS != winj_cpool_create
             (params, bytes, &defined)) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.access_flags,
               "not enough bytes for access flags"))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.this_class,
               "not enough bytes for this class"))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.super_class,
               "not enough bytes for super class"))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.iface_count,
               "not enough bytes for interface count"))) {
  } else if (!(defined.ifaces = winj_malloc
               (params, sizeof(*defined.ifaces) *
                defined.iface_count))) {
    result = winj_error
      (params, "failed to allocate %u bytes for ifaces",
       sizeof(*defined.ifaces) *
       defined.iface_count);
  } else if (EXIT_SUCCESS != (result = winj_class_ifaces_create
                              (params, bytes, &defined))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_unpack_u2
                              (params, bytes, &defined.fields_count,
                               "not enough bytes for field count"))) {
  } else if (!(defined.fields = winj_calloc
               (params, defined.fields_count,
                sizeof(*defined.fields)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for fields",
       sizeof(*defined.fields) * defined.fields_count);
  } else if (EXIT_SUCCESS != (result = winj_class_fields_create
                              (params, bytes, &defined))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.methods_count,
               "not enough bytes for methods count"))) {
  } else if (!(defined.methods = winj_calloc
               (params, defined.methods_count,
                sizeof(*defined.methods)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for methods",
       sizeof(*defined.methods) * defined.methods_count);
  } else if (EXIT_SUCCESS != (result = winj_class_methods_create
                              (params, bytes, &defined))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_bytes_unpack_u2
              (params, bytes, &defined.attributes_count,
               "not enough bytes for attributes count"))) {
  } else if (!(defined.attributes = winj_calloc
               (params, defined.attributes_count,
                sizeof(*defined.attributes)))) {
    result = winj_error(params, "failed to allocate %u bytes for "
                         "attributes", sizeof(*defined.attributes) *
                         defined.attributes_count);
  } else if (EXIT_SUCCESS != (result = winj_class_attributes_create
                              (params, bytes, &defined,
                               defined.attributes_count,
                               defined.attributes))) {
  } else if (class_out) {
    *class_out = defined;
    class_out->bytes = *bytes;
    class_out->bytes.offset = offset;
    memset(bytes, 0, sizeof(*bytes));
    memset(&defined, 0, sizeof(defined));
  }
  winj_class_file_cleanup(params, &defined);
  return result;
}


/**
 * Generic binary search implementation.  Checks whether the current
 * entry name matches the goal.  If so, the match pointer is set to
 * the current entry.  If not, the index, top and bottom values are
 * adjusted to the next place it makes sense to search.  A search ends
 * without a match when top is no longer greater than bottom.  Each
 * comparison rules out half of the array entries due to the
 * assumption that the array is arranged in sorted order so the
 * number of steps should be proportional to the base two logarithm
 * of the number of array entries (scaling is O(ln(n))). */
unsigned
winj_binary_search_step
(unsigned goal_len, const char *goal, unsigned index,
 unsigned name_len, const char *name, void *current, 
 unsigned *top, unsigned *bottom, void **match)
{
  if (current) {
    unsigned minimum = (goal_len < name_len) ? goal_len : name_len;
    int cmp;
    if ((cmp = strncmp(goal, name, minimum)) == 0)
      cmp = (goal_len < name_len) ? -1 :
        (goal_len > name_len) ? 1 : 0;

    if (cmp == 0) {
      *top = *bottom;
      *match = current;
    } else if (cmp < 0) {
      *top = index;
    } else *bottom = index + 1;
  }
  return *bottom + (*top - *bottom) / 2;
}

#define WINJ_BINARY_SEARCH(parent, child, sibling)                     \
  static int winj_##parent##_##sibling##_search                        \
  (struct winj_##parent *src_##parent,                                 \
   unsigned name_len, const char *name,                                \
   struct winj_##child **child##_out)                                  \
  {                                                                    \
    struct winj_##child *found = NULL;                                 \
    struct winj_##child *current = NULL;                               \
    u4 top = src_##parent->sibling##_count;                            \
    u4 bottom = 0;                                                     \
    u4 index = 0;                                                      \
    if (name && !name_len)                                             \
      name_len = strlen(name);                                         \
    while (top > bottom) {                                             \
      index = winj_binary_search_step                                  \
        (name_len, name, index,                                        \
         current ? current->name_len : 0,                              \
         current ? current->name : NULL, current,                      \
         &top, &bottom, (void**)&found);                               \
      if (index < top)                                                 \
        current = &src_##parent->sibling##s[index];                    \
    }                                                                  \
    if (child##_out)                                                   \
      *child##_out = found;                                            \
    return EXIT_SUCCESS;                                               \
  }                                                                    \
  static int                                                           \
  winj_##parent##_##sibling##_store                                    \
  (struct winj_vm_params *params,                                      \
   struct winj_##parent *src_##parent,                                 \
   struct winj_##child *child##_in)                                    \
  {                                                                    \
    int result = EXIT_SUCCESS;                                         \
    struct winj_##child *next;                                         \
    struct winj_##child *found = NULL;                                 \
    struct winj_##child *current = NULL;                               \
    u4 top = src_##parent->sibling##_count;                            \
    u4 bottom = 0;                                                     \
    u4 index = 0;                                                      \
    if (!child##_in)                                                   \
      result = winj_error(params, "missing ##child pointer");          \
    while (top > bottom) {                                             \
      index = winj_binary_search_step                                  \
        (src_##parent->name_len, src_##parent->name, index,            \
         current ? current->name_len : 0,                              \
         current ? current->name : 0, current,                         \
         &top, &bottom, (void**)&found);                               \
      if (index < top)                                                 \
        current = &src_##parent->sibling##s[index];                    \
    };                                                                 \
    if (EXIT_SUCCESS != result) {                                      \
    } else if (found) {                                                \
      result = winj_error                                              \
        (params, "refusing to store ##child that already exists: "     \
         "%.*s", child##_in->name_len, child##_in->name);              \
    } else if (!(next = winj_realloc                                   \
                 (params, src_##parent->sibling##s,                    \
                  sizeof(*src_##parent->sibling##s) *                  \
                  (src_##parent->sibling##_count + 1)))) {             \
      result = winj_error                                              \
        (params, "failed to allocate %u bytes for ##child",            \
         sizeof(*src_##parent->sibling##s) *                           \
         (src_##parent->sibling##_count + 1));                         \
    } else {                                                           \
      src_##parent->sibling##s = next;                                 \
      memmove(&src_##parent->sibling##s[index + 1],                    \
              &src_##parent->sibling##s[index],                        \
              sizeof(*src_##parent->sibling##s) *                      \
              (src_##parent->sibling##_count++ - index));              \
      src_##parent->sibling##s[index] = *child##_in;                   \
    }                                                                  \
    return result;                                                     \
  }

WINJ_BINARY_SEARCH(class, method, static_method);
WINJ_BINARY_SEARCH(class, method, method);

/**
 * Used for classes defined by class files to stitch things together.
 * Synthetic classes used by the system do not use this.
 *
 * @param params parameters for system customization
 * @param cls class as seen by the virtual machine
 * @param class_file unpacked data from a class file
 * @returns EXIT_SUCCESS unless something went wrong */
static int
winj_class_class_file
(struct winj_vm_params *params, struct winj_class *cls,
 struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  const char *name = NULL;
  unsigned    name_len = 0;
  unsigned ii;

  for (ii = 0; (EXIT_SUCCESS == result) &&
         (ii < class_file->methods_count); ++ii) {
    u1 tag_utf8 = WINJ_CONST_UTF8;
    union winj_cpool_info *name_info = NULL;
    union winj_cpool_info *desc_info = NULL;
    struct winj_method_file *method_file = &class_file->methods[ii];
    struct winj_method method;
    memset(&method, 0, sizeof(method));
    method.method_file = method_file;

    if (EXIT_SUCCESS !=
        (result = winj_cpool_get
         (params, class_file, method_file->name_index,
          &tag_utf8, &name_info))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_cpool_get
                (params, class_file, method_file->descriptor_index,
                 &tag_utf8, &desc_info))) {
    } else if (EXIT_SUCCESS !=
               (result = winj_string_concat
                (params, name_info->const_utf8.length,
                 (const char *)name_info->const_utf8.bytes,
                 desc_info->const_utf8.length,
                 (const char *)desc_info->const_utf8.bytes,
                 &method.name_len, &method.name))) {
    } else if ((method_file->access_flags & WINJ_ACCESS_STATIC) &&
               (EXIT_SUCCESS !=
                (result = winj_class_static_method_store
                 (params, cls, &method)))) {
    } else if (!(method_file->access_flags & WINJ_ACCESS_STATIC) &&
               (EXIT_SUCCESS !=
                (result = winj_class_method_store
                 (params, cls, &method)))) {
    } else {
      memset(&method, 0, sizeof(method));
    }
    winj_free(params, method.name);
  }

  /* TODO: create fields */
  /* TODO: create static fields */

  if (EXIT_SUCCESS != result) {
  } else if (EXIT_SUCCESS !=
      (result = winj_cpool_get_class_name
       (params, class_file, class_file->this_class,
        &name_len, &name))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_string_copy
              (params, name_len, name, &cls->name_len, &cls->name))) {
  }
  return result;
}

/**
 * Check whether class is valid according to section 4.10 of the
 * Java Virtual Machine Specification.
 *
 * @param parameters for system customization
 * @param class_file a class to validate
 * @returns EXIT_SUCCESS unless class is not valid */
int
winj_class_file_validate
(struct winj_thread *thread, struct winj_class_file *class_file)
{
  int result = EXIT_SUCCESS;
  /* TODO */
  return result;
}

int
winj_class_instance(struct winj_class *cls, struct winj_object *obj)
{
  int result = EXIT_FAILURE;
  struct winj_class *current = obj ? obj->cls : NULL;

  for (; (result != EXIT_SUCCESS) && current;
       current = current->super)
    if (current == cls)
      result = EXIT_SUCCESS;
  return result;
}

static const char *
winj_path_next(const char **path, char sep, unsigned *count_out)
{
  const char *result = NULL;
  unsigned count = 0;

  if (path && *path) {
    const char *next = strchr(*path, sep);
    result = *path;

    if (next) {
      count = next - result;
      *path = next + 1;
    } else {
      count = strlen(result);
      *path = NULL;
    }
  }
  if (count_out)
    *count_out = count;
  return result;
}

/**
 * Convert a fully qualified class name to a file system path
 *
 * @param vm virtual machine for params
 * @param name_len number of bytes in class name (or 0 for strlen)
 * @param name fully qualified class name
 * @param path destination to write path to
 * @return EXIT_SUCCESS unless something goes wrong */
static int
winj_class_get_path
(struct winj_vm_params *params, unsigned name_len, const char *name,
 char **path)
{
  int result = EXIT_SUCCESS;
  const char suffix[] = ".class";
  char *buffer = NULL;

  if (!name_len)
    name_len = strlen(name);

  if (!(buffer = winj_malloc(params, name_len + sizeof(suffix)))) {
    result = winj_error
      (params, "failed to allocate path for \"%.*s\"", name_len, name);
  } else if (path) {
    unsigned ii;

    for (ii = 0; ii < name_len; ++ii)
      buffer[ii] = (name[ii] == '.') ? '/' : name[ii];
    memcpy(buffer + name_len, suffix, sizeof(suffix));

    *path = buffer;
    buffer = NULL;
  }
  winj_free(params, buffer);
  return result;
}

static int
rc_vfprintf(FILE *stream, int previous,
            const char *format, va_list args)
{
  int result = vfprintf(stream, format, args);
  result = ((previous >= 0) && (result >= 1)) ?
    (result + previous) : -1;
  return result;
}

static int
rc_fprintf(FILE *stream, int previous, const char *format, ...)
{
  int result;
  va_list args;

  va_start(args, format);
  result = rc_vfprintf(stream, previous, format, args);
  va_end(args);
  return result;
}

int
winj_printdesc_class
(struct winj_vm_params *params, FILE *stream, int previous,
 unsigned length, const char *desc)
{
  int result = 0;
  char *buffer = NULL;

  if (!(buffer = winj_malloc(params, length + 1))) {
    winj_error(params, "failed to allocate %u bytes", length + 1);
    result = -1;
  } else {
    unsigned ii;

    strncpy(buffer, desc, length);
    buffer[length] = '\0';
    for (ii = 0; ii < length; ++ii)
      if (buffer[ii] == '/')
        buffer[ii] = '.';
    result = rc_fprintf(stream, previous, "%s", buffer);
  }
  winj_free(params, buffer);
  return result;
}

enum winj_print_flags {
  WINJ_PRINT_CONSTPOOL = 1<<0,
  WINJ_PRINT_FIELDS    = 1<<1,
  WINJ_PRINT_METHODS   = 1<<2,

  WINJ_PRINT_DEFAULT = WINJ_PRINT_FIELDS | WINJ_PRINT_METHODS,
  WINJ_PRINT_ALL = WINJ_PRINT_CONSTPOOL | WINJ_PRINT_DEFAULT,
};

/**
 * Print a representation of the specified class to a FILE stream.
 *
 * @param params parameters for system customization
 * @param clazz class to print
 * @param stream FILE stream to print class information to
 * @param flags settings for printing parts of a class
 * @param format included in Javadoc comment on class
 * @return number of characters printed */
/* static FIXME */ int
winj_class_fprintf
(struct winj_vm_params *params, struct winj_class_file *class_file,
 FILE *stream, unsigned flags, const char *format, ...)
{
  int result = 0;
  unsigned ii;

  if (!flags)
    flags = WINJ_PRINT_DEFAULT;

  if (format) {
    va_list args;
    va_start(args, format);
    result = rc_fprintf(stream, result, "/**\n * ");
    result = rc_vfprintf(stream, result, format, args);
    result = rc_fprintf(stream, result, " */\n");
    /* TODO: vsnprintf and wrap input? */
    va_end(args);
  }

  if (result >= 0) {
    const char *implements = "implements";
    char *class_name = NULL;
    char *super_name = NULL;

    if (EXIT_SUCCESS != winj_describe_class_file_alloc
        (params, class_file, class_file->this_class,
         class_file->access_flags, &class_name)) {
      result = -1;
    } else if (class_file->super_class &&
               (EXIT_SUCCESS != winj_describe_class_file_alloc
                (params, class_file, class_file->super_class,
                 0, &super_name))) {
      result = -1;
    } else {
      result = rc_fprintf(stream, result, "class %s\n", class_name);
      if (super_name)
        result = rc_fprintf
          (stream, result, "    extends %s\n", super_name);
    }

    for (ii = 0; ii < class_file->iface_count; ++ii) {
      char *iface_name = NULL;

      if (EXIT_SUCCESS != winj_describe_class_file_alloc
          (params, class_file, class_file->ifaces[ii],
           0, &iface_name)) {
        result = -1;
      } else result = rc_fprintf
               (stream, result, "    %s %s\n", implements, iface_name);
      implements = "          ";
      winj_free(params, iface_name);
    }
    result = rc_fprintf(stream, result, "{\n");

    winj_free(params, class_name);
    winj_free(params, super_name);
  }

  if ((result >= 0) && (flags & WINJ_PRINT_CONSTPOOL)) {
    if (class_file->cpool_count > 1)
      result = rc_fprintf(stream, result, "    // Constant Pool:\n");
    for (ii = 1; ii < class_file->cpool_count; ++ii) {
      union winj_cpool_info *info = NULL;
      u1 tag = 0;
      if (!class_file->cpool_idx)
        continue;

      winj_cpool_get(params, class_file, ii, &tag, &info);
      result = rc_fprintf(stream, result, "    // [%u] ", ii);

      switch (tag) {
      case WINJ_CONST_CLASS:
        result = rc_fprintf(stream, result, "CLASS %hu",
                            info->const_class);
        break;
      case WINJ_CONST_UTF8:
        result = rc_fprintf(stream, result, "UTF8 %.*s",
                            (int)info->const_utf8.length,
                            info->const_utf8.bytes);
        break;
      case WINJ_CONST_FIELDREF:
        result = rc_fprintf
          (stream, result, "FIELDREF class=%hu nameandtype=%hu",
           info->const_methodref.class_index,
           info->const_methodref.nameandtype_index);
        break;
      case WINJ_CONST_METHODREF:
        result = rc_fprintf
          (stream, result, "METHODREF class=%hu nameandtype=%hu",
           info->const_methodref.class_index,
           info->const_methodref.nameandtype_index);
        break;
      case WINJ_CONST_NAMEANDTYPE:
        result = rc_fprintf
          (stream, result, "NAMEANDTYPE name=%hu, desc=%hu",
           info->const_nameandtype.name_index,
           info->const_nameandtype.descriptor_index);
        break;
      case WINJ_CONST_STRING:
        result = rc_fprintf(stream, result, "STRING %hu",
                            info->const_string);
        break;
      case WINJ_CONST_INTEGER:
        result = rc_fprintf
          (stream, result, "INTEGER %d", info->const_int);
        break;
      default:
        result = rc_fprintf
          (stream, result, "    UNKNOWN %x", (unsigned)tag);
      }
      result = rc_fprintf(stream, result, "\n");
    }
  }

  if ((result >= 0) && (flags & WINJ_PRINT_FIELDS)) {
    for (ii = 0; (result >= 0) &&
           (ii < class_file->fields_count); ++ii) {
      struct winj_field_file *field = &class_file->fields[ii];
      char *field_desc = NULL;

      if (EXIT_SUCCESS != winj_describe_field_alloc
          (params, class_file, field, &field_desc)) {
        result = -1;
      } else {
        result = rc_fprintf(stream, result, "    %s;\n", field_desc);
      }
      winj_free(params, field_desc);
    }
  }

  if ((result >= 0) && (flags & WINJ_PRINT_METHODS)) {
    for (ii = 0; ii < class_file->methods_count; ++ii) {
      struct winj_method_file *method = &class_file->methods[ii];
      char *method_desc = NULL;

      if (EXIT_SUCCESS != winj_describe_method_alloc
          (params, class_file, method, &method_desc)) {
        result = -1;
      } else if (method->access_flags &
                 (WINJ_ACCESS_ABSTRACT | WINJ_ACCESS_NATIVE)) {
        result = rc_fprintf(stream, result, "    %s;\n", method_desc);
      } else {
        result = rc_fprintf
          (stream, result, "    %s { /* ... */ }\n", method_desc);
      }
      winj_free(params, method_desc);
    }
  }

  result = rc_fprintf(stream, result, "}\n");
  return result;
}

/**
 * Open specified file and read all the bytes.
 *
 * @param vm virtual machine for params
 * @param fin file to read all bytes from
 * @param bytes destination in which to store bytes
 * @return EXIT_SUCCESS unless something goes wrong */
int
winj_bytes_from_file
(struct winj_vm_params *params, FILE *fin,
 struct winj_bytes *bytes_out)
{
  int result = EXIT_SUCCESS;
  struct winj_bytes collected = {0};
  unsigned capacity = 0;
  u1 *next = NULL;

  while ((result == EXIT_SUCCESS) && !feof(fin)) {
    const unsigned chunk = 2048;

    if (capacity >= collected.count + chunk/2) {
    } else if (!(next = winj_realloc
                 (params, collected.value, collected.count + chunk))) {
      result = winj_error(params, "failed to allocate %u bytes",
                           collected.count + chunk);
    } else {
      collected.value = next;
      capacity = collected.count + chunk;
    }

    if (result == EXIT_SUCCESS) {
      unsigned nbytes = fread(collected.value + collected.count, 1,
                              capacity - collected.count, fin);
      if (nbytes > 0) {
        collected.count += nbytes;
      } else if (ferror(fin) && (errno != EAGAIN) &&
                 (errno != EWOULDBLOCK)) {
        result = winj_error
          (params, "fread failed: %s", strerror(errno));
      }
    }
  }

  if ((result == EXIT_SUCCESS) && bytes_out) {
    *bytes_out = collected;
    collected.value = NULL;
  }
  winj_free(params, collected.value);
  return result;
}

static int
winj_bytes_from_environ_path
(struct winj_vm_params *params, const char *environ_variable,
 const char *filename, struct winj_bytes *bytes_out)
{
  int result = EXIT_SUCCESS;
  unsigned filename_length = strlen(filename);
  unsigned prefix_length = 0;
  unsigned found = 0;
  const char *prefix = NULL;
  const char *winjpath = NULL;

  if (params && params->getenv)
    winjpath = params->getenv(params->context, environ_variable);
  else winjpath = getenv(environ_variable);

  if (!winjpath)
    winjpath = ".";

  while ((result == EXIT_SUCCESS) && !found &&
         (prefix = winj_path_next(&winjpath, ':', &prefix_length))) {
    FILE *ff = NULL;
    char *path = NULL;
    unsigned separate = 0;
    unsigned length = filename_length + prefix_length;
    struct winj_bytes bytes = {0};

    if (prefix && prefix_length > 0 &&
        (prefix[prefix_length - 1] != '/')) {
      separate = 1;
      length += 1;
    }

    if (!(path = winj_malloc(params, length + 1))) {
      result = winj_error
        (params, "failed to allocate %u bytes for path", length + 1);
    } else {
      strcpy(path, prefix);
      if (separate)
        path[prefix_length] = '/';
      strcpy(path + prefix_length + (separate ? 1 : 0), filename);
      path[length] = '\0';
    }

    if (result != EXIT_SUCCESS) {
    } else if (!(ff = fopen(path, "rb"))) {
      /* Completely ignore missing files, but log other reasons.
       * Either way keep going to try the next WINJ_PATH entry */
      if (errno != ENOENT)
        winj_warn(params, "failed to open \"%s\": %s",
                   path, strerror(errno));
    } else if (EXIT_SUCCESS !=
               (result = winj_bytes_from_file(params, ff, &bytes))) {
    } else found = 1;

    if (found && bytes_out) {
      *bytes_out = bytes;
      bytes.value = NULL;
    }
    if (ff)
      fclose(ff);
    winj_free(params, path);
    winj_free(params, bytes.value);
  }

  if (!found && bytes_out && (result == EXIT_SUCCESS)) {
    bytes_out->value = NULL;
    bytes_out->count = bytes_out->offset = 0;
  }
  return result;
}

/**
 * Attempt to fetch a named class using the default mechanism.  This
 * is available in case a custom <code>find_class</code>
 * implementation wants to supplement rather than entirely replace the
 * default mechanims.  This routine grabs the contents of the
 * <code>WINJ_PATH</code> environment variable (using replacement
 * <code>getenv</code> if provided) and tries prepending each
 * colon-separated segment to build a file system path implied by the
 * fully qualified class name.
 *
 * So for example, if <code>WINJ_PATH</code> is
 * <code>/lib:/tmp/classes</code> and the name is
 * <code>java.lang.Object</code> this routine will attempt to open
 * <code>/lib/java/lang/Object.class</code> and
 * <code>/tmp/classes/java/lang/Object.class</code> before giving up.
 *
 * @param params parameters for system customization
 * @param name_len fully qualified class name to fetch
 * @param name fully qualified class name to fetch
 * @param bytes destination to place allocated bytes
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_find_class_default
(struct winj_vm_params *params, unsigned name_len, const char *name,
 struct winj_bytes *bytes)
{
  int result = EXIT_SUCCESS;
  char *path = NULL;

  if (EXIT_SUCCESS != (result = winj_class_get_path
                       (params, name_len, name, &path))) {
  } else if (EXIT_SUCCESS != (result = winj_bytes_from_environ_path
                              (params, "WINJ_PATH", path, bytes))) {
  }
  winj_free(params, path);
  return result;
}

/**
 * Populate a pointer with the class corresponding to a fully qualified
 * class name if one exists or with NULL otherwise.  Either of these
 * conditions is considered success with respect to the return code.
 *
 * @param vm virtual machine to search
 * @param name_len number of bytes in length (or 0 for strlen)
 * @param name name to look for, such as <code>java.lang.Object</code>
 * @param class_out destination in which to store class pointer or NULL
 * @return EXIT_SUCCESS unless something went wrong. */
static int
winj_vm_class_lookup
(struct winj_vm *vm, unsigned name_len, const char *name,
 struct winj_class **class_out)
{
  int result = EXIT_SUCCESS;
  struct winj_class *found = NULL;
  struct winj_class *current = NULL;
  u4 top = vm->class_count;
  u4 bottom = 0;
  u4 index = 0;

  if (!name_len)
    name_len = strlen(name);

  while (top > bottom) {
    index = winj_binary_search_step
      (name_len, name, index, current ? current->name_len : 0,
       current ? current->name : NULL, current,
       &top, &bottom, (void**)&found);
    if (index < top)
      current = vm->classes[index];
  }

  if (class_out)
    *class_out = found;
  return result;
}

/**
 * Add a class to the list maintained by a virtual machine.
 * This routine maintains the sorted order by class name so that
 * subsequent attempts to look up a class can use binary search.
 *
 * @param vm virtual machine to add to
 * @param loaded class to store
 * @return EXIT_SUCCESS unles something went wrong */
static int
winj_vm_class_store(struct winj_vm *vm, struct winj_class *cls)
{
  int result = EXIT_SUCCESS;
  struct winj_vm_params *params = vm ? &vm->params : NULL;
  struct winj_class **next;
  struct winj_class *found = NULL;
  struct winj_class *current = NULL;
  u4 top = vm->class_count;
  u4 bottom = 0;
  u4 index = 0;

  if (!cls)
    result = winj_error(params, "missing class pointer");

  while (top > bottom) {
    index = winj_binary_search_step
      (cls->name_len, cls->name, index,
       current ? current->name_len : 0,
       current ? current->name : NULL,
       current, &top, &bottom, (void**)&found);
    if (index < top)
      current = vm->classes[index];
  }

  if (EXIT_SUCCESS != result) {
  } else if (found) {
    result = winj_error
      (params, "refusing to store class that already exists: "
       "%.*s", cls->name_len, cls->name);
  } else if (!(next = winj_realloc
               (params, vm->classes, sizeof(*vm->classes) *
                (vm->class_count + 1)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for class pointers",
       sizeof(*vm->classes) * (vm->class_count + 1));
  } else {
    vm->classes = next;
    memmove(&vm->classes[index + 1], &vm->classes[index],
            sizeof(*vm->classes) * (vm->class_count++ - index));
    vm->classes[index] = cls;
  }
  return result;
}

static int
winj_thread_oom(struct winj_thread *thread)
{
  /* TODO: throw a preallocated java.lang.OutOfMemoryError instance */
  return EXIT_FAILURE;
}

static int
winj_thread_throw(struct winj_thread *thread, unsigned throwable_len,
                  const char *throwable_name, const char *format, ...)
{
  int result = EXIT_SUCCESS;
  va_list args;

  /* TODO: lookup throwable_name */
  va_start(args, format);
  /* TODO: pack formatted string */
  /* TODO: create instance of exception winj */
  if (throwable_name && !throwable_len)
    throwable_len = strlen(throwable_name);
  winj_error(&thread->vm->params, "Exception %.*s",
             throwable_len, throwable_name);
  winj_vlog(&thread->vm->params, WINJ_LEVEL_ERROR,
            format, args); /* FIXME */
  va_end(args);

  /* TODO: check for suitable handler in each frame */
  return result;
}

/**
 * Create a synthetic class that has no corresponding class file.
 *
 * @param vm virtual machine instance in which to define class
 * @param name_len optional length of class name
 * @param name class name
 * @param field_count number of fields
 * @param field_specs specification for each field
 * @param method_count number of methods
 * @param methods specification for each method
 * @param class_out optional destination for defined class
 * */
static int
winj_vm_class_synthetic
(struct winj_vm *vm, unsigned name_len, const char *name,
 unsigned field_count, struct winj_field *fields,
 unsigned method_count, struct winj_method *methods,
 struct winj_class **class_out)
{
  int result = EXIT_SUCCESS;
  struct winj_vm_params *params = vm ? &vm->params : NULL;
  struct winj_class *cls = NULL;
  unsigned ii;

  for (ii = 0; (EXIT_SUCCESS == result) && (ii < field_count); ++ii) {
    /* TODO: establish fields methods */
  }
  for (ii = 0; (EXIT_SUCCESS == result) && (ii < method_count); ++ii) {
    /* TODO: establish methods */
  }
  /* TODO: create link to parent class */

  if (!(cls = winj_calloc(params, 1, sizeof(*cls)))) {
    result = winj_error(params, "failed to allocate %u bytes "
                        "for class definition", sizeof(*cls));
  } else if (EXIT_SUCCESS != (result = winj_string_copy
                              (params, name_len, name,
                               &cls->name_len, &cls->name))) {
  } else if (EXIT_SUCCESS != (result = winj_vm_class_store(vm, cls))) {
  } else {
    if (class_out)
      *class_out = cls;
    cls->access_flags |= WINJ_ACCESS_SYNTHETIC;
    cls = NULL; /* already stored */
  }
  winj_class_cleanup(params, cls);
  return result;
}

/**
 * Create, validate and store a class.
 *
 * @param thread place to throw exceptions if things go wrong
 * @param bytes contents of class to steal on success
 * @params loader class loader to associate define class with
 * @params class_out detination for defined class on success
 * @return EXIT_SUCCESS unless something went wrong */
static int
winj_thread_class_define
(struct winj_thread *thread, struct winj_bytes *bytes,
 struct winj_object *loader, struct winj_class **class_out)
{
  int result = EXIT_SUCCESS;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_class *cls = NULL;

  if (!thread) {
    result = winj_error(params, "missing thread %p", thread);
  } else if (!bytes || !bytes->value || !bytes->count) {
    result = winj_error
      (params, "missing bytes %p(%u/%p)", bytes,
       bytes ? bytes->count : 0, bytes ? bytes->value : NULL);
  } else if (!(cls = winj_malloc
               (params, sizeof(*cls) + sizeof(*cls->class_file)))) {
    result = winj_error
      (params, "failed to allocate %u bytes for class",
       sizeof(*cls) + sizeof(*cls->class_file));
  } else { /* single allocation for class and class file */
    memset(cls, 0, sizeof(*cls));
    cls->self.cls = thread->vm->class_class;
    cls->class_file = (struct winj_class_file *)(&cls[1]);
    memset(cls->class_file, 0, sizeof(*cls->class_file));
  }

  if (EXIT_SUCCESS != result) {
  } else if (EXIT_SUCCESS !=
             (result = winj_class_file_create
              (params, bytes, cls->class_file))) {
    winj_thread_throw(thread, 0, "java/lang/ClassFormatError",
                      "more detail here would be nice");
  } else if (EXIT_SUCCESS !=
             (result = winj_class_file_validate
              (thread, cls->class_file))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_class_class_file
              (params, cls, cls->class_file))) {
    winj_thread_throw(thread, 0, "java/lang/InternalError",
                      "failed to connect class and class file");
  } else if (EXIT_SUCCESS != (result = winj_vm_class_store
                              (thread->vm, cls))) {
  } else if (class_out) {
    *class_out = cls;
    cls = NULL;
  }
  winj_class_cleanup(params, cls);
  return result;
}

/**
 * Attempt to find a class specified by a fully qualified name.  If
 * the class in question has already been loaded the existing instance
 * will be found.  If not either the <code>find_class</code> supplied
 * by parameters will be called or the default class loading routine
 * will search for class files according to the WINJ_PATH environment
 * variable.
 *
 * @param thread virtual machine thread on which to find class
 * @param name_len optional length of class name (0 for strlen)
 * @param name fully qualified class name
 * @param class_out set to the class if found or NULL if not
 * @return EXIT_SUCCESS unless something went wrong. */
static int
winj_thread_class_find
(struct winj_thread *thread, unsigned name_len, const char *name,
 struct winj_class **class_out)
{
  int result = EXIT_SUCCESS;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_bytes bytes = {0};
  struct winj_class *found = NULL;

  if (name && !name_len)
    name_len = strlen(name);

  if (!name) {
    result = winj_error
      (params, "missing arguments (name=%p/%u)", name, name_len);
  } else if (EXIT_SUCCESS != winj_vm_class_lookup
             (thread->vm, name_len, name, &found)) {
  } else if (found) { /* requested class already loaded? */
  } else if (params->find_class && EXIT_SUCCESS !=
             (result = params->find_class
              (params->context, params, name_len, name, &bytes))) {
    winj_debug(params, "failed find_class: %.*s", name_len, name);
  } else if (!bytes.count && EXIT_SUCCESS !=
             (result = winj_find_class_default
              (params, name_len, name, &bytes))) {
    winj_debug(params, "failed find default: %.*s", name_len, name);
  } else if (!bytes.count) { /* no class found */
  } else if (EXIT_SUCCESS !=
             (result = winj_thread_class_define
              (thread, &bytes, NULL, &found))) {
  }

  if ((EXIT_SUCCESS == result) && class_out) {
    *class_out = found;
    found = NULL;
  }
  winj_class_cleanup(params, found);
  winj_free(params, bytes.value);
  return result;
}

static int
winj_operand_push
(struct winj_vm *vm, struct winj_thread *thread, u4 thing)
{
  int result = EXIT_SUCCESS;
  u4 *next;

  if (!thread) {
    result = winj_error(&vm->params, "missing thread argument");
  } else if (!(next = winj_realloc
               (&vm->params, thread->operands,
                sizeof(*thread->operands) *
                (thread->operand_count + 1)))) {
    winj_thread_oom(thread);
    result = EXIT_FAILURE;
  } else {
    thread->operands = next;
    thread->operands[thread->operand_count++] = thing;
  }
  return result;
}

static int
winj_operand_pop
(struct winj_vm *vm, struct winj_thread *thread, u4 *thing)
{
  int result = EXIT_SUCCESS;

  if (!thread) {
    result = winj_error
      (&vm->params, "missing thread argument");
  } else if (!thread->operand_count) {
    result = winj_error
      (&vm->params, "operand stack underflow (thread=%p)", thread);
  } else if (thing) {
    *thing = thread->operands[--thread->operand_count];
  }
  return result;
}

int
winj_nyi(struct winj_vm *vm, struct winj_thread *thread)
{
  return winj_error(&vm->params, "opcode not yet implemented");
}

/* static FIXME */ int
winj_thread_step(struct winj_vm *vm, struct winj_thread *thread)
{
  int result = EXIT_SUCCESS;

  u1 opcode = 0x00;
  /* TODO: find current opcode from thread pc */

  switch (opcode) {
  case WINJ_OPCODE_NOP: /* that was easy */ break;
  case WINJ_OPCODE_ACONST_NULL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ICONST_M1:
    winj_operand_push(vm, thread, (u4)-1); break;
  case WINJ_OPCODE_ICONST_0:
    winj_operand_push(vm, thread, 0); break;
  case WINJ_OPCODE_ICONST_1:
    winj_operand_push(vm, thread, 1); break;
  case WINJ_OPCODE_ICONST_2:
    winj_operand_push(vm, thread, 2); break;
  case WINJ_OPCODE_ICONST_3:
    winj_operand_push(vm, thread, 3); break;
  case WINJ_OPCODE_ICONST_4:
    winj_operand_push(vm, thread, 4); break;
  case WINJ_OPCODE_ICONST_5:
    winj_operand_push(vm, thread, 5); break;
  case WINJ_OPCODE_LCONST_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LCONST_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FCONST_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FCONST_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FCONST_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DCONST_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DCONST_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_BIPUSH: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_SIPUSH: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LDC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LDC_W: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LDC2_W: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ILOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LLOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FLOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DLOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ILOAD_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ILOAD_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ILOAD_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ILOAD_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LLOAD_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LLOAD_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LLOAD_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LLOAD_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FLOAD_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FLOAD_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FLOAD_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FLOAD_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DLOAD_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DLOAD_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DLOAD_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DLOAD_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ALOAD_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ALOAD_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ALOAD_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ALOAD_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_AALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_BALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_CALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_SALOAD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISTORE_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISTORE_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISTORE_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISTORE_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSTORE_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSTORE_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSTORE_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSTORE_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSTORE_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSTORE_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSTORE_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSTORE_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSTORE_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSTORE_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSTORE_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSTORE_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ASTORE_0: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ASTORE_1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ASTORE_2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ASTORE_3: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_AASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_BASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_CASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_SASTORE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_POP: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_POP2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP_X1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP_X2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP2_X1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DUP2_X2: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_SWAP: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IADD: {
    u4 term1;
    u4 term2;

    if (EXIT_SUCCESS != (result = winj_operand_pop
                         (vm, thread, &term2))) {
    } else if (EXIT_SUCCESS != (result = winj_operand_pop
                                (vm, thread, &term1))) {
    } else {
      result = winj_operand_push(vm, thread, term1 + term2);
    }
  } break;
  case WINJ_OPCODE_LADD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FADD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DADD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISUB: {
    u4 term1;
    u4 term2;

    if (EXIT_SUCCESS != (result = winj_operand_pop
                         (vm, thread, &term2))) {
    } else if (EXIT_SUCCESS != (result = winj_operand_pop
                                (vm, thread, &term1))) {
    } else {
        result = winj_operand_push(vm, thread, term1 - term2);
    }
  } break;
  case WINJ_OPCODE_LSUB: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FSUB: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DSUB: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IMUL: {
    u4 factor1;
    u4 factor2;

    if (EXIT_SUCCESS != (result = winj_operand_pop
                         (vm, thread, &factor2))) {
    } else if (EXIT_SUCCESS != (result = winj_operand_pop
                                (vm, thread, &factor1))) {
    } else {
      result = winj_operand_push(vm, thread, factor1 * factor2);
    }
    } break;
  case WINJ_OPCODE_LMUL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FMUL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DMUL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IDIV: {
    u4 numerator;
    u4 denominator;

    if (EXIT_SUCCESS != (result = winj_operand_pop
                         (vm, thread, &denominator))) {
    } else if (EXIT_SUCCESS != (result = winj_operand_pop
                                (vm, thread, &numerator))) {
    } else if (denominator == 0) {
      winj_thread_throw
        (thread, 0, "java/lang/ArithmeticException",
         "division by zero: %u / %u", numerator, denominator);
    } else {
      result = winj_operand_push
        (vm, thread, numerator / denominator);
    }
  } break;
  case WINJ_OPCODE_LDIV: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FDIV: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DDIV: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IREM: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LREM: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FREM: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DREM: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INEG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LNEG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FNEG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DNEG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISHL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSHL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ISHR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LSHR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IUSHR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LUSHR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IAND: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LAND: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IOR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LOR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IXOR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LXOR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IINC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2L: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2F: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2D: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_L2I: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_L2F: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_L2D: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_F2I: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_F2L: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_F2D: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_D2I: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_D2L: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_D2F: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2B: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2C: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_I2S: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LCMP: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FCMPL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FCMPG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DCMPL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DCMPG: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFEQ: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFNE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFLT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFGE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFGT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFLE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPEQ: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPNE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPLT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPGE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPGT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ICMPLE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ACMPEQ: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IF_ACMPNE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_GOTO: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_JSR: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_RET: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_TABLESWITCH: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LOOKUPSWITCH: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IRETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_LRETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_FRETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_DRETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ARETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_RETURN: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_GETSTATIC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_PUTSTATIC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_GETFIELD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_PUTFIELD: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INVOKEVIRTUAL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INVOKESPECIAL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INVOKESTATIC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INVOKEINTERFACE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INVOKEDYNAMIC: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_NEW: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_NEWARRAY: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ANEWARRAY: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ARRAYLENGTH: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_ATHROW: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_CHECKCAST: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_INSTANCEOF: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_MONITORENTER: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_MONITOREXIT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_WIDE: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_MULTIANEWARRAY: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFNULL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IFNONNULL: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_GOTO_W: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_JSR_W: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_BREAKPOINT: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IMPDEP1: winj_nyi(vm, thread); break;
  case WINJ_OPCODE_IMPDEP2: winj_nyi(vm, thread); break;
  default: winj_nyi(vm, thread); break;
  }
  return result;
}

void
winj_vm_object_cleanup(struct winj_vm *vm, struct winj_object *obj)
{
  struct winj_vm_params *params = vm ? &vm->params : NULL;

  if (obj) {
    if (obj->cls == vm->class_array) {
      struct winj_array *array = (struct winj_array *)obj;
      winj_free(params, array->elements);
    }
    winj_free(params, obj);
  }
}

static int
winj_type_parse
(struct winj_vm_params *params,
 unsigned desc_len, const char *desc, const char **next_out,
 struct winj_argument *argument_out)
{
  int result = EXIT_SUCCESS;
  const char *next = NULL;
  struct winj_argument argument = {0};

  if (desc && !desc_len)
    desc_len = strlen(desc);
  if (!desc || !desc_len || !*desc) {
    result = winj_error(params, "empty type descriptor");
  } else {
    next = desc + 1;

    switch (*desc) {
    case 'V': argument.argtype = WINJ_TYPE_VOID;    break;
    case 'Z': argument.argtype = WINJ_TYPE_BOOLEAN; break;
    case 'B': argument.argtype = WINJ_TYPE_BYTE;    break;
    case 'C': argument.argtype = WINJ_TYPE_CHAR;    break;
    case 'S': argument.argtype = WINJ_TYPE_SHORT;   break;
    case 'I': argument.argtype = WINJ_TYPE_INT;     break;
    case 'J': argument.argtype = WINJ_TYPE_LONG;    break;
    case 'F': argument.argtype = WINJ_TYPE_FLOAT;   break;
    case 'D': argument.argtype = WINJ_TYPE_DOUBLE;  break;
    case 'L': {
      const char *end = NULL;
      if (!(end = winj_strnchr(desc + 1, ';', desc_len - 1))) {
        result = winj_error(params, "missing object terminator");
      } else {
        next = end + 1;
        argument.argtype = WINJ_TYPE_OBJECT;
        argument.class_name = desc + 1;
        argument.class_name_len = desc_len - 1 - (end - desc);
      }
    } break;
    case '[': {
      if (EXIT_SUCCESS !=
          (result = winj_type_parse
           (params, desc_len - 1, desc + 1, &next, &argument))) {
      } else argument.array_count++;
    } break;
    default:
      result = winj_error
        (params, "unrecognized type descriptor: %c (%u)",
         *desc, (unsigned)*desc);
    }
  }

  if (EXIT_SUCCESS == result) {
    if (argument_out)
      *argument_out = argument;
    if (next_out)
      *next_out = next;
  }
  return result;
}

int
winj_arguments_parse
(struct winj_vm_params *params,
 unsigned desc_len, const char *desc, enum winj_type *return_type,
 unsigned *argument_count_out, struct winj_argument **arguments_out)
{
  int result = EXIT_SUCCESS;
  unsigned count = 0;
  struct winj_argument *argarray = NULL;
  const char *open = NULL;
  const char *close = NULL;

  if (desc && !desc_len)
    desc_len = strlen(desc);

  if (!(open = winj_strnchr(desc, '(', desc_len))) {
    result = winj_error(params, "missing open parenthesis");
  } else if (!(close = winj_strnchr
               (open, ')', desc_len - (open - desc)))) {
    result = winj_error(params, "missing close parenthesis");
  } else {
    const char *next = open + 1;

    while ((EXIT_SUCCESS == result) && (next < close)) {
      struct winj_argument *argnext = NULL;
      struct winj_argument argument;

      if (EXIT_SUCCESS !=
          (result = winj_type_parse
           (params, close - next, next, &next, &argument))) {
      } else if (!(argnext = winj_realloc
                   (params, argarray, (count + 1) *
                    sizeof(*argarray)))) {
        result = winj_error(params, "failed to allocate %u bytes",
                            (count + 1) * sizeof(*argarray));
      } else {
        argarray = argnext;
        argarray[count++] = argument;
      }
    }
  }

  if (EXIT_SUCCESS == result) {
    if (arguments_out) {
      *arguments_out = argarray;
      argarray = NULL;
    }
    if (argument_count_out)
      *argument_count_out = count;
  }
  winj_free(params, argarray);
  return result;
}

int
winj_arguments_values
(struct winj_vm_params *params, jvalue *values,
 unsigned argument_count, struct winj_argument *arguments)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  for (ii = 0; ii < argument_count; ++ii)
    arguments[ii].value = values[ii];
  return result;
}

int
winj_arguments_varargs
(struct winj_vm_params *params, va_list args,
 unsigned argument_count, struct winj_argument *arguments)
{
  int result = EXIT_SUCCESS;
  unsigned ii;

  /* TODO: something about arrays? */
  for (ii = 0; (EXIT_SUCCESS == result) &&
         (ii < argument_count); ++ii) {
    struct winj_argument *argument = &arguments[ii];
    switch (argument->argtype) {
    case WINJ_TYPE_BOOLEAN:
      argument->value.z = va_arg(args, jint); break;
    case WINJ_TYPE_BYTE:
      argument->value.b = va_arg(args, jint); break;
    case WINJ_TYPE_CHAR:
      argument->value.c = va_arg(args, jint); break;
    case WINJ_TYPE_SHORT:
      argument->value.s = va_arg(args, jint); break;
    case WINJ_TYPE_INT:
      argument->value.i = va_arg(args, jint); break;
    case WINJ_TYPE_LONG:
      argument->value.j = va_arg(args, jlong); break;
    case WINJ_TYPE_FLOAT:
      argument->value.f = va_arg(args, jdouble); break;
    case WINJ_TYPE_DOUBLE:
      argument->value.d = va_arg(args, jdouble); break;
    case WINJ_TYPE_OBJECT:
      argument->value.l = va_arg(args, jobject); break;
    default:
      result = winj_error
        (params, "unknown type: %u", argument->argtype);
    }
  }
  return result;
}


/* === Java Native Interface (JNI) */

static jint JNICALL
JNI__GetVersion(JNIEnv *env)
{ return JNI_VERSION_24; }

static jint
JNI__GetJavaVM(JNIEnv *env, JavaVM **jvm)
{
  jint rc = JNI_OK;
  struct winj_thread *thread = (struct winj_thread *)env;
  if (!jvm) {
    rc = JNI_EINVAL;
  } else *jvm = (JavaVM*)thread->vm;
  return rc;
}

static jclass
JNI__DefineClass
(JNIEnv *env, const char *name, jobject loader,
 const jbyte *buf, jsize len)
{
  struct winj_class *result = NULL;
  struct winj_class *defined = NULL;
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_bytes bytes = { len, 0, (unsigned char *)buf };
  struct winj_bytes copy  = { 0, 0, NULL };

  if (EXIT_SUCCESS != winj_bytes_copy(params, &bytes, &copy)) {
    winj_thread_throw(thread, 0, "java/lang/OutOfMemoryError",
                      "failed to allocate %u bytes", bytes.count);
  } else if (EXIT_SUCCESS != winj_thread_class_define
             (thread, &copy, loader, &defined)) {
  } else {
    result = defined;
    defined = NULL;
  }
  winj_free(params, copy.value);
  winj_class_cleanup(params, defined);
  return result ? &result->self : NULL;
}

static jclass
JNI__FindClass(JNIEnv *env, const char *name)
{
  struct winj_class *result = NULL;
  winj_thread_class_find((struct winj_thread *)env, 0, name, &result);
  return result ? &result->self : NULL;
}

static jclass
JNI__GetSuperclass(JNIEnv *env, jclass clazz)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_class *result = NULL;

  if (!clazz) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing class");
  } else if (EXIT_SUCCESS != winj_class_instance
             (thread->vm->class_class, clazz)) {
    winj_thread_throw(thread, 0, "java/lang/IllegalArgumentException",
                      "class argument required");
  } else result = ((struct winj_class *)clazz)->super;
  return result ? &result->self : NULL;
}

jboolean JNI__IsAssignableFrom(JNIEnv *env, jclass clazz1, jclass clazz2) {
    return JNI_FALSE;
}

jobject JNI__AllocObject(JNIEnv *env, jclass clazz) {
    return NULL;
}

jobject JNI__NewObject(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return NULL;
}

jobject JNI__NewObjectA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return NULL;
}

jobject JNI__NewObjectV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return NULL;
}

jclass JNI__GetObjectClass(JNIEnv *env, jobject obj) {
    return NULL;
}

jboolean JNI__IsInstanceOf(JNIEnv *env, jobject obj, jclass clazz) {
    return JNI_FALSE;
}

static jmethodID
JNI__GetMethodID
(JNIEnv *env, jclass clazz, const char *name, const char *sig)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = (thread && thread->vm) ?
    &thread->vm->params : NULL;
  struct winj_method *method = NULL;
  char *combined = NULL;

  if (clazz->cls != thread->vm->class_class) {
    winj_error(params, "invalid class object provided");
  } else if (EXIT_SUCCESS != winj_string_concat
             (params, 0, name, 0, sig, NULL, &combined)) {
    winj_error(params, "string concatenation failed");
  } else winj_class_method_search
           ((struct winj_class *)clazz, 0, combined, &method);
  winj_free(params, combined);
  return method;
}

jfieldID JNI__GetFieldID(JNIEnv *env, jclass clazz, const char *name, const char *sig) {
    return NULL;
}

jfieldID JNI__GetStaticFieldID(JNIEnv *env, jclass clazz, const char *name, const char *sig) {
    return NULL;
}

jobject JNI__GetStaticObjectField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return NULL;
}

void JNI__SetStaticObjectField(JNIEnv *env, jclass clazz, jfieldID fieldID, jobject value) {}

jboolean JNI__GetStaticBooleanField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return JNI_FALSE;
}

void JNI__SetStaticBooleanField(JNIEnv *env, jclass clazz, jfieldID fieldID, jboolean value) {}

jbyte JNI__GetStaticByteField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0;
}

void JNI__SetStaticByteField(JNIEnv *env, jclass clazz, jfieldID fieldID, jbyte value) {}

jchar JNI__GetStaticCharField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0;
}

void JNI__SetStaticCharField(JNIEnv *env, jclass clazz, jfieldID fieldID, jchar value) {}

jshort JNI__GetStaticShortField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0;
}

void JNI__SetStaticShortField(JNIEnv *env, jclass clazz, jfieldID fieldID, jshort value) {}

jint JNI__GetStaticIntField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0;
}

void JNI__SetStaticIntField(JNIEnv *env, jclass clazz, jfieldID fieldID, jint value) {}

jlong JNI__GetStaticLongField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0;
}

void JNI__SetStaticLongField(JNIEnv *env, jclass clazz, jfieldID fieldID, jlong value) {}

jfloat JNI__GetStaticFloatField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0.0f;
}

void JNI__SetStaticFloatField(JNIEnv *env, jclass clazz, jfieldID fieldID, jfloat value) {}

jdouble JNI__GetStaticDoubleField(JNIEnv *env, jclass clazz, jfieldID fieldID) {
    return 0.0;
}

void JNI__SetStaticDoubleField(JNIEnv *env, jclass clazz, jfieldID fieldID, jdouble value) {}

jobject JNI__GetObjectField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return NULL;
}

void JNI__SetObjectField(JNIEnv *env, jobject obj, jfieldID fieldID, jobject value) {}

jboolean JNI__GetBooleanField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return JNI_FALSE;
}

void JNI__SetBooleanField(JNIEnv *env, jobject obj, jfieldID fieldID, jboolean value) {}

jbyte JNI__GetByteField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0;
}

void JNI__SetByteField(JNIEnv *env, jobject obj, jfieldID fieldID, jbyte value) {}

jchar JNI__GetCharField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0;
}

void JNI__SetCharField(JNIEnv *env, jobject obj, jfieldID fieldID, jchar value) {}

jshort JNI__GetShortField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0;
}

void JNI__SetShortField(JNIEnv *env, jobject obj, jfieldID fieldID, jshort value) {}

jint JNI__GetIntField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0;
}

void JNI__SetIntField(JNIEnv *env, jobject obj, jfieldID fieldID, jint value) {}

jlong JNI__GetLongField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0;
}

void JNI__SetLongField(JNIEnv *env, jobject obj, jfieldID fieldID, jlong value) {}

jfloat JNI__GetFloatField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0.0f;
}

void JNI__SetFloatField(JNIEnv *env, jobject obj, jfieldID fieldID, jfloat value) {}

jdouble JNI__GetDoubleField(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return 0.0;
}

void JNI__SetDoubleField(JNIEnv *env, jobject obj, jfieldID fieldID, jdouble value) {}

static jmethodID
JNI__GetStaticMethodID
(JNIEnv *env, jclass clazz, const char *name, const char *sig)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = (thread && thread->vm) ?
    &thread->vm->params : NULL;
  struct winj_method *method = NULL;
  char *combined = NULL;

  if (!clazz || (clazz->cls != thread->vm->class_class)) {
    winj_error(params, "invalid class object provided %p", clazz->cls);
  } else if (EXIT_SUCCESS != winj_string_concat
             (params, 0, name, 0, sig, NULL, &combined)) {
    winj_error(params, "string concatenation failed");
  } else winj_class_static_method_search
           ((struct winj_class *)clazz, 0, combined, &method);
  winj_free(params, combined);
  return method;
}

jobject JNI__CallStaticObjectMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return NULL;
}

jobject JNI__CallStaticObjectMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return NULL;
}

jobject JNI__CallStaticObjectMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return NULL;
}

jboolean JNI__CallStaticBooleanMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return JNI_FALSE;
}

jboolean JNI__CallStaticBooleanMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return JNI_FALSE;
}

jboolean JNI__CallStaticBooleanMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return JNI_FALSE;
}

jbyte JNI__CallStaticByteMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jbyte JNI__CallStaticByteMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jbyte JNI__CallStaticByteMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jchar JNI__CallStaticCharMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jchar JNI__CallStaticCharMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jchar JNI__CallStaticCharMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jshort JNI__CallStaticShortMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jshort JNI__CallStaticShortMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jshort JNI__CallStaticShortMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jint JNI__CallStaticIntMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jint JNI__CallStaticIntMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jint JNI__CallStaticIntMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jlong JNI__CallStaticLongMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jlong JNI__CallStaticLongMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jlong JNI__CallStaticLongMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jfloat JNI__CallStaticFloatMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0.0f;
}

jfloat JNI__CallStaticFloatMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0.0f;
}

jfloat JNI__CallStaticFloatMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0.0f;
}

jdouble JNI__CallStaticDoubleMethod(JNIEnv *env, jclass clazz, jmethodID methodID, ...) {
    return 0.0;
}

jdouble JNI__CallStaticDoubleMethodA(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0.0;
}

jdouble JNI__CallStaticDoubleMethodV(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args) {
    return 0.0;
}

static void
JNI__CallStaticVoidMethodA
(JNIEnv *env, jclass clazz, jmethodID methodID, const jvalue *args)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  winj_thread_throw(thread, 0, "java/lang/InternalError",
                    "not yet implemented");
  /* TODO */
}

static void
JNI__CallStaticVoidMethodV
(JNIEnv *env, jclass clazz, jmethodID methodID, va_list args)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_argument *argarray = NULL;
  unsigned argarray_count = 0;
  enum winj_type return_type = WINJ_TYPE_VOID;

  if (!methodID) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing methodID");
  } else if (!clazz) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing class");
  } else if (EXIT_SUCCESS != winj_class_instance
             (thread->vm->class_class, clazz)) {
    winj_thread_throw(thread, 0, "java/lang/IllegalArgumentException",
                      "static method requires class");
  } else if (EXIT_SUCCESS != winj_arguments_parse
             (params, methodID->name_len, methodID->name,
              &return_type, &argarray_count, &argarray)) {
    winj_thread_throw(thread, 0, "java/lang/InternalError",
                      "method parse failure: \".*s\"",
                      methodID->name_len, methodID->name);
  } else if (return_type != WINJ_TYPE_VOID) {
    winj_thread_throw(thread, 0, "java/lang/IllegalArgumentException",
                      "attempt to call non-void method");
  } else if (EXIT_SUCCESS != winj_arguments_varargs
             (params, args, argarray_count, argarray)) {
    winj_thread_throw(thread, 0, "java/lang/InternalError",
                      "failed to convert varargs: \".*s\"",
                      methodID->name_len, methodID->name);
  } else if (methodID->call) {
    winj_info(params, "calling internal method %.*s.%.*s",
              ((struct winj_class *)clazz)->name_len,
              ((struct winj_class *)clazz)->name,
              methodID->name_len, methodID->name);
    methodID->call(thread, methodID, NULL, clazz,
                   argarray_count, argarray);
  } else if (methodID->method_file) {
    winj_info(params, "interpreting method %.*s.%.*s",
              ((struct winj_class *)clazz)->name_len,
              ((struct winj_class *)clazz)->name,
              methodID->name_len, methodID->name);
    /* TODO */
  } else winj_thread_throw(thread, 0, "java/lang/InternalError",
                           "invalid method %.*s on class %.*s",
                           methodID->name_len, methodID->name,
                           ((struct winj_class *)clazz)->name_len,
                           ((struct winj_class *)clazz)->name);
  winj_free(params, argarray);
}

static void
JNI__CallStaticVoidMethod
(JNIEnv *env, jclass clazz, jmethodID methodID, ...)
{
  va_list args;
  va_start(args, methodID);
  JNI__CallStaticVoidMethodV(env, clazz, methodID, args);
  va_end(args);
}

static jobject
JNI__CallObjectMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  winj_thread_throw(thread, 0, "java/lang/InternalError",
                    "not yet implemented");
  /* TODO */
  return NULL;
}

static jobject
JNI__CallObjectMethodA
(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  winj_thread_throw(thread, 0, "java/lang/InternalError",
                    "not yet implemented");
  /* TODO */
  return NULL;
}

static jobject
JNI__CallObjectMethodV
(JNIEnv *env, jobject obj, jmethodID methodID, va_list args)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  winj_thread_throw(thread, 0, "java/lang/InternalError",
                    "not yet implemented");
  /* TODO */
  return NULL;
}

jboolean JNI__CallBooleanMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return JNI_FALSE;
}

jboolean JNI__CallBooleanMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return JNI_FALSE;
}

jboolean JNI__CallBooleanMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return JNI_FALSE;
}

jbyte JNI__CallByteMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0;
}

jbyte JNI__CallByteMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0;
}

jbyte JNI__CallByteMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0;
}

jchar JNI__CallCharMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0;
}

jchar JNI__CallCharMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0;
}

jchar JNI__CallCharMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0;
}

jshort JNI__CallShortMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0;
}

jshort JNI__CallShortMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0;
}

jshort JNI__CallShortMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0;
}

jint JNI__CallIntMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0;
}

jint JNI__CallIntMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0;
}

jint JNI__CallIntMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0;
}

jlong JNI__CallLongMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0;
}

jlong JNI__CallLongMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0;
}

jlong JNI__CallLongMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0;
}

jfloat JNI__CallFloatMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0.0f;
}

jfloat JNI__CallFloatMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0.0f;
}

jfloat JNI__CallFloatMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0.0f;
}

jdouble JNI__CallDoubleMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {
    return 0.0;
}

jdouble JNI__CallDoubleMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {
    return 0.0;
}

jdouble JNI__CallDoubleMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {
    return 0.0;
}

void JNI__CallVoidMethod(JNIEnv *env, jobject obj, jmethodID methodID, ...) {}

void JNI__CallVoidMethodA(JNIEnv *env, jobject obj, jmethodID methodID, const jvalue *args) {}

void JNI__CallVoidMethodV(JNIEnv *env, jobject obj, jmethodID methodID, va_list args) {}

/* Call Nonvirtual Methods */
jobject JNI__CallNonvirtualObjectMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return NULL;
}

jobject JNI__CallNonvirtualObjectMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return NULL;
}

jobject JNI__CallNonvirtualObjectMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return NULL;
}

jboolean JNI__CallNonvirtualBooleanMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return JNI_FALSE;
}

jboolean JNI__CallNonvirtualBooleanMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return JNI_FALSE;
}

jboolean JNI__CallNonvirtualBooleanMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return JNI_FALSE;
}

jbyte JNI__CallNonvirtualByteMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jbyte JNI__CallNonvirtualByteMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jbyte JNI__CallNonvirtualByteMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jchar JNI__CallNonvirtualCharMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jchar JNI__CallNonvirtualCharMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jchar JNI__CallNonvirtualCharMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jshort JNI__CallNonvirtualShortMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jshort JNI__CallNonvirtualShortMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jshort JNI__CallNonvirtualShortMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jint JNI__CallNonvirtualIntMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jint JNI__CallNonvirtualIntMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jint JNI__CallNonvirtualIntMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jlong JNI__CallNonvirtualLongMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0;
}

jlong JNI__CallNonvirtualLongMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0;
}

jlong JNI__CallNonvirtualLongMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0;
}

jfloat JNI__CallNonvirtualFloatMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0.0f;
}

jfloat JNI__CallNonvirtualFloatMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0.0f;
}

jfloat JNI__CallNonvirtualFloatMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0.0f;
}

jdouble JNI__CallNonvirtualDoubleMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {
    return 0.0;
}

jdouble JNI__CallNonvirtualDoubleMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {
    return 0.0;
}

jdouble JNI__CallNonvirtualDoubleMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {
    return 0.0;
}

void JNI__CallNonvirtualVoidMethod(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, ...) {}

void JNI__CallNonvirtualVoidMethodA(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, const jvalue *args) {}

void JNI__CallNonvirtualVoidMethodV(JNIEnv *env, jobject obj, jclass clazz, jmethodID methodID, va_list args) {}

/* String Operations */
jstring JNI__NewString(JNIEnv *env, const jchar *unicode, jsize len) {
    return NULL;
}

jsize JNI__GetStringLength(JNIEnv *env, jstring str) {
    return 0;
}

const jchar* JNI__GetStringChars(JNIEnv *env, jstring str, jboolean *isCopy) {
    return NULL;
}

void JNI__ReleaseStringChars(JNIEnv *env, jstring str, const jchar *chars) {}

static jstring
JNI__NewStringUTF(JNIEnv *env, const char *utf)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_object *string = NULL;
  struct winj_object *result = NULL;

  if (!utf) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing utf");
  } else if (!(string = winj_calloc(params, 1, sizeof(*string)))) {
    winj_thread_throw(thread, 0, "java/lang/OutOfMemoryError",
                      "failed to allocate %u bytes for string class",
                      sizeof(*string));
  } else if (EXIT_SUCCESS != winj_vm_class_lookup
             (thread->vm, 0, "java/lang/String", &string->cls)) {
    winj_thread_throw(thread, 0, "java/lang/InternalError",
                      "failed to find string class");
  } else {
    /* TODO: copy characters somewhere */
    result = winj_objlist_append(&thread->vm->objects, string);
    string = NULL;
  }
  winj_vm_object_cleanup(thread->vm, string);
  return result;
}

jsize JNI__GetStringUTFLength(JNIEnv *env, jstring str) {
    return 0;
}

const char* JNI__GetStringUTFChars(JNIEnv *env, jstring str, jboolean *isCopy) {
    return NULL;
}

void JNI__ReleaseStringUTFChars(JNIEnv *env, jstring str, const char *chars) {}

/* Array Operations */
jsize JNI__GetArrayLength(JNIEnv *env, jarray array) {
    return 0;
}

static jobjectArray
JNI__NewObjectArray
(JNIEnv *env, jsize len, jclass clazz, jobject init)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_vm_params *params = thread ? &thread->vm->params : NULL;
  struct winj_object *result = NULL;
  struct winj_array *array = NULL;
  union winj_elements *elements = NULL;

  if (len < 0) {
    winj_thread_throw(thread, 0, "java/lang/IllegalArgumentException",
                      "invalid array size: %d", len);
  } else if (!clazz) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing class argument");
  } else if (EXIT_SUCCESS != winj_class_instance
             (thread->vm->class_class, clazz)) {
    winj_thread_throw
      (thread, 0, "java/lang/IllegalArgumentException",
       "class argument is not actually a class: %.*s",
       clazz->cls->name_len, clazz->cls->name);
  } else if (!(array = winj_calloc(params, 1, sizeof(*array)))) {
    winj_thread_throw(thread, 0, "java/lang/OutOfMemoryError",
                      "failed to allocate %u bytes for array",
                      sizeof(*array));
  } else if (!(elements = winj_calloc
               (params, len, sizeof(*elements)))) {
  } else {
    unsigned ii;

    array->self.cls = thread->vm->class_array;
    array->count = len;
    array->type = WINJ_TYPE_OBJECT;
    array->element_class = (struct winj_class *)clazz;
    array->elements = elements;
    for (ii = 0; ii < len; ++ii)
      elements[ii].jobject = init;
    elements = NULL;

    result = winj_objlist_append(&thread->vm->objects, &array->self);
    array = NULL;
  }
  winj_free(params, elements);
  winj_free(params, array);
  return result;
}

jobject JNI__GetObjectArrayElement(JNIEnv *env, jobjectArray array, jsize index) {
    return NULL;
}

static void
JNI__SetObjectArrayElement
(JNIEnv *env, jobjectArray array, jsize index, jobject value)
{
  struct winj_thread *thread = (struct winj_thread *)env;
  struct winj_array *actual = (struct winj_array *)array;

  if (!array) {
    winj_thread_throw(thread, 0, "java/lang/NullPointerException",
                      "missing array for SetObjectArrayElement");
  } else if (array->cls != thread->vm->class_array) {
    winj_thread_throw
      (thread, 0, "java/lang/IllegalArgumentException",
       "array argument has type %.*s but must be an array",
       array->cls->name_len, array->cls->name);
  } else if ((index < 0) || (index > actual->count)) {
    winj_thread_throw
      (thread, 0, "java/lang/ArrayIndexOutOfBoundsException",
       "index is %d count is %u", index, actual->count);
  } else if (actual->type != WINJ_TYPE_OBJECT) {
    winj_thread_throw(thread, 0, "java/lang/ArrayStoreException",
                      "primitive array asked to store object");
  } else if (!value) {
    actual->elements[index].jobject = NULL;
  } else if (EXIT_SUCCESS != winj_class_instance
             (actual->element_class, value)) {
    winj_thread_throw(thread, 0, "java/lang/ArrayStoreException",
                      "attempt to store wrong class: %.*s "
                      "(should be %.*s)",
                      value->cls->name_len, value->cls->name,
                      actual->element_class->name_len,
                      actual->element_class->name);
  } else actual->elements[index].jobject = value;
}

jbooleanArray JNI__NewBooleanArray(JNIEnv *env, jsize len) {
    return NULL;
}

jbyteArray JNI__NewByteArray(JNIEnv *env, jsize len) {
    return NULL;
}

jcharArray JNI__NewCharArray(JNIEnv *env, jsize len) {
    return NULL;
}

jshortArray JNI__NewShortArray(JNIEnv *env, jsize len) {
    return NULL;
}

jintArray JNI__NewIntArray(JNIEnv *env, jsize len) {
    return NULL;
}

jlongArray JNI__NewLongArray(JNIEnv *env, jsize len) {
    return NULL;
}

jfloatArray JNI__NewFloatArray(JNIEnv *env, jsize len) {
    return NULL;
}

jdoubleArray JNI__NewDoubleArray(JNIEnv *env, jsize len) {
    return NULL;
}

jboolean* JNI__GetBooleanArrayElements(JNIEnv *env, jbooleanArray array, jboolean *isCopy) {
    return NULL;
}

jbyte* JNI__GetByteArrayElements(JNIEnv *env, jbyteArray array, jboolean *isCopy) {
    return NULL;
}

jchar* JNI__GetCharArrayElements(JNIEnv *env, jcharArray array, jboolean *isCopy) {
    return NULL;
}

jshort* JNI__GetShortArrayElements(JNIEnv *env, jshortArray array, jboolean *isCopy) {
    return NULL;
}

jint* JNI__GetIntArrayElements(JNIEnv *env, jintArray array, jboolean *isCopy) {
    return NULL;
}

jlong* JNI__GetLongArrayElements(JNIEnv *env, jlongArray array, jboolean *isCopy) {
    return NULL;
}

jfloat* JNI__GetFloatArrayElements(JNIEnv *env, jfloatArray array, jboolean *isCopy) {
    return NULL;
}

jdouble* JNI__GetDoubleArrayElements(JNIEnv *env, jdoubleArray array, jboolean *isCopy) {
    return NULL;
}

void JNI__ReleaseBooleanArrayElements(JNIEnv *env, jbooleanArray array, jboolean *elems, jint mode) {}
void JNI__ReleaseByteArrayElements(JNIEnv *env, jbyteArray array, jbyte *elems, jint mode) {}
void JNI__ReleaseCharArrayElements(JNIEnv *env, jcharArray array, jchar *elems, jint mode) {}
void JNI__ReleaseShortArrayElements(JNIEnv *env, jshortArray array, jshort *elems, jint mode) {}
void JNI__ReleaseIntArrayElements(JNIEnv *env, jintArray array, jint *elems, jint mode) {}
void JNI__ReleaseLongArrayElements(JNIEnv *env, jlongArray array, jlong *elems, jint mode) {}
void JNI__ReleaseFloatArrayElements(JNIEnv *env, jfloatArray array, jfloat *elems, jint mode) {}
void JNI__ReleaseDoubleArrayElements(JNIEnv *env, jdoubleArray array, jdouble *elems, jint mode) {}

void JNI__GetBooleanArrayRegion(JNIEnv *env, jbooleanArray array, jsize start, jsize len, jboolean *buf) {}
void JNI__GetByteArrayRegion(JNIEnv *env, jbyteArray array, jsize start, jsize len, jbyte *buf) {}
void JNI__GetCharArrayRegion(JNIEnv *env, jcharArray array, jsize start, jsize len, jchar *buf) {}
void JNI__GetShortArrayRegion(JNIEnv *env, jshortArray array, jsize start, jsize len, jshort *buf) {}
void JNI__GetIntArrayRegion(JNIEnv *env, jintArray array, jsize start, jsize len, jint *buf) {}
void JNI__GetLongArrayRegion(JNIEnv *env, jlongArray array, jsize start, jsize len, jlong *buf) {}
void JNI__GetFloatArrayRegion(JNIEnv *env, jfloatArray array, jsize start, jsize len, jfloat *buf) {}
void JNI__GetDoubleArrayRegion(JNIEnv *env, jdoubleArray array, jsize start, jsize len, jdouble *buf) {}

void JNI__SetBooleanArrayRegion(JNIEnv *env, jbooleanArray array, jsize start, jsize len, const jboolean *buf) {}
void JNI__SetByteArrayRegion(JNIEnv *env, jbyteArray array, jsize start, jsize len, const jbyte *buf) {}
void JNI__SetCharArrayRegion(JNIEnv *env, jcharArray array, jsize start, jsize len, const jchar *buf) {}
void JNI__SetShortArrayRegion(JNIEnv *env, jshortArray array, jsize start, jsize len, const jshort *buf) {}
void JNI__SetIntArrayRegion(JNIEnv *env, jintArray array, jsize start, jsize len, const jint *buf) {}
void JNI__SetLongArrayRegion(JNIEnv *env, jlongArray array, jsize start, jsize len, const jlong *buf) {}
void JNI__SetFloatArrayRegion(JNIEnv *env, jfloatArray array, jsize start, jsize len, const jfloat *buf) {}
void JNI__SetDoubleArrayRegion(JNIEnv *env, jdoubleArray array, jsize start, jsize len, const jdouble *buf) {}

jint JNI__RegisterNatives(JNIEnv *env, jclass clazz, const JNINativeMethod *methods, jint nMethods) {
    return JNI_ERR;
}

jint JNI__UnregisterNatives(JNIEnv *env, jclass clazz) {
    return JNI_ERR;
}

jint JNI__MonitorEnter(JNIEnv *env, jobject obj) {
    return JNI_ERR;
}

jint JNI__MonitorExit(JNIEnv *env, jobject obj) {
    return JNI_ERR;
}

jthrowable JNI__ExceptionOccurred(JNIEnv *env) {
    return NULL;
}

void JNI__ExceptionDescribe(JNIEnv *env) {}

void JNI__ExceptionClear(JNIEnv *env) {}

jboolean JNI__ExceptionCheck(JNIEnv *env) { return JNI_FALSE; }

void JNI__FatalError(JNIEnv *env, const char *msg) {
  exit(EXIT_FAILURE);
}

jobject JNI__NewLocalRef(JNIEnv *env, jobject ref) {
  return NULL;
}

void JNI__DeleteLocalRef(JNIEnv *env, jobject ref) {}

jint JNI__EnsureLocalCapacity(JNIEnv *env, jint capacity) {
  return JNI_ERR;
}

jobject JNI__NewGlobalRef(JNIEnv *env, jobject obj) {
    return NULL;
}

void JNI__DeleteGlobalRef(JNIEnv *env, jobject ref) {}

jobject JNI__NewWeakGlobalRef(JNIEnv *env, jobject obj) {
    return NULL;
}

void JNI__DeleteWeakGlobalRef(JNIEnv *env, jobject ref) {}

jint JNI__PushLocalFrame(JNIEnv *env, jint capacity) {
    return JNI_ERR;
}

jobject JNI__PopLocalFrame(JNIEnv *env, jobject result) {
    return NULL;
}

jobjectRefType JNI__GetObjectRefType(JNIEnv *env, jobject obj) {
    return JNIInvalidRefType;
}

void* JNI__GetPrimitiveArrayCritical(JNIEnv *env, jarray array, jboolean *isCopy) {
    return NULL;
}

void JNI__ReleasePrimitiveArrayCritical(JNIEnv *env, jarray array, void *carray, jint mode) {}

const jchar* JNI__GetStringCritical(JNIEnv *env, jstring str, jboolean *isCopy) {
    return NULL;
}

void JNI__ReleaseStringCritical(JNIEnv *env, jstring str, const jchar *carray) {}

jobject JNI__NewDirectByteBuffer(JNIEnv *env, void *address, jlong capacity) {
    return NULL;
}

void* JNI__GetDirectBufferAddress(JNIEnv *env, jobject buf) {
    return NULL;
}

jlong JNI__GetDirectBufferCapacity(JNIEnv *env, jobject buf) {
    return -1;
}

jobject JNI__GetObjectRef(JNIEnv *env, jobject obj, jfieldID fieldID) {
    return NULL;
}

jobject JNI__GetModule(JNIEnv *env, jclass clazz) {
    return NULL;
}

static struct winj_thread *
winj_vm_thread_create(struct winj_vm *vm, void *thread_group)
{
  struct winj_thread *result = NULL;
  struct winj_thread *created = NULL;
  struct winj_thread **next = NULL;

  if (!vm) {
    winj_error(NULL, "missing vm");
  } else if (!(created = winj_calloc
               (&vm->params, 1, sizeof(*created)))) {
    winj_error(&vm->params, "failed to allocate %u bytes for thread",
                sizeof(*created));
  } else if (!(next = winj_realloc
               (&vm->params, vm->threads, (vm->thread_count + 1) *
                sizeof(*vm->threads)))) {
    winj_error(&vm->params, "failed to allocate %u bytes for thread "
                "pointer array", (vm->thread_count + 1) *
                sizeof(*vm->threads));
  } else {
    vm->threads = next;

    created->vm = vm;
    created->jni_env = &vm->table_env;

    result = vm->threads[vm->thread_count++] = created;
    created = NULL; /* stolen */
  }
  winj_free(vm ? &vm->params : NULL, created);
  return result;
}

static void
winj_thread_cleanup
(struct winj_vm_params *params, struct winj_thread *thread)
{
  if (thread) {
    winj_free(params, thread->frames);
    winj_free(params, thread->operands);
    winj_free(params, thread->locals);
  }
  winj_free(params, thread);
}

/**
 * Reclaim all memory allocated by a virtual machine instance.
 *
 * @param vm virtual machine to clean up */
void
winj_vm_cleanup(struct winj_vm *vm)
{
  struct winj_vm_params *params = vm ? &vm->params : NULL;

  if (vm) {
    unsigned ii;

    while (vm->objects.head) {
      struct winj_object *obj = winj_objlist_remove
        (&vm->objects, vm->objects.head);
      winj_vm_object_cleanup(vm, obj);
    }

    for (ii = 0; ii < vm->thread_count; ++ii)
      winj_thread_cleanup(params, vm->threads[ii]);
    winj_free(params, vm->threads);

    for (ii = 0; ii < vm->class_count; ++ii)
      winj_class_cleanup(params, vm->classes[ii]);
    winj_free(params, vm->classes);

    winj_free(params, vm);
  }
}

jint JNICALL
JNI_GetDefaultJavaVMInitArgs(void *vm_args)
{
  int result = JNI_OK;
  JavaVMInitArgs *args = (JavaVMInitArgs *)vm_args;

  if (args->version > JNI_VERSION_24) {
    result = JNI_EVERSION;
  } else {
    memset(args, 0, sizeof(*args));
    args->version  = JNI_VERSION_24;
    args->nOptions = 0;
    args->options  = NULL;
    args->ignoreUnrecognized = JNI_TRUE;
  }
  return result;
}

static jint JNICALL
JNI__DestroyJavaVM(JavaVM *jvm)
{
  struct winj_vm *vm = (struct winj_vm *)jvm;
  winj_vm_cleanup(vm);
  return JNI_OK;
}

static jint JNICALL
JNI__AttachCurrentThread(JavaVM *jvm, void **p_jnienv, void *thr_args)
{
  struct winj_vm *vm = (struct winj_vm *)jvm;
  (void)vm;
  return JNI_ERR; /* not yet implemented */
}

static jint JNICALL
JNI__DetachCurrentThread(JavaVM *jvm)
{
  struct winj_vm *vm = (struct winj_vm *)jvm;
  (void)vm;
  return JNI_ERR; /* not yet implemented */
}

static jint JNICALL
JNI__GetEnv(JavaVM *jvm, void **p_jnienv, jint version)
{
  struct winj_vm *vm = (struct winj_vm *)jvm;
  (void)vm;
  return JNI_ERR; /* not yet implemented */
}

static jint JNICALL
JNI__AttachCurrentThreadAsDaemon
(JavaVM *jvm, void **p_jnienv, void *thr_args)
{
  struct winj_vm *vm = (struct winj_vm *)jvm;
  (void)vm;
  return JNI_ERR; /* not yet implemented */
}

static void
winj_vm_params_init(struct winj_vm_params *params, void *vm_args)
{
  /* TODO: support required parameters from JNI specification */
  /* TODO: realloc */
  /* TODO: logv */
  /* TODO: getenv */
  /* TODO: find_class */
}

struct winj_class_spec {
  const char *name;
  const char *parent;
  u2 access_flags;

  unsigned field_count;
  struct winj_field *fields;
  unsigned method_count;
  struct winj_method *methods;
} builtin_classes[] = {
  { "java/lang/Object", NULL },
  { "java/lang/Class", "java/lang/Object" },
  { "java/lang/Array", "java/lang/Object" },
  { "java/lang/String", "java/lang/Object" },  
};

/**
 * Create a Java Virtual Machine instance.
 *
 * @param vm destination for pointer to JVM
 * @param params parameter stucture for configuring JVM
 * @return EXIT_SUCCESS unless something goes wrong */
int
winj_vm_create(struct winj_vm_params *params, struct winj_vm **vm)
{
  int result = EXIT_SUCCESS;
  struct winj_vm *out = NULL;
  unsigned ii;

  if (!(out = winj_calloc(params, 1, sizeof(*out)))) {
    result = winj_error(params, "failed to allocate %u bytes "
                         "for vm", sizeof(*out));
  } else {
    unsigned count = sizeof(builtin_classes)/sizeof(*builtin_classes);

    out->params = *params;

    for (ii = 0; (result == EXIT_SUCCESS) && (ii < count); ++ii)
      result = winj_vm_class_synthetic
        (out, 0, builtin_classes[ii].name,
         builtin_classes[ii].field_count,
         builtin_classes[ii].fields,
         builtin_classes[ii].method_count,
         builtin_classes[ii].methods, NULL);
  }

  if (EXIT_SUCCESS != result) {
  } else if (EXIT_SUCCESS !=
             (result = winj_vm_class_lookup
              (out, 0, "java/lang/Class", &out->class_class))) {
  } else if (EXIT_SUCCESS !=
             (result = winj_vm_class_lookup
              (out, 0, "java/lang/Array", &out->class_array))) {
  } else if (vm) {
    out->table_invoke.DestroyJavaVM = JNI__DestroyJavaVM;
    out->table_invoke.GetEnv = JNI__GetEnv;
    out->table_invoke.DetachCurrentThread = JNI__DetachCurrentThread;
    out->table_invoke.AttachCurrentThread = JNI__AttachCurrentThread;
    out->table_invoke.AttachCurrentThreadAsDaemon =
      JNI__AttachCurrentThreadAsDaemon;
    out->jni_invoke = &out->table_invoke;

    out->table_env.GetVersion       = JNI__GetVersion;
    out->table_env.DefineClass      = JNI__DefineClass;
    out->table_env.FindClass        = JNI__FindClass;
    out->table_env.GetSuperclass    = JNI__GetSuperclass;
    out->table_env.IsAssignableFrom = JNI__IsAssignableFrom;
    out->table_env.AllocObject    = JNI__AllocObject;
    out->table_env.NewObject      = JNI__NewObject;
    out->table_env.NewObjectA     = JNI__NewObjectA;
    out->table_env.NewObjectV     = JNI__NewObjectV;
    out->table_env.GetObjectClass = JNI__GetObjectClass;
    out->table_env.IsInstanceOf   = JNI__IsInstanceOf;
    out->table_env.GetMethodID    = JNI__GetMethodID;

    out->table_env.GetFieldID = JNI__GetFieldID;
    out->table_env.GetObjectField = JNI__GetObjectField;
    out->table_env.SetObjectField = JNI__SetObjectField;
    out->table_env.GetBooleanField = JNI__GetBooleanField;
    out->table_env.SetBooleanField = JNI__SetBooleanField;
    out->table_env.GetByteField    = JNI__GetByteField;
    out->table_env.SetByteField    = JNI__SetByteField;
    out->table_env.GetCharField    = JNI__GetCharField;
    out->table_env.SetCharField    = JNI__SetCharField;
    out->table_env.GetShortField   = JNI__GetShortField;
    out->table_env.SetShortField   = JNI__SetShortField;
    out->table_env.GetIntField     = JNI__GetIntField;
    out->table_env.SetIntField     = JNI__SetIntField;
    out->table_env.GetLongField    = JNI__GetLongField;
    out->table_env.SetLongField    = JNI__SetLongField;
    out->table_env.GetFloatField   = JNI__GetFloatField;
    out->table_env.SetFloatField   = JNI__SetFloatField;
    out->table_env.GetDoubleField  = JNI__GetDoubleField;
    out->table_env.SetDoubleField  = JNI__SetDoubleField;

    out->table_env.GetStaticFieldID      = JNI__GetStaticFieldID;
    out->table_env.GetStaticObjectField  = JNI__GetStaticObjectField;
    out->table_env.SetStaticObjectField  = JNI__SetStaticObjectField;
    out->table_env.GetStaticBooleanField = JNI__GetStaticBooleanField;
    out->table_env.SetStaticBooleanField = JNI__SetStaticBooleanField;
    out->table_env.GetStaticByteField    = JNI__GetStaticByteField;
    out->table_env.SetStaticByteField    = JNI__SetStaticByteField;
    out->table_env.GetStaticCharField    = JNI__GetStaticCharField;
    out->table_env.SetStaticCharField    = JNI__SetStaticCharField;
    out->table_env.GetStaticShortField   = JNI__GetStaticShortField;
    out->table_env.SetStaticShortField   = JNI__SetStaticShortField;
    out->table_env.GetStaticIntField     = JNI__GetStaticIntField;
    out->table_env.SetStaticIntField     = JNI__SetStaticIntField;
    out->table_env.GetStaticLongField    = JNI__GetStaticLongField;
    out->table_env.SetStaticLongField    = JNI__SetStaticLongField;
    out->table_env.GetStaticFloatField   = JNI__GetStaticFloatField;
    out->table_env.SetStaticFloatField   = JNI__SetStaticFloatField;
    out->table_env.GetStaticDoubleField  = JNI__GetStaticDoubleField;
    out->table_env.SetStaticDoubleField  = JNI__SetStaticDoubleField;
    out->table_env.GetObjectField  = JNI__GetObjectField;
    out->table_env.SetObjectField  = JNI__SetObjectField;
    out->table_env.GetBooleanField = JNI__GetBooleanField;
    out->table_env.SetBooleanField = JNI__SetBooleanField;
    out->table_env.GetByteField    = JNI__GetByteField;
    out->table_env.SetByteField    = JNI__SetByteField;
    out->table_env.GetCharField    = JNI__GetCharField;
    out->table_env.SetCharField    = JNI__SetCharField;
    out->table_env.GetShortField   = JNI__GetShortField;
    out->table_env.SetShortField   = JNI__SetShortField;
    out->table_env.GetIntField     = JNI__GetIntField;
    out->table_env.SetIntField     = JNI__SetIntField;
    out->table_env.GetLongField    = JNI__GetLongField;
    out->table_env.SetLongField    = JNI__SetLongField;
    out->table_env.GetFloatField   = JNI__GetFloatField;
    out->table_env.SetFloatField   = JNI__SetFloatField;
    out->table_env.GetDoubleField  = JNI__GetDoubleField;
    out->table_env.SetDoubleField  = JNI__SetDoubleField;    
    out->table_env.GetStaticMethodID       = JNI__GetStaticMethodID;
    out->table_env.CallStaticObjectMethod  =
      JNI__CallStaticObjectMethod;
    out->table_env.CallStaticObjectMethodA =
      JNI__CallStaticObjectMethodA;
    out->table_env.CallStaticObjectMethodV =
      JNI__CallStaticObjectMethodV;
    out->table_env.CallStaticBooleanMethod =
      JNI__CallStaticBooleanMethod;
    out->table_env.CallStaticBooleanMethodA =
      JNI__CallStaticBooleanMethodA;
    out->table_env.CallStaticBooleanMethodV =
      JNI__CallStaticBooleanMethodV;
    out->table_env.CallStaticByteMethod    = JNI__CallStaticByteMethod;
    out->table_env.CallStaticByteMethodA   = JNI__CallStaticByteMethodA;
    out->table_env.CallStaticByteMethodV   = JNI__CallStaticByteMethodV;
    out->table_env.CallStaticCharMethod    = JNI__CallStaticCharMethod;
    out->table_env.CallStaticCharMethodA   = JNI__CallStaticCharMethodA;
    out->table_env.CallStaticCharMethodV   = JNI__CallStaticCharMethodV;
    out->table_env.CallStaticShortMethod   = JNI__CallStaticShortMethod;
    out->table_env.CallStaticShortMethodA  =
      JNI__CallStaticShortMethodA;
    out->table_env.CallStaticShortMethodV  =
      JNI__CallStaticShortMethodV;
    out->table_env.CallStaticIntMethod     = JNI__CallStaticIntMethod;
    out->table_env.CallStaticIntMethodA    = JNI__CallStaticIntMethodA;
    out->table_env.CallStaticIntMethodV    = JNI__CallStaticIntMethodV;
    out->table_env.CallStaticLongMethod    = JNI__CallStaticLongMethod;
    out->table_env.CallStaticLongMethodA   = JNI__CallStaticLongMethodA;
    out->table_env.CallStaticLongMethodV   = JNI__CallStaticLongMethodV;
    out->table_env.CallStaticFloatMethod   = JNI__CallStaticFloatMethod;
    out->table_env.CallStaticFloatMethodA  =
      JNI__CallStaticFloatMethodA;
    out->table_env.CallStaticFloatMethodV  =
      JNI__CallStaticFloatMethodV;
    out->table_env.CallStaticDoubleMethod  =
      JNI__CallStaticDoubleMethod;
    out->table_env.CallStaticDoubleMethodA =
      JNI__CallStaticDoubleMethodA;
    out->table_env.CallStaticDoubleMethodV =
      JNI__CallStaticDoubleMethodV;
    out->table_env.CallStaticVoidMethod    = JNI__CallStaticVoidMethod;
    out->table_env.CallStaticVoidMethodA   = JNI__CallStaticVoidMethodA;
    out->table_env.CallStaticVoidMethodV   = JNI__CallStaticVoidMethodV;
    out->table_env.CallObjectMethod   = JNI__CallObjectMethod;
    out->table_env.CallObjectMethodA  = JNI__CallObjectMethodA;
    out->table_env.CallObjectMethodV  = JNI__CallObjectMethodV;
    out->table_env.CallBooleanMethod  = JNI__CallBooleanMethod;
    out->table_env.CallBooleanMethodA = JNI__CallBooleanMethodA;
    out->table_env.CallBooleanMethodV = JNI__CallBooleanMethodV;
    out->table_env.CallByteMethod     = JNI__CallByteMethod;
    out->table_env.CallByteMethodA    = JNI__CallByteMethodA;
    out->table_env.CallByteMethodV    = JNI__CallByteMethodV;
    out->table_env.CallCharMethod     = JNI__CallCharMethod;
    out->table_env.CallCharMethodA    = JNI__CallCharMethodA;
    out->table_env.CallCharMethodV    = JNI__CallCharMethodV;
    out->table_env.CallShortMethod    = JNI__CallShortMethod;
    out->table_env.CallShortMethodA   = JNI__CallShortMethodA;
    out->table_env.CallShortMethodV   = JNI__CallShortMethodV;
    out->table_env.CallIntMethod      = JNI__CallIntMethod;
    out->table_env.CallIntMethodA     = JNI__CallIntMethodA;
    out->table_env.CallIntMethodV     = JNI__CallIntMethodV;
    out->table_env.CallLongMethod     = JNI__CallLongMethod;
    out->table_env.CallLongMethodA    = JNI__CallLongMethodA;
    out->table_env.CallLongMethodV    = JNI__CallLongMethodV;
    out->table_env.CallFloatMethod    = JNI__CallFloatMethod;
    out->table_env.CallFloatMethodA   = JNI__CallFloatMethodA;
    out->table_env.CallFloatMethodV   = JNI__CallFloatMethodV;
    out->table_env.CallDoubleMethod   = JNI__CallDoubleMethod;
    out->table_env.CallDoubleMethodA  = JNI__CallDoubleMethodA;
    out->table_env.CallDoubleMethodV  = JNI__CallDoubleMethodV;
    out->table_env.CallVoidMethod     = JNI__CallVoidMethod;
    out->table_env.CallVoidMethodA    = JNI__CallVoidMethodA;
    out->table_env.CallVoidMethodV    = JNI__CallVoidMethodV;
    out->table_env.CallNonvirtualObjectMethod =
      JNI__CallNonvirtualObjectMethod;
    out->table_env.CallNonvirtualObjectMethodA =
      JNI__CallNonvirtualObjectMethodA;
    out->table_env.CallNonvirtualObjectMethodV =
      JNI__CallNonvirtualObjectMethodV;
    out->table_env.CallNonvirtualBooleanMethod =
      JNI__CallNonvirtualBooleanMethod;
    out->table_env.CallNonvirtualBooleanMethodA =
      JNI__CallNonvirtualBooleanMethodA;
    out->table_env.CallNonvirtualBooleanMethodV =
      JNI__CallNonvirtualBooleanMethodV;
    out->table_env.CallNonvirtualByteMethod =
      JNI__CallNonvirtualByteMethod;
    out->table_env.CallNonvirtualByteMethodA =
      JNI__CallNonvirtualByteMethodA;
    out->table_env.CallNonvirtualByteMethodV =
      JNI__CallNonvirtualByteMethodV;
    out->table_env.CallNonvirtualCharMethod =
      JNI__CallNonvirtualCharMethod;
    out->table_env.CallNonvirtualCharMethodA =
      JNI__CallNonvirtualCharMethodA;
    out->table_env.CallNonvirtualCharMethodV =
      JNI__CallNonvirtualCharMethodV;
    out->table_env.CallNonvirtualShortMethod =
      JNI__CallNonvirtualShortMethod;
    out->table_env.CallNonvirtualShortMethodA =
      JNI__CallNonvirtualShortMethodA;
    out->table_env.CallNonvirtualShortMethodV =
      JNI__CallNonvirtualShortMethodV;
    out->table_env.CallNonvirtualIntMethod =
      JNI__CallNonvirtualIntMethod;
    out->table_env.CallNonvirtualIntMethodA =
      JNI__CallNonvirtualIntMethodA;
    out->table_env.CallNonvirtualIntMethodV =
      JNI__CallNonvirtualIntMethodV;
    out->table_env.CallNonvirtualLongMethod =
      JNI__CallNonvirtualLongMethod;
    out->table_env.CallNonvirtualLongMethodA =
      JNI__CallNonvirtualLongMethodA;
    out->table_env.CallNonvirtualLongMethodV =
      JNI__CallNonvirtualLongMethodV;
    out->table_env.CallNonvirtualFloatMethod =
      JNI__CallNonvirtualFloatMethod;
    out->table_env.CallNonvirtualFloatMethodA =
      JNI__CallNonvirtualFloatMethodA;
    out->table_env.CallNonvirtualFloatMethodV =
      JNI__CallNonvirtualFloatMethodV;
    out->table_env.CallNonvirtualDoubleMethod =
      JNI__CallNonvirtualDoubleMethod;
    out->table_env.CallNonvirtualDoubleMethodA =
      JNI__CallNonvirtualDoubleMethodA;
    out->table_env.CallNonvirtualDoubleMethodV =
      JNI__CallNonvirtualDoubleMethodV;
    out->table_env.CallNonvirtualVoidMethod =
      JNI__CallNonvirtualVoidMethod;
    out->table_env.CallNonvirtualVoidMethodA =
      JNI__CallNonvirtualVoidMethodA;
    out->table_env.CallNonvirtualVoidMethodV =
      JNI__CallNonvirtualVoidMethodV;
    out->table_env.NewString             = JNI__NewString;
    out->table_env.GetStringLength       = JNI__GetStringLength;
    out->table_env.GetStringChars        = JNI__GetStringChars;
    out->table_env.ReleaseStringChars    = JNI__ReleaseStringChars;
    out->table_env.NewStringUTF          = JNI__NewStringUTF;
    out->table_env.GetStringUTFLength    = JNI__GetStringUTFLength;
    out->table_env.GetStringUTFChars     = JNI__GetStringUTFChars;
    out->table_env.ReleaseStringUTFChars = JNI__ReleaseStringUTFChars;    
    out->table_env.GetArrayLength = JNI__GetArrayLength;
    out->table_env.NewObjectArray = JNI__NewObjectArray;
    out->table_env.GetObjectArrayElement = JNI__GetObjectArrayElement;
    out->table_env.SetObjectArrayElement = JNI__SetObjectArrayElement;
    out->table_env.NewBooleanArray = JNI__NewBooleanArray;
    out->table_env.NewByteArray    = JNI__NewByteArray;
    out->table_env.NewCharArray    = JNI__NewCharArray;
    out->table_env.NewShortArray   = JNI__NewShortArray;
    out->table_env.NewIntArray     = JNI__NewIntArray;
    out->table_env.NewLongArray    = JNI__NewLongArray;
    out->table_env.NewFloatArray   = JNI__NewFloatArray;
    out->table_env.NewDoubleArray  = JNI__NewDoubleArray;
    out->table_env.GetBooleanArrayElements = JNI__GetBooleanArrayElements;
    out->table_env.GetByteArrayElements    = JNI__GetByteArrayElements;
    out->table_env.GetCharArrayElements    = JNI__GetCharArrayElements;
    out->table_env.GetShortArrayElements   = JNI__GetShortArrayElements;
    out->table_env.GetIntArrayElements     = JNI__GetIntArrayElements;
    out->table_env.GetLongArrayElements    = JNI__GetLongArrayElements;
    out->table_env.GetFloatArrayElements   = JNI__GetFloatArrayElements;
    out->table_env.GetDoubleArrayElements  = JNI__GetDoubleArrayElements;
    out->table_env.ReleaseBooleanArrayElements =
      JNI__ReleaseBooleanArrayElements;
    out->table_env.ReleaseByteArrayElements =
      JNI__ReleaseByteArrayElements;
    out->table_env.ReleaseCharArrayElements =
      JNI__ReleaseCharArrayElements;
    out->table_env.ReleaseShortArrayElements =
      JNI__ReleaseShortArrayElements;
    out->table_env.ReleaseIntArrayElements =
      JNI__ReleaseIntArrayElements;
    out->table_env.ReleaseLongArrayElements =
      JNI__ReleaseLongArrayElements;
    out->table_env.ReleaseFloatArrayElements =
      JNI__ReleaseFloatArrayElements;
    out->table_env.ReleaseDoubleArrayElements =
      JNI__ReleaseDoubleArrayElements;
    out->table_env.GetBooleanArrayRegion = JNI__GetBooleanArrayRegion;
    out->table_env.GetByteArrayRegion    = JNI__GetByteArrayRegion;
    out->table_env.GetCharArrayRegion    = JNI__GetCharArrayRegion;
    out->table_env.GetShortArrayRegion   = JNI__GetShortArrayRegion;
    out->table_env.GetIntArrayRegion     = JNI__GetIntArrayRegion;
    out->table_env.GetLongArrayRegion    = JNI__GetLongArrayRegion;
    out->table_env.GetFloatArrayRegion   = JNI__GetFloatArrayRegion;
    out->table_env.GetDoubleArrayRegion  = JNI__GetDoubleArrayRegion;
    out->table_env.SetBooleanArrayRegion = JNI__SetBooleanArrayRegion;
    out->table_env.SetByteArrayRegion    = JNI__SetByteArrayRegion;
    out->table_env.SetCharArrayRegion    = JNI__SetCharArrayRegion;
    out->table_env.SetShortArrayRegion   = JNI__SetShortArrayRegion;
    out->table_env.SetIntArrayRegion     = JNI__SetIntArrayRegion;
    out->table_env.SetLongArrayRegion    = JNI__SetLongArrayRegion;
    out->table_env.SetFloatArrayRegion   = JNI__SetFloatArrayRegion;
    out->table_env.SetDoubleArrayRegion  = JNI__SetDoubleArrayRegion;
    out->table_env.RegisterNatives   = JNI__RegisterNatives;
    out->table_env.UnregisterNatives = JNI__UnregisterNatives;
    out->table_env.MonitorEnter = JNI__MonitorEnter;
    out->table_env.MonitorExit  = JNI__MonitorExit;
    out->table_env.GetJavaVM = JNI__GetJavaVM;
    out->table_env.ExceptionOccurred = JNI__ExceptionOccurred;
    out->table_env.ExceptionDescribe = JNI__ExceptionDescribe;
    out->table_env.ExceptionClear    = JNI__ExceptionClear;
    out->table_env.ExceptionCheck    = JNI__ExceptionCheck;
    out->table_env.FatalError        = JNI__FatalError;    
    out->table_env.NewLocalRef         = JNI__NewLocalRef;
    out->table_env.DeleteLocalRef      = JNI__DeleteLocalRef;
    out->table_env.EnsureLocalCapacity = JNI__EnsureLocalCapacity;
    out->table_env.NewGlobalRef        = JNI__NewGlobalRef;
    out->table_env.DeleteGlobalRef     = JNI__DeleteGlobalRef;
    out->table_env.NewWeakGlobalRef    = JNI__NewWeakGlobalRef;
    out->table_env.DeleteWeakGlobalRef = JNI__DeleteWeakGlobalRef;
    out->table_env.PushLocalFrame = JNI__PushLocalFrame;
    out->table_env.PopLocalFrame  = JNI__PopLocalFrame;
    out->table_env.GetObjectRefType = JNI__GetObjectRefType;
    out->table_env.GetPrimitiveArrayCritical =
      JNI__GetPrimitiveArrayCritical;
    out->table_env.ReleasePrimitiveArrayCritical =
      JNI__ReleasePrimitiveArrayCritical;
    out->table_env.GetStringCritical = JNI__GetStringCritical;
    out->table_env.ReleaseStringCritical = JNI__ReleaseStringCritical;
    out->table_env.NewDirectByteBuffer     = JNI__NewDirectByteBuffer;
    out->table_env.GetDirectBufferAddress  = JNI__GetDirectBufferAddress;
    out->table_env.GetDirectBufferCapacity =
      JNI__GetDirectBufferCapacity;
    out->table_env.GetObjectRef = JNI__GetObjectRef;    
    out->table_env.GetModule = JNI__GetModule;

    /* java.lang.Class is a synthentic class so it and other synthetic
     * classes must be created without a pointer to it.  This should
     * fix that right up... */
    for (ii = 0; ii < out->class_count; ++ii)
      out->classes[ii]->self.cls = out->class_class;

    *vm = out;
    out = NULL;
  }
  winj_vm_cleanup(out);
  return result;
}

jint JNICALL
JNI_CreateJavaVM(JavaVM **p_jvm, void **p_jnienv, void *vm_args)
{
  jint result = JNI_OK;
  struct winj_vm_params params;
  struct winj_vm       *vm = NULL;
  struct winj_thread   *thread = NULL;

  memset(&params, 0, sizeof(params));
  if (vm_args)
    winj_vm_params_init(&params, vm_args);

  if (!p_jvm || !p_jnienv || !vm_args) {
    winj_error(&params, "invalid parameters (p_vm=%p, p_env=%p, "
               "vm_args=%p)", p_jvm, p_jnienv, vm_args);
    result = JNI_EINVAL;
  } else if (EXIT_SUCCESS != winj_vm_create(&params, &vm)) {
    result = JNI_ENOMEM;
  } else if (!(thread = winj_vm_thread_create(vm, NULL))) {
    result = JNI_ENOMEM;
  } else {
    *p_jnienv = &thread->jni_env;
    *p_jvm    = (JavaVM*)vm;
    vm = NULL;
  }
  winj_vm_cleanup(vm);
  return result;
}
