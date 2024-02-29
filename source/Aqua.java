package net.antimeme.jarbles.abalone;
import net.antimeme.jarbles.abalone.GraphicPlayer;
import java.awt.*;
import java.awt.event.*;

/**
 * A bluish theme for Jarbles. */
public class Aqua extends GraphicPlayer.Theme {
    /**
     * Provides the theme name.
     * @return the name of this theme */
    public static String getName() { return "Aqua"; }

    /**
     * Constructs an instance of the Aqua theme. */
    public Aqua() {
        lineOne = "Aqua Jarbles";
        lineTwo = "by Jeff Gold";
        background    = new Color(80, 80, 240);
        cellHighOuter = Color.black;
        cellLowOuter  = Color.white;
        cellLowInner  = Color.cyan;
        cellHighInner = Color.cyan;

        pieceBlack = new Color(0, 0, 240);
        upperBlack = Color.white;
        lowerBlack = Color.black;

        pieceWhite = new Color(180, 180, 240);
        upperWhite = Color.white;
        lowerWhite = Color.black;

        scoreBacking  = new Color(20, 20, 80);
        scoreText     = Color.cyan;
    }
    
    protected void drawCell(Graphics g, Point p, int size) {
        double adjSize = (int)(size * cellAdjust);
        int radius;
        
        // draw the outer shell
        radius = (int)adjSize;
        g.setColor(Color.blue);
        g.fillOval(p.x - radius, p.y - radius, 2 * radius, 2 * radius);

        radius = (int)(9 * adjSize / 10);
        g.setColor(Color.cyan); 
        g.fillOval(p.x - radius, p.y - radius, 2 * radius, 2 * radius);
    }
}
