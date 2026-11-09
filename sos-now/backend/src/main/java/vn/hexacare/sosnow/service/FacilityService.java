package vn.hexacare.sosnow.service;

import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.hexacare.sosnow.dto.FacilityResponse;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class FacilityService {
    private static final Comparator<FacilityResponse> DISTRICT_ORDER = Comparator
            .comparingInt(FacilityResponse::emergencyPriority)
            .thenComparing(FacilityResponse::name).thenComparing(FacilityResponse::id);
    private static final Comparator<FacilityResponse> NEARBY_ORDER = Comparator
            .comparingLong(FacilityResponse::distanceMeters)
            .thenComparingInt(FacilityResponse::emergencyPriority).thenComparing(FacilityResponse::id);
    private final FacilityCatalog catalog;
    private final DistrictService districts;
    private final RoadDistanceService roadDistances;

    @Autowired
    public FacilityService(FacilityCatalog catalog, DistrictService districts, RoadDistanceService roadDistances) {
        this.catalog = catalog;
        this.districts = districts;
        this.roadDistances = roadDistances;
    }

    public FacilityService(FacilityCatalog catalog, DistrictService districts) {
        this(catalog, districts, null);
    }

    public List<FacilityResponse> byDistrict(String district) {
        String canonical = districts.canonical(district).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Choose a district from /api/districts."));
        return catalog.all().stream().filter(f -> f.district().equals(canonical)).sorted(DISTRICT_ORDER).toList();
    }

    public List<FacilityResponse> nearby(double lat, double lng, int radius, int limit) {
        if (!Double.isFinite(lat) || !Double.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180
                || radius < 1 || radius > 50_000 || limit < 1 || limit > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid search parameters: lat [-90,90], lng [-180,180], radius [1,50000], limit [1,50].");
        }
        // User coordinates and calculated distances remain request-local and are never persisted or cached.
        List<FacilityResponse> facilities = catalog.all();
        List<Long> routed = roadDistances == null
                ? java.util.Collections.nCopies(facilities.size(), null)
                : roadDistances.distancesMeters(lat, lng, facilities);
        List<Located> located = new ArrayList<>(facilities.size());
        for (int index = 0; index < facilities.size(); index++) {
            FacilityResponse facility = facilities.get(index);
            Long roadMeters = routed.get(index);
            long meters = roadMeters != null ? roadMeters
                    : Math.round(distanceMeters(lat, lng, facility.latitude(), facility.longitude()));
            located.add(new Located(facility, meters, roadMeters != null ? "ROAD" : "STRAIGHT_LINE"));
        }
        if (located.isEmpty()) return List.of();
        int target = Math.min(Math.min(3, limit), located.size());
        double searchRadius = radius;
        List<Located> matches;
        do {
            double current = searchRadius;
            matches = located.stream().filter(f -> f.meters <= current).toList();
            searchRadius *= 2;
        } while (matches.size() < target);
        return matches.stream().map(f -> f.facility.withDistance(f.meters, f.distanceMethod))
                .sorted(NEARBY_ORDER).limit(limit).toList();
    }

    static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(deltaLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.pow(Math.sin(deltaLng / 2), 2);
        return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.clamp(a, 0, 1)));
    }

    private record Located(FacilityResponse facility, long meters, String distanceMethod) {}
}
