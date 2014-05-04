/* ripple/context.h
 * Copyright (C) 2006-2013 by Jeff Gold.
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
 * An abstraction over memory managment and logging.  Libraries based
 * on this one can have their use of such resources redirected without
 * internal code changes.
 *
 * A log message can be sent from the NULL source if nothing else is
 * appropriate, but otherwise the contents of the supplied string are
 * used to determine which settings apply -- two identical strings
 * with different addresses are considered the same source.
 *
 * Settings are composed of a level and a set of bits that control
 * features to apply on each message.  Available features:
 *
 *   STAMP : prepend a time stamp using the context timefmt.
 *   UTC   : show timestamps in UTC rather than local time zone.
 *   PID   : prepend the process identifier.
 *   SOURCE: prepend source component of log message.
 *   LEVEL : prepend the severity of the log message.
 *   CODE  : prepend file and line number of call to log.
 *   FUNC  : prepend the function where log has been called.
 *
 * These can be combined in arbitrary ways, except that UTC is only
 * useful if STAMP is specified. */
#ifndef RIPPLE_CONTEXT_H
#define RIPPLE_CONTEXT_H
#include <stdlib.h>
#include <stdarg.h>

#ifdef __GNUC__
# define RIPPLE_PRINTF(n) \
  __attribute__ (( format(printf, (n), (n) + 1) ))
#else
# define RIPPLE_PRINTF(n)
#endif /* !__GNUC__ */

#ifdef __cplusplus
extern "C" {
#endif

enum {
  RIPPLE_CTXLEVEL_BITS    = 8 /* bits used for log level */,
  RIPPLE_CTXLEVEL_MASK    = ((1 << RIPPLE_CTXLEVEL_BITS) - 1),

  RIPPLE_CTXLEVEL_FATAL   = 0 /* program state is unreliable */,
  RIPPLE_CTXLEVEL_ERROR   = 1 /* operation has failed */,
  RIPPLE_CTXLEVEL_WARNING = 2 /* operation has unexpected result */,
  RIPPLE_CTXLEVEL_NOTICE  = 3 /* something noteworthy has happened */,
  RIPPLE_CTXLEVEL_DEBUG   = 4 /* details for developers */,

  RIPPLE_CTXFLAG_MASK   = ~RIPPLE_CTXLEVEL_MASK,
  RIPPLE_CTXFLAG_STAMP  = (1 << (RIPPLE_CTXLEVEL_BITS + 0)),
  RIPPLE_CTXFLAG_UTC    = (1 << (RIPPLE_CTXLEVEL_BITS + 1)),
  RIPPLE_CTXFLAG_PID    = (1 << (RIPPLE_CTXLEVEL_BITS + 2)),
  RIPPLE_CTXFLAG_SOURCE = (1 << (RIPPLE_CTXLEVEL_BITS + 3)),
  RIPPLE_CTXFLAG_LEVEL  = (1 << (RIPPLE_CTXLEVEL_BITS + 4)),
  RIPPLE_CTXFLAG_CODE   = (1 << (RIPPLE_CTXLEVEL_BITS + 5)),
  RIPPLE_CTXFLAG_FUNC   = (1 << (RIPPLE_CTXLEVEL_BITS + 6)),
};

typedef void (*ripple_clean_t)(void *context);
typedef void *(*ripple_alloc_t)(void *context, void *ptr, size_t size);
typedef void (*ripple_logfn_t)(void *context, const char *message);

struct ripple_context {
  void *context;
  unsigned settings;
  ripple_alloc_t alloc;
  ripple_logfn_t logfn;
  ripple_clean_t clean;

  const char *timefmt;
  unsigned nsrcs;
  unsigned msrcs;
  struct ripple_context_source *srcs;
  struct ripple_context_source *tree;
};

/** Prepare a ripple_context structure for use.
 *
 *  @param rctx context structure to initialize
 *  @param settings initial log level and feature flags
 *  @param context opaque pointer passed to callback functions
 *  @param clean called during cleanup if non-NULL
 *  @param alloc called to allocate memory (stdlib used if NULL)
 *  @param logfn called to log messages (stderr used if NULL) */
void
ripple_context_setup(struct ripple_context *rctx, unsigned settings,
                     void *context, ripple_clean_t clean,
                     ripple_alloc_t alloc, ripple_logfn_t logfn);

/** Reclaim resources associated with a ripple_context structure. */
void
ripple_context_cleanup(struct ripple_context *rctx);

/** Return a buffer with capacity for size bytes which has the 
 *  same contents as ptr or NULL if this is not possible. */
void*
ripple_context_realloc(struct ripple_context *rctx,
                       void *block, size_t size);

/** Return allocated memory of at least specified size or NULL. */
inline void *
ripple_context_malloc(struct ripple_context *rctx, size_t size);

/** Reclaim specified memory block. */
inline void
ripple_context_free(struct ripple_context *rctx, void *block);

/** Return non-zero iff sending a log message at the specified 
 *  level for the specified source would be accepted. */
int
ripple_context_level(struct ripple_context *rctx, unsigned level,
                     const char *source);

/** Send a message to the context log at the specified level. */
int
ripple_context_log(struct ripple_context *rctx, unsigned level,
                   const char *source, const char *file, int line,
                   const char *func,   const char *message,
                   ...) RIPPLE_PRINTF(7);

/** Send a message to the context log at the specified level. */
int
ripple_context_logv(struct ripple_context *rctx, unsigned level,
                    const char *source, const char *file, int line,
                    const char *func,   const char *message,
                    va_list args);

/** Use specified time format when logging with time stamps.
 *
 *  @return the previous time format or NULL */
const char*
ripple_context_timefmt(struct ripple_context *rctx,
                       const char *timefmt);

/** Adjust log settings for a single source. */
int
ripple_context_source_flags(struct ripple_context *rctx,
                            const char *source, unsigned settings);

/** Adjust log settings for a single source based on a space separated
 *  list including the log level and flags. */
int
ripple_context_source_string(struct ripple_context *rctx,
                             const char *source, const char *settings);

/** Adjust log settings for a single source based on the contents of
 *  an environment variable. */
int
ripple_context_source_environ(struct ripple_context *rctx,
                              const char *source, const char *env);

/** Always fail to allocate. */
void *ripple_null_alloc(void *context, void *ptr, size_t size);

/** Discard all log messages. */
void ripple_null_logfn(void *context, const char *message);

#define RIPPLE_CTXLOG(rctx, level, source, ...)                 \
  (ripple_context_level(rctx, level, source) &&                 \
   ripple_context_log(rctx, level, source, __FILE__, __LINE__,  \
                      __func__, __VA_ARGS__)) 
#define RIPPLE_FATAL(rctx, source, ...)              \
  (void)RIPPLE_CTXLOG(rctx, RIPPLE_CTXLEVEL_FATAL,   \
                      source, __VA_ARGS__)
#define RIPPLE_ERROR(rctx, source, ...)              \
  (void)RIPPLE_CTXLOG(rctx, RIPPLE_CTXLEVEL_ERROR,   \
                      source, __VA_ARGS__)
#define RIPPLE_WARNING(rctx, source, ...)            \
  (void)RIPPLE_CTXLOG(rctx, RIPPLE_CTXLEVEL_WARNING, \
                      source, __VA_ARGS__)
#define RIPPLE_NOTICE(rctx, source, ...)             \
  (void)RIPPLE_CTXLOG(rctx, RIPPLE_CTXLEVEL_NOTICE,  \
                      source, __VA_ARGS__)
#define RIPPLE_DEBUG(rctx, source, ...)              \
  (void)RIPPLE_CTXLOG(rctx, RIPPLE_CTXLEVEL_DEBUG,   \
                      source, __VA_ARGS__)
#define RIPPLE_ASSERT(rctx, source, test)                              \
  ((void)(ripple_context_level(rctx, RIPPLE_CTXLEVEL_DEBUG, source) && \
          !(test) && ripple_context_log                                \
          (rctx, RIPPLE_CTXLEVEL_FATAL, source, __FILE__, __LINE__,    \
           __func__, "assertion failed: " #test)))

#ifndef RIPPLE_NO_ABBR
typedef struct ripple_context rctx_t;
enum {
  RCTX_LOG_MASK    = RIPPLE_CTXLEVEL_MASK,
  RCTX_LOG_FATAL   = RIPPLE_CTXLEVEL_FATAL,
  RCTX_LOG_ERROR   = RIPPLE_CTXLEVEL_ERROR,
  RCTX_LOG_WARNING = RIPPLE_CTXLEVEL_WARNING,
  RCTX_LOG_NOTICE  = RIPPLE_CTXLEVEL_NOTICE,
  RCTX_LOG_DEBUG   = RIPPLE_CTXLEVEL_DEBUG,

  RCTX_FLAG_MASK   = RIPPLE_CTXFLAG_MASK,
  RCTX_FLAG_SOURCE = RIPPLE_CTXFLAG_SOURCE,
  RCTX_FLAG_STAMP  = RIPPLE_CTXFLAG_STAMP,
  RCTX_FLAG_UTC    = RIPPLE_CTXFLAG_UTC,
  RCTX_FLAG_LEVEL  = RIPPLE_CTXFLAG_LEVEL,
  RCTX_FLAG_CODE   = RIPPLE_CTXFLAG_CODE,
  RCTX_FLAG_FUNC   = RIPPLE_CTXFLAG_FUNC,
  RCTX_FLAG_PID    = RIPPLE_CTXFLAG_PID,
};

# define RCTX_LOG     RIPPLE_CTXLOG
# define RCTX_FATAL   RIPPLE_FATAL
# define RCTX_ERROR   RIPPLE_ERROR
# define RCTX_WARNING RIPPLE_WARNING
# define RCTX_NOTICE  RIPPLE_NOTICE
# define RCTX_DEBUG   RIPPLE_DEBUG
# define RCTX_ASSERT  RIPPLE_ASSERT

# define rctx_setup    ripple_context_setup
# define rctx_cleanup  ripple_context_cleanup
# define rctx_malloc   ripple_context_malloc
# define rctx_free     ripple_context_free
# define rctx_realloc  ripple_context_realloc
# define rctx_level    ripple_context_level
# define rctx_log      ripple_context_log
# define rctx_srcflags ripple_context_source_flags
# define rctx_srcstr   ripple_context_source_string
# define rctx_srcenv   ripple_context_source_environ
# define rctx_timefmt  ripple_context_timefmt
# define rctx_source   ripple_context_source
# define rctx_nalloc   ripple_null_alloc
# define rctx_nlogfn   ripple_null_logfn
#endif /* !RIPPLE_NO_ABBR */

#ifdef __cplusplus
}
#endif
#endif /* RIPPLE_CONTEXT_H */
