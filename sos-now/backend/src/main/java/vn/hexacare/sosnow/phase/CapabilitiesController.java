package vn.hexacare.sosnow.phase;

import org.springframework.web.bind.annotation.*;
import vn.hexacare.sosnow.service.FacilityCatalog;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.*;
import static vn.hexacare.sosnow.phase.ApiChecks.reviewed;

@RestController
public class CapabilitiesController {
    private final GuidanceCatalog guides;
    private final FacilityCatalog facilities;
    private final AedRepository aeds;
    private final SupportService support;
    private final Clock clock;
    public CapabilitiesController(GuidanceCatalog guides, FacilityCatalog facilities, AedRepository aeds,
                                  SupportService support, Clock clock) {
        this.guides = guides; this.facilities = facilities; this.aeds = aeds; this.support = support; this.clock = clock;
    }
    @GetMapping("/api/capabilities")
    public Map<String, Object> all() {
        long aedCount = aeds.findAll().stream().filter(a -> a.getStatus() == Aed.Status.OPERATIONAL
                && reviewed(a.getVerifiedAt(), clock.instant()) && reviewed(a.getLastInspectedAt(), clock.instant())).count();
        return Map.of("project", "Esmarch", "apiVersion", "0.2.0", "emergencyNumber", "115",
                "phase1", Map.of("facilities", Map.of("apiReady", true, "verifiedCount", facilities.all().size()),
                        "voice", Map.of("apiReady", true, "inputMode", "CLIENT_TRANSCRIPT", "engine", "KEYWORD_RULES",
                                "audioUploadSupported", false, "requiresConfirmation", true),
                        "featuredScenarioIds", List.of("cardiac", "choking", "stroke"),
                        "guides", guides.all("vi", Audience.ADULT, true).stream().map(g -> Map.of("scenarioId", g.scenarioId(),
                                "status", g.status(), "formats", g.availableFormats())).toList()),
                "phase2", Map.of("locales", guides.languages(), "audiences", List.of(Audience.values()),
                        "watchDelivery", "CLIENT_COMPANION", "videoAnswers", "REVIEWED_CONTENT_LOOKUP",
                        "aeds", Map.of("apiReady", true, "verifiedOperationalCount", aedCount)),
                "phase3", Map.of("apiReady", true, "adminConfigured", support.adminConfigured(), "delivery", "RESPONDER_POLLING",
                        "presenceTtlSeconds", 300, "requestTtlSeconds", 600, "storage", "SINGLE_INSTANCE_MEMORY",
                        "dispatchConnected", false));
    }
}
