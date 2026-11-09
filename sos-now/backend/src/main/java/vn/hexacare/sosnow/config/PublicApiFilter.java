package vn.hexacare.sosnow.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;
import java.io.IOException;
import java.time.Duration;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class PublicApiFilter extends OncePerRequestFilter {
    private final ObjectMapper mapper;
    private final boolean requireHttps;
    private final Duration window;
    private final IpRateLimiter limiter;

    public PublicApiFilter(ObjectMapper mapper,
                           @Value("${app.require-https:false}") boolean requireHttps,
                           @Value("${app.public-api.rate-limit.requests:60}") int requests,
                           @Value("${app.public-api.rate-limit.window:60s}") Duration window,
                           @Value("${app.public-api.rate-limit.max-clients:10000}") int maxClients) {
        this.mapper = mapper;
        this.requireHttps = requireHttps;
        this.window = window;
        this.limiter = new IpRateLimiter(requests, window, maxClients);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !path(request).startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Pragma", "no-cache");
        if (requireHttps && !request.isSecure()) {
            reject(response, HttpStatus.UPGRADE_REQUIRED, "HTTPS is required.");
            return;
        }
        if (request.isSecure()) response.setHeader("Strict-Transport-Security", "max-age=31536000");
        String path = path(request);
        boolean limitedApi = !path.equals("/api/health") && !path.equals("/api/alerts") && !path.startsWith("/api/alerts/");
        // Never trust raw X-Forwarded-For. The container must resolve trusted proxy addresses.
        if (limitedApi && !request.getMethod().equals("OPTIONS") && !limiter.allow(request.getRemoteAddr())) {
            response.setHeader("Retry-After", Long.toString(Math.max(1, window.toSeconds() + 1)));
            reject(response, HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please retry later.");
            return;
        }
        chain.doFilter(request, response);
    }

    private String path(HttpServletRequest request) {
        // Match MVC's decoded path, including removal of semicolon (matrix) parameters.
        return UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    }

    private void reject(HttpServletResponse response, HttpStatus status, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ProblemDetail.forStatusAndDetail(status, detail));
    }
}
