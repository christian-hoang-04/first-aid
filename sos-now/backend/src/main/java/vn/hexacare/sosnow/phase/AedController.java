package vn.hexacare.sosnow.phase;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/aeds")
public class AedController {
    private final AedService aeds;
    public AedController(AedService aeds) { this.aeds = aeds; }
    @GetMapping("/nearby")
    public List<AedService.View> nearby(@RequestParam double lat, @RequestParam double lng,
                                       @RequestParam(defaultValue = "5000") int radius,
                                       @RequestParam(defaultValue = "5") int limit) {
        return aeds.nearby(lat, lng, radius, limit);
    }
}
