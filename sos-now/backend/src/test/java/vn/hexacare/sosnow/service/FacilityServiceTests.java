package vn.hexacare.sosnow.service;

import org.junit.jupiter.api.Test;
import vn.hexacare.sosnow.dto.FacilityResponse;
import vn.hexacare.sosnow.model.FacilityType;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class FacilityServiceTests {
    @Test
    void handlesAntipodalCoordinatesWithoutNan() {
        assertThat(FacilityService.distanceMeters(0, 0, 0, 180)).isBetween(20_000_000d, 20_020_000d);
        assertThat(FacilityService.distanceMeters(10.8, 106.7, 10.8, 106.7)).isZero();
    }

    @Test
    void warmSearchOverTenThousandFacilitiesStaysUnderOneSecond() {
        var facilities = IntStream.range(0, 10_000).mapToObj(i -> new FacilityResponse(
                "synthetic-" + i, "Synthetic facility", FacilityType.HOSPITAL, "Test address", "Bình Thạnh",
                10.7 + i * 0.00001, 106.7, null, true,
                List.of(new FacilityResponse.Phone("Test only", "02800000000", true)), Instant.EPOCH)).toList();
        var catalog = mock(FacilityCatalog.class);
        when(catalog.all()).thenReturn(facilities);
        var service = new FacilityService(catalog, new DistrictService());
        service.nearby(10.8, 106.7, 5000, 5);
        long started = System.nanoTime();
        var result = service.nearby(10.8, 106.7, 5000, 5);
        long elapsed = (System.nanoTime() - started) / 1_000_000;
        assertThat(result).hasSize(5);
        assertThat(result).extracting(FacilityResponse::distanceMeters).isSorted();
        assertThat(elapsed).isLessThan(1000);
        System.out.println("Warm nearby service search, 10000 synthetic facilities: " + elapsed + " ms");
    }

    @Test
    void expandsToAvailableHcmcFacilitiesEvenForFarAwayUser() {
        var facility = new FacilityResponse("test", "Test", FacilityType.HOSPITAL, "Test address", "Bình Thạnh",
                10.8, 106.7, null, true, List.of(new FacilityResponse.Phone("Test", "02800000000", true)), Instant.EPOCH);
        var catalog = mock(FacilityCatalog.class);
        when(catalog.all()).thenReturn(List.of(facility));
        var service = new FacilityService(catalog, new DistrictService());
        assertThat(service.nearby(-10.8, -73.3, 1, 50)).hasSize(1);
    }
}
