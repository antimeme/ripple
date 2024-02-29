// Options.java
// Copyright (C) 2008-2020 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
package net.antimeme.ripple;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.TreeSet;
import java.util.LinkedList;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;
import java.io.BufferedReader;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Generic option parsing with support for command line arguments,
 * dynamic help text, confuration files and system properties.
 * Because all of these mechanisms use the same object structure
 * consistent applications are easier to create. */
public class Options {

    /** Exception for option parsing problems. */
    public static class Problem extends RuntimeException {
        /** Option that caused this problem */
        java.lang.String opt = null;

        /** Argument to option that caused this problem */
        java.lang.String arg = null;

        /**
         * Creates a problem
         * @param cause what caused the problem */
        public Problem(Throwable cause) { super(cause); }

        /**
         * Creates a problem
         * @param msg message to describe problem */
        public Problem(java.lang.String msg) { super(msg); }

        /**
         * Creates a problem
         * @param msg message to describe problem
         * @param opt option to which the problem applies */
        public Problem(java.lang.String msg,
                       java.lang.String opt)
        { super(msg + " " + opt); this.opt = opt; }

        /**
         * Creates a problem
         * @param msg message to describe problem
         * @param opt option to which the problem applies
         * @param arg argument given to option that caused problem */
        public Problem(java.lang.String msg,
                       java.lang.String opt,
                       java.lang.String arg) {
            super(msg + " for " + opt + ": " + arg);
            this.opt = opt; this.arg = arg;
        }
    }

    /** One or more configurable parameters. */
    public static interface Option {
        /**
         * Returns a list of names claimed by this option.  When the
         * all argument is false only those names for which a help
         * message is available are supplied.
         *
         * @param all When true include options with no help text
         * @return names of available options */
        public Iterable<java.lang.String> names(boolean all);

        /**
         * Returns a brief description of the purpose of option purpose.
         *
         * @param opt Name of option to query.
         * @return Description of specified option. */
        public java.lang.String help(java.lang.String opt);

        /**
         * Returns the full name of an option which is uniquely
         * matched as a prefix by the argument.
         *
         * @param opt Name of option to query
         * @return Full name of specified option. */
        public java.lang.String prefix(java.lang.String opt);

        /**
         * Returns true iff the specified option name is claimed by
         * this option instance.
         *
         * @param opt Name of option to query
         * @return True iff the specified name is claimed. */
        public boolean find(java.lang.String opt);

        /**
         * Returns the cannonical name for an option character or
         * null if that character is not claimed by this instance.
         *
         * @param shr Short option name.
         * @return Canonical name for specified option. */
        public java.lang.String find(char shr);
        
        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg);

        /**
         * Called when an option is found.  Returns true iff the
         * option can be used without an argument.
         *
         * @param opt Name of option to query
         * @return True iff the option does not require an argument. */
        public boolean apply(java.lang.String opt);
    }

    private ArrayList<Option> opts = new ArrayList<Option>();

    /**
     * Creates an empty option collection.
     * Populate this by calling {@link #add}. */
    public Options() {}

    /**
     * Add an option subclass to the collection.
     * @param <T> a subclass of Option
     * @param s option to be added
     * @return the option that was added for chaining */
    public <T extends Option> T add(T s) { opts.add(s); return s; }

    protected static java.lang.String tagArg = "=";
    protected static java.lang.String tagOpt = "--";
    protected static java.lang.String tagShr = "-";

    private class NamedOption {
        public Option o;
        public java.lang.String name;

        public NamedOption(Option o, java.lang.String name)
        { this.o = o;  this.name = name; }
    }

    /**
     * Match arguments to options and set values appropriately.
     * @param args iterable set of arguments to consider
     * @return an iterable containing all values which do not
     *         qualify as option arguments */
    public Iterable<java.lang.String> parseArgs
        (Iterable<java.lang.String> args)
    {
        ArrayList<java.lang.String> extra =
            new ArrayList<java.lang.String>();
        LinkedList<NamedOption> wanters =
            new LinkedList<NamedOption>();
        boolean fill = false;
        for (java.lang.String arg : args) {
            if (fill) {
                extra.add(arg);
            } else if (wanters.size() > 0) {
                NamedOption next = wanters.remove();
                next.o.convert(next.name, arg);
            } else if (arg.equals(tagOpt)) {
                fill = true;
            } else if (arg.startsWith(tagOpt)) {
                // Accept options in two forms.  Given something
                // resembling --opt=opt_arg apply and convert are
                // called immediately.  Given --opt alone, apply
                // gets called and if it returns false interest
                // in consuming the next argument is registered.
                // Unambiguous prefixes are accepted for documented
                // options, so if the only option that begins with
                // the letters "op" is "opt" --op or --op=opt_arg will
                // match it just as --opt or --opt=opt_arg would.
                Option match = null;
                java.lang.String match_opt = null;
                java.lang.String match_arg = null;
                boolean ambiguous = false;
                Option prefix = null;
                java.lang.String prefix_opt = null;
                java.lang.String prefix_arg = null;

                int arg_tag = arg.indexOf(tagArg);
                java.lang.String opt = (arg_tag >= 0) ?
                    arg.substring(tagOpt.length(), arg_tag) :
                    arg.substring(tagOpt.length());
                java.lang.String opt_arg = (arg_tag >= 0) ?
                    arg.substring(arg_tag + tagArg.length()) : null;

                for (Option o : opts) {
                    if (o.find(opt)) {
                        match = o;
                        match_opt = opt;
                        match_arg = opt_arg;
                        break;
                    }
                    java.lang.String optpre;
                    if (!ambiguous &&
                        ((optpre = o.prefix(opt)) != null) &&
                        (o.help(optpre) != null)) {
                        if (prefix == null) {
                            prefix = o;
                            prefix_opt = optpre;
                            prefix_arg = opt_arg;
                        } else {
                            prefix = null;
                            prefix_opt = prefix_arg = null;
                            ambiguous = true;
                        }
                    }
                }
                if (match == null) {
                    match     = prefix;
                    match_opt = prefix_opt;
                    match_arg = prefix_arg;
                }
                if (match != null) {
                    if (match_arg != null) {
                        match.apply(match_opt);
                        match.convert(match_opt, match_arg);
                    } else if (!match.apply(match_opt))
                        wanters.add(new NamedOption(match, match_opt));
                } else throw new Problem("Unknown option", arg);
            } else if (arg.startsWith(tagShr)) {
                // Short options are a single letter each and can be
                // combined in one command line argument.  For
                // example, given -abc three options will be
                // activated.  Arguments must follow.  If options 'a'
                // and 'c' require arguments but 'b' does not, the
                // command line could look like this:
                // program -abc a_arg c_arg
                for (char c : arg.substring
                         (tagShr.length()).toCharArray()) {
                    boolean matched = false;
                    for (Option o : opts) {
                        java.lang.String opt;
                        if ((opt = o.find(c)) != null) {
                            if (!o.apply(opt))
                                wanters.add(new NamedOption(o, opt));
                            matched = true;
                            break;
                        }
                    }
                    if (!matched)
                        throw new Problem
                            ("Unknown option",
                             Character.valueOf(c).toString());
                }
            } else extra.add(arg);
        }
        if (wanters.size() > 0)
            throw new Problem("Missing argument for",
                              wanters.peek().name);
        return extra;
    }

    /**
     * Match arguments to options and set values appropriately.
     * @param args array of arguments to consider
     * @return an iterable containing all values which do not
     *         qualify as option arguments */
    public Iterable<java.lang.String> parseArgs
        (java.lang.String[] args)
    { return parseArgs(Arrays.asList(args)); }

    /**
     * Read configuration to set default values for options.
     * @param reader source of configuration data
     * @throws IOException when stream does */
    public void parseConfig(BufferedReader reader) throws IOException {
        java.lang.String line;
        while ((line = reader.readLine()) != null) {
            if (line.matches("^\\s*(#.*)?")) // empty and comments lines
                continue;
            java.lang.String opt;
            boolean matched = false;
            int point = line.indexOf(tagArg);
            if (point >= 0) {
                opt = line.substring(0, point).trim();
                java.lang.String arg =
                    line.substring(point + tagArg.length()).trim();
                if ((arg.length() > 1) &&
                    ((arg.startsWith("\"") && arg.endsWith("\"")) ||
                     (arg.startsWith("'") && arg.endsWith("'"))))
                    arg = arg.substring(1, arg.length() - 2);
                for (Option o : opts) {
                    if (o.find(opt)) {
                        o.apply(opt);
                        o.convert(opt, arg);
                        matched = true;
                        break;
                    }
                }
            } else {
                opt = line.trim();
                for (Option o : opts) {
                    if (o.find(opt)) {
                        if (!o.apply(opt))
                            throw new Problem
                                ("Missing argument for", opt);
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched)
                throw new Problem("Unknown setting: ", opt);
        }
    }

    /**
     * Read a configuration stream to set default values for options.
     * @param stream source of configuration data
     * @throws IOException when stream does */
    public void parseConfig(InputStream stream) throws IOException
    { parseConfig(new BufferedReader(new InputStreamReader(stream))); }

    /**
     * Read a configuration from a named file.
     * @param fname name of file to open and read */
    public void parseConfig(java.lang.String fname) {
        try {
            parseConfig(new FileInputStream(fname));
        } catch (FileNotFoundException ex) {
            throw new Problem("Configuration", fname, ex.getMessage());
        } catch (IOException ex) {
            throw new Problem("Configuration", fname, ex.getMessage());
        } catch (Problem ex) {
            throw new Problem("Configuration", fname, ex.getMessage());
        }
    }

    /**
     * Explain each option on the provided stream.
     * @param stream destination for help text */
    public void help(java.io.PrintStream stream) {
        int maxlen = 0;
        for (Option o : opts)
            for (java.lang.String opt : o.names(false))
                if (o.help(opt) != null)
                    maxlen = Math.max(maxlen, opt.length());
        for (Option o : opts)
            for (java.lang.String opt : o.names(false)) {
                java.lang.String opt_help = o.help(opt);
                if (opt_help != null) {
                    stream.print(opt);
                    for (int i = opt.length(); i < maxlen; i++)
                        stream.print(" ");
                    stream.print(" - ");
                    Ripple.wrap
                        (stream, maxlen + 3, maxlen + 3, 72, opt_help);
                }
            }
    }

    /**
     * Search system properties to find values for each option
     * in this group.
     * @param prefix Prepended to option name to make system property */
    public void getProperties(java.lang.String prefix) {
        for (Option o : opts)
            for (java.lang.String opt : o.names(true)) {
                java.lang.String arg;
                if ((arg = System.getProperty(prefix + opt)) != null) {
                    if (!o.apply(opt) || (arg.length() > 0))
                        o.convert(opt, arg);
                }
            }
    }

    /**
     * Common resources for supporting familiar option types. */
    public static class Base implements Option {
        protected java.lang.String opt;
        protected char             shr;
        protected java.lang.String hlp;
        
        /**
         * Creates an option.
         * @param opt Canonical name for option
         * @param shr Short name for option
         * @param help Description of option for users */
        public Base(java.lang.String opt, char shr,
                    java.lang.String help)
        { this.opt = opt;  this.shr = shr; this.hlp = help; }

        public java.lang.String prefix(java.lang.String opt) {
            return ((this.opt != null) && (this.opt.startsWith(opt))) ?
                this.opt : null;
        }

        public boolean find(java.lang.String opt) {
            return (this.opt != null) && (this.opt.equals(opt));
        }

        public java.lang.String find(char shr) {
            return ((this.shr != '\0') && (this.shr == shr)) ?
                opt : null;
        }

        public Iterable<java.lang.String> names(boolean all) {
            ArrayList<java.lang.String> result =
                new ArrayList<java.lang.String>();
            if (all || hlp != null) result.add(this.opt);
            return result;
        }

        public java.lang.String help(java.lang.String opt)
        { return hlp; }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { throw new Problem("Unnecessary argument", opt, arg); }

        public boolean apply(java.lang.String opt)
        { return false; }
    }

    /**
     * A simple switch setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class Switch extends Base {
        /**
         * Current value of switch option. */
        public boolean value = false;

        protected char negshr = '\0';
        protected java.lang.String negpre = "no-";

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param negshr short name to disable option (such as -i)
         * @param defl default value
         * @param help description of option for users */
        public Switch(java.lang.String opt, char shr, char negshr,
                      boolean defl, java.lang.String help)
        { super(opt, shr, help); this.negshr = negshr; value = defl; }

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Switch(java.lang.String opt, char shr, boolean defl,
                      java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param negshr short name to disable option (such as -i)
         * @param help description of option for users */
        public Switch(java.lang.String opt, char shr, char negshr,
                      java.lang.String help)
        { super(opt, shr, help); this.negshr = negshr; }

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Switch(java.lang.String opt, char shr,
                      java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Switch(java.lang.String opt, boolean defl,
                      java.lang.String help)
        { super(opt, '\0', help); value = defl; }

        /**
         * Create a new switch option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Switch(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        public Iterable<java.lang.String> names(boolean all) {
            ArrayList<java.lang.String> result =
                new ArrayList<java.lang.String>();
            if (all || hlp != null) result.add(this.opt);
            if (all) result.add(negpre + this.opt);
            return result;
        }
        public boolean find(java.lang.String opt) {
            if (this.opt != null)
                return opt.equals(this.opt) ||
                    opt.equals(negpre + this.opt);
            return false;
        }
        public java.lang.String find(char shr) {
            if (this.shr != '\0') {
                if (this.shr == shr)
                    return opt;
                else if (this.negshr == shr)
                    return negpre + opt;
            }
            return null;
        }

        public boolean apply(java.lang.String opt) {
            value = this.opt.equals(opt);
            return true;
        }
        public java.lang.String toString()
        { return Boolean.toString(value); }
    }

    /**
     * A simple counter setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class Counter extends Base {
        /**
         * Current value of counter. */
        public int value;

        /**
         * Create a new counter option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Counter(java.lang.String opt, char shr, int defl,
                       java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new counter option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Counter(java.lang.String opt, char shr,
                       java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new counter option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Counter(java.lang.String opt, int defl,
                       java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new counter option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Counter(java.lang.String opt,
                       java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Called when option is given
         * @param opt that was found
         * @return always true */
        public boolean apply(java.lang.String opt)
        { value++; return true; }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return java.lang.Integer.toString(value); }
    }

    /**
     * A simple string setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class String extends Base {
        /**
         * Current value of string option. */
        public java.lang.String value = null;

        /**
         * Create a new string option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public String(java.lang.String opt, char shr,
                      java.lang.String defl, java.lang.String help)
        { super(opt, shr, help);  value = defl; }

        /**
         * Create a new string option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public String(java.lang.String opt, java.lang.String defl,
                      java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new string option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public String(java.lang.String opt, char shr,
                      java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new string option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public String(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg) { value = arg; }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString() { return value; }
    }

    /**
     * A simple integer setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class Integer extends Base {
        /**
         * Current value of integer. */
        public int value;

        /**
         * Create a new integer option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Integer(java.lang.String opt, char shr, int defl,
                       java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new integer option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Integer(java.lang.String opt, char shr,
                       java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new integer option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Integer(java.lang.String opt, int defl,
                       java.lang.String help)
        { super(opt, '\0', help); value = defl; }

        /**
         * Create a new integer option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Integer(java.lang.String opt,
                       java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return java.lang.Integer.toString(value); }

        /**
         * Convert argument to integer if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert'
         * @return converted argument */
        public static int check(java.lang.String opt,
                                java.lang.String arg) {
            try { return java.lang.Integer.parseInt(arg); }
            catch (NumberFormatException ex) {
                throw new Problem("Argument must be an integer",
                                  opt, arg);
            }
        }
    }

    /**
     * A long integer setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class Long extends Base {
        /**
         * Current value of long integer. */
        public long value;

        /**
         * Create a new long integer option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Long(java.lang.String opt, char shr, long defl,
                    java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new long integer option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Long(java.lang.String opt, char shr,
                    java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new long integer option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Long(java.lang.String opt, long defl,
                    java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new long integer option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Long(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return java.lang.Long.toString(value); }

        /**
         * Convert argument to long integer if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert
         * @return converted value */
        public static long check(java.lang.String opt,
                                 java.lang.String arg) {
            try { return java.lang.Long.parseLong(arg); }
            catch (NumberFormatException ex) {
                throw new Problem("Argument must be an integers",
                                  opt, arg);
            }
        }
    }

    /**
     * A simple floating point setting.  A public <code>value</code>
     * field permits access to the parsed result. */
    public static class Float extends Base {
        /**
         * Current value of single precision floating point number. */
        public float value;

        /**
         * Create a new single precision floating point option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Float(java.lang.String opt, char shr, float defl,
                     java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new single precision floating point option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Float(java.lang.String opt, char shr,
                     java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new single precision floating point option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Float(java.lang.String opt, float defl,
                     java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new single precision floating point option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Float(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return java.lang.Float.toString(value); }

        /**
         * Convert argument to single precision float if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert
         * @return converted value */
        public static float check(java.lang.String opt,
                                  java.lang.String arg) {
            try { return java.lang.Float.parseFloat(arg); }
            catch (NumberFormatException ex) {
                throw new Problem("Argument must be an integers",
                                  opt, arg);
            }
        }
    }

    /**
     * A double precision floating point setting.  A public
     * <code>value</code> field permits access to the parsed result. */
    public static class Double extends Base {

        /**
         * Current value of double precision floating point number. */
        public double value;

        /**
         * Create a new double precision floating point option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public Double(java.lang.String opt, char shr, double defl,
                     java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new double precision floating point option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public Double(java.lang.String opt, char shr,
                     java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new double precision floating point option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public Double(java.lang.String opt, double defl,
                     java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new double precision floating point option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public Double(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return java.lang.Double.toString(value); }

        /**
         * Convert argument to double precision float if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert
         * @return converted value */
        public static double check(java.lang.String opt,
                                  java.lang.String arg) {
            try { return java.lang.Double.parseDouble(arg); }
            catch (NumberFormatException ex) {
                throw new Problem("Argument must be an integers",
                                  opt, arg);
            }
        }
    }

    /**
     * An internet address setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class InetAddress extends Base {
        /**
         * Current value of internt address. */
        public java.net.InetAddress value;

        /**
         * Create a new internet address option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public InetAddress(java.lang.String opt, char shr,
                           java.net.InetAddress defl,
                           java.lang.String help)
        { super(opt, shr, help); value = defl; }

        /**
         * Create a new internet address option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public InetAddress(java.lang.String opt, char shr,
                           java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new internet address option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public InetAddress(java.lang.String opt,
                           java.net.InetAddress defl,
                           java.lang.String help)
        { super(opt, '\0', help); value = defl; }

        /**
         * Create a new internet address option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public InetAddress(java.lang.String opt, java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt, java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return (value != null) ? value.toString() : null; }

        /**
         * Convert argument to an internet address if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert
         * @return converted value */
        public static java.net.InetAddress check(java.lang.String opt,
                                                 java.lang.String arg) {
            try {
                return java.net.InetAddress.getByName(arg);
            } catch (UnknownHostException ex) {
                throw new Problem("Host unknown", opt, arg);
            }
        }
    }    

    /**
     * A print stream setting.  A public <code>value</code> field
     * permits access to the parsed result. */
    public static class PrintStream extends Base {
        /**
         * Current value of print stream. */
        public java.io.PrintStream value;

        /**
         * Create a new print stream option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param defl default value
         * @param help description of option for users */
        public PrintStream(java.lang.String opt, char shr,
                           java.io.PrintStream defl,
                           java.lang.String help)
        { super(opt, shr, help);  value = defl; }

        /**
         * Create a new print stream option
         * @param opt long name for option (such as --option)
         * @param shr short name for option (such as -o)
         * @param help description of option for users */
        public PrintStream(java.lang.String opt, char shr,
                           java.lang.String help)
        { super(opt, shr, help); }

        /**
         * Create a new print stream option
         * @param opt long name for option (such as --option)
         * @param defl default value
         * @param help description of option for users */
        public PrintStream(java.lang.String opt,
                           java.io.PrintStream defl,
                           java.lang.String help)
        { super(opt, '\0', help);  value = defl; }

        /**
         * Create a new print stream option
         * @param opt long name for option (such as --option)
         * @param help description of option for users */
        public PrintStream(java.lang.String opt,
                           java.lang.String help)
        { super(opt, '\0', help); }

        /**
         * Associate the argument with the named option.
         *
         * @param opt Name of option to convert.
         * @param arg Argument to supply to option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { value = check(opt, arg); }

        /**
         * Return representation of option value
         * @return representation of option value */
        public java.lang.String toString()
        { return (value != null) ? value.toString() : null; }

        /**
         * Convert argument to a print stream if possible.
         * @param opt option for which this is being done
         * @param arg argument to convert
         * @return converted value */
        public static java.io.PrintStream check(java.lang.String opt,
                                                java.lang.String arg) {
            try {
                return new java.io.PrintStream
                    (new FileOutputStream(arg, true));
            } catch (FileNotFoundException ex) {
                throw new Problem("File not found", opt, arg);
            }
        }
    }    

    /**
     * Configuration file setting.  The entire file is read and parsed
     * at configuration time, so the run-time order in which options
     * are presented matters. */
    public static class Config extends Base {
        private Options opts;

        /**
         * Create a configuration option
         * @param opts option collection to populate
         * @param opt long form option to process (such as --option)
         * @param shr short form option to process (such as -o)
         * @param help text describing this option */
        public Config(Options opts, java.lang.String opt, char shr,
                      java.lang.String help)
        { super(opt, shr, help); this.opts = opts; }

        /**
         * Create a configuration option
         * @param opts option collection to populate
         * @param opt long form option to process (such as --option)
         * @param help text describing this option */
        public Config(Options opts, java.lang.String opt,
                      java.lang.String help)
        { super(opt, '\0', help); this.opts = opts; }

        /**
         * Accept an argument for this option
         * @param opt name of option being processed
         * @param arg value to set option to */
        public void convert(java.lang.String opt,
                            java.lang.String arg)
        { opts.parseConfig(arg); }
    }

    /** Extensible groups of options using reflection. */
    public static class Group implements Option {
        protected static java.lang.String pre_help    = "help_";
        protected static java.lang.String pre_shr     = "short_";
        protected static java.lang.String pre_apply   = "apply_";
        protected static java.lang.String pre_convert = "convert_";

        /**
         * Creates a degenerate Group suitable for subclass use. */
        protected Group() {}

        /**
         * Returns an option specific apply method or null.. */
        private Method getApply(java.lang.String opt) {
            Method result = null;
            try { return getClass().getMethod(pre_apply + opt); }
            catch (NoSuchMethodException ex) {}
            return result;
        }
        /** Returns an option specific convert method or null. */
        private Method getConvert(java.lang.String opt) {
            Method result = null;
            try {
                return getClass().getMethod
                    (pre_convert + opt, java.lang.String.class);
            } catch (NoSuchMethodException ex) {}
            return result;
        }

        /** Implements Option. */
        public java.lang.String prefix(java.lang.String opt) {
            for (Method m : getClass().getMethods())
                if (m.getName().startsWith(pre_apply + opt))
                    return m.getName().substring(pre_apply.length());
            return null;
        }

        /** Implements Option. */
        public boolean find(java.lang.String opt) {
            return (getConvert(opt) != null) || (getApply(opt) != null);
        }

        /** Implements Option. */
        public java.lang.String find(char shr) {
            try {
                Field f = getClass().getField(pre_shr + shr);
                if ((f != null) && (f.getType() ==
                                    java.lang.String.class))
                    return (java.lang.String)f.get(this);
            } catch (NoSuchFieldException ex) {
            } catch (IllegalAccessException ex) {}
            return null;
        }

        /** Implements Option. */
        public Iterable<java.lang.String> names(boolean all) {
            if (all) {
                TreeSet<java.lang.String> result =
                    new TreeSet<java.lang.String>();
                for (Method m : getClass().getMethods()) {
                    java.lang.String name = m.getName();
                    if (name.startsWith(pre_apply))
                        result.add(name.substring(pre_apply.length()));
                    else if (name.startsWith(pre_convert))
                        result.add(name.substring
                                   (pre_convert.length()));
                }
                return result;
            } else {
                ArrayList<java.lang.String> result =
                    new ArrayList<java.lang.String>();
                for (Field f : getClass().getFields()) {
                    java.lang.String name = f.getName();
                    if (name.startsWith(pre_help))
                        result.add(name.substring(pre_help.length()));
                }
                return result;
            }
        }

        /** Implements Option. */
        public java.lang.String help(java.lang.String opt) {
            try {
                Field f = getClass().getField(pre_help + opt);
                if ((f != null) && (f.getType() ==
                                    java.lang.String.class))
                    return (java.lang.String)f.get(this);
            } catch (NoSuchFieldException ex) {
            } catch (IllegalAccessException ex) {}
            return null;
        }

        /** Implements Option. */
        public void convert(java.lang.String opt,
                            java.lang.String arg) {
            Method m = getConvert(opt);
            if (m != null)
                try {
                    m.invoke(this, arg);
                    return;
                } catch (IllegalAccessException ex) {
                } catch (InvocationTargetException ex) {
                    Throwable cause = ex.getCause();
                    if (cause instanceof Problem)
                        throw (Problem)cause;
                    else throw new Problem(cause);
                }
            throw new Problem("Unnecessary argument", opt, arg);
        }

        /**
         * Called when option is given
         * @param opt option that was found
         * @return always true */
        public boolean apply(java.lang.String opt) {
            Method m = getApply(opt);
            if (m != null)
                try {
                    m.invoke(this);
                    return true;
                } catch (IllegalAccessException ex) {
                } catch (InvocationTargetException ex) {
                    Throwable cause = ex.getCause();
                    if (cause instanceof Problem)
                        throw (Problem)cause;
                    else throw new Problem(cause);
                }
            return getConvert(opt) == null;
        }
    }
    
    /**
     * Description for automated usage message.
     * @return Usage message. */
    public static java.lang.String usageLine()
    { return "Accepts command line options."; }

    /**
     * A simple option demonstration.
     * @param args Command line arguments. */
    public static void main(java.lang.String[] args) {
        Options opts   = new Options();
        Switch  active = opts.add
            (new Switch("active", 'a', 'A', "a meaningless field " +
                        "that can be true or false but has no clear " +
                        "purpose; don't do this in your own code " +
                        "because it's just here to test the word " +
                        "wrapping features of this program."));
        Integer count  = opts.add
            (new Integer("count", 'c', "one two three..."));
        String  name   = opts.add
            (new String("name", 'n', null, "something to refer " +
                        "to something by."));

        class Address extends Group {
            public java.lang.String street = null;
            public void convert_street(java.lang.String arg)
            { street = arg; }

            public int zipcode = 0;
            public void convert_zipcode(java.lang.String arg)
            { zipcode = Integer.check("zipcode", arg); }
            public java.lang.String short_z = "zipcode";
            public java.lang.String help_zipcode =
                "note that there is no documentation for street.";
        }
        Address a = opts.add(new Address());

        opts.getProperties("options.");
        opts.parseArgs(args);
        System.out.println("active  = " + active);
        System.out.println("count   = " + count);
        System.out.println("name    = " + name);
        System.out.println("street  = " + a.street);
        System.out.println("zipcode = " + a.zipcode);

        System.out.println();
        opts.help(System.out);
    }
}
