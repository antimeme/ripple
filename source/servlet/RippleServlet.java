package net.esclat.ripple.servlet;
import java.io.File;
import java.io.PrintWriter;
import java.io.IOException;
import javax.security.cert.X509Certificate;
import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet(name="RippleServlet",
            urlPatterns={ "/", "/index", "/index.html" })
public class RippleServlet extends HttpServlet
{
    private static final long serialVersionUID = 1L;
    protected ServletContext srvctx = null;
    protected File tempdir = null;

    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        srvctx = getServletContext();
        tempdir = (File)srvctx.getAttribute
            ("javax.servlet.context.tempdir");
    }

    public void destroy() {}

    public void doGet(HttpServletRequest request,
                      HttpServletResponse response)
        throws ServletException, IOException {
        response.setContentType("text/html");
        PrintWriter out = response.getWriter();
        out.println("<!DOCTYPE html>");
        out.println("<meta charset=\"utf-8\">");
        out.println("<title>Ripple Servlet</title>");
        out.println("<h1>Ripple Servlet</h1>");
        out.println("<p>TempDir: " + tempdir.getPath() + "</p>");
        out.println("<p>PathInfo: " + request.getPathInfo() + "</p>");

        if (request.isSecure()) {
            X509Certificate certs[] = (X509Certificate[])
                request.getAttribute
                ("javax.servlet.request.X509Certificate");
            out.println("<p>Secure</p>");
            out.println("<p>SessionID: " + request.getAttribute
                ("javax.servlet.request.ssl_session_id") + "</p>");
            out.println("<p>CipherSuite: " + request.getAttribute
                ("javax.servlet.request.cipher_suite") + "</p>");
            out.println("<p>KeySize: " + request.getAttribute
                        ("javax.servlet.request.key_size") + "</p>");
        } else { out.println("<p>Insecure</p>"); }
    }
                              
}
