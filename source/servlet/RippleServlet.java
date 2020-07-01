package net.esclat.ripple.servlet;
import java.io.File;
import java.io.PrintWriter;
import java.io.IOException;
import java.security.cert.X509Certificate;
import javax.security.auth.x500.X500Principal;
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
            out.println("<p>Secure</p>");
            out.println("<p>SessionID: " + request.getAttribute
                ("javax.servlet.request.ssl_session_id") + "</p>");
            out.println("<p>CipherSuite: " + request.getAttribute
                ("javax.servlet.request.cipher_suite") + "</p>");
            out.println("<p>KeySize: " + request.getAttribute
                        ("javax.servlet.request.key_size") + "</p>");

            X509Certificate certs[] = (X509Certificate[])
                request.getAttribute
                ("javax.servlet.request.X509Certificate");
            if (certs != null) {
                if (certs.length > 0) {
                    out.println("<ul>");
                    for (int ii = 0; ii < certs.length; ++ii) {
                        X509Certificate cert = certs[ii];
                        X500Principal subject =
                            cert.getSubjectX500Principal();
                        X500Principal issuer =
                            cert.getIssuerX500Principal();
                        out.println
                            ("<li>Subject: " + subject.getName() +
                             " (" + issuer.getName() + ")</li>");
                    }
                    out.println("</ul>");
                }
            } else out.println("<p>No client certificate</p>");
        } else { out.println("<p>Insecure</p>"); }
    }
}
