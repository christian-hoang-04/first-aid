package vn.hexacare.sosnow.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import java.util.Arrays;
import java.util.List;

@Configuration
public class WebConfig {
    @Bean
    FilterRegistrationBean<CorsFilter> corsFilter(@Value("${app.cors-origins}") String origins) {
        var configuration = new CorsConfiguration();
        List<String> allowed = Arrays.stream(origins.split(",")).map(String::strip)
                .filter(s -> !s.isBlank()).toList();
        if (allowed.isEmpty() || allowed.stream().anyMatch(s -> s.contains("*"))) {
            throw new IllegalArgumentException("Configure explicit frontend origins in CORS_ORIGINS.");
        }
        configuration.setAllowedOrigins(allowed);
        configuration.setAllowedMethods(List.of(HttpMethod.GET.name(), HttpMethod.POST.name(), HttpMethod.PUT.name(), HttpMethod.DELETE.name(), HttpMethod.OPTIONS.name()));
        configuration.setAllowedHeaders(List.of("Content-Type", "Accept", "Authorization", "X-Admin-Token"));
        configuration.setExposedHeaders(List.of("Retry-After"));
        configuration.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        var registration = new FilterRegistrationBean<>(new CorsFilter(source));
        // CORS headers must also be present on rate-limit and HTTPS error responses.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
