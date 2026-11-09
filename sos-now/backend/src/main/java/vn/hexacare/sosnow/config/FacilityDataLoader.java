package vn.hexacare.sosnow.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import vn.hexacare.sosnow.dto.FacilityImport;
import vn.hexacare.sosnow.service.FacilityCatalog;
import vn.hexacare.sosnow.service.FacilityImportService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Component
public class FacilityDataLoader implements ApplicationRunner {
    private final String dataFile;
    private final ObjectMapper mapper;
    private final FacilityImportService importer;
    private final FacilityCatalog catalog;

    public FacilityDataLoader(@Value("${app.facilities.data-file:}") String dataFile,
                              ObjectMapper mapper, FacilityImportService importer, FacilityCatalog catalog) {
        this.dataFile = dataFile;
        this.mapper = mapper;
        this.importer = importer;
        this.catalog = catalog;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (!dataFile.isBlank()) {
            Path path = Path.of(dataFile);
            if (Files.size(path) > 5_000_000) throw new IllegalArgumentException("Facility import exceeds 5 MB.");
            List<FacilityImport> rows;
            try (var input = Files.newInputStream(path)) {
                rows = mapper.readerFor(new TypeReference<List<FacilityImport>>() {})
                        .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(input);
            }
            importer.importVerified(rows);
        }
        catalog.invalidate();
        // Warm the public catalog at startup; no location-dependent work here.
        catalog.all();
    }
}
