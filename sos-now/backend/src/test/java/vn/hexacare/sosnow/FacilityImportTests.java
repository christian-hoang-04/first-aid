package vn.hexacare.sosnow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import vn.hexacare.sosnow.config.FacilityDataLoader;
import vn.hexacare.sosnow.dto.FacilityImport;
import vn.hexacare.sosnow.model.FacilityType;
import vn.hexacare.sosnow.repository.FacilityRepository;
import vn.hexacare.sosnow.service.FacilityCatalog;
import vn.hexacare.sosnow.service.FacilityImportService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class FacilityImportTests {
    @Autowired FacilityImportService importer;
    @Autowired FacilityRepository repository;
    @Autowired FacilityCatalog catalog;
    @Autowired ObjectMapper mapper;
    @TempDir Path directory;

    @BeforeEach
    void reset() { repository.deleteAll(); catalog.invalidate(); }

    @Test
    void upsertsVerifiedRecordsAndReplacesPhoneList() {
        importer.importVerified(List.of(row("test", "Quan Binh Thanh", Instant.now(), "02800000000")));
        assertThat(repository.count()).isEqualTo(1);
        assertThat(catalog.all().getFirst().district()).isEqualTo("Bình Thạnh");
        importer.importVerified(List.of(row("test", "Bình Thạnh", Instant.now(), "+842800000001")));
        catalog.invalidate();
        assertThat(repository.count()).isEqualTo(1);
        assertThat(catalog.all().getFirst().phones()).hasSize(1);
        assertThat(catalog.all().getFirst().phones().getFirst().number()).isEqualTo("+842800000001");
    }

    @Test
    void rejectsEntireBatchWhenVerificationMissing() {
        assertThatThrownBy(() -> importer.importVerified(List.of(
                row("valid", "Bình Thạnh", Instant.now(), "02800000000"),
                row("unverified", "Bình Thạnh", null, "02800000001"))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("verifiedAt");
        assertThat(repository.count()).isZero();
    }

    @Test
    void rejectsFutureVerificationInvalidPhonesAndUnsupportedDistricts() {
        assertThatThrownBy(() -> importer.importVerified(List.of(row("test", "Bình Thạnh",
                Instant.now().plusSeconds(86400), "02800000000")))).hasMessageContaining("verifiedAt");
        assertThatThrownBy(() -> importer.importVerified(List.of(row("test", "Bình Thạnh",
                Instant.now(), "REPLACE")))).hasMessageContaining("phones");
        assertThatThrownBy(() -> importer.importVerified(List.of(row("test", "Hà Nội",
                Instant.now(), "02800000000")))).hasMessageContaining("district");
        assertThat(repository.count()).isZero();
    }

    @Test
    void rejectsDuplicatesInsteadOfSilentlyOverwriting() {
        FacilityImport row = row("duplicate", "Bình Thạnh", Instant.now(), "02800000000");
        assertThatThrownBy(() -> importer.importVerified(List.of(row, row))).hasMessageContaining("duplicate");
        assertThat(repository.count()).isZero();
    }

    @Test
    void rejectsFacilitiesOutsideInitialHcmcCoordinateWindow() {
        var valid = row("test", "Bình Thạnh", Instant.now(), "02800000000");
        var invalid = new FacilityImport(valid.id(), valid.name(), valid.type(), valid.address(), valid.district(),
                21.0, 105.8, valid.hasEmergency(), valid.phones(), valid.verifiedAt(), valid.verificationSource());
        assertThatThrownBy(() -> importer.importVerified(List.of(invalid))).hasMessageContaining("latitude");
        assertThat(repository.count()).isZero();
    }

    @Test
    void loadsJsonFileAndWarmsCatalog() throws Exception {
        Path file = directory.resolve("facilities.json");
        mapper.writeValue(file.toFile(), List.of(row("from-file", "Bình Thạnh", Instant.now(), "02800000000")));
        new FacilityDataLoader(file.toString(), mapper, importer, catalog).run(null);
        assertThat(catalog.all()).extracting("id").containsExactly("from-file");
    }

    @Test
    void rejectsUnknownFieldsInInputFile() throws Exception {
        Path file = directory.resolve("invalid.json");
        Files.writeString(file, "[{\"unknownField\":true}]");
        assertThatThrownBy(() -> new FacilityDataLoader(file.toString(), mapper, importer, catalog).run(null))
                .isInstanceOf(com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException.class);
        assertThat(repository.count()).isZero();
    }

    private FacilityImport row(String id, String district, Instant verifiedAt, String number) {
        return new FacilityImport(id, "Synthetic test facility", FacilityType.HOSPITAL, "Synthetic test address",
                district, 10.80, 106.70, true, List.of(new FacilityImport.Phone("Test only", number, true)),
                verifiedAt, "Synthetic fixtures; never import into production");
    }
}
