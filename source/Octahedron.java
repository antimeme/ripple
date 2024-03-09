// Octahedron.java
// Copyright (C) 2010-2024 by Jeff Gold
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
import java.awt.Graphics;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FontMetrics;

/**
 * An experiment that draws an octahedral net. */
public class Octahedron extends net.antimeme.ripple.Applet {
    /** Ratio between height of center and edge length */
    private final double height_factor = Math.sqrt(3) / 2;

    private void drawTriangle(Graphics g, int depth, int x1, int y1,
                              int x2, int y2, int x3, int y3) {
        if (depth > 0) {
            drawTriangle(g, depth - 1,
                         (x1 + x2) / 2, (y1 + y2) / 2,
                         (x2 + x3) / 2, (y2 + y3) / 2,
                         (x3 + x1) / 2, (y3 + y1) / 2);
            drawTriangle(g, depth - 1, x1, y1,
                         (x1 + x2) / 2, (y1 + y2) / 2,
                         (x1 + x3) / 2, (y1 + y3) / 2);
            drawTriangle(g, depth - 1, x2, y2,
                         (x2 + x1) / 2, (y2 + y1) / 2,
                         (x2 + x3) / 2, (y2 + y3) / 2);
            drawTriangle(g, depth - 1, x3, y3,
                         (x3 + x2) / 2, (y3 + y2) / 2,
                         (x3 + x1) / 2, (y3 + y1) / 2);
        } else {
            g.drawLine(x1, y1, x2, y2);
            g.drawLine(x2, y2, x3, y3);
            g.drawLine(x3, y3, x1, y1);
        }
    }

    public Dimension getPreferredSize()
    { return new Dimension(320, 240); }

    public void paint(Graphics g) {
        int size, offx = 0, offy = 0;
        Dimension d = getSize();
        if (d.width > d.height) {
            size = d.height;
            offx = (d.width - d.height) / 2;
        } else { size = d.width; offy = (d.height - d.width) / 2; }
        g.setColor(Color.gray);
        g.fillRect(offx, offy, size, size);

        FontMetrics fm = g.getFontMetrics();
        String s = "Size: " + d.width + ", " + d.height;
        g.setColor(Color.black);
        g.drawString(s, (d.width - fm.stringWidth(s)) / 2,
                     fm.getHeight());

        int depth = 0;
        String depth_value = getParameter("depth");
        if (depth_value != null)
            depth = Integer.parseInt(depth_value);

        int side = (int)(size / 3.5);
        int height = (int)(height_factor * side);
        g.setColor(Color.green);
        drawTriangle(g, depth,
                     offx + size / 2, offy + (size - height) / 2,
                     offx + (size - side) / 2,
                     offy + (size + height) / 2,
                     offx + (size + side) / 2,
                     offy + (size + height) / 2);
        g.setColor(Color.red);
        drawTriangle(g, depth,
                     offx + size / 2,
                     offy + (size + (3 * height)) / 2,
                     offx + (size - side) / 2,
                     offy + (size + height) / 2,
                     offx + (size + side) / 2,
                     offy + (size + height) / 2);
        g.setColor(Color.blue);
        drawTriangle(g, depth,
                     offx + size / 2,
                     offy + (size + (3 * height)) / 2,
                     offx + (size - side) / 2,
                     offy + (size + height) / 2,
                     offx + (size - (2 * side)) / 2,
                     offy + (size + (3 * height)) / 2);
        g.setColor(Color.magenta);
        drawTriangle(g, depth,
                     offx + size / 2, offy + (size - height) / 2,
                     offx + (size - side) / 2,
                     offy + (size + height) / 2,
                     offx - side + size / 2,
                     offy + (size - height) / 2);
        g.setColor(Color.red);
        drawTriangle(g, depth,
                     offx + size / 2, offy + (size - height) / 2,
                     offx + side + size / 2,
                     offy + (size - height) / 2,
                     offx + (size + side) / 2,
                     offy + (size + height) / 2);
        g.setColor(Color.blue);
        drawTriangle(g, depth,
                     offx + size / 2, offy + (size - height) / 2,
                     offx + side + size / 2,
                     offy + (size - height) / 2,
                     offx + (size + side) / 2,
                     offy + (size - (3 * height)) / 2);
        g.setColor(Color.green);
        drawTriangle(g, depth,
                     offx + (3 * side + size) / 2,
                     offy + (size - (3 * height)) / 2,
                     offx + side + size / 2,
                     offy + (size - height) / 2,
                     offx + (size + side) / 2,
                     offy + (size - (3 * height)) / 2);
        g.setColor(Color.magenta);
        drawTriangle(g, depth,
                     offx + (3 * side + size) / 2,
                     offy + (size + height) / 2,
                     offx + side + size / 2,
                     offy + (size - height) / 2,
                     offx + (size + side) / 2,
                     offy + (size + height) / 2);
    }

    /**
     * Entry point for a simple test application.
     * @param args command line arguments
     * @throws Exception anything can happen */
    public static void main(String[] args) throws Exception
    { new Octahedron().standalone(args); }
}
