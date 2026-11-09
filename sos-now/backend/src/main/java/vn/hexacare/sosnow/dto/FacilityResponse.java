package vn.hexacare.sosnow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import vn.hexacare.sosnow.model.Facility;
import vn.hexacare.sosnow.model.FacilityType;
import java.time.Instant;
import java.util.List;

public record FacilityResponse(
        String id, String name, FacilityType type, String address, String district,
        double latitude, double longitude,
        @JsonInclude(JsonInclude.Include.NON_NULL) Long distanceMeters,
        @JsonInclude(JsonInclude.Include.NON_NULL) String distanceMethod,
        boolean hasEmergency, List<Phone> phones, Instant verifiedAt) {

    public record Phone(String label, String number, boolean is24h) {}

    public FacilityResponse(String id, String name, FacilityType type, String address, String district,
                            double latitude, double longitude, Long distanceMeters,
                            boolean hasEmergency, List<Phone> phones, Instant verifiedAt) {
        this(id, name, type, address, district, latitude, longitude, distanceMeters, null,
                hasEmergency, phones, verifiedAt);
    }

    public static FacilityResponse from(Facility facility) {
        return new FacilityResponse(facility.getId(), facility.getName(), facility.getType(),
                facility.getAddress(), facility.getDistrict(), facility.getLatitude(), facility.getLongitude(),
                null, null, facility.hasEmergency(), facility.getPhones().stream()
                .map(p -> new Phone(p.getLabel(), p.getNumber(), p.isAvailable24h())).toList(),
                facility.getVerifiedAt());
    }

    public FacilityResponse withDistance(long meters) {
        return withDistance(meters, null);
    }

    public FacilityResponse withDistance(long meters, String method) {
        return new FacilityResponse(id, name, type, address, district, latitude, longitude,
                meters, method, hasEmergency, phones, verifiedAt);
    }

    public int emergencyPriority() {
        if (!hasEmergency) return 2;
        return phones.stream().anyMatch(Phone::is24h) ? 0 : 1;
    }
}
