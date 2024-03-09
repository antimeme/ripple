package net.antimeme.ripple.expense;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.exc.InvalidDefinitionException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;

@WebServlet("/expense/*")
public class ExpenseServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    protected static final String SQL_SETUP =
        "CREATE TABLE IF NOT EXISTS expenses (" +
        "  id INTEGER PRIMARY KEY," +
        "  reason TEXT NOT NULL," +
        "  amount REAL NOT NULL," +
        "  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";
    protected ObjectMapper mapper = new ObjectMapper();
    protected DataSource ds = null;

    public static class Expense {
        protected int id;
        public int getId() { return id; }
        public void setId(int value) { id = value; }

        protected String reason;
        public String getReason() { return reason; }
        public void setReason(String value) { reason = value; }

        protected float amount;
        public float getAmount() { return amount; }
        public void setAmount(float value) { amount = value; }

        protected Date date;
        public Date getDate() { return date; }
        public void setDate(Date value) { date = value; }

        protected String[] tags;
        public String[] getTags() { return tags; }
        public void setTags(String[] value) { tags = value; }
        public void setTagsList(List<String> value)
        { setTags(value.toArray(new String[value.size()])); }
    }

    public static class ExpenseList {
        protected Expense[] expenses;
        public Expense[] getExpenses() { return expenses; }
        public void setExpenses(Expense[] value) { expenses = value; }
        public void setExpensesList(List<Expense> value)
        { setExpenses(value.toArray(new Expense[value.size()])); }
    }

    @Override
    public void init() throws ServletException {
        super.init();
        try {
            Context ctx = new InitialContext();
            ds = (DataSource)ctx.lookup("java:comp/env/jdbc/ExpenseDB");

            Connection conn = ds.getConnection();
            conn.setAutoCommit(false);

            PreparedStatement pstmt = conn.prepareStatement(SQL_SETUP);
            pstmt.executeUpdate();

            conn.commit();
            conn.setAutoCommit(true);
        } catch (NamingException ex) { throw new ServletException(ex);
        } catch (SQLException ex) { throw new ServletException(ex); }
    }

    @Override
    protected void doGet(HttpServletRequest request,
                         HttpServletResponse response)
            throws ServletException, IOException {
        String path = request.getPathInfo();

        if ((path != null) && path.equals("/list")) {
            try {
                ArrayList<Expense> list = new ArrayList<Expense>();
                Connection conn = ds.getConnection();
                PreparedStatement pstmt = conn.prepareStatement
                    ("SELECT id, reason, amount, date FROM expenses;");
                ResultSet rs = pstmt.executeQuery();

                while (rs.next()) {
                    Expense exp = new Expense();
                    exp.id     = rs.getInt("id");
                    exp.amount = rs.getFloat("amount");
                    exp.reason = rs.getString("reason");
                    exp.date  = rs.getDate("date");
                    list.add(exp);
                }

                ExpenseList elist = new ExpenseList();
                elist.setExpensesList(list);

                PrintWriter out = response.getWriter();
                out.println(mapper.writeValueAsString(elist));
                response.setContentType("application/json");
            } catch (SQLException ex) {
                throw new ServletException(ex);
            }
        } else response.sendError(response.SC_NOT_FOUND);
    }

    @Override
    protected void doPost(HttpServletRequest request,
                          HttpServletResponse response)
        throws ServletException, IOException
    {
        String path = request.getPathInfo();

        if ((path != null) && path.equals("/add")) {
            try {
                StringBuilder sb = new StringBuilder();
                BufferedReader reader = request.getReader();
                String line;
                while ((line = reader.readLine()) != null)
                    sb.append(line);
                Expense target = mapper.readValue
                    (sb.toString(), Expense.class);

                Connection conn = ds.getConnection();
                PreparedStatement pstmt = conn.prepareStatement
                    ("INSERT INTO expenses (amount, reason) " +
                     "VALUES (?, ?);");
                pstmt.setFloat(1, target.amount);
                pstmt.setString(2, target.reason);
                pstmt.executeUpdate();
                response.setStatus(HttpServletResponse.SC_CREATED);
            } catch (SQLException ex) {
                throw new ServletException(ex);
            }
        } else response.sendError(response.SC_NOT_FOUND);
    }
}
