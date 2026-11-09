package vn.hexacare.sosnow;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import vn.hexacare.sosnow.controller.MapController;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MapApiTests {
    @Autowired MockMvc mvc;
    @Test void returnsPublicDisplaySettingsWithoutLocationOrAuthentication() throws Exception {
        mvc.perform(get("/api/map/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.providerName").value("OpenStreetMap"))
                .andExpect(jsonPath("$.tileUrl").value("https://tile.openstreetmap.org/{z}/{x}/{y}.png"))
                .andExpect(jsonPath("$.defaultCenter.lat").value(10.7769))
                .andExpect(jsonPath("$.maxZoom").value(19))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void rejectsUnsafeUrlsAndTemplates() {
        for (String tile : new String[]{"http://example.com/{z}/{x}/{y}.png", "https://example.com/tile.png",
                "https://secret@example.com/{z}/{x}/{y}.png"}) {
            assertThatThrownBy(() -> new MapController("Test", tile, "Test", "https://example.com/copyright", 19))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
