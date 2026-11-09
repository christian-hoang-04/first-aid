package vn.hexacare.sosnow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import vn.hexacare.sosnow.model.Facility;
import vn.hexacare.sosnow.model.FacilityPhone;
import vn.hexacare.sosnow.model.FacilityType;
import vn.hexacare.sosnow.repository.FacilityRepository;
import vn.hexacare.sosnow.repository.SosAlertRepository;
import vn.hexacare.sosnow.service.FacilityCatalog;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class FacilityApiTests {
    @Autowired MockMvc mvc;
    @Autowired FacilityRepository repository;
    @Autowired SosAlertRepository alerts;
    @Autowired FacilityCatalog catalog;

    @BeforeEach
    void reset() {
        repository.deleteAll();
        catalog.invalidate();
    }

    @Test
    void anonymousNearbyReturnsContractAndMetricDistance() throws Exception {
        save("test-hospital", 10.80, true, true, Instant.parse("2026-01-01T00:00:00Z"));
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.80").param("lng", "106.70"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("test-hospital"))
                .andExpect(jsonPath("$[0].name").value("Test test-hospital"))
                .andExpect(jsonPath("$[0].type").value("HOSPITAL"))
                .andExpect(jsonPath("$[0].address").value("Synthetic test address"))
                .andExpect(jsonPath("$[0].district").value("Bình Thạnh"))
                .andExpect(jsonPath("$[0].latitude").value(10.80))
                .andExpect(jsonPath("$[0].longitude").value(106.70))
                .andExpect(jsonPath("$[0].distanceMeters").value(0))
                .andExpect(jsonPath("$[0].hasEmergency").value(true))
                .andExpect(jsonPath("$[0].phones[0].number").value("02800000000"))
                .andExpect(jsonPath("$[0].phones[0].is24h").value(true))
                .andExpect(jsonPath("$[0].verifiedAt").value("2026-01-01T00:00:00Z"))
                .andExpect(jsonPath("$[0].verificationSource").doesNotExist());
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.81").param("lng", "106.70"))
                .andExpect(jsonPath("$[0].distanceMeters").value(allOf(greaterThan(1100), lessThan(1125))));
    }

    @Test
    void expandsPastEmptyAndSparseRadiiAndHonorsLimit() throws Exception {
        save("first", 10.81, true, true, Instant.now());
        save("second", 10.86, true, true, Instant.now());
        save("third", 10.94, true, true, Instant.now());
        save("outside", 11.1, true, true, Instant.now());
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.80").param("lng", "106.70")
                        .param("radius", "500"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", contains("first", "second", "third")));
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.80").param("lng", "106.70")
                        .param("radius", "500").param("limit", "1"))
                .andExpect(jsonPath("$[*].id", contains("first")));
    }

    @Test
    void prioritizesEmergency24hThenEmergencyThenDistance() throws Exception {
        save("clinic", 10.80, false, true, Instant.now());
        save("day-emergency", 10.81, true, false, Instant.now());
        save("night-far", 10.83, true, true, Instant.now());
        save("night-near", 10.82, true, true, Instant.now());
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.80").param("lng", "106.70"))
                .andExpect(jsonPath("$[*].id", contains("night-near", "night-far", "day-emergency", "clinic")));
    }

    @Test
    void districtLookupSupportsUnaccentedNamesAndOmitsDistance() throws Exception {
        save("test", 10.8, true, false, Instant.now());
        mvc.perform(get("/api/facilities").param("district", "  quan binh thanh  "))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].distanceMeters").doesNotExist());
        mvc.perform(get("/api/facilities").param("district", "Quận 1"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void districtsAreAvailableEvenWithoutFacilityData() throws Exception {
        mvc.perform(get("/api/districts")).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(22))).andExpect(jsonPath("$", hasItem("Bình Thạnh")));
        mvc.perform(get("/api/facilities").param("district", "Hà Nội")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/facilities")).andExpect(status().isBadRequest());
    }

    @Test
    void neverPublishesUnverifiedOrFutureVerifiedFacilities() throws Exception {
        save("unverified", 10.80, true, true, null);
        save("future", 10.80, true, true, Instant.now().plusSeconds(86400));
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.80").param("lng", "106.70"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/facilities").param("district", "Bình Thạnh"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @ParameterizedTest
    @CsvSource({"lat,91", "lat,-91", "lat,NaN", "lat,Infinity", "lng,181", "lng,-181",
            "lng,-Infinity", "radius,0", "radius,50001", "radius,1.5", "limit,0", "limit,51", "limit,abc"})
    void invalidSearchParametersReturn400(String parameter, String value) throws Exception {
        var request = get("/api/facilities/nearby");
        request.param("lat", parameter.equals("lat") ? value : "10.80");
        request.param("lng", parameter.equals("lng") ? value : "106.70");
        if (!parameter.equals("lat") && !parameter.equals("lng")) request.param(parameter, value);
        mvc.perform(request).andExpect(status().isBadRequest());
    }

    @Test
    void handlesMissingCoordinates() throws Exception {
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.8")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/facilities/nearby").param("lng", "106.7")).andExpect(status().isBadRequest());
    }

    @Test
    void doesNotPersistLogOrEchoUserCoordinates(CapturedOutput output) throws Exception {
        long count = alerts.count();
        save("test", 10.80, true, true, Instant.now());
        mvc.perform(get("/api/facilities/nearby").param("lat", "10.789123456").param("lng", "106.789123456"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        String body = mvc.perform(get("/api/facilities/nearby").param("lat", "10.789123456-secret").param("lng", "106.70"))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("10.789123456", "secret");
        assertThat(output.getAll()).doesNotContain("10.789123456", "106.789123456");
        assertThat(alerts.count()).isEqualTo(count);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void allowsConfiguredFrontendAndRejectsUnknownOrigin() throws Exception {
        mvc.perform(get("/api/districts").header("Origin", "https://esmarch.example"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://esmarch.example"));
        mvc.perform(get("/api/districts").header("Origin", "https://untrusted.example"))
                .andExpect(status().isForbidden());
        mvc.perform(options("/api/facilities/nearby").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    private void save(String id, double lat, boolean emergency, boolean fullTime, Instant verifiedAt) {
        repository.saveAndFlush(new Facility(id, "Test " + id, emergency ? FacilityType.HOSPITAL : FacilityType.CLINIC,
                "Synthetic test address", "Bình Thạnh", lat, 106.70, emergency,
                List.of(new FacilityPhone("Test only", "02800000000", fullTime)), verifiedAt, "Test fixture only"));
    }
}
