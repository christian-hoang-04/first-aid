package vn.hexacare.sosnow.service;

import org.springframework.stereotype.Component;
import vn.hexacare.sosnow.dto.FacilityResponse;
import vn.hexacare.sosnow.repository.FacilityRepository;
import java.time.Instant;
import java.util.List;

@Component
public class FacilityCatalog {
    private final FacilityRepository repository;
    private List<FacilityResponse> snapshot = List.of();
    private long expiresAtNanos;

    public FacilityCatalog(FacilityRepository repository) { this.repository = repository; }

    // Cache only public facility data. User coordinates never enter this cache.
    public synchronized List<FacilityResponse> all() {
        long now = System.nanoTime();
        if (expiresAtNanos == 0 || now - expiresAtNanos >= 0) {
            snapshot = repository.findVerifiedWithPhones(Instant.now()).stream()
                    .map(FacilityResponse::from).toList();
            expiresAtNanos = now + 30_000_000_000L;
        }
        return snapshot;
    }

    public synchronized void invalidate() { expiresAtNanos = 0; }
}
