package vn.hexacare.sosnow.controller;

import org.springframework.web.bind.annotation.*;
import vn.hexacare.sosnow.dto.FacilityResponse;
import vn.hexacare.sosnow.service.DistrictService;
import vn.hexacare.sosnow.service.FacilityService;
import java.util.List;

@RestController
@RequestMapping("/api")
public class FacilityController {
    private final FacilityService facilities;
    private final DistrictService districts;

    public FacilityController(FacilityService facilities, DistrictService districts) {
        this.facilities = facilities;
        this.districts = districts;
    }

    @GetMapping("/facilities/nearby")
    public List<FacilityResponse> nearby(@RequestParam double lat, @RequestParam double lng,
                                        @RequestParam(defaultValue = "5000") int radius,
                                        @RequestParam(defaultValue = "5") int limit) {
        return facilities.nearby(lat, lng, radius, limit);
    }

    @GetMapping("/facilities")
    public List<FacilityResponse> byDistrict(@RequestParam String district) {
        return facilities.byDistrict(district);
    }

    @GetMapping("/districts")
    public List<String> districts() { return districts.all(); }
}
