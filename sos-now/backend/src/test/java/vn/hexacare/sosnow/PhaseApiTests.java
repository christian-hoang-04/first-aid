package vn.hexacare.sosnow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import vn.hexacare.sosnow.phase.*;
import vn.hexacare.sosnow.repository.SosAlertRepository;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.*;
import static vn.hexacare.sosnow.phase.SupportService.*;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.support.admin-token=phase-api-test-administrator-token-32chars")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class PhaseApiTests {
    private static final String ADMIN = "phase-api-test-administrator-token-32chars";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired GuidanceCatalog guides;
    @Autowired AedService aeds;
    @Autowired AedRepository aedRepository;
    @Autowired SupportService support;
    @Autowired ResponderRepository responders;
    @Autowired SosAlertRepository alerts;
    @Autowired MutableClock clock;

    @TestConfiguration
    static class TimeConfig { @Bean @Primary MutableClock testClock() { return new MutableClock(); } }
    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-30T00:00:00Z");
        synchronized void advance(Duration duration) { now = now.plus(duration); }
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public synchronized Instant instant() { return now; }
    }
    @BeforeEach void reset() {
        clock.advance(Duration.ofHours(1)); support.purge(); responders.deleteAll(); aedRepository.deleteAll();
        guides.replaceReviewed(List.of(guide("vi", Audience.ADULT)));
    }
    private Guide guide(String language, Audience audience) {
        return new Guide("cardiac", language, audience, "Synthetic reviewed test guide", List.of(
                new Step(1, "Test first step", "Synthetic reviewed instruction one", List.of("first", "bước đầu"),
                        List.of(new Media(Format.VIDEO, "https://media.example.test/guide.mp4", "video/mp4", "Test video", 5d, 10d))),
                new Step(2, "Test second step", "Synthetic reviewed instruction two", List.of("second"),
                        List.of(new Media(Format.IMAGE, "https://media.example.test/guide.webp", "image/webp", "Test image", null, null),
                                new Media(Format.MODEL_3D, "https://media.example.test/guide.glb", "model/gltf-binary", "Test model", null, null)))),
                clock.instant().minusSeconds(60), "Test reviewer", List.of("Synthetic test fixture; not clinical content"));
    }
    @Test void guidesExposeMediaAndNeverFallbackFromChildrenToAdult() throws Exception {
        mvc.perform(get("/api/guides/cardiac")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.availableFormats", containsInAnyOrder("IMAGE", "VIDEO", "MODEL_3D")))
                .andExpect(jsonPath("$.steps[0].media[0].startSeconds").value(5));
        for (String audience : List.of("CHILD", "INFANT")) {
            mvc.perform(get("/api/guides/cardiac").param("audience", audience))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING_REVIEW"))
                    .andExpect(jsonPath("$.steps", hasSize(0)));
        }
        mvc.perform(get("/api/guides").param("featured", "true")).andExpect(jsonPath("$", hasSize(3)));
    }
    @Test void supportsLocalizedReviewedContentAndRejectsUnsupportedLocales() throws Exception {
        guides.replaceReviewed(List.of(guide("vi", Audience.ADULT), guide("en", Audience.CHILD)));
        mvc.perform(get("/api/guides/cardiac").param("locale", "en-US").param("audience", "CHILD"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locale").value("en"))
                .andExpect(jsonPath("$.audience").value("CHILD")).andExpect(jsonPath("$.status").value("READY"));
        mvc.perform(get("/api/locales")).andExpect(jsonPath("$[1].reviewedAudiences", hasItem("CHILD")));
        mvc.perform(get("/api/guides/cardiac").param("locale", "fr")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/guides/missing")).andExpect(status().isNotFound());
    }
    @Test void rejectsUnreviewedFutureAndUnsafeMediaCatalogsAtomically() {
        Guide good = guide("vi", Audience.ADULT);
        Guide future = new Guide(good.scenarioId(), "en", good.audience(), good.title(), good.steps(), clock.instant().plusSeconds(60), good.reviewedBy(), good.sources());
        assertThatThrownBy(() -> guides.replaceReviewed(List.of(good, future))).isInstanceOf(ResponseStatusException.class);
        assertThat(guides.get("cardiac", "en", Audience.ADULT).status()).isEqualTo("PENDING_REVIEW");
        Guide unsafe = new Guide("cardiac", "vi", Audience.CHILD, "Test", List.of(new Step(1, "Test", "Test", List.of(),
                List.of(new Media(Format.IMAGE, "javascript:alert(1)", "image/png", "Test", null, null)))), good.reviewedAt(), "Test", good.sources());
        assertThatThrownBy(() -> guides.replaceReviewed(List.of(unsafe))).isInstanceOf(ResponseStatusException.class);
        assertThat(guides.get("cardiac", "vi", Audience.ADULT).status()).isEqualTo("READY");
    }
    @Test void voiceRecognizesVietnameseAndEnglishWithoutPersistingTranscript(CapturedOutput output) throws Exception {
        long before = alerts.count();
        mvc.perform(post("/api/voice/interpret").contentType("application/json")
                        .content(mapper.writeValueAsString(new VoiceService.Request("khong tho", "vi", Audience.ADULT))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.suggestedScenarioId").value("cardiac"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true)).andExpect(jsonPath("$.inputMode").value("CLIENT_TRANSCRIPT"));
        mvc.perform(post("/api/voice/interpret").contentType("application/json")
                        .content(mapper.writeValueAsString(new VoiceService.Request("he is choking", "en", Audience.ADULT))))
                .andExpect(jsonPath("$.suggestedScenarioId").value("choking"))
                .andExpect(jsonPath("$.status").value("CONTENT_UNAVAILABLE"));
        String response = mvc.perform(post("/api/voice/interpret").contentType("application/json")
                        .content(mapper.writeValueAsString(new VoiceService.Request("private-phrase-4395", "vi", Audience.ADULT))))
                .andExpect(jsonPath("$.status").value("NEEDS_CLARIFICATION")).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("private-phrase-4395");
        assertThat(output.getAll()).doesNotContain("private-phrase-4395");
        assertThat(alerts.count()).isEqualTo(before);
    }
    @Test void voiceRejectsAmbiguousNegatedAndMissingFields() throws Exception {
        for (String transcript : List.of("ngừng tim chảy máu", "không bị đột quỵ", "hello")) {
            mvc.perform(post("/api/voice/interpret").contentType("application/json")
                            .content(mapper.writeValueAsString(new VoiceService.Request(transcript, "vi", Audience.ADULT))))
                    .andExpect(jsonPath("$.status").value("NEEDS_CLARIFICATION"));
        }
        mvc.perform(post("/api/voice/interpret").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }
    @Test void videoAnswersPointToReviewedSegmentsAndUnknownQuestionNeedsClarification() throws Exception {
        mvc.perform(post("/api/video/answers").contentType("application/json").content(mapper.writeValueAsString(
                        new GuidanceController.VideoQuestion("cardiac", "vi", Audience.ADULT, "show first", 0d))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("MATCHED"))
                .andExpect(jsonPath("$.seekToSeconds").value(5)).andExpect(jsonPath("$.answerMode").value("REVIEWED_CONTENT_LOOKUP"));
        mvc.perform(post("/api/video/answers").contentType("application/json").content(mapper.writeValueAsString(
                        new GuidanceController.VideoQuestion("cardiac", "vi", Audience.ADULT, "unknown", 0d))))
                .andExpect(jsonPath("$.status").value("NEEDS_CLARIFICATION"));
    }
    @Test void watchReceivesCompactTextWithoutMediaPayload() throws Exception {
        String body = mvc.perform(get("/api/wear/guides/cardiac")).andExpect(status().isOk())
                .andExpect(jsonPath("$.emergencyNumber").value("115"))
                .andExpect(jsonPath("$.dispatchConnected").value(false))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("media.example", "media", "MODEL_3D");
    }
    private AedService.Input aed(String id, Aed.Status status, double lat) {
        return new AedService.Input(id, "Synthetic test AED", "Test address", "Bình Thạnh", lat, 106.7,
                "Test access", "Test hours", false, status, clock.instant().minusSeconds(60),
                clock.instant().minusSeconds(60), "Synthetic test verification");
    }
    @Test void aedLookupIncludesAccessDetailsExcludesBrokenDevicesAndKeepsRadius() throws Exception {
        aeds.importVerified(List.of(aed("near", Aed.Status.OPERATIONAL, 10.8), aed("broken", Aed.Status.OUT_OF_SERVICE, 10.8),
                aed("far", Aed.Status.OPERATIONAL, 11.1)));
        mvc.perform(get("/api/aeds/nearby").param("lat", "10.8").param("lng", "106.7"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", contains("near")))
                .andExpect(jsonPath("$[0].accessInstructions").value("Test access"));
        mvc.perform(get("/api/aeds/nearby").param("lat", "NaN").param("lng", "106.7"))
                .andExpect(status().isBadRequest());
    }
    @Test void unverifiedAedImportIsRejectedWithoutWritingValidRows() {
        var invalid = new AedService.Input("bad", "Test", "Test", "Bình Thạnh", 10.8, 106.7, "Test", "Test", true,
                Aed.Status.OPERATIONAL, null, clock.instant(), "Test");
        assertThatThrownBy(() -> aeds.importVerified(List.of(aed("good", Aed.Status.OPERATIONAL, 10.8), invalid)))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(aedRepository.count()).isZero();
    }
    private record Helper(String id, String authorization) {}
    private Helper helper(Set<Skill> skills, double lat) {
        var enrolled = support.enroll(ADMIN, new Enrollment("Test alias", "02800000000", skills,
                clock.instant().minusSeconds(60), "Synthetic test verification"));
        String id = (String) enrolled.get("responderId"); String auth = "Bearer " + enrolled.get("accessToken");
        support.available(auth, new Availability(true, lat, 106.7, true));
        return new Helper(id, auth);
    }
    private Map<String, Object> request(Audience audience) {
        return support.create(new CreateRequest("cardiac", "vi", audience, 10.8, 106.7, 5000, true));
    }
    @Test void adminEnrollmentRequiresCredentialsAndVerifiedQualification() throws Exception {
        String body = mapper.writeValueAsString(new Enrollment("Test", "02800000000", Set.of(Skill.CPR), clock.instant(), "Test"));
        mvc.perform(post("/api/admin/responders").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/responders").header("X-Admin-Token", ADMIN).contentType("application/json").content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.accessToken").isString());
        assertThatThrownBy(() -> support.enroll(ADMIN, new Enrollment("Test", "02800000000", Set.of(Skill.CPR), null, "Test")))
                .isInstanceOf(ResponseStatusException.class);
    }
    @Test void nearbyRespondersHideCoordinatesPhoneAndRequirePediatricSkill() throws Exception {
        helper(Set.of(Skill.CPR), 10.8);
        Helper pediatric = helper(Set.of(Skill.CPR, Skill.PEDIATRIC), 10.81);
        String body = mvc.perform(get("/api/responders/nearby").param("lat", "10.8").param("lng", "106.7")
                        .param("skill", "CPR").param("audience", "CHILD"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].responderId", contains(pediatric.id)))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("latitude", "longitude", "contactPhone", "tokenHash");
    }
    @Test void supportRequestFlowsFromConsentToAcceptToCompleteWithPrivateLocation() throws Exception {
        Helper helper = helper(Set.of(Skill.CPR), 10.8);
        long before = alerts.count();
        var created = request(Audience.ADULT); String id = (String) created.get("id");
        String owner = "Bearer " + created.get("requesterToken");
        mvc.perform(get("/api/responders/me/requests").header("Authorization", helper.authorization))
                .andExpect(jsonPath("$[0].latitude").doesNotExist()).andExpect(jsonPath("$[0].longitude").doesNotExist());
        mvc.perform(post("/api/support-requests/{id}/accept", id).header("Authorization", helper.authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.latitude").value(10.8));
        mvc.perform(get("/api/support-requests/{id}", id).header("Authorization", owner))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.responder.contactPhone").value("02800000000"));
        mvc.perform(post("/api/support-requests/{id}/complete", id).header("Authorization", helper.authorization))
                .andExpect(status().isNoContent());
        assertThat(support.inbox(helper.authorization)).isEmpty();
        assertThat(support.state(owner, id).get("status")).isEqualTo(State.COMPLETED);
        assertThat(alerts.count()).isEqualTo(before);
    }
    @Test void rejectsMissingConsentAndWrongRequesterTokens() throws Exception {
        Helper helper = helper(Set.of(Skill.CPR), 10.8);
        assertThatThrownBy(() -> support.create(new CreateRequest("cardiac", "vi", Audience.ADULT, 10.8, 106.7, 5000, false)))
                .isInstanceOf(ResponseStatusException.class);
        var created = request(Audience.ADULT);
        mvc.perform(get("/api/support-requests/{id}", created.get("id")).header("Authorization", helper.authorization))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/responders/me/requests")).andExpect(status().isUnauthorized());
    }
    @Test void onlyOneInvitedResponderCanAcceptARequest() throws Exception {
        Helper one = helper(Set.of(Skill.CPR), 10.8), two = helper(Set.of(Skill.CPR), 10.81);
        var created = request(Audience.ADULT); String id = (String) created.get("id");
        try (var executor = Executors.newFixedThreadPool(2)) {
            List<Callable<Integer>> calls = List.of(() -> acceptStatus(one.authorization, id), () -> acceptStatus(two.authorization, id));
            var results = executor.invokeAll(calls).stream().map(f -> { try { return f.get(); } catch (Exception e) { throw new RuntimeException(e); } }).toList();
            assertThat(results).containsExactlyInAnyOrder(200, 409);
        }
    }
    private int acceptStatus(String token, String id) {
        try { support.accept(token, id); return 200; } catch (ResponseStatusException e) { return e.getStatusCode().value(); }
    }
    @Test void expiryAndCancellationRemoveAccessToLocation() throws Exception {
        Helper helper = helper(Set.of(Skill.CPR), 10.8);
        var created = request(Audience.ADULT); String id = (String) created.get("id"); String owner = "Bearer " + created.get("requesterToken");
        support.accept(helper.authorization, id); support.cancel(owner, id);
        assertThat(support.inbox(helper.authorization)).isEmpty();
        clock.advance(Duration.ofMinutes(11)); support.purge();
        mvc.perform(get("/api/support-requests/{id}", id).header("Authorization", owner)).andExpect(status().isNotFound());
        assertThat(support.nearby(10.8, 106.7, 5000, 5, Skill.CPR, Audience.ADULT)).isEmpty();
    }
    @Test void revokedAndRotatedTokensLoseAccessImmediately() {
        Helper helper = helper(Set.of(Skill.CPR), 10.8);
        var rotated = support.rotate(ADMIN, helper.id);
        assertThatThrownBy(() -> support.inbox(helper.authorization)).isInstanceOf(ResponseStatusException.class);
        String next = "Bearer " + rotated.get("accessToken");
        support.available(next, new Availability(true, 10.8, 106.7, true));
        support.revoke(ADMIN, helper.id);
        assertThatThrownBy(() -> support.inbox(next)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void capabilitiesReportDataAndEngineHonestly() throws Exception {
        mvc.perform(get("/api/capabilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.phase1.voice.engine").value("KEYWORD_RULES"))
                .andExpect(jsonPath("$.phase1.voice.audioUploadSupported").value(false))
                .andExpect(jsonPath("$.phase3.dispatchConnected").value(false));
    }
}
