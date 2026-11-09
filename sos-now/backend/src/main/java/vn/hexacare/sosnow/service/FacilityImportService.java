package vn.hexacare.sosnow.service;

import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.hexacare.sosnow.dto.FacilityImport;
import vn.hexacare.sosnow.model.Facility;
import vn.hexacare.sosnow.repository.FacilityRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

@Service
public class FacilityImportService {
    private final Validator validator;
    private final DistrictService districts;
    private final FacilityRepository repository;

    public FacilityImportService(Validator validator, DistrictService districts, FacilityRepository repository) {
        this.validator = validator;
        this.districts = districts;
        this.repository = repository;
    }

    @Transactional
    public void importVerified(List<FacilityImport> rows) {
        if (rows == null || rows.isEmpty() || rows.size() > 10_000) {
            throw new IllegalArgumentException("Facility import must contain 1 to 10000 records.");
        }
        var ids = new HashSet<String>();
        var entities = new ArrayList<Facility>();
        for (int index = 0; index < rows.size(); index++) {
            FacilityImport row = rows.get(index);
            if (row == null) throw invalid(index, "record is null");
            var errors = validator.validate(row);
            if (!errors.isEmpty()) {
                String fields = errors.stream().map(v -> v.getPropertyPath().toString()).sorted()
                        .distinct().reduce((a, b) -> a + ", " + b).orElse("record");
                throw invalid(index, "invalid fields: " + fields);
            }
            if (!Double.isFinite(row.latitude()) || !Double.isFinite(row.longitude())) {
                throw invalid(index, "facility coordinates must be finite");
            }
            if (!ids.add(row.id())) throw invalid(index, "duplicate facility id");
            final int position = index;
            String suppliedDistrict = row.district().strip();
            String district;
            if (suppliedDistrict.startsWith("Phường ") || suppliedDistrict.startsWith("Xã ")) {
                district = suppliedDistrict;
            } else {
                district = districts.canonical(suppliedDistrict)
                        .orElseThrow(() -> invalid(position, "district is outside the supported catalog"));
            }
            entities.add(row.toEntity(district));
        }
        // Validate every row before writing; the transaction also rolls back on DB errors.
        repository.saveAllAndFlush(entities);
    }

    private IllegalArgumentException invalid(int index, String message) {
        return new IllegalArgumentException("Facility import row " + (index + 1) + ": " + message);
    }
}
