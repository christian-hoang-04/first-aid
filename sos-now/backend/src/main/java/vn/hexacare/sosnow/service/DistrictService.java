package vn.hexacare.sosnow.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import vn.hexacare.sosnow.repository.FacilityRepository;
import java.text.Normalizer;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class DistrictService {
    // Legacy district labels for the initial HCMC service area, not an administrative registry.
    private static final List<String> DISTRICTS = List.of(
            "Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8",
            "Quận 10", "Quận 11", "Quận 12", "Bình Tân", "Bình Thạnh", "Gò Vấp",
            "Phú Nhuận", "Tân Bình", "Tân Phú", "Thủ Đức", "Bình Chánh", "Cần Giờ",
            "Củ Chi", "Hóc Môn", "Nhà Bè", "TP. Hồ Chí Minh");

    private final FacilityRepository facilities;

    @Autowired
    public DistrictService(FacilityRepository facilities) { this.facilities = facilities; }

    // Keep direct construction available for small, repository-free unit tests.
    public DistrictService() { this.facilities = null; }

    public List<String> all() {
        if (facilities == null) return DISTRICTS;
        var districts = new LinkedHashSet<>(DISTRICTS);
        districts.addAll(facilities.findVerifiedDistrictNames(Instant.now()));
        return List.copyOf(districts);
    }

    public Optional<String> canonical(String value) {
        if (value == null) return Optional.empty();
        String key = normalize(value);
        return DISTRICTS.stream().filter(d -> normalize(d).equals(key)).findFirst();
    }

    private String normalize(String value) {
        return Normalizer.normalize(value.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('đ', 'd')
                .replaceFirst("^(quan|huyen|thanh pho|tp\\.?)\\s+", "")
                .replaceAll("\\s+", " ");
    }
}
