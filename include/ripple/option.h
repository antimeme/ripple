/* ripple/option.h
 * Copyright (C) 2006-2014 by Jeff Gold.
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
 * A self-documenting command line option parsing library. */
#ifndef RIPPLE_OPTION_H
#define RIPPLE_OPTION_H
#include <ripple/context.h>

#ifdef __cplusplus
extern "C" {
#endif

  /* NOTES:
   * - description == NULL means undocumented
   * - process == NULL means not implemented
   * - configuration file option (stream internal?)
   * - usage should support stream?
   */

enum {
  RIPPLE_OPTERR_USAGE   = -1, /* requested help */
  RIPPLE_OPTERR_UNKNOWN = -2, /* invoked an unrecognized option */
  RIPPLE_OPTERR_REPEAT  = -3, /* invoked an option more than once */
  RIPPLE_OPTERR_NOARGS  = -4, /* argument given where not allowed */
  RIPPLE_OPTERR_MISSING = -5, /* argument omitted where required */
  RIPPLE_OPTERR_INVALID = -6, /* argument invalid */
  RIPPLE_OPTERR_NOIMP   = -7, /* invoked an option not implemented */

  RIPPLE_OPTFLAG_NONE    = 0,
  RIPPLE_OPTFLAG_ARG     = (1 << 0),  /* requires an argument */
  RIPPLE_OPTFLAG_OPT     = (1 << 1),  /* can accept inline argument */
  RIPPLE_OPTFLAG_PROCESS = (1 << 16), /* reserved for process speprocess function flags */
};

struct ripple_option;
typedef int (*ripple_oprocess_t)(struct ripple_option* option,
                                 const char* arg);
struct ripple_option {
  char        sname;   /* short name: "o"      -> -o */
  const char* lname;   /* long name:  "option" -> --option */
  const char* desc;    /* description of option for usage */
  const char* argdesc; /* name of argument type: --option=argdesc */
  unsigned    flags;
  unsigned    setting;
  ripple_oprocess_t process;

  void*     output;
  unsigned* count;
};

struct ripple_ogroup {
  const char* name;
  const char* description;

  struct ripple_option* options;
  unsigned              noptions;
  struct ripple_ogroup* groups;
  unsigned              ngroups;
};

/* ------------------------------------------------------------------ */

void
ripple_option_usage(struct ripple_ogroup* group, void* fixme /* :FIXME: */);

int
ripple_option_parse(struct ripple_context* rctx,
                    struct ripple_ogroup*  group,
                    int argc, char* const* const argv);

int
ripple_option_config(struct ripple_context* rctx,
                     struct ripple_ogroup*  group,
                     const char** configfile,
                     int argc, char* const* const arvg);

int
ripple_option_main(struct ripple_ogroup* group,
                   int argc, char* const* const argv,
                   int (*go)(void));

/* ------------------------------------------------------------------ */

int
ripple_oprocess_string(struct ripple_option* option, const char* arg);

int
ripple_oprocess_flag(struct ripple_option* option, const char* arg);

int
ripple_oprocess_unflag(struct ripple_option* option, const char* arg);

int
ripple_oprocess_incr(struct ripple_option* option, const char* arg);

enum {
  RIPPLE_OPTINT_NONE        = 0,
  RIPPLE_OPTINT_NONZERO     = 1,
  RIPPLE_OPTINT_POSITIVE    = 2,
  RIPPLE_OPTINT_NEGATIVE    = 3,
  RIPPLE_OPTINT_NONPOSITIVE = 4,
  RIPPLE_OPTINT_NONNEGATIVE = 5,
  RIPPLE_OPTINT_PORT        = 6,
};
int
ripple_oprocess_integer(struct ripple_option* option, const char* arg);

int
ripple_oprocess_config(struct ripple_option* option, const char* arg);


#ifndef   RIPPLE_NO_ABBR
typedef struct ripple_option  ropt_t;
typedef struct ripple_ogroup  ropts_t;
# define RIPPLE_OPTGET_FLAGS(option)    ((option)->flags)
# define RIPPLE_OPTGET_SETTINGS(option) ((option)->settings)
# define RIPPLE_OPTGET_VALUE(option)    ((option)->value)
#endif /* RIPPLE_NO_ABBR */

#define RIPPLE_OPTION_FLAG(sname, lname, flags, dest, desc) \
  { sname, lname, desc, NULL, RIPPLE_OPTFLAG_NONE, \
    ripple_oprocess_flag, flags, NULL, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_UNFLAG(sname, lname, flags, dest, desc) \
  { sname, lname, desc, NULL, RIPPLE_OPTFLAG_NONE, \
    ripple_oprocess_unflag, flags, NULL, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_INCR(sname, lname, inc, dest, desc) \
  { sname, lname, desc, NULL, RIPPLE_OPTFLAG_REPEAT, \
    ripple_oprocess_increment, inc, NULL, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_DECR(sname, lname, dec, dest, desc) \
  { sname, lname, desc, NULL, RIPPLE_OPTFLAG_REPEAT, \
    ripple_oprocess_decrement, dec, NULL, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_STRING(sname, lname, argdesc, dest, desc) \
  { sname, lname, desc, argdesc, RIPPLE_OPTFLAG_ARG, \
    ripple_oprocess_string, 0, NULL, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_OSTRING(sname, lname, argdesc, count, dest, desc) \
  { sname, lname, desc, argdesc, RIPPLE_OPTFLAG_OPT, \
    ripple_oprocess_string, 0, count, \
    0, NULL, 0, (void*)dest }
#define RIPPLE_OPTION_INTEGER(sname, lname, argdesc, check, dest, desc) \
  { sname, lname, argdesc, desc, RIPPLE_OPTFLAG_ARG, check, \
      NULL/*ripple_oprocess_integer*/, (void*)dest, 0 }
#define RIPPLE_OPTION_GROUP(name, groupv, groupc, desc)            \
  { '\0', name, NULL, desc, RIPPLE_OPTFLAG_NONE, NULL, 0, NULL,     \
      (groupc) ? groupc : sizeof(groupv) / sizeof(*groupv), groupv, \
      0, NULL }

#define RIPPLE_OGROUP_INIT(name, desc, groupv, groupc)                   \
  { name, desc, (groupc) ? (groupc) : sizeof(groupv) /                  \
      sizeof(*groupv), groupv, 1 }

#ifdef __cplusplus
}
#endif
#endif /* !RIPPLE_OPTION_H */
