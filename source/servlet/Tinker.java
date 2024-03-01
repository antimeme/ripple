package net.antimeme.ripple.servlet;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.IOException;
import java.io.BufferedReader;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.exc.InvalidDefinitionException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;

@WebServlet("/tinkerService")
public class Tinker extends HttpServlet
{
    private static final long serialVersionUID = 1L;
    protected ObjectMapper mapper = new ObjectMapper();

    public static class Something {
        protected int number;
        public int getNumber() { return this.number; }
        public void setNumber(int value) { this.number = value; }

        protected String label;
        public String getLabel() { return this.label; }
        public void setLabel(String value) { this.label = value; }

        protected int[] list;
        public int[] getList() { return this.list; }
        public void setList(int[] value) { this.list = value; }

        protected boolean setting;
        public boolean getSetting() { return this.setting; }
        public void setSetting(boolean value) { this.setting = value; }
    }

    @Override
    public void doPost(HttpServletRequest request,
                       HttpServletResponse response)
        throws ServletException, IOException {
        if (request.getContentType().strip().toLowerCase()
            .equals("application/json")) {
            StringBuilder sb = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;
            while ((line = reader.readLine()) != null)
                sb.append(line);

            try {
                Something thing = mapper.readValue
                    (sb.toString(), Something.class);

                thing.number += 2;
                if (thing.list != null)
                    for (int ii = 0; ii < thing.list.length; ++ii)
                        thing.list[ii] += 1;

                response.setContentType("application/json");
                response.getWriter().write
                    (mapper.writeValueAsString(thing));
            } catch (UnrecognizedPropertyException ex) {
                response.setStatus(response.SC_BAD_REQUEST);
                response.setContentType("text/plain");
                response.getWriter().write
                    ("What is this property? " + ex.getPropertyName());
            } catch (InvalidDefinitionException ex) {
                response.setStatus(response.SC_BAD_REQUEST);
                response.setContentType("text/plain");
                response.getWriter().write
                    ("Invalid definition");
            } catch (MismatchedInputException ex) {
                response.setStatus(response.SC_BAD_REQUEST);
                response.setContentType("text/plain");
                response.getWriter().write
                    ("Got some mismatched input");
            } catch (JsonParseException ex) {
                response.setStatus(response.SC_BAD_REQUEST);
                response.setContentType("text/plain");
                response.getWriter().write
                    ("Can't parse this: " + sb.toString());
            }
        } else {
            response.setStatus(response.SC_BAD_REQUEST);
            response.setContentType("text/plain");
            response.getWriter().write
                ("Unrecognized content type: " +
                 request.getContentType());
        }
    }
}
