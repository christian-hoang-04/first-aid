package vn.hexacare.sosnow.phase;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.*;
import static vn.hexacare.sosnow.phase.ApiChecks.*;

@RestController
@RequestMapping("/api")
public class GuidanceController {
    private final GuidanceCatalog catalog;
    public GuidanceController(GuidanceCatalog catalog) { this.catalog = catalog; }
    @GetMapping("/guides")
    public List<View> guides(@RequestParam(defaultValue = "vi") String locale,
                            @RequestParam(defaultValue = "ADULT") Audience audience,
                            @RequestParam(defaultValue = "false") boolean featured) {
        return catalog.all(locale, audience, featured);
    }
    @GetMapping("/guides/{scenarioId}")
    public View guide(@PathVariable String scenarioId, @RequestParam(defaultValue = "vi") String locale,
                      @RequestParam(defaultValue = "ADULT") Audience audience) {
        return catalog.get(scenarioId, locale, audience);
    }
    @GetMapping("/locales") public List<Language> locales() { return catalog.languages(); }
    @GetMapping("/wear/guides/{scenarioId}")
    public Map<String, Object> watch(@PathVariable String scenarioId, @RequestParam(defaultValue = "vi") String locale,
                                    @RequestParam(defaultValue = "ADULT") Audience audience) {
        View guide = catalog.get(scenarioId, locale, audience);
        return Map.of("scenarioId", guide.scenarioId(), "title", guide.title(), "status", guide.status(),
                "locale", guide.locale(), "audience", guide.audience(), "emergencyNumber", "115",
                "steps", guide.steps().stream().map(s -> Map.of("number", s.number(), "title", s.title(), "text", s.text())).toList(),
                "delivery", "CLIENT_COMPANION", "dispatchConnected", false);
    }
    public record VideoQuestion(String scenarioId, String locale, Audience audience, String question, Double positionSeconds) {}
    @PostMapping("/video/answers")
    public Map<String, Object> answer(@RequestBody VideoQuestion request) {
        String question = text(request.question(), 500, "question");
        require(request.positionSeconds() == null || Double.isFinite(request.positionSeconds()) && request.positionSeconds() >= 0,
                "Invalid playback position.");
        View guide = catalog.get(request.scenarioId(), request.locale(), request.audience());
        if (!guide.status().equals("READY")) return Map.of("status", "CONTENT_UNAVAILABLE", "requiresConfirmation", true);
        var ranked = guide.steps().stream().map(s -> new Scored(s, (int) s.keywords().stream()
                .filter(term -> containsPhrase(question, term)).count())).sorted((a, b) -> Integer.compare(b.score, a.score)).toList();
        if (ranked.getFirst().score == 0 || ranked.size() > 1 && ranked.getFirst().score == ranked.get(1).score) {
            return Map.of("status", "NEEDS_CLARIFICATION", "requiresConfirmation", true);
        }
        Step step = ranked.getFirst().step;
        var video = step.media().stream().filter(m -> m.type() == Format.VIDEO && m.startSeconds() != null).findFirst();
        if (video.isEmpty()) return Map.of("status", "VIDEO_UNAVAILABLE", "stepNumber", step.number(), "text", step.text());
        return Map.of("status", "MATCHED", "stepNumber", step.number(), "text", step.text(), "video", video.get(),
                "seekToSeconds", video.get().startSeconds(), "answerMode", "REVIEWED_CONTENT_LOOKUP", "requiresConfirmation", true);
    }
    private record Scored(Step step, int score) {}
}
