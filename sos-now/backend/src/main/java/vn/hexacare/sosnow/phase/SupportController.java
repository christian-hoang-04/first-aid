package vn.hexacare.sosnow.phase;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.Audience;
import static vn.hexacare.sosnow.phase.SupportService.*;

@RestController
@RequestMapping("/api")
public class SupportController {
    private final SupportService support;
    public SupportController(SupportService support) { this.support = support; }
    @PostMapping("/admin/responders") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> enroll(@RequestHeader(value = "X-Admin-Token", required = false) String admin,
                                      @RequestBody Enrollment request) { return support.enroll(admin, request); }
    @DeleteMapping("/admin/responders/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@RequestHeader(value = "X-Admin-Token", required = false) String admin,
                       @PathVariable String id) { support.revoke(admin, id); }
    @PostMapping("/admin/responders/{id}/rotate-token")
    public Map<String, Object> rotate(@RequestHeader(value = "X-Admin-Token", required = false) String admin,
                                      @PathVariable String id) { return support.rotate(admin, id); }
    @PutMapping("/responders/me/availability")
    public Map<String, Object> available(@RequestHeader(value = "Authorization", required = false) String token,
                                         @RequestBody Availability request) { return support.available(token, request); }
    @GetMapping("/responders/nearby")
    public List<Nearby> nearby(@RequestParam double lat, @RequestParam double lng,
                               @RequestParam(defaultValue = "5000") int radius, @RequestParam(defaultValue = "5") int limit,
                               @RequestParam(defaultValue = "FIRST_AID") Skill skill,
                               @RequestParam(defaultValue = "ADULT") Audience audience) {
        return support.nearby(lat, lng, radius, limit, skill, audience);
    }
    @PostMapping("/support-requests") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody CreateRequest request) { return support.create(request); }
    @GetMapping("/support-requests/{id}")
    public Map<String, Object> state(@RequestHeader(value = "Authorization", required = false) String token,
                                     @PathVariable String id) { return support.state(token, id); }
    @DeleteMapping("/support-requests/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@RequestHeader(value = "Authorization", required = false) String token,
                       @PathVariable String id) { support.cancel(token, id); }
    @GetMapping("/responders/me/requests")
    public List<Map<String, Object>> inbox(@RequestHeader(value = "Authorization", required = false) String token) {
        return support.inbox(token);
    }
    @PostMapping("/support-requests/{id}/accept")
    public Map<String, Object> accept(@RequestHeader(value = "Authorization", required = false) String token,
                                      @PathVariable String id) { return support.accept(token, id); }
    @PostMapping("/support-requests/{id}/complete") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(@RequestHeader(value = "Authorization", required = false) String token,
                         @PathVariable String id) { support.complete(token, id); }
}
