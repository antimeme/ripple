package net.esclat.ripple.expense;
// Inspired by
// https://github.com/hadisfr/TomcatSQLite/blob/master/src/main/java/Srvlt.java

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.DriverManager;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

@WebServlet("/expense")
public class ExpenseServlet extends HttpServlet {
    Connection connection = null;

    @Override
    public void init() throws ServletException {
        String dbPath = getServletContext().getInitParameter("dbPath");
        String jdbcUrl = "jdbc:sqlite:" + dbPath;
        try {
            Class.forName("org.sqlite.JDBC");
            connection = DriverManager.getConnection(jdbcUrl);

            // TODO: create tables
            Statement statement = connection.createStatement();
            statement.setQueryTimeout(30);  // set timeout to 30 sec.
            statement.executeUpdate
                ("CREATE TABLE IF NOT EXISTS expenses (" +
                 "  id INTEGER PRIMARY KEY," +
                 "  reason TEXT NOT NULL," +
                 "  amount REAL NOT NULL," +
                 "  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);");
            connection.setAutoCommit(false);

            try {
                PreparedStatement insertStatement =
                    connection.prepareStatement
                    ("INSERT INTO expenses (reason, amount) " +
                     "VALUES(?, ?)");
                insertStatement.setString(1, "Soapy Sponges");
                insertStatement.setFloat(2, 5.99f);
                insertStatement.executeUpdate();
                insertStatement.setString(1, "Silky Sponges");
                insertStatement.setFloat(2, 6.99f);
                insertStatement.executeUpdate();
                connection.commit();
            } catch (SQLException ex) {
                connection.rollback();
                throw new ServletException
                    ("Failed to initialize database", ex);
            }

            connection.setAutoCommit(true);
        } catch (SQLException | ClassNotFoundException ex) {
            throw new ServletException("Failed to create database", ex);
        }
    }

    @Override
    public void destroy() {
        try {
            if (connection != null)
                connection.close();
        } catch (SQLException ex) { /* TODO: log this */ }
    }

    @Override
    protected void doGet(HttpServletRequest request,
                         HttpServletResponse response)
        throws ServletException, IOException {
        try {
            Statement statement = connection.createStatement();
            statement.setQueryTimeout(30);

            ResultSet rs = statement.executeQuery
                ("SELECT reason, amount FROM expenses;");
            while (rs.next()) {
                // read the result set
                response.getWriter().write
                    ("reason = " + rs.getString("name"));
                response.getWriter().write(", ");
                response.getWriter().write
                    ("amount = " + rs.getFloat("id"));
                response.getWriter().write("\n");
            }
        } catch (SQLException ex) {
            response.getWriter().write(ex.getMessage());
        }
    }
}
