package vn.hexacare.sosnow.phase;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import static vn.hexacare.sosnow.phase.ApiChecks.*;

@Service
public class GuidanceCatalog implements ApplicationRunner {
    public enum Audience { ADULT, CHILD, INFANT }
    public enum Format { IMAGE, VIDEO, MODEL_3D }
    public record Media(Format type, String url, String mimeType, String alt,
                        Double startSeconds, Double endSeconds) {}
    public record Step(int number, String title, String text, List<String> keywords, List<Media> media) {}
    public record Guide(String scenarioId, String locale, Audience audience, String title,
                        List<Step> steps, Instant reviewedAt, String reviewedBy, List<String> sources) {}
    public record View(String scenarioId, String title, String locale, Audience audience, boolean featured,
                       String status, List<Step> steps, List<Format> availableFormats, Instant reviewedAt,
                       List<String> sources) {}
    public record Language(String code, String name, String speechLocale, List<Audience> reviewedAudiences) {}

    private static final Map<String, List<String>> TITLES = Map.of(
            "cardiac", List.of("Bất tỉnh hoặc ngừng thở", "Unresponsive or not breathing normally"),
            "choking", List.of("Hóc nghẹn", "Choking"),
            "stroke", List.of("Dấu hiệu đột quỵ", "Stroke signs"),
            "bleeding", List.of("Chảy máu nhiều", "Severe bleeding"));
    private static final List<String> IDS = List.of("cardiac", "choking", "stroke", "bleeding");
    private volatile Map<String, Guide> guides = Map.of();
    private final String dataFile;
    private final ObjectMapper mapper;
    private final Clock clock;

    public GuidanceCatalog(@Value("${app.guides.data-file:}") String dataFile, ObjectMapper mapper, Clock clock) {
        this.dataFile = dataFile; this.mapper = mapper; this.clock = clock;
    }

    @Override public void run(ApplicationArguments args) throws Exception {
        if (dataFile.isBlank()) return;
        Path path = Path.of(dataFile);
        require(Files.size(path) <= 5_000_000, "Guide file exceeds 5 MB.");
        try (var input = Files.newInputStream(path)) {
            List<Guide> rows = mapper.readerFor(new TypeReference<List<Guide>>() {})
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(input);
            replaceReviewed(rows);
        }
    }

    public void replaceReviewed(List<Guide> rows) {
        require(rows != null && !rows.isEmpty() && rows.size() <= 100, "Invalid guide catalog size.");
        Map<String, Guide> next = new HashMap<>();
        for (Guide guide : rows) {
            require(guide != null && guide.scenarioId() != null && IDS.contains(guide.scenarioId()) && guide.audience() != null, "Invalid guide identity.");
            String language = locale(guide.locale());
            text(guide.title(), 200, "guide title");
            require(reviewed(guide.reviewedAt(), clock.instant()), "Guide must have a completed clinical review.");
            text(guide.reviewedBy(), 200, "reviewedBy");
            require(guide.sources() != null && !guide.sources().isEmpty(), "Guide sources are required.");
            guide.sources().forEach(source -> text(source, 1000, "source"));
            require(guide.steps() != null && !guide.steps().isEmpty() && guide.steps().size() <= 50, "Invalid guide steps.");
            int number = 1;
            for (Step step : guide.steps()) {
                require(step != null && step.number() == number++, "Guide steps must be sequential from 1.");
                text(step.title(), 200, "step title"); text(step.text(), 3000, "step text");
                require(step.keywords() != null && step.keywords().size() <= 30 && step.media() != null
                        && step.media().size() <= 10, "Invalid step metadata.");
                step.keywords().forEach(term -> text(term, 100, "keyword"));
                for (Media media : step.media()) {
                    require(media != null && media.type() != null, "Invalid media type.");
                    https(media.url()); text(media.alt(), 500, "media alt");
                    String expected = switch (media.type()) {
                        case IMAGE -> "image/"; case VIDEO -> "video/"; case MODEL_3D -> "model/gltf";
                    };
                    require(text(media.mimeType(), 100, "mimeType").startsWith(expected), "Media MIME type does not match format.");
                    if (media.startSeconds() != null || media.endSeconds() != null) {
                        require(media.type() == Format.VIDEO && media.startSeconds() != null && media.endSeconds() != null
                                && Double.isFinite(media.startSeconds()) && Double.isFinite(media.endSeconds())
                                && media.startSeconds() >= 0 && media.endSeconds() > media.startSeconds(), "Invalid video segment.");
                    }
                }
            }
            String key = key(guide.scenarioId(), language, guide.audience());
            require(!next.containsKey(key), "Duplicate guide identity.");
            // Copy nested lists to avoid exposing mutable caller-owned collections.
            next.put(key, new Guide(guide.scenarioId(), language, guide.audience(), guide.title(),
                    guide.steps().stream().map(step -> new Step(step.number(), step.title(), step.text(),
                            List.copyOf(step.keywords()), List.copyOf(step.media()))).toList(), guide.reviewedAt(),
                    guide.reviewedBy(), List.copyOf(guide.sources())));
        }
        guides = Map.copyOf(next);
    }

    public List<View> all(String language, Audience audience, boolean featuredOnly) {
        return IDS.stream().filter(id -> !featuredOnly || !id.equals("bleeding"))
                .map(id -> get(id, language, audience)).toList();
    }
    public View get(String id, String language, Audience audience) {
        require(audience != null, "Audience is required.");
        language = locale(language);
        if (id == null || !IDS.contains(id)) throw error(HttpStatus.NOT_FOUND, "Scenario not found.");
        Guide guide = guides.get(key(id, language, audience));
        boolean ready = guide != null && reviewed(guide.reviewedAt(), clock.instant());
        return new View(id, ready ? guide.title() : TITLES.get(id).get(language.equals("vi") ? 0 : 1), language,
                audience, !id.equals("bleeding"), ready ? "READY" : "PENDING_REVIEW",
                ready ? guide.steps() : List.of(), ready ? guide.steps().stream().flatMap(s -> s.media().stream())
                .map(Media::type).distinct().toList() : List.of(), ready ? guide.reviewedAt() : null,
                ready ? guide.sources() : List.of());
    }
    public List<Language> languages() {
        return List.of(new Language("vi", "Tiếng Việt", "vi-VN", reviewedAudiences("vi")),
                new Language("en", "English", "en-US", reviewedAudiences("en")));
    }
    private List<Audience> reviewedAudiences(String language) {
        return Arrays.stream(Audience.values()).filter(a -> all(language, a, false).stream()
                .anyMatch(g -> g.status().equals("READY"))).toList();
    }
    private String key(String id, String language, Audience audience) { return id + ":" + language + ":" + audience; }
}
