package vn.hexacare.sosnow.phase;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import vn.hexacare.sosnow.service.DistrictService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import static vn.hexacare.sosnow.phase.ApiChecks.*;

@Service
public class AedService implements ApplicationRunner {
    public record Input(String id, String name, String address, String district, Double latitude, Double longitude,
                        String accessInstructions, String openingHours, Boolean is24h, Aed.Status status,
                        Instant verifiedAt, Instant lastInspectedAt, String verificationSource) {}
    public record View(String id, String name, String address, String district, double latitude, double longitude,
                       String accessInstructions, String openingHours, boolean is24h, Aed.Status status,
                       Instant verifiedAt, Instant lastInspectedAt, long distanceMeters) {}
    private final AedRepository repository;
    private final DistrictService districts;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final String file;
    private final TransactionTemplate transaction;

    public AedService(AedRepository repository, DistrictService districts, ObjectMapper mapper, Clock clock,
                      @Value("${app.aeds.data-file:}") String file, PlatformTransactionManager manager) {
        this.repository = repository; this.districts = districts; this.mapper = mapper; this.clock = clock;
        this.file = file; this.transaction = new TransactionTemplate(manager);
    }
    @Override public void run(ApplicationArguments args) throws Exception {
        if (file.isBlank()) return;
        Path path = Path.of(file);
        require(Files.size(path) <= 5_000_000, "AED file exceeds 5 MB.");
        try (var input = Files.newInputStream(path)) {
            importVerified(mapper.readerFor(new TypeReference<List<Input>>() {})
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(input));
        }
    }
    public void importVerified(List<Input> rows) {
        require(rows != null && !rows.isEmpty() && rows.size() <= 10000, "Invalid AED catalog size.");
        var ids = new HashSet<String>();
        var entities = new ArrayList<Aed>();
        for (Input row : rows) {
            require(row != null, "Invalid AED record.");
            require(text(row.id(), 100, "AED id").matches("[a-z0-9]+(?:-[a-z0-9]+)*") && ids.add(row.id()), "Duplicate or invalid AED id.");
            text(row.name(), 200, "AED name"); text(row.address(), 500, "AED address");
            String district = districts.canonical(row.district()).orElseThrow(() -> error(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid AED district."));
            require(row.latitude() != null && row.longitude() != null && row.is24h() != null && row.status() != null, "Missing AED fields.");
            location(row.latitude(), row.longitude());
            require(row.latitude() >= 10.3 && row.latitude() <= 11.3 && row.longitude() >= 106.3 && row.longitude() <= 107.1,
                    "AED is outside the initial service area.");
            text(row.accessInstructions(), 1000, "access instructions"); text(row.openingHours(), 200, "opening hours");
            text(row.verificationSource(), 1000, "verification source");
            require(reviewed(row.verifiedAt(), clock.instant()) && reviewed(row.lastInspectedAt(), clock.instant()), "AED verification and inspection are required.");
            entities.add(new Aed(row, district));
        }
        transaction.executeWithoutResult(status -> repository.saveAllAndFlush(entities));
    }
    public List<View> nearby(double lat, double lng, int radius, int limit) {
        ApiChecks.nearby(lat, lng, radius, limit);
        return repository.findAll().stream().filter(a -> a.getStatus() == Aed.Status.OPERATIONAL
                        && reviewed(a.getVerifiedAt(), clock.instant()) && reviewed(a.getLastInspectedAt(), clock.instant()))
                .filter(a -> meters(lat, lng, a.getLatitude(), a.getLongitude()) <= radius)
                .map(a -> new View(a.getId(), a.getName(), a.getAddress(), a.getDistrict(), a.getLatitude(), a.getLongitude(),
                        a.getAccessInstructions(), a.getOpeningHours(), a.is24h(), a.getStatus(), a.getVerifiedAt(), a.getLastInspectedAt(),
                        Math.round(meters(lat, lng, a.getLatitude(), a.getLongitude()))))
                .sorted(Comparator.comparingLong(View::distanceMeters).thenComparing(View::id)).limit(limit).toList();
    }
}
