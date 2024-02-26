// Juju.java
// Copyright (C) 2014-2024 by Jeff Gold
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
package net.esclat.ripple;
import java.math.BigInteger;
import java.math.BigDecimal;
import java.io.Reader;
import java.io.StringReader;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.io.Writer;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.IOException;
import java.util.Deque;
import java.util.List;
import java.util.LinkedList;
import java.util.ArrayList;
import java.util.Map;
import java.util.LinkedHashMap;

/**
 * <p>Parses JSON data and uses a simple object representation.  Parse
 * errors are given a line and column number for reference in the
 * input to make understanding problems in JSON data easier.  No
 * dependencies apart from the standard Java Runtime Environment are
 * used.</p>
 *
 * <p>The following example will print "b = 7.7":</p>
 *
 * <pre>
       Object o = Juju.parseJSON("{\"a\": false, \"b\": 7.7 }");
       System.out.println("b = " + ((Map&lt;String, Object&gt;)o).
                                   get("b"));
 * </pre> */
public class Juju {

    /** Reports a parsing problem with line and column of input. */
    public static class ParseException extends RuntimeException {
        /** Line number where parsing failed */
        public long line;

        /** Column where parsing failed */
        public long column;

        protected static String process
            (long line, long column, String message)
        {
            return "input:" + line + "," + column + ": " + message;
        }

        protected ParseException(long line, long column, String message)
        {
            super(process(line, column, message));
            this.line = line;
            this.column = column;
        }

        protected ParseException(long line, long column,
                                 Throwable cause)
        { super(cause); this.line = line; this.column = column; }

        protected ParseException(long line, long column,
                                 String message, Throwable cause)
        {
            super(process(line, column, message), cause);
            this.line = line;
            this.column = column;
        }
    }

    private Juju() {}
    private enum ParseState {
        READY, DONE, STRING, ESCAPE, UHEX, NUMBER, VALUE,
        ARRAY, ARRAY_DONE, OBJECT_PREKEY, OBJECT_POSTKEY, OBJECT_NEXT;
    }

    private static ParseState finish
        (Deque<Object> stack, long line, long column,
         int current, Object value)
    {
        ParseState result = ParseState.DONE;
        if (stack.size() > 0) {
            Object parent = stack.peekFirst();
            if (parent instanceof List) {
                ((List<Object>)parent).add(value);

                if (current == '}')
                    throw new ParseException
                        (line, column, "Invalid object termination");
                else if (current == ']')
                    result = finish
                        (stack, line, column, ' ', stack.pop());
                else if (current == ',')
                    result = ParseState.READY;
                else result = ParseState.ARRAY;
            } else {
                String key = (String)stack.pop();
                Map<String, Object> map =
                    (Map<String, Object>)stack.peekFirst();
                map.put(key, value);

                if (current == ']')
                    throw new ParseException
                        (line, column, "Invalid array termination");
                else if (current == '}')
                    result = finish
                        (stack, line, column, ' ', stack.pop());
                else if (current == ',')
                    result = ParseState.OBJECT_PREKEY;
                else result = ParseState.OBJECT_NEXT;
            }
        } else stack.push(value);
        return result;
    }

    private static ParseState finishNumber
        (Deque<Object> stack, long line, long column,
         int current, String value)
    {
        Object result = null;
        BigDecimal bd = new BigDecimal(value);

        if (result == null)
            try {
                result = bd.intValueExact();
            } catch (ArithmeticException ex) {}
        if (result == null)
            try {
                result = bd.longValueExact();
            } catch (ArithmeticException ex) {}
        if (result == null)
            try {
                result = bd.toBigIntegerExact();
            } catch (ArithmeticException ex) {}
        if (result == null)
            result = bd.doubleValue();
        return finish(stack, line, column, current, result);
    }

    private static ParseState finishValue
        (Deque<Object> stack, long line, long column,
         int current, String value)
    {
        Object actual = null;
        if ("true".equals(value))
            actual = Boolean.valueOf(true);
        else if ("false".equals(value))
            actual = Boolean.valueOf(false);
        else if ("null".equals(value))
            actual = null;
        else throw new ParseException
                 (line, column, "Unknown value: " + value);
        return finish(stack, line, column, current, actual);
    }

    /**
     * Process JSON data from a reader  This method will
     * read all bytes in the reader.
     *
     * @throws IOException when something goes wrong with the Reader
     * @throws ParseException when input data is invalid
     * @param input Reader to convert to a data structure
     * @return An object representing the JSON stucture */
    public static Object parseJSON(Reader input)
        throws IOException, ParseException
    {
        ParseState state = ParseState.READY;
        Deque<Object> stack = new LinkedList<Object>();
        boolean inkey = false;
        int uhex = 0, uhex_count = 0;
        long line = 1, column = 0;
        int current, last = -1;
        StringBuilder value = new StringBuilder();

        while ((current = input.read()) >= 0) {
            switch (state) {
            case READY:
                if (Character.isWhitespace(current))
                    break;
                if (current == '[') {
                    stack.push(new ArrayList<Object>());
                } else if (current == ']') {
                    if (!(stack.peekLast() instanceof List))
                        throw new ParseException
                            (line, column, "Invalid list termination");
                    finish(stack, line, column, current,
                           ((List<Object>)stack.pop()));
                } else if (current == '{') {
                    stack.push(new LinkedHashMap<String, Object>());
                    state = ParseState.OBJECT_PREKEY;
                } else if (current == '}') {
                    throw new ParseException
                        (line, column, "Invalid object termination");
                } else if (current == '"') {
                    state = ParseState.STRING;
                } else if ((current == '-') ||
                           ((current >= '0') && (current <= '9'))) {
                    value.append(Character.toChars(current));
                    state = ParseState.NUMBER;
                } else {
                    value.append(Character.toChars(current));
                    state = ParseState.VALUE;
                }
                break;
            case STRING: // Quoted text
                if (current == '"') {
                    if (inkey) {
                        stack.push(value.toString());
                        inkey = false;
                        state = ParseState.OBJECT_POSTKEY;
                    } else state = finish(stack, line, column, current,
                                          value.toString());
                    value = new StringBuilder();
                } else if (current == '\\')
                    state = ParseState.ESCAPE;
                else value.append(Character.toChars(current));
                break;
            case ESCAPE: // Special characters within strings
                state = ParseState.STRING;
                if (current == 'u') {
                    uhex = uhex_count = 0;
                    state = ParseState.UHEX;
                } else if (current == '"') value.append('"');
                else if (current == '\\') value.append('\\');
                else if (current == '/')  value.append('/');
                else if (current == 'b')  value.append('\b');
                else if (current == 'f')  value.append('\f');
                else if (current == 'n')  value.append('\n');
                else if (current == 'r')  value.append('\r');
                else if (current == 't')  value.append('\t');
                else throw new ParseException
                         (line, column, "Unrecognized escape sequence");
                break;
            case UHEX: // Generic unicode escape sequence
                ++uhex_count;
                if ((current >= '0') && (current <= '9'))
                    uhex = (uhex << 4) | (current - '0');
                else if ((current >= 'a') && (current <= 'f'))
                    uhex = (uhex << 4) | (current - 'a' + 10);
                else if ((current >= 'A') && (current <= 'F'))
                    uhex = (uhex << 4) | (current - 'A' + 10);
                else throw new ParseException
                         (line, column, "Unrecognized hex character: " +
                          Character.toChars(current));
                if (uhex_count >= 4) {
                    value.append(Character.toChars(uhex));
                    state = ParseState.STRING;
                }
                break;
            case VALUE:
                if (Character.isWhitespace(current) ||
                    (current == ']') || (current == '}') ||
                    (current == ',')) {
                    state = finishValue
                        (stack, line, column, current,
                         value.toString());
                    value = new StringBuilder();
                } else value.append(Character.toChars(current));
                break;
            case NUMBER: // Numeric value
                try {
                    if ((current == '-') || (current == '+') ||
                        (current == 'e') || (current == 'E') ||
                        (current == '.') ||
                        ((current >= '0') && (current <= '9')))
                        value.append(Character.toChars(current));
                    else if (Character.isWhitespace(current) ||
                             (current == ']') || (current == '}') ||
                             (current == ',')) {
                        state = finishNumber
                            (stack, line, column, current,
                             value.toString());
                        value = new StringBuilder();
                    } else throw new ParseException
                               (line, column,
                                "Unexpected number character: " +
                                new String(Character.toChars(current)));
                } catch (NumberFormatException ex) {
                    throw new ParseException
                        (line, column, "Invalid number: " + value, ex);
                }
                break;
            case ARRAY:
                if (current == ']') {
                    state = finish(stack, line, column, ' ',
                                   stack.pop());
                } else if (current == ',')
                    state = ParseState.READY;
                else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (line, column, "Expected ',' or ']' character");
                break;
            case OBJECT_PREKEY:
                if (current == '}') {
                    state = finish(stack, line, column, ' ',
                                   stack.pop());
                } else if (current == '\"') {
                    inkey = true;
                    state = ParseState.STRING;
                } else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (line, column, "Object key must be a string: " +
                         new String(Character.toChars(current)));
                break;
            case OBJECT_POSTKEY:
                if (current == ':') {
                    state = ParseState.READY;
                } else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (line, column, "Expected ':' character");
                break;
            case OBJECT_NEXT:
                if (current == '}') {
                    state = finish
                        (stack, line, column, ' ', stack.pop());
                } else if (current == ',') {
                    state = ParseState.OBJECT_PREKEY;
                } else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (line, column, "Expected ',' character");
                break;
            case DONE:
                if (!Character.isWhitespace(current))
                    throw new ParseException
                        (line, column, "Extraneous characters");
                break;
            default:
                throw new ParseException
                    (0, column, "Unknown state: " + state);
            }

            // Update position in file for more informative
            // exceptions.  To keep this up to date it's important
            // that the code above never skips it, for example by
            // using continue instead of break.  This is intended to
            // detect line endings regardless of Unix (\n), DOS (\r\n)
            // or MacOS (\r) style
            ++column;
            if ((current == '\n') || (current == '\r')) {
                column = 0;
                if ((current != '\n') || (last != '\r'))
                    ++line;
            }
            last = current;
        }

        switch (state) {
        case READY:
        case DONE:
            break;
        case NUMBER:
            try {
                finishNumber(stack, line, column, ' ',
                             value.toString());
            } catch (NumberFormatException ex) {
                throw new ParseException
                    (line, column, "Invalid number: " + value, ex);
            }
            break;
        case VALUE:
            finishValue(stack, line, column, ' ', value.toString());
            break;
        default:
            throw new ParseException
                (line, column, "Unterminated value");
        }
        if (stack.size() > 1)
            throw new ParseException
                (line, column, "Unterminated " +
                 ((stack.peekLast() instanceof List) ?
                  "array" : "object"));
        return stack.peekFirst();
    }

    /**
     * Process JSON data from a string.
     *
     * @throws IOException when something goes wrong with the Reader
     * @throws ParseException when input data is invalid
     * @param data String to convert to a data structure
     * @return An object representing the JSON stucture */
    public static Object parseJSON(String data)
        throws IOException, ParseException
    { return parseJSON(new StringReader(data)); }

    /**
     * Process JSON data from an input stream.  This method will
     * read all bytes in the stream until the end.
     *
     * @throws IOException when something goes wrong with the Reader
     * @throws ParseException when input data is invalid
     * @param data InputStream to convert to a data structure
     * @return An object representing the JSON stucture */
    public static Object parseJSON(InputStream data)
        throws IOException, ParseException
    { return parseJSON(new InputStreamReader(data)); }

    private static Writer doIndent(Writer out, int indent)
        throws IOException
    {
        for (int i = 0; i < indent; ++i)
            out.append(' ');
        return out;
    }

    /**
     * Converts a simple data structure to JSON.
     *
     * @throws IOException when Writer doesn't work
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @param indent Starting indentation (if negative no unnecessary
     *        white space will be added)
     * @param step Number of spaces to add at each indentation level
     * @param out Writer for output */
    public static void formatJSON
        (Object o, int indent, int step, Writer out)
        throws IOException
    {
        boolean first = true;
        if (indent < 0)
            step = 0;

        if (o instanceof List) {
            out.append("[");
            if ((((List)o).size() > 0) && (indent >= 0))
                doIndent(out.append('\n'), indent + step);
            for (Object oo : (List)o) {
                if (first)
                    first = false;
                else if (indent >= 0)
                    doIndent(out.append(",\n"), indent + step);
                else out.append(',');
                formatJSON(oo, indent + step, step, out);
            }
            if ((((List)o).size() > 0) && (indent >= 0))
                doIndent(out.append('\n'), indent);
            out.append("]");
        } else if (o instanceof Map) {
            out.append("{");
            if ((((Map)o).size() > 0) && (indent >= 0))
                doIndent(out.append('\n'), indent + step);
            for (String key : ((Map<String, Object>)o).keySet()) {
                if (first)
                    first = false;
                else if (indent >= 0)
                    doIndent(out.append(",\n"), indent + step);
                else out.append(',');
                out.append('"');
                out.append(key);
                out.append('"');
                out.append((indent >= 0) ? ": " : ":");
                formatJSON(((Map<String, Object>)o).get(key),
                           indent + step, step, out);
            }
            if ((((Map)o).size() > 0) && (indent >= 0))
                doIndent(out.append('\n'), indent);
            out.append("}");
        } else if (o instanceof String) {
            out.append('"');
            for (int current : ((String)o).toCharArray())
                if (current == '\"')
                    out.append("\\\"");
                else if (current == '\\')
                    out.append("\\\\");
                //else if (current == '/')
                //    out.append("\\/");
                else if (current == '\b')
                    out.append("\\b");
                else if (current == '\f')
                    out.append("\\f");
                else if (current == '\n')
                    out.append("\\n");
                else if (current == '\r')
                    out.append("\\r");
                else if (current == '\t')
                    out.append("\\t");
                else out.append(new String(Character.toChars(current)));
            out.append('"');
        } else if (o != null)
            out.append(o.toString());
        else out.append("null");
    }

    /**
     * Converts a simple data structure to JSON.
     *
     * @throws IOException when Writer doesn't work
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @param indent Starting indentation (if negative no unnecessary
     *        white space will be added)
     * @param out Writer for output */
    public static void formatJSON(Object o, int indent, Writer out)
        throws IOException
    { formatJSON(o, indent, 4, out); }

    /**
     * Converts a simple data structure to JSON.
     *
     * @throws IOException when Writer doesn't work
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @param out Writer for output */
    public static void formatJSON(Object o, Writer out)
        throws IOException
    { formatJSON(o, 0, out); }

    /**
     * Converts a simple data structure to a JSON string.
     *
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @param indent Starting indentation (if negative no unnecessary
     *        white space will be added)
     * @param step Number of spaces to add at each indentation level
     * @return String containing JSON data */
    public static String formatJSON(Object o, int indent, int step)
    {
        StringWriter out = new StringWriter();
        try { formatJSON(o, indent, step, out); }
        catch (IOException ex) { throw new RuntimeException(ex); }
        return out.toString();
    }

    /**
     * Converts a simple data structure to a JSON string.
     *
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @param indent Starting indentation (if negative no unnecessary
     *        white space will be added)
     * @return String containing JSON data */
    public static String formatJSON(Object o, int indent)
    { return formatJSON(o, indent, 4); }

    /**
     * Converts a simple data structure to a JSON string.
     *
     * @param o Object to convert, which must be composed of {@link
     *        java.util.Map}, {@link java.util.List}, {@link
     *        java.lang.String}, {@link java.lang.Boolean} or some
     *        numeric type
     * @return String containing JSON data */
    public static String formatJSON(Object o)
    { return formatJSON(o, -1); }


    /** <p>Finds a subset of an object</p>
     *
     *  <pre>
     *  Object o = Juju.parseJSON("{\"a\": {\"b\": {\"c\": 7}}}");
     *  System.out.println(Juju.lookupJSON(o, "a.b.c")); // 7
     *  </pre>
     *
     * @param o JSON object to examine
     * @param key period separated fields to dereference
     * @return value of the field described by key */
    public static Object lookupJSON(Object o, String key)
    {
        Deque<Object> stack = new LinkedList<Object>();
        ParseState state = ParseState.READY;
        int uhex = 0, uhex_count = 0;
        long column = 0;
        StringBuilder value = new StringBuilder();

        for (int current : key.toCharArray()) {
            switch (state) {
            case READY:
                if (current == '[')
                    state = ParseState.ARRAY;
                else if (current == '.')
                    throw new ParseException
                        (0, column, "Empty identifier");
                else if (current == '"')
                    throw new ParseException
                        (0, column, "String identifier");
                else if (current >= '0' && current <= '9')
                    throw new ParseException
                        (0, column, "Identifier begins with digit");
                else if (!Character.isWhitespace(current)) {
                    value.append(Character.toChars(current));
                    state = ParseState.VALUE;
                }
                break;
            case VALUE:
                if ((value.length() == 0) &&
                    (current >= '0' && current <= '9'))
                    throw new ParseException
                        (0, column, "Identifier begins with digit");

                if (current == '.')
                    if (value.length() > 0) {
                        stack.push(value.toString());
                        value = new StringBuilder();
                    } else throw new ParseException
                               (0, column,
                                "Empty identifier");
                else if (current == '[')
                    if (value.length() > 0) {
                        stack.push(value.toString());
                        value = new StringBuilder();
                        state = ParseState.ARRAY;
                    } else throw new ParseException
                             (0, column, "Empty identifier");
                else if (current == '"')
                    throw new ParseException
                        (0, column, "String identifier");
                else if (Character.isWhitespace(current))
                    state = ParseState.DONE;
                else value.append(Character.toChars(current));
                break;
            case DONE:
                if (current == '.')
                    state = ParseState.VALUE;
                else if (current == '[')
                    state = ParseState.ARRAY;
                else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (0, column, "Invalid identifier: " +
                         new String(Character.toChars(current)));
                break;
            case ARRAY:
                if (current == ']') {
                    state = ParseState.DONE;
                } else if (current == '"') {
                    state = ParseState.STRING;
                } else if (current >= '0' && current <= '9') {
                    value.append(Character.toChars(current));
                    state = ParseState.NUMBER;
                } else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (0, column, "Invalid array index: " +
                         Character.toChars(current));
                break;
            case ARRAY_DONE:
                if (current == ']')
                    state = ParseState.DONE;
                else if (!Character.isWhitespace(current))
                    throw new ParseException
                        (0, column, "Invalid array index: " +
                         Character.toChars(current));
                break;
            case NUMBER:
                if (current >= '0' && current <= '9') {
                    value.append(Character.toChars(current));
                    state = ParseState.NUMBER;
                } else if (current == ']') {
                    stack.push(Integer.parseInt(value.toString()));
                    value = new StringBuilder();
                    state = ParseState.DONE;
                } else if (Character.isWhitespace(current))
                    state = ParseState.ARRAY_DONE;
                else throw new ParseException
                           (0, column, "Invalid number: " +
                            Character.toChars(current));
                break;
            case STRING:
                if (current == '"') {
                    state = ParseState.ARRAY_DONE;
                    stack.push(value.toString());
                    value = new StringBuilder();
                } else if (current == '\\')
                    state = ParseState.ESCAPE;
                else value.append(Character.toChars(current));
                break;
            case ESCAPE:
                state = ParseState.STRING;
                if (current == 'u') {
                    uhex = uhex_count = 0;
                    state = ParseState.UHEX;
                } else if (current == '"') value.append('"');
                else if (current == '\\') value.append('\\');
                else if (current == '/')  value.append('/');
                else if (current == 'b')  value.append('\b');
                else if (current == 'f')  value.append('\f');
                else if (current == 'n')  value.append('\n');
                else if (current == 'r')  value.append('\r');
                else if (current == 't')  value.append('\t');
                else throw new ParseException
                         (0, column, "Unrecognized escape sequence");
                break;
            case UHEX:
                ++uhex_count;
                if ((current >= '0') && (current <= '9'))
                    uhex = (uhex << 4) | (current - '0');
                else if ((current >= 'a') && (current <= 'f'))
                    uhex = (uhex << 4) | (current - 'a' + 10);
                else if ((current >= 'A') && (current <= 'F'))
                    uhex = (uhex << 4) | (current - 'A' + 10);
                else throw new ParseException
                         (0, column, "Unrecognized hex character: " +
                          Character.toChars(current));
                if (uhex_count >= 4) {
                    value.append(Character.toChars(uhex));
                    state = ParseState.STRING;
                }
                break;
            default:
                throw new ParseException
                    (0, column, "Unknown state: " + state);
            }
            ++column;
        }

        switch (state) {
        case VALUE:
            stack.push(value.toString());
        case READY:
        case DONE:
            break;
        default:
            throw new ParseException(0, column, "Unterminated value");
        }

        Object result = o;
        while (stack.size() > 0) {
            Object index = stack.removeLast();
            if (index instanceof String) {
                if (!(result instanceof Map))
                    throw new ParseException
                        (0, column, "Given field \"" + index +
                         "\" for non-object: " + formatJSON(result));
                result = ((Map<String, Object>)result).get
                    ((String)index);
            } else {
                if (!(result instanceof List))
                    throw new ParseException
                        (0, column, "Given index " + index +
                         " for non-list: " + formatJSON(result));
                result = ((List<Object>)result).get((Integer)index);
            }
        }
        return result;
    }

    private static void show(Object o) throws Exception
    {
        System.out.println
            ("Result(" +
             ((o != null) ? o.getClass().getName() : "null") + "):");
        PrintWriter out = new PrintWriter(System.out);
        formatJSON(o, out);
        out.append('\n');
        out.flush();
    }

    /**
     * Description for automated usage message.
     * @return description of the {@link #main} method of this class */
    public static java.lang.String usageLine()
    { return "Parses JSON and performs lookups."; }

    /**
     * Performs a parsing test to validate this library.
     * @return true iff test was successful
     * @throws Exception anything can happen */
    public static boolean test() throws Exception
    {
        boolean success = true;
        Map<String, Map<String, Object> > tests =
            new LinkedHashMap<String, Map<String, Object> >();

        Map<String, Object> subtests =
            new LinkedHashMap<String, Object>();
        subtests.put("a", 1234);
        subtests.put("b", "line\r\n");
        subtests.put("C[0]", 1);
        subtests.put("C[1]", 2);
        subtests.put("C[2]", 3);
        subtests.put("D[0]", 1);
        subtests.put("D[1]", 3);
        subtests.put("D[2]", 4);
        subtests.put("D[3].a", "qqq");
        subtests.put("D[3].b[0]", 4);
        subtests.put("D[4]", 5);
        tests.put("{ \"a\": 1234, \"b\"   :\"line\\r\\n\", " +
                  "\"C\" : [ 1, 2, 3 ],  \n\"D\": [1,3,4  , " +
                  "{\"a\": \"qqq\"  ," +
                  "\"b\": [4,4,4, {}, 5] } ,5]}", subtests);

        for (String json : tests.keySet()) {
            Object o = parseJSON(json);
            Map<String, Object> lookups = tests.get(json);
            for (String path : lookups.keySet()) {
                Object a = lookupJSON(o, path);
                if (!a.equals(lookups.get(path))) {
                    System.out.println
                        ("FAIL: expected " + lookups.get(path));
                    System.out.println
                        ("      received " + a);
                    success = false;
                }
            }
        }
        return success;
    }

    /**
     * A simple command line test program.  Provide a JSON object
     * on the standard input stream.  Each command line option is
     * interpreted as series of keys to lookup.
     *
     * <pre>
       $ java -jar `ls ripple-*.jar | tail -1` Juju \
          "[ null, false, true, 0, 2, 1024, 2.2, -22.01e2, 5.5e-3 ]" \
          '"R&#92;u00e9sum&#92;u00E9"'
       $ cat &lt;&lt;EOF | java -jar `ls ripple-*.jar | tail -1` Juju
       { "a": 1234, "b"   :"line\r\n", "C" : [ 1, 2, 3 ],
         "D": [1,3,4  , {"a": "qqq"  ,"b": [4,4,4, {}, 5] } ,5]}
       EOF
       </pre>
     *
     * @throws Exception Anything can happen.
     * @param args JSON strings to parse */
    public static void main(String[] args) throws Exception {
        Object o = Juju.parseJSON(System.in);
        show(o);
        for (String arg : args)
            show(Juju.lookupJSON(o, arg));
    }
}
