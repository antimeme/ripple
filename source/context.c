/* source/context.c
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
 * Dynamically retargettable memory management and logging. */
#include <stdio.h>
#include <ctype.h>
#include <string.h>
#include <time.h>
#ifdef _WIN32
# define snprintf _snprintf
# define getpid   _getpid
# define gmtime_r(timep, result) gmtime(timep)
# define localtime_r(timep, result) localtime(timep)
typedef int pid_t;
#else
# include <unistd.h>
#endif /* !_WIN32 */

#include <config.h>
#include <ripple/context.h>
#include <ripple/tree.h>

static const char* ripple_context_source = PACKAGE_NAME;
static const char* ripple_timefmt = "[%Y-%m-%d %H:%M:%S %Z]";

struct ripple_context_source {
  const char *name;
  unsigned settings;
  struct ripple_tree_data treedata;
};
#define source_nodefn(n) (&(n)->treedata)
#define source_cmpfn(a, b) strcmp((a)->name, (b)->name)
RIPPLE_TREE_DEFINE(source, struct ripple_context_source,
                   source_nodefn, source_cmpfn);

void
ripple_context_setup(struct ripple_context* rctx, unsigned settings,
                     void *context, ripple_clean_t clean,
                     ripple_alloc_t alloc, ripple_logfn_t logfn)
{
  *rctx = (struct ripple_context){ 
    .context  = context,
    .settings = settings,
    .clean    = clean,
    .alloc    = alloc,
    .logfn    = logfn 
  };
}

void
ripple_context_cleanup(struct ripple_context* rctx)
{
  if (rctx) {
    ripple_context_free(rctx, rctx->srcs);
    if (rctx->clean)
      rctx->clean(rctx->context);
  }
}

void*
ripple_context_realloc(struct ripple_context* rctx,
                       void* block, size_t size)
{
  void* result = (rctx && rctx->alloc) ? 
    rctx->alloc(rctx->context, block, size) : realloc(block, size);
  if (size && !result)
    RIPPLE_ERROR(rctx, ripple_context_source,
                 "failed to allocate memory (%p, %p, %u)",
                 rctx, block, (unsigned)size);
  return result;
}

inline void*
ripple_context_malloc(struct ripple_context* rctx, size_t size)
{ return ripple_context_realloc(rctx, NULL, size); }

inline void
ripple_context_free(struct ripple_context* rctx, void* block)
{ (void)ripple_context_realloc(rctx, block, 0); }

static struct ripple_context_source*
ripple__findsrc(struct ripple_context* rctx, const char* name)
{
  struct ripple_context_source* result = NULL;
  if (rctx && name) {
    struct ripple_context_source target =
      (struct ripple_context_source) { .name = name, };
    result = ripple_tree_find_source(rctx->tree, &target);
  }
  return result;
}

int
ripple_context_level(struct ripple_context* rctx, unsigned level,
                     const char* source)
{
  unsigned result = RIPPLE_CTXLEVEL_NOTICE;
  if (rctx) {
    struct ripple_context_source* src;
    src = ripple__findsrc(rctx, source);

    result = (src ? src->settings : rctx->settings) &
      RIPPLE_CTXLEVEL_MASK;
  }
  return result >= level;
}

const char*
ripple_context_timefmt(struct ripple_context* rctx, const char* timefmt)
{
  const char* result = NULL;
  if (rctx) {
    result = rctx->timefmt;
    if (timefmt)
      rctx->timefmt = timefmt;
  }
  return result;
}

int
ripple_context_source_flags(struct ripple_context* rctx,
                            const char* source, unsigned settings)
{
  int result = 0;
  if (rctx) {
    result = 1;
    if (source) {
      struct ripple_context_source* src;
      if (!(src = ripple__findsrc(rctx, source))) {
        if (rctx->nsrcs >= rctx->msrcs) {
          struct ripple_context_source* srcs;
          unsigned msrcs = rctx->msrcs ? rctx->msrcs * 2 : 16;
          srcs = ripple_context_realloc(rctx, rctx->srcs,
                                        msrcs * sizeof *src);
          if (srcs) {
            rctx->msrcs = msrcs;
            rctx->srcs  = srcs;
          }
        }
        if (rctx->nsrcs < rctx->msrcs) {
          src = &rctx->srcs[rctx->nsrcs++];
          src->name = source;
          (void)ripple_tree_insert_source(&rctx->tree, src);
        }
      }
      if (src)
        src->settings = settings;
      else result = 0;
    } else rctx->settings = settings;
  }
  return result;
}

int
ripple_context_source_string(struct ripple_context *rctx,
                             const char *source, const char *settings)
{
  (void)rctx; (void)source; (void)settings;
  return 0; /* TODO: implement this! */
}

int
ripple_context_source_environ(struct ripple_context *rctx,
                              const char *source, const char *env)
{
  (void)rctx; (void)source; (void)env;
  return 0; /* TODO: implement this! */
}

static const char*
ripple__strlevel(unsigned level)
{
  const char* result;
  switch (level & RIPPLE_CTXLEVEL_MASK) {
  case RIPPLE_CTXLEVEL_FATAL:   result = "FATAL";   break;
  case RIPPLE_CTXLEVEL_ERROR:   result = "ERROR";   break;
  case RIPPLE_CTXLEVEL_WARNING: result = "WARNING"; break;
  case RIPPLE_CTXLEVEL_NOTICE:  result = "NOTICE";  break;
  case RIPPLE_CTXLEVEL_DEBUG:   result = "DEBUG";   break;
  default: result = "UNKNOWN";
  }
  return result;
}

static inline int
ripple__addlogv(char* buffer, size_t size, int used,
                const char* message, va_list args)
{
  int result = 0;
  if ((used >= 0) && ((unsigned)used < size)) {
    result = vsnprintf(buffer + used, size - used, message, args);
    if (result >= 0) 
      result += used;
  }
  return result;
}

static inline int
ripple__addlog(char* buffer, size_t size, int used,
               const char* message, ...)
{
  int result;
  va_list args;
  va_start(args, message);
  result = ripple__addlogv(buffer, size, used, message, args);
  va_end(args);
  return result;
}

static inline int
ripple__putlog(unsigned settings, unsigned level, 
               const char* source, const char* timefmt, 
               const char* file, int line, const char* func,
               time_t now, pid_t pid, char* buffer, size_t size, 
               const char* message, va_list args)
{
  int result = 0;
  if (settings & RIPPLE_CTXFLAG_STAMP) {
    char timestr[64];
    struct tm tmval;
    if (settings & RIPPLE_CTXFLAG_UTC)
      tmval = *gmtime_r(&now, &tmval);
    else tmval = *localtime_r(&now, &tmval);
    if (strftime(timestr, sizeof timestr, timefmt, &tmval))
      result = ripple__addlog(buffer, size, result, "%s ", timestr);
  }

  if (settings & RIPPLE_CTXFLAG_PID)
    result = ripple__addlog(buffer, size, result, "%d ", (int)pid);
  if ((settings & RIPPLE_CTXFLAG_SOURCE) && source)
    result = ripple__addlog(buffer, size, result, "%s ", source);
  if (settings & RIPPLE_CTXFLAG_LEVEL)
    result = ripple__addlog(buffer, size, result,	"%s ",
                            ripple__strlevel(level));
  if (settings & RIPPLE_CTXFLAG_CODE)
    result = ripple__addlog(buffer, size, result, "%s:%d: ",
                            file, line);
  if ((settings & RIPPLE_CTXFLAG_FUNC) && func)
    result = ripple__addlog(buffer, size, result, "%s: ", func);
  return ripple__addlogv(buffer, size, result, message, args);
}

int
ripple_context_logv(struct ripple_context* rctx, unsigned level, 
                    const char* source, const char* file, int line,
                    const char* func, const char* message, va_list args)
{
  int result = 0;
  unsigned settings = 0;
  if (rctx) {
    struct ripple_context_source* src;
    if ((src = ripple__findsrc(rctx, source)))
      settings = src->settings;
    else settings = rctx->settings;
  }

  if (ripple_context_level(rctx, level, source)) {
    char   stackbuf[256];
    char*  buffer = stackbuf;
    size_t size   = sizeof stackbuf;
    const char* timefmt = (rctx && rctx->timefmt) ? rctx->timefmt :
      ripple_timefmt;
    pid_t  pid = (settings & RIPPLE_CTXFLAG_PID)   ? getpid()   : 0;
    time_t now = (settings & RIPPLE_CTXFLAG_STAMP) ? time(NULL) : 0;

    do {
      result = ripple__putlog(settings, level, source, timefmt,
                              file, line, func, now, pid,
                              buffer, size, message, args);
      if ((result < 0) || ((unsigned)result >= size)) {
        if (result >= 0) {
          size = result + 1; 
          result = -1; 
        } else size *= 2;
        if (buffer != stackbuf)
          ripple_context_free(rctx, buffer);
        buffer = ripple_context_malloc(rctx, size);
      }
    } while (buffer && (result < 0));

    if (buffer) {
      char* c = buffer;
      while (*c) {
        if ((*c == '\n') || (*c == '\r'))
          *c = ' ';
        else if (!((unsigned char)*c & 0x80) && !isprint(*c))
          *c = '#';
        ++c;
      }

      if (rctx && rctx->logfn)
        rctx->logfn(rctx->context, buffer);
      else { fprintf(stderr, "%s\n", buffer); fflush(stderr); }

      if (buffer != stackbuf)
        ripple_context_free(rctx, buffer);
    }
  }

  if ((level & RIPPLE_CTXLEVEL_MASK) == RIPPLE_CTXLEVEL_FATAL)
    abort();
  return result;
}

int
ripple_context_log(struct ripple_context* rctx, unsigned level, 
                   const char* source, const char* file, int line,
                   const char* func, const char* message, ...)
{
  int result;
  va_list args;
  va_start(args, message);
  result = ripple_context_logv(rctx, level, source, file, line, 
                               func, message, args);
  va_end(args);
  return result;
}

void*
ripple_null_alloc(void *context, void* ptr, size_t size)
{ (void)context; (void)ptr; (void)size; return NULL; }

void
ripple_null_logfn(void *context, const char* message)
{ (void)context; (void)message; }
