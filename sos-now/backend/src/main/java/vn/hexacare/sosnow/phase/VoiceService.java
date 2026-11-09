package vn.hexacare.sosnow.phase;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import static vn.hexacare.sosnow.phase.ApiChecks.*;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.*;

@Service
public class VoiceService {
    public record Request(String transcript, String locale, Audience audience) {}
    public record Response(String status, String inputMode, String engine, String locale, Audience audience,
                           String suggestedScenarioId, List<String> matchedTerms, boolean requiresConfirmation,
                           String emergencyNumber, String spokenText, View guide) {}
    private static final Map<String, List<String>> VI = Map.of(
            "cardiac", List.of("bất tỉnh", "không thở", "ngừng tim", "ngã quỵ"),
            "choking", List.of("hóc", "nghẹn", "dị vật", "không nói được", "không ho được"),
            "stroke", List.of("méo miệng", "yếu tay", "nói khó", "đột quỵ", "tai biến"),
            "bleeding", List.of("chảy máu", "mất máu", "đứt tay", "vết thương"));
    private static final Map<String, List<String>> EN = Map.of(
            "cardiac", List.of("unresponsive", "not breathing", "cardiac arrest", "collapsed"),
            "choking", List.of("choking", "cannot cough", "cannot speak"),
            "stroke", List.of("stroke", "face drooping", "arm weakness", "slurred speech"),
            "bleeding", List.of("bleeding", "blood loss", "deep cut"));
    private final GuidanceCatalog catalog;
    private final ObjectMapper mapper;
    private final boolean remoteEnabled;
    private final URI endpoint;
    private HttpClient client;

    public VoiceService(GuidanceCatalog catalog, ObjectMapper mapper,
                        @Value("${app.ai.enabled:false}") boolean remoteEnabled,
                        @Value("${app.ai-base-url:http://localhost:8000}") String baseUrl) {
        this.catalog = catalog; this.mapper = mapper; this.remoteEnabled = remoteEnabled;
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/triage");
    }

    public Response interpret(Request request) {
        String transcript = text(request.transcript(), 500, "transcript");
        require(transcript.length() >= 2 && request.audience() != null, "Transcript and audience are required.");
        String language = locale(request.locale());
        var terms = language.equals("vi") ? VI : EN;
        var matches = new HashMap<String, List<String>>();
        terms.forEach((id, keywords) -> matches.put(id, keywords.stream()
                .filter(term -> containsPhrase(transcript, term)).toList()));
        int max = matches.values().stream().mapToInt(List::size).max().orElse(0);
        List<String> candidates = matches.keySet().stream().filter(id -> matches.get(id).size() == max).toList();
        boolean negated = List.of("không bị", "không có", "not choking", "no stroke", "not bleeding")
                .stream().anyMatch(term -> containsPhrase(transcript, term));
        String id = max > 0 && candidates.size() == 1 && !negated ? candidates.getFirst() : null;
        String engine = "LOCAL_KEYWORD_RULES";
        if (remoteEnabled && id != null) {
            // Remote classification is optional; it cannot override an ambiguous local result.
            try {
                var httpRequest = HttpRequest.newBuilder(endpoint).timeout(Duration.ofMillis(1500))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(
                                Map.of("text", transcript, "locale", language)))).build();
                var response = remoteClient().send(httpRequest, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200 && response.body().length() <= 100_000) {
                    var result = mapper.readTree(response.body());
                    if (id.equals(result.path("scenario_id").asText())) engine = "KEYWORD_RULES_SERVICE";
                    else id = null; // Do not silently choose when two classifiers disagree.
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } catch (Exception ignored) {
                // No transcript or provider exception is logged. Local classification remains available.
            }
        }
        View guide = id == null ? null : catalog.get(id, language, request.audience());
        String status = id == null ? "NEEDS_CLARIFICATION" : guide.status().equals("READY") ? "MATCHED" : "CONTENT_UNAVAILABLE";
        String spoken = guide != null && guide.status().equals("READY") ? guide.steps().getFirst().text()
                : language.equals("vi") ? "Hãy xác nhận tình huống. Nếu khẩn cấp, gọi 115."
                : "Please confirm the situation. In an emergency, call 115.";
        return new Response(status, "CLIENT_TRANSCRIPT", engine, language, request.audience(), id,
                id == null ? List.of() : matches.get(id), true, "115", spoken, guide);
    }
    private synchronized HttpClient remoteClient() {
        if (client == null) client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(400)).build();
        return client;
    }
}
