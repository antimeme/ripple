package net.esclat.ripple.servlet;
import java.io.PrintWriter;
import java.io.IOException;
import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet(name="RippleServlet", urlPatterns={ "/ripple" })
public class RippleServlet extends HttpServlet
{
    private static final long serialVersionUID = 1L;
    protected ServletContext srvctx = null;

    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        srvctx = getServletContext();
        // File f = getInitParameter("javax.servlet.context.tempdir");
    }

    public void destroy() {}

    public void doGet(HttpServletRequest request,
                      HttpServletResponse response)
        throws ServletException, IOException {
        if (request.isSecure()) {
            //X509Certificate certs[] = request.getParameter
            //    ("javax.servlet.request.X509Certificate");
            //int key_size = request.getParameter
            //    ("javax.servlet.request.key_size");
            //String cipherSuite = request.getParameter
            //    ("javax.servlet.request.cipher_suite");
            //String sessionID = request.getParameter
            //    ("javax.servlet.request.ssl_session_id");
        }

        response.setContentType("text/html");
        PrintWriter out = response.getWriter();
        out.println("<title>Ripple Servlet</title>");
        out.println("<h1>Ripple Servlet</h1>");
    }
                              
}
