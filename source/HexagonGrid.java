// HexGrid.java
// Copyright (C) 2006-2007 by Jeff Gold.
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
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
package net.antimeme.ripple;
import java.awt.Rectangle;
import java.awt.Point;

/** An abstaction for representing hexagonal grids. */
public class HexagonGrid {
    /**
     * Distance from the center to the closest point of any side
     * of an isometric unit hexagon. */
    public static final double PERPENDICULAR = Math.sqrt(3.0) / 2.0;
    private Point center;
    private int cellEdge; 
    private int gridEdge;

    /** Constructs a new hexagonal grid with degenerate dimensions.
     *  Calling any drawing operation before a call to reshape() has
     *  undefined results. */
    public HexagonGrid() {}

    /** Constructs a new hexagonal grid that draws in the
     *  specified area at the specified size.
     *
     *  @param target Indicates the dimensions of the drawing area.  A
     *  HexagonGrid is not responsible for enforcing this and may draw
     *  out of bounds if this is convenient for implementaiton.
     *  @param size Approximate number of pixels along each edge of
     *  the hexagon that delimits a cell.
     *  @param grid When true the size parameter is instead
     *  interpreted as the number of cells along each edge of a grid
     *  that must fit in the specified drawing area. */
    public HexagonGrid(Rectangle target, int size, boolean grid) {
        reshape(target, size, grid);
    }

    /**
     * Changes the dimensions for future drawing operations.
     *
     *  @param target Indicates the dimensions of the drawing area.  A
     *  HexagonGrid is not responsible for enforcing this and may draw
     *  out of bounds if this is convenient for implementaiton.
     *  @param size Approximate number of pixels along each edge of
     *  the hexagon that delimits a cell.
     *  @param grid When true the size parameter is instead
     *  interpreted as the number of cells along each edge of a grid
     *  that must fit in the specified drawing area. */
    public void reshape(Rectangle target, int size, boolean grid) {
        if (grid) {
            double adjHeight = PERPENDICULAR * ((4 * size) - 2);
            double adjWidth  = (3 * size - 1);	    

            // cross-multiply to determine maximum size
            if (target.width * adjWidth > target.height * adjHeight)
                cellEdge = (int)(target.height / adjWidth);
            else cellEdge = (int)(target.width / adjHeight);

            gridEdge = size;
        } else {
            gridEdge = 1;
            cellEdge = size;
        }
        center = new Point(target.x + target.width / 2,
                           target.y + target.height / 2);
    }

    /**
     * Returns the length of one hexagonal cell edge.
     * @return length of one hexagonal cell edge */
    public int getCellEdge() { return cellEdge; }

    /**
     * Returns the number of hexagons along each grid side.
     * @return number of hexagons along each grid side */
    public int getGridEdge() { return gridEdge; }

    /**
     * Determines the coordinates of the center for the specified
     * grid location.
     * @param row Row of the specified grid cell
     * @param col Column of the specified grid cell
     * @return coordinates of the center of the selected cell */
    public Point getGridPoint(int row, int col) {
        return new Point((int)(center.x + 
                               (cellEdge * PERPENDICULAR * 
                                ((2 * col) - row))),
                         (int)(center.y + 
                               (cellEdge * 3 * row / 2.0)));
    }

    /**
     * Represents a sinle cell in the grid */
    public static class Location {
        /** Vertical position in grid */
        public int row;

        /** Horizontal position in grid */
        public int col;

        /**
         * Create a new location at the center of the grid */
        public Location() { row = col = 0; }

        /**
         * Create a new location
         * @param r vertical position
         * @param c horizontal position */
        public Location(int r, int c) { row = r; col = c; }

        /**
         * Returns true iff object is equivalent to this
         * @param that object to compare
         * @return result of comparison */
        public boolean equals(Object that) {
            if (this == that)
                return true;
            if (that == null)
                return false;
            if (!that.getClass().equals(getClass()))
                return false;
	    
            Location t = (Location)that;
            if ((t.row == row) && (t.col == col))
                return true;
            return false;
        }
    }

    /**
     * Computes the row and column of the grid in which a given point
     * falls and returns a location object with this result.  Note
     * that the center point of HexagonGrid is location (0, 0) and
     * that the postive directions are to the right and down.
     *
     * @param p Coordinates from which to find a grid cell
     * @param clamp When true limits locations to the grid edge
     * @return representation of the grid cell containing the point */
    public Location getLocation(Point p, boolean clamp) {
        if (cellEdge <= 0) 
            return null;

        Location result = new Location();
        // Determine approximate row in which the point falls
        // by assuming flat horizontal bands.
        double roughRow = ((p.y - center.y) / 
                           (3 * cellEdge / 2.0)) + 0.5;
        result.row = (int)roughRow - ((roughRow >= 0) ? 0 : 1);
	
        // Determine approximate column in which the point falls
        // by assuming tilted vertical bands.
        double roughCol = ((p.x - center.x) / 
                           (2 * PERPENDICULAR * cellEdge)) +
            ((result.row + 1) / 2.0);
        result.col = (int)roughCol - ((roughCol >= 0) ? 0 : 1);

        // Correct the approximations so that they reflect actual
        // hexagon geometry.  There are four ways the bands could have
        // gone wrong, each amounts to a line intersection.  Instead
        // of doing the same operation four times the code below
        // collapses everything into one case and then works out the
        // adjustment based on which one is relevant using the sign of
        // the original values.
        Point gridp = getGridPoint(result.row, result.col);
        int x = p.x - gridp.x;
        int y = p.y - gridp.y;
        if (Math.abs(y) > cellEdge - 
            (Math.abs(x) / (2 * PERPENDICULAR))) {
            int adjust = (y >= 0) ? 1 : -1;
	    
            result.row += adjust;
            if ((x >= 0) == (y >= 0))
                result.col += adjust;
        }

        if (clamp) {
            if ((gridEdge <= Math.max(Math.abs(result.row), 
                                      Math.abs(result.col))) ||
                (gridEdge <= Math.abs(result.row - result.col)))
                result = null;
        }
        return result;
    }
    
    /**
     * Same as {@link #getLocation(Point, boolean)} but defaults
     * to unclamped.
     *
     * @param p Coordinates from which to find a grid cell
     * @return representation of the grid cell containing the point */
    public Location getLocation(Point p) {
        return getLocation(p, false);
    }    
}
