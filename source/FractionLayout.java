// FractionLayout.java
// Copyright (C) 2006-2011 by Jeff Gold.
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
// A layout manager that uses decimal fractions between zero and one
// to create sensible scaling behavior for a user interface container.
package net.esclat.ripple;
import java.util.ArrayList;
import java.util.StringTokenizer;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.Component;
import java.awt.Container;

// Dependencies needed only for module unit test.
import java.applet.Applet;
import java.awt.Button;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

/** Positions components according to proportional rules specified
 *  as numbers between zero and one.  */
public final class FractionLayout implements LayoutManager {
    private static class LayoutItem {
        float x, y, width, height;
        Component comp;
    }
    private ArrayList<LayoutItem> items = new ArrayList<LayoutItem>();

    private float getFraction(StringTokenizer tokens) {
        float value = 0.0f;
        if (tokens.hasMoreTokens()) {
            value = Float.valueOf(tokens.nextToken()).floatValue();
            if ((value <= 0.0) || (value > 1.0))
                throw new IllegalArgumentException("out of range");
        } else throw new IllegalArgumentException("invalid constraint");
        return value;
    }

    /** Layout specified component at fractional coordinates
     *  determined by the name string.  This should have the form
     *  "0.25 0.25 0.5 0.5" (this example would center the component
     *  at half the total size of the parent). */
    public void addLayoutComponent(String name, Component comp) {
        StringTokenizer tokens = new StringTokenizer(name);
        LayoutItem item = new LayoutItem();
        item.x      = getFraction(tokens);
        item.y      = getFraction(tokens);
        item.width  = getFraction(tokens);
        item.height = getFraction(tokens);
        item.comp   = comp;
        items.add(item);
    }

    public void layoutContainer(Container parent) {
        Dimension size = parent.getSize();
        Insets insets = parent.getInsets();
        int x, y, width, height;
        x = insets.left;
        y = insets.top;
        width  = size.width  - (insets.left + insets.right);
        height = size.height - (insets.top  + insets.bottom);

        for (LayoutItem item : items)
            item.comp.setBounds(x + (int)(width * item.x),
                                y + (int)(height * item.y),
                                (int)(width  * item.width),
                                (int)(height * item.height));
    }

    public Dimension minimumLayoutSize(Container parent) {
        Dimension parent_size = new Dimension(0, 0);
        for (LayoutItem item : items) {
            Dimension child_size = item.comp.getMinimumSize();

            child_size.width  /= item.width;
            child_size.height /= item.height;
            if (child_size.width > parent_size.width)
                parent_size.width = child_size.width;
            if (child_size.height > parent_size.height)
                parent_size.height = child_size.height;
        }

        Insets insets = parent.getInsets();
        parent_size.width  += insets.left + insets.right;
        parent_size.height += insets.top  + insets.bottom;
        return parent_size;
    }

    public Dimension preferredLayoutSize(Container parent) {
        Dimension parent_size = new Dimension(0, 0);
        for (LayoutItem item : items) {
            Dimension child_size = item.comp.getPreferredSize();

            child_size.width  /= item.width;
            child_size.height /= item.height;
            if (child_size.width > parent_size.width)
                parent_size.width = child_size.width;
            if (child_size.height > parent_size.height)
                parent_size.height = child_size.height;
        }

        Insets insets = parent.getInsets();
        parent_size.width  += insets.left + insets.right;
        parent_size.height += insets.top  + insets.bottom;
        return parent_size;
    }

    public void removeLayoutComponent(Component comp) {
        LayoutItem target = null;
        for (LayoutItem defendant : items)
            if (defendant.comp == comp) {
                target = defendant;
                break;
            }
        items.remove(target);
    }

    public static void main(String args[]) throws Exception {
        Applet a = new Applet();
        a.setLayout(new FractionLayout());
        a.add(new Button("one"), "0.05 0.05 0.4 0.4");
        a.add(new Button("two"), "0.5 0.5 0.25 0.25");
        Standalone.app(a, "FractionLayout", args).joinQuit(0);
    }
}
