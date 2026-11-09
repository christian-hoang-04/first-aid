package vn.hexacare.sosnow;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.require-https=true", "app.public-api.rate-limit.requests=2"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicApiPolicyTests {
    @Autowired MockMvc mvc;

    @Test
    void enforcesHttpsWithoutTrustingRawForwardedHeader() throws Exception {
        mvc.perform(get("/api/districts").header("X-Forwarded-Proto", "https"))
                .andExpect(status().is(426)).andExpect(jsonPath("$.detail").value("HTTPS is required."));
        mvc.perform(get("/api;v=1/districts")).andExpect(status().is(426));
        mvc.perform(get("/api/districts").secure(true).with(request -> {
            request.setRemoteAddr("192.0.2.1"); return request;
        })).andExpect(status().isOk())
                .andExpect(header().string("Strict-Transport-Security", "max-age=31536000"));
    }

    @Test
    void returns429WithCorsAndRetryAfterAndIgnoresSpoofedIpHeaders() throws Exception {
        for (int i = 0; i < 2; i++) {
            mvc.perform(get("/api/districts").secure(true).with(request -> {
                request.setRemoteAddr("192.0.2.2"); return request;
            })).andExpect(status().isOk());
        }
        mvc.perform(get("/api/districts").secure(true).header("Origin", "https://esmarch.example")
                        .header("X-Forwarded-For", "192.0.2.99").with(request -> {
                            request.setRemoteAddr("192.0.2.2"); return request;
                        }))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
                .andExpect(header().string("Access-Control-Allow-Origin", "https://esmarch.example"))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get("/api/districts;v=1").secure(true).with(request -> {
            request.setRemoteAddr("192.0.2.2"); return request;
        })).andExpect(status().isTooManyRequests());
        mvc.perform(options("/api/districts").secure(true).header("Origin", "https://esmarch.example")
                        .header("Access-Control-Request-Method", "GET").with(request -> {
                            request.setRemoteAddr("192.0.2.2"); return request;
                        })).andExpect(status().isOk());
    }
}
