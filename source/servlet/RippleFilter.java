package net.antimeme.ripple.servlet;
import java.util.Enumeration;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.FileNotFoundException;
import java.security.cert.X509Certificate;
import javax.security.auth.x500.X500Principal;
import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.WriteListener;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.ServletOutputStream;
import javax.servlet.annotation.WebFilter;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;

/**
 * This component causes URIs that don't match any servlet or file
 * name to be served when a corresponding file with a .html extension
 * is found.  For example, /ripple/poke is redirected to
 * /ripple/poke.html since the latter exists in the WAR file. */
@WebFilter(urlPatterns = "/*")
public class RippleFilter extends HttpServlet implements Filter
{
    private static final long serialVersionUID = 1L;
    protected ServletContext ctx  = null;

    /**
     * Pretends to be a ServletOutputStream but doesn't send
     * data to any client.  Depending on what happens in a filter
     * this data may either be discarded or resolved by sending
     * it to the actual response output stream.
     *
     * A DelayedOutputStream is always and immediately writable
     * without blocking, since the data is collected in memory. */
    public static class DelayedOutputStream
        extends ServletOutputStream
    {
        protected ByteArrayOutputStream baos =
            new ByteArrayOutputStream();
        protected WriteListener listener = null;
        
        @Override
        public void write(int b) { baos.write(b); }

        @Override
        public void setWriteListener(WriteListener listener) {
            if (this.listener != null)
                throw new IllegalStateException
                    ("Repeating setWriteListener is not allowed");
            this.listener = listener;
            try { this.listener.onWritePossible(); }
            catch (IOException ex) { throw new RuntimeException(ex); }
        }

        /**
         * Because this captures output for potential replay later
         * we are always ready.
         * @return always true */
        @Override
        public boolean isReady() { return true; }

        /**
         * Allows the DelayedResponse to implement
         * {@link DelayedResponse#reset} */
        public void reset() { baos.reset(); }

        /**
         * Transfer the contents of this output stream to another.
         * This is used to send a delayed response.
         * @param out actual output stream for response
         * @return the same stream provided for chaining */
        public void resolve(ServletOutputStream out) throws IOException
        { out.write(baos.toByteArray()); out.flush(); }
    }

    /**
     * A wrapper around an HttpServletResponse that passes through
     * most things but avoids sending anything to the client.
     * If it becomes desirable to commit the response the
     * {@link #resolve} method can be called.  Otherwise interact
     * directly with the original response to discard data but
     * keep settings such as status and headers. */
    public static class DelayedResponse
        extends HttpServletResponseWrapper
    {
        protected HttpServletResponse response;
        protected boolean errorSent = false;
        protected int errorSC = 0;
        protected String errorMessage = null;
        protected String redirected = null;
        protected DelayedOutputStream dout = new DelayedOutputStream();

        DelayedResponse(HttpServletResponse response)
        { super(response); this.response = response; }

        @Override
        public int getStatus()
        { return errorSent ? errorSC : super.getStatus(); }

        @Override
        public void sendError(int sc)
        { errorSC = sc; errorSent = true; }

        @Override
        public void sendError(int sc, String message)
        { errorSC = sc; errorMessage = message; errorSent = true; }

        @Override
        public void sendRedirect(String location)
        { redirected = location; }

        @Override
        public void reset() { super.reset(); dout.reset(); }

        @Override
        public void resetBuffer()
        { super.resetBuffer(); dout.reset(); }

        @Override
        public ServletOutputStream getOutputStream() { return dout; }

        @Override
        public PrintWriter getWriter() throws IOException {
            return new PrintWriter
                (new OutputStreamWriter
                 (dout, getCharacterEncoding()), true);
        }

        void resolve() throws IOException {
            if (errorSent) {
                if (errorMessage != null)
                    response.sendError(errorSC, errorMessage);
                else response.sendError(errorSC);
            } else if (redirected != null)
                response.sendRedirect(redirected);
            else dout.resolve(response.getOutputStream());
        }
    }

    @Override
    public void init(FilterConfig config) throws ServletException
    { ctx = config.getServletContext(); }

    @Override
    public void destroy() { ctx = null; }

    protected void handleInfo(HttpServletRequest request,
                              HttpServletResponse response)
        throws ServletException, IOException
    {
        File tempdir = (File)ctx.getAttribute
            ("javax.servlet.context.tempdir");

        response.setContentType("text/html");
        PrintWriter out = response.getWriter();
        out.println("<!DOCTYPE html>");
        out.println("<meta charset=\"utf-8\">");
        out.println("<link rel=\"icon\" href=\"images/ripple.svg\"/>");
        out.println("<title>Ripple Servlet</title>");
        out.println("<h1>Ripple Servlet</h1>");
        out.println("<p>TempDir: " + tempdir.getPath() + "</p>");
        out.println("<p>QueryString: " +
                    request.getQueryString() + "</p>");
        out.println("<p>ContextPath: " +
                    request.getContextPath() + "</p>");
        out.println("<p>ServletPath: " +
                    request.getServletPath() + "</p>");
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

    @Override
    public void doFilter(ServletRequest request,
                         ServletResponse response,
                         FilterChain chain)
        throws IOException, ServletException
    {
        //for (Enumeration<String> en = ctx.getInitParameterNames();
        //     en.hasMoreElements();)
        //    System.out.println("DEBUG-initparam: " + en.nextElement());
        //for (Enumeration<String> en = ctx.getAttributeNames();
        //     en.hasMoreElements();)
        //    System.out.println("DEBUG-initparam: " + en.nextElement());

        // This filter attempts to avoid interfering with servlets
        // or static files.  Action is taken only if the request
        // would have indicated a resource that does not exist.  In
        // that case we add a ".html" to the path and try again.
        if ((request instanceof HttpServletRequest)) {
            HttpServletRequest httpRequest =
                (HttpServletRequest)request;
            HttpServletResponse httpResponse =
                (HttpServletResponse)response;
            DelayedResponse delayed = new DelayedResponse(httpResponse);
            chain.doFilter(httpRequest, delayed);
            if (httpRequest.getMethod().equalsIgnoreCase("GET") &&
                (delayed.getStatus() == httpResponse.SC_NOT_FOUND) &&
                !httpRequest.getServletPath().endsWith("/") &&
                !httpRequest.getServletPath().endsWith(".html")) {
                String path = httpRequest.getServletPath() + ".html";
                if (ctx.getResource(path) != null)
                    httpRequest.getRequestDispatcher(path)
                        .forward(request, response);
                    //httpResponse.sendRedirect
                    //    (httpRequest.getRequestURI() + ".html");
                else delayed.resolve();
            } else delayed.resolve();
        } else chain.doFilter(request, response);
    }
}
