package net.esclat.jarbles.abalone;
import net.esclat.jarbles.abalone.GraphicPlayer;
import java.awt.*;
import java.awt.event.*;

public class Aqua extends GraphicPlayer.Theme {
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

    public static void main(String args[]) {
	// Parse command line arguments.
	long    time = 0;
	boolean duel = true;
	boolean anim = true;
	for (int argc = 0; argc < args.length; argc++) {
	    if (args[argc].equals("single"))
		duel = false;
	    else if (args[argc].equals("noduel"))
		duel = false;
	    else if (args[argc].equals("animate"))
		anim = true;
	    else if (args[argc].equals("quick"))
		anim = false;
	    else try {
		int timeArg = new Integer(args[argc]).intValue();
		time = Math.max(timeArg * 1000, 0);
	    } catch (NumberFormatException nfe) {}
	} // for argc

        Aqua aqua = new Aqua();
	GraphicPlayer gpb = new GraphicPlayer(aqua);	
	gpb.setAnimated(anim);
	gpb.startElapseThread();
	GraphicPlayer gpw;
	if (duel) { 
	    gpw = new GraphicPlayer(); 
	    gpw.setAnimated(anim); 
	    gpw.startElapseThread();
        } else gpw = gpb;

	Frame f = new Frame("GraphicPlayer Test");
	f.setLayout(new GridLayout());
	f.add(gpb);
        if (duel) 
            f.add(gpw);
	f.pack();
	f.setVisible(true);
	f.addWindowListener(new WindowAdapter() {
		public void windowClosing(WindowEvent e) { 
		    System.exit(0); 
		} // windowCloseing(WindowEvent)
	    }); // new WindowAdapter()
        
        Object status = Board.game(time, gpb, gpw);

	// Declare the winner, if any.
	String winner = "Neither player";
	if (status == Board.BLACK)
	    winner = "Black";
	else if (status == Board.WHITE)
	    winner = "White";
	System.out.println(winner + " wins.");
    }
}
