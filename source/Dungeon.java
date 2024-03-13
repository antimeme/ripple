// Dungeon.java
// Copyright (C) 2024 by Jeff Gold.
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
package net.antimeme.dungeon.Dungeon;
import net.antimeme.ripple.Camera;
import java.util.Map;
import java.util.TreeMap;
import java.util.Random;
import java.util.function.BiConsumer;
import java.awt.Dimension;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Point;
import java.awt.event.KeyEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.geom.Arc2D;
import java.awt.geom.Rectangle2D;

/**
 * A simplistic example of a dungeon crawling rogue-like game. */
public class Dungeon extends Camera.Application {

    protected static Random random = new Random();
    protected static final Color colorPlayer = new Color(128, 128, 248);
    protected static final Color colorPlayerInner =
        new Color(64, 64, 192);
    protected static final Color colorVoid  = new Color(16, 16, 16);
    protected static final Color colorWall  = new Color(144, 144, 192);
    protected static final Color colorFloor = new Color(32, 32, 64);
    protected static final Color colorGrid  = new Color(128, 128, 128);

    protected static final int cellSize = 25;
    protected boolean showGrid = false;
    protected Dimension bounds = null;
    protected Font fontBase = null;
    protected Font font = null;
    protected Camera.Point playerPosition = new Camera.Point(0, 0);
    protected Camera.Point playerDest = null;
    protected long         playerPhase = 0;
    protected Camera.Point markDest = null;
    protected boolean moveUp    = false;
    protected boolean moveDown  = false;
    protected boolean moveRight = false;
    protected boolean moveLeft  = false;

    /**
     * Reversable transformation from a pair ofw positive integers to a
     * single positive integer.
     *     http://szudzik.com/ElegantPairing.pdf */
    protected int pair(int x, int y)
    { return (x >= y) ? x * x + x + y :  y * y + x; }

    /**
     * Reversable transformation from a pair ofw positive integers to a
     * single positive integer.
     *     http://szudzik.com/ElegantPairing.pdf */
    protected Point unpair(int z) {
        final int rz = (int)Math.floor(Math.sqrt(z));
        return (z - rz * rz < rz) ?
            new Point(z - rz * rz, rz) :
            new Point(rz, z - rz * rz - rz);
    }

    protected static int getGridRow(Camera.Point point)
    {
        return (int)Math.floor((point.y + cellSize / 2) / cellSize);
    }

    protected static int getGridColumn(Camera.Point point)
    {
        return (int)Math.floor((point.x + cellSize / 2) / cellSize);
    }

    /**
     * Given row and column numbers, return the coordinates of the
     * square grid cell containing that point.
     * @param row vertical position of the cell in the grid
     * @param col horizontal position of the cell in the grid
     * @return rectangle representing the selected grid cell */
    protected static Rectangle2D getGridCell(int row, int col)
    {
        return new Rectangle2D.Float(cellSize * (col * 2 - 1) / 2,
                                     cellSize * (row * 2 - 1) / 2,
                                     cellSize, cellSize);
    }

    /**
     * Given a point in world space, return the coordinates of the
     * square grid cell containing that point.
     * @param point location in world space to consider
     * @return rectangle representing the selected grid cell */
    protected static Rectangle2D getGridCell(Camera.Point point)
    {
        return getGridCell(getGridRow(point), getGridColumn(point));
    }

    protected static Camera.Point getGridCenter(Rectangle2D cell) {
        return new Camera.Point
            ((float)(cell.getX() + cell.getWidth() / 2),
             (float)(cell.getY() + cell.getHeight() / 2));
    }

    /**
     * Calls a specified function for each grid cell covered by
     * a rectangle.
     * @param area specifies location of grid cells to map
     * @param fn function to call for each grid cell in area */
    protected void gridMapArea
        (Camera.Point start, Camera.Point end,
         BiConsumer<Integer, Integer> fn)
    {
        int rowStart = getGridRow(start);
        int rowEnd = getGridRow(end);
        if (rowStart > rowEnd) {
            int temp = rowStart;
            rowStart = rowEnd;
            rowEnd   = temp;
        }
        int colStart = getGridColumn(start);
        int colEnd = getGridColumn(end);
        if (colStart > colEnd) {
            int temp = colStart;
            colStart = colEnd;
            colEnd   = temp;
        }

        for (int row = rowStart; row <= rowEnd; ++row)
            for (int col = colStart; col <= colEnd; ++col)
                fn.accept(row, col);
    }

    protected static class Room {
        int size;
        int row;
        int col;

        int top;
        int bottom;
        int left;
        int right;

        int topDoor;
        int bottomDoor;
        int leftDoor;
        int rightDoor;

        public Room(int size, int row, int col) {
            final int chunk = size / 4;
            top = (int)(chunk + random.nextInt(size / 8));
            bottom = (int)(chunk + random.nextInt(size / 8));
            left = (int)(chunk + random.nextInt(size / 8));
            right = (int)(chunk + random.nextInt(size / 8));

            final int width = left + right;
            topDoor = (int)(random.nextInt(width * 3 / 4) -
                            width * 3 / 8);
            bottomDoor = (int)(random.nextInt(width * 3 / 4) -
                               width * 3 / 8);
            final int height = top + bottom;
            leftDoor = (int)(random.nextInt(height * 3 / 4) -
                             height * 3 / 8);
            rightDoor = (int)(random.nextInt(height * 3 / 4) -
                              height * 3 / 8);

            this.size = size;
            this.row = row;
            this.col = col;
        }

        public void draw(Graphics2D gfx, int cellSize) {
            AffineTransform saved = gfx.getTransform();
            gfx.scale(cellSize, cellSize);
            gfx.translate(row * size, col * size);

            gfx.setColor(colorWall);
            gfx.fill(new Rectangle2D.Float
                     (-(left * 2 + 1) / 2f, -(bottom * 2 + 1) / 2f,
                      (left + right + 1), (top + bottom + 1)));
            gfx.setColor(colorFloor);
            gfx.fill(new Rectangle2D.Float
                     (-(left * 2 - 1) / 2f, -(bottom * 2 - 1) / 2f,
                      (left + right - 1), (top + bottom - 1)));
            gfx.fill(new Rectangle2D.Float
                     ((topDoor * 2 - 1) / 2f,
                      (top * 2 - 1) / 2f, 1, size / 2 - top));
            gfx.fill(new Rectangle2D.Float
                     ((bottomDoor * 2 - 1) / 2f,
                      -(size + 1) / 2f, 1,
                      size / 2 - bottom + 1));
            gfx.fill(new Rectangle2D.Float
                     ((right * 2 - 1) / 2f,
                      (rightDoor * 2 - 1) / 2f,
                      size / 2 - right, 1));
            gfx.fill(new Rectangle2D.Float
                     (-(size + 1) / 2f,
                      (leftDoor * 2 - 1) / 2f,
                      size / 2 - left + 1, 1));
            gfx.setTransform(saved);
        }
    }
    protected Map<Integer, Room> rooms = new TreeMap<Integer, Room>();

    protected void drawPlayer(Graphics2D gfx) {

        gfx.setColor(colorPlayer);
        gfx.fill(new Arc2D.Float(playerPosition.x - 10,
                                 playerPosition.y - 10,
                                 20f, 20f, 0f, 360f, Arc2D.PIE));
        float radius = (float)
            (5 + 3 * Math.cos((float)(playerPhase - 2500) / 2500));
        gfx.setColor(colorPlayerInner);
        gfx.fill(new Arc2D.Float((playerPosition.x - radius),
                                 (playerPosition.y - radius),
                                 (2 * radius), (2 * radius),
                                 0f, 360f, Arc2D.PIE));
    }

    @Override
    public boolean useAutoZoom() { return true; }
    @Override
    public float getMinZoom() { return cellSize; }
    @Override
    public float getMaxZoom() { return 25 * cellSize; }

    @Override
    public void init(Camera camera) {
        showGrid = Boolean.getBoolean("dungeon.showgrid");

        fontBase = new Font("Arial", Font.PLAIN, 36);
        camera.setScale(cellSize * 10);

        for (int ii = 0; ii < 3; ++ii)
            for (int jj = 0; jj < 3; ++jj)
                rooms.put(pair(ii, jj), new Room(32, ii - 1, jj - 1));
    }

    @Override
    public void drawBefore(Camera camera, Graphics2D gfx) {
        gfx.setColor(colorVoid);
        gfx.fillRect(0, 0, bounds.width, bounds.height);
    }

    @Override
    public void drawAfter(Camera camera, Graphics2D gfx) {
        FontMetrics fm = null;
        String message = "Dungeon";

        gfx.setColor(colorPlayer);
        gfx.setFont(font);
        fm = gfx.getFontMetrics();
        gfx.drawString
            (message, (bounds.width - fm.stringWidth(message)) / 2,
             fm.getAscent());
    }

    @Override
    public void draw(Camera camera, Graphics2D gfx) {
        for (Map.Entry<Integer, Room> entry : rooms.entrySet())
            entry.getValue().draw(gfx, cellSize);

        if (showGrid) {
            gfx.setColor(colorGrid);
            gridMapArea
                (camera.toWorld(new Camera.Point(0, bounds.height)),
                 camera.toWorld(new Camera.Point(bounds.width, 0)),
                 (row, col) -> gfx.draw(getGridCell(row, col)));
        }

        if (markDest != null) {
            gfx.setColor(colorPlayerInner);
            gfx.fill(getGridCell(markDest));
        }
        drawPlayer(gfx);
    }

    protected long reportTimer = 0;

    @Override
    public void update(Camera camera, long elapsed) {
        playerPhase += elapsed;
        playerPhase %= 5000;

        reportTimer += elapsed;
        if (reportTimer > 1000) {
            //System.out.println("PLAYER: " + playerPosition);
            //System.out.println("CAMERA: " + camera.getPosition());
            reportTimer = 0;
        }

        if (moveUp && moveDown) {
        } else if (moveUp) {
            playerDest = getGridCenter(getGridCell(playerPosition))
                .translate(0, cellSize);
        } else if (moveDown) {
            playerDest = getGridCenter(getGridCell(playerPosition))
                .translate(0, -cellSize);
        } else if (moveUp && moveDown) {
        } else if (moveLeft) {
            playerDest = getGridCenter(getGridCell(playerPosition))
                .translate(-cellSize, 0);
        } else if (moveRight) {
            playerDest = getGridCenter(getGridCell(playerPosition))
                .translate(cellSize, 0);
        }

        if (playerDest != null) {
            if (playerDest.difference
                (playerPosition).quadrance() < 5) {
                playerPosition = playerDest;
                playerDest = markDest = null;
            } else playerPosition = playerPosition.translate
                       (playerDest.difference
                        (playerPosition).normalize());
            camera.setPosition(playerPosition);
        }
    }

    @Override
    public void mousePressed(Camera camera, MouseEvent event) {
        if (event.getButton() == event.BUTTON1) {
            Camera.Point click = camera.toWorld
                (new Camera.Point(event.getX(), event.getY()));
            markDest = playerDest = getGridCenter(getGridCell(click));
        }
    }

    @Override
    public void keyPressed(Camera camera, KeyEvent event) {
        switch (event.getKeyCode()) {
        case KeyEvent.VK_UP:
        case KeyEvent.VK_W:
            moveUp = true;
            break;
        case KeyEvent.VK_LEFT:
        case KeyEvent.VK_A:
            moveLeft = true;
            break;
        case KeyEvent.VK_RIGHT:
        case KeyEvent.VK_D:
            moveRight = true;
            break;
        case KeyEvent.VK_DOWN:
        case KeyEvent.VK_S:
            moveDown = true;
            break;
        case KeyEvent.VK_SPACE:
            /* TODO */
            break;
        }
    }

    @Override
    public void keyReleased(Camera camera, KeyEvent event) {
        switch (event.getKeyCode()) {
        case KeyEvent.VK_UP:
        case KeyEvent.VK_W:
            moveUp = false;
            break;
        case KeyEvent.VK_LEFT:
        case KeyEvent.VK_A:
            moveLeft = false;
            break;
        case KeyEvent.VK_RIGHT:
        case KeyEvent.VK_D:
            moveRight = false;
            break;
        case KeyEvent.VK_DOWN:
        case KeyEvent.VK_S:
            moveDown = false;
            break;
        case KeyEvent.VK_SPACE:
            /* TODO */
            break;
        }
    }

    @Override
    public void resize(Camera camera, Dimension size) {
        bounds = size;
        font = fontBase.deriveFont
            ((float)Math.min(size.width, size.height) / 17);
    }

    public static void main(String[] args)
    { new Camera(640, 480).manage(new Dungeon()); }
}
