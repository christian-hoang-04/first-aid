package vn.hexacare.sosnow.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import vn.hexacare.sosnow.model.Facility;
import vn.hexacare.sosnow.model.FacilityPhone;
import vn.hexacare.sosnow.model.FacilityType;
import java.time.Instant;
import java.util.List;

public record FacilityImport(
        @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") @Size(max = 100) String id,
        @NotBlank @Size(max = 200) String name,
        @NotNull FacilityType type,
        @NotNull @Size(max = 500) String address,
        @NotBlank @Size(max = 100) String district,
        @NotNull @DecimalMin("10.3") @DecimalMax("11.3") Double latitude,
        @NotNull @DecimalMin("106.3") @DecimalMax("107.4") Double longitude,
        @NotNull Boolean hasEmergency,
        @NotEmpty @Size(max = 10) List<@NotNull @Valid Phone> phones,
        @NotNull @PastOrPresent Instant verifiedAt,
        @NotBlank @Size(max = 1000) String verificationSource) {

    public record Phone(
            @NotBlank @Size(max = 100) String label,
            @NotBlank @Pattern(regexp = "(?:115|\\+?[0-9]{8,15})") String number,
            @NotNull Boolean is24h) {}

    public Facility toEntity(String canonicalDistrict) {
        return new Facility(id, name.strip(), type, address.strip(), canonicalDistrict, latitude, longitude,
                hasEmergency, phones.stream().map(p -> new FacilityPhone(p.label.strip(), p.number, p.is24h))
                .toList(), verifiedAt, verificationSource.strip());
    }
}
