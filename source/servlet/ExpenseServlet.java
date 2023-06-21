package net.esclat.ripple.expense;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/expense")
public class ExpenseServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private static final String SETUP_SQL =
        "CREATE TABLE IF NOT EXISTS expenses (" +
        "  id INTEGER PRIMARY KEY," +
        "  reason TEXT NOT NULL," +
        "  amount REAL NOT NULL," +
        "  when TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";

    protected Connection conn = null;

    @Override
    public void init() throws ServletException {
        super.init();

        String dbPath = getServletContext().getInitParameter("dbPath");
        if (dbPath == null)
            dbPath = "expense.db";

        try {
            conn = DriverManager.getConnection("jdbc:sqlite:" + dbPath);

            conn.setAutoCommit(false);
            PreparedStatement pstmt = conn.prepareStatement(SETUP_SQL);
            pstmt.executeUpdate();
            conn.commit();
            conn.setAutoCommit(true);
        } catch (SQLException ex) {
            throw new ServletException("Error initializing database", ex);
        }
    }

    @Override
    protected void doGet(HttpServletRequest request,
                         HttpServletResponse response)
            throws ServletException, IOException {
        List<String> names = new ArrayList<>();
        try {
            PreparedStatement pstmt = conn.prepareStatement
                ("SELECT id, reason, amount, date FROM expenses;");
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                int        id = rs.getInt("id");
                float  amount = rs.getFloat("amount");
                String reason = rs.getString("reason");
                Date   when   = rs.getDate("date");
                names.add(reason);
            }
        } catch (SQLException e) {
            throw new ServletException("Error reading from database", e);
        }
        PrintWriter out = response.getWriter();
        response.setContentType("text/plain");
        for (String name : names) {
            out.println(name);
        }
    }

    @Override
    protected void doPost(HttpServletRequest request,
                          HttpServletResponse response)
        throws ServletException, IOException
    {
        String amount = request.getParameter("amount");
        String reason = request.getParameter("reason");
        try {
            PreparedStatement pstmt = conn.prepareStatement
            ("INSERT INTO expenses VALUES (?, ?);");
            pstmt.setString(1, amount);
            pstmt.setString(2, reason);
            pstmt.executeUpdate();
        } catch (SQLException e) {
            throw new ServletException("Error writing to database", e);
        }
        response.setStatus(HttpServletResponse.SC_CREATED);
    }
}
