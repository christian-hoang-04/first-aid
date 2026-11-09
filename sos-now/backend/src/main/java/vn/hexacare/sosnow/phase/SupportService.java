package vn.hexacare.sosnow.phase;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Instant;
import java.time.Duration;
import java.util.*;
import static vn.hexacare.sosnow.phase.ApiChecks.*;
import static vn.hexacare.sosnow.phase.GuidanceCatalog.Audience;

@Service
public class SupportService {
    public enum Skill { FIRST_AID, CPR, AED, PEDIATRIC }
    public enum State { OPEN, ACCEPTED, CANCELLED, COMPLETED }
    public record Enrollment(String displayName, String contactPhone, Set<Skill> skills,
                             Instant verifiedAt, String verificationSource) {}
    public record Availability(boolean available, Double latitude, Double longitude, boolean consentToLocationUse) {}
    public record CreateRequest(String scenarioId, String locale, Audience audience, Double latitude, Double longitude,
                                int radius, boolean shareLocationWithAcceptedResponder) {}
    public record Nearby(String responderId, String displayName, Set<Skill> skills, long approximateDistanceMeters) {}
    private record Presence(double latitude, double longitude, Instant expiresAt) {}
    private static final Duration PRESENCE_TTL = Duration.ofMinutes(5);
    private static final Duration REQUEST_TTL = Duration.ofMinutes(10);
    private final Map<String, Presence> presence = new HashMap<>();
    private final Map<String, Ticket> requests = new HashMap<>();
    private final ResponderRepository responders;
    private final GuidanceCatalog catalog;
    private final Clock clock;
    private final String adminToken;

    public SupportService(ResponderRepository responders, GuidanceCatalog catalog, Clock clock,
                          @Value("${app.support.admin-token:}") String adminToken) {
        this.responders = responders; this.catalog = catalog; this.clock = clock; this.adminToken = adminToken;
    }
    public synchronized Map<String, Object> enroll(String credential, Enrollment enrollment) {
        admin(credential);
        text(enrollment.displayName(), 100, "display name");
        require(text(enrollment.contactPhone(), 30, "contact phone").matches("\\+?[0-9]{8,15}"), "Invalid contact phone.");
        require(enrollment.skills() != null && !enrollment.skills().isEmpty()
                && enrollment.skills().stream().noneMatch(Objects::isNull), "Verified skills are required.");
        require(reviewed(enrollment.verifiedAt(), clock.instant()), "Completed qualification verification is required.");
        text(enrollment.verificationSource(), 1000, "qualification verification source");
        if (responders.count() >= 10000) throw error(HttpStatus.SERVICE_UNAVAILABLE, "Responder catalog capacity reached.");
        String id = UUID.randomUUID().toString();
        String token = Tokens.issue();
        responders.saveAndFlush(new Responder(id, enrollment, Tokens.hash(token)));
        return Map.of("responderId", id, "accessToken", token, "tokenType", "Bearer", "showTokenOnce", true);
    }
    public synchronized void revoke(String credential, String id) {
        admin(credential); purge();
        Responder profile = responders.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Responder not found."));
        presence.remove(id);
        requests.values().forEach(ticket -> {
            ticket.invited.remove(id);
            if (id.equals(ticket.acceptedBy)) { ticket.state = State.CANCELLED; ticket.clearLocation(); }
        });
        responders.delete(profile);
    }
    public synchronized Map<String, Object> rotate(String credential, String id) {
        admin(credential);
        Responder profile = responders.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Responder not found."));
        String token = Tokens.issue(); profile.setTokenHash(Tokens.hash(token)); responders.saveAndFlush(profile);
        presence.remove(id);
        return Map.of("responderId", id, "accessToken", token, "tokenType", "Bearer", "showTokenOnce", true);
    }
    private void admin(String credential) {
        if (adminToken.length() < 32) throw error(HttpStatus.SERVICE_UNAVAILABLE, "Responder administration is not configured.");
        if (!Tokens.equal(adminToken, credential)) throw error(HttpStatus.UNAUTHORIZED, "Invalid administrator credential.");
    }
    private Responder authenticate(String authorization) {
        Responder profile = responders.findByTokenHash(Tokens.bearerHash(authorization))
                .orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Invalid responder token."));
        if (!reviewed(profile.getVerifiedAt(), clock.instant())) throw error(HttpStatus.FORBIDDEN, "Responder qualification is not verified.");
        return profile;
    }
    public synchronized Map<String, Object> available(String authorization, Availability input) {
        purge(); Responder profile = authenticate(authorization);
        if (!input.available()) { presence.remove(profile.getId()); return Map.of("available", false); }
        require(input.consentToLocationUse() && input.latitude() != null && input.longitude() != null,
                "Location consent and coordinates are required to become available.");
        location(input.latitude(), input.longitude());
        if (presence.size() >= 1000 && !presence.containsKey(profile.getId())) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE, "Live responder capacity reached.");
        }
        Instant expires = clock.instant().plus(PRESENCE_TTL);
        presence.put(profile.getId(), new Presence(input.latitude(), input.longitude(), expires));
        return Map.of("available", true, "expiresAt", expires, "refreshAfterSeconds", 120);
    }
    public synchronized List<Nearby> nearby(double lat, double lng, int radius, int limit, Skill skill, Audience audience) {
        ApiChecks.nearby(lat, lng, radius, limit); require(skill != null && audience != null, "Skill and audience are required."); purge();
        return responders.findAll().stream().filter(p -> reviewed(p.getVerifiedAt(), clock.instant())
                        && p.getSkills().contains(skill) && (audience == Audience.ADULT || p.getSkills().contains(Skill.PEDIATRIC)))
                .filter(p -> presence.containsKey(p.getId()))
                .map(p -> {
                    Presence live = presence.get(p.getId());
                    return new Candidate(p, meters(lat, lng, live.latitude(), live.longitude()));
                }).filter(c -> c.meters <= radius).sorted(Comparator.comparingDouble(Candidate::meters).thenComparing(c -> c.profile.getId()))
                .limit(limit).map(c -> new Nearby(c.profile.getId(), c.profile.getDisplayName(), c.profile.getSkills(),
                        Math.round(c.meters / 100) * 100)).toList();
    }
    public synchronized Map<String, Object> create(CreateRequest input) {
        require(input.shareLocationWithAcceptedResponder() && input.latitude() != null && input.longitude() != null,
                "Explicit consent to share location with the accepting responder is required.");
        ViewIdentity identity = identity(input);
        ApiChecks.nearby(input.latitude(), input.longitude(), input.radius(), 5); purge();
        List<Nearby> candidates = nearby(input.latitude(), input.longitude(), input.radius(), 5,
                identity.skill, input.audience());
        if (candidates.isEmpty()) throw error(HttpStatus.CONFLICT, "No verified available responders in the requested radius.");
        if (requests.size() >= 1000) throw error(HttpStatus.SERVICE_UNAVAILABLE, "Support request capacity reached.");
        String id = UUID.randomUUID().toString(); String token = Tokens.issue();
        Instant expires = clock.instant().plus(REQUEST_TTL);
        Ticket ticket = new Ticket(id, Tokens.hash(token), input, identity.skill, expires,
                new LinkedHashSet<>(candidates.stream().map(Nearby::responderId).toList()));
        requests.put(id, ticket);
        return Map.of("id", id, "status", ticket.state, "requesterToken", token, "expiresAt", expires,
                "invitedCount", ticket.invited.size(), "delivery", "RESPONDER_POLLING", "dispatchConnected", false,
                "emergencyNumber", "115");
    }
    private ViewIdentity identity(CreateRequest input) {
        catalog.get(input.scenarioId(), input.locale(), input.audience());
        return new ViewIdentity(input.scenarioId().equals("cardiac") ? Skill.CPR : Skill.FIRST_AID);
    }
    public synchronized List<Map<String, Object>> inbox(String authorization) {
        purge(); Responder profile = authenticate(authorization);
        Presence live = presence.get(profile.getId());
        return requests.values().stream().filter(t -> t.invited.contains(profile.getId()) && t.state == State.OPEN && live != null
                        || profile.getId().equals(t.acceptedBy) && t.state == State.ACCEPTED)
                .sorted(Comparator.comparing(t -> t.id)).map(t -> {
                    Map<String, Object> view = new LinkedHashMap<>();
                    view.put("id", t.id); view.put("status", t.state); view.put("scenarioId", t.scenarioId);
                    view.put("audience", t.audience); view.put("expiresAt", t.expiresAt);
                    if (t.state == State.ACCEPTED) {
                        view.put("latitude", t.latitude); view.put("longitude", t.longitude);
                    } else view.put("approximateDistanceMeters", Math.round(meters(live.latitude, live.longitude, t.latitude, t.longitude) / 100) * 100);
                    return view;
                }).toList();
    }
    public synchronized Map<String, Object> accept(String authorization, String id) {
        purge(); Responder profile = authenticate(authorization); Ticket ticket = find(id);
        if (!ticket.invited.contains(profile.getId())) throw error(HttpStatus.FORBIDDEN, "Responder was not invited.");
        if (ticket.state != State.OPEN) throw error(HttpStatus.CONFLICT, "Support request is no longer open.");
        if (!presence.containsKey(profile.getId()) || !profile.getSkills().contains(ticket.skill)
                || ticket.audience != Audience.ADULT && !profile.getSkills().contains(Skill.PEDIATRIC)) {
            throw error(HttpStatus.CONFLICT, "Responder is not currently eligible.");
        }
        ticket.state = State.ACCEPTED; ticket.acceptedBy = profile.getId();
        return Map.of("id", id, "status", ticket.state, "latitude", ticket.latitude, "longitude", ticket.longitude,
                "expiresAt", ticket.expiresAt, "dispatchConnected", false, "emergencyNumber", "115");
    }
    public synchronized Map<String, Object> state(String authorization, String id) {
        purge(); Ticket ticket = owned(authorization, id);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", id); view.put("status", ticket.state); view.put("expiresAt", ticket.expiresAt);
        view.put("dispatchConnected", false); view.put("emergencyNumber", "115");
        if (ticket.state == State.ACCEPTED) responders.findById(ticket.acceptedBy).ifPresent(p -> view.put("responder",
                Map.of("id", p.getId(), "displayName", p.getDisplayName(), "contactPhone", p.getContactPhone())));
        return view;
    }
    public synchronized void cancel(String authorization, String id) {
        purge(); Ticket ticket = owned(authorization, id);
        if (ticket.state == State.COMPLETED) throw error(HttpStatus.CONFLICT, "Request is already completed.");
        ticket.state = State.CANCELLED; ticket.clearLocation();
    }
    public synchronized void complete(String authorization, String id) {
        purge(); Responder profile = authenticate(authorization); Ticket ticket = find(id);
        if (!profile.getId().equals(ticket.acceptedBy)) throw error(HttpStatus.FORBIDDEN, "Only the accepting responder can complete this request.");
        if (ticket.state != State.ACCEPTED) throw error(HttpStatus.CONFLICT, "Request is not accepted.");
        ticket.state = State.COMPLETED; ticket.clearLocation();
    }
    private Ticket owned(String authorization, String id) {
        String hash = Tokens.bearerHash(authorization); Ticket ticket = find(id);
        if (!Tokens.equal(hash, ticket.ownerHash)) throw error(HttpStatus.UNAUTHORIZED, "Invalid requester token.");
        return ticket;
    }
    private Ticket find(String id) {
        Ticket ticket = requests.get(id);
        if (ticket == null) throw error(HttpStatus.NOT_FOUND, "Support request not found or expired.");
        return ticket;
    }
    @Scheduled(fixedDelay = 30000)
    public synchronized void purge() {
        Instant now = clock.instant();
        presence.values().removeIf(p -> !p.expiresAt.isAfter(now));
        requests.values().removeIf(t -> { if (!t.expiresAt.isAfter(now)) { t.clearLocation(); return true; } return false; });
    }
    public boolean adminConfigured() { return adminToken.length() >= 32; }
    private record Candidate(Responder profile, double meters) {}
    private record ViewIdentity(Skill skill) {}
    private static class Ticket {
        final String id, ownerHash, scenarioId;
        final Audience audience;
        final Skill skill;
        final Instant expiresAt;
        final Set<String> invited;
        Double latitude, longitude;
        State state = State.OPEN;
        String acceptedBy;
        Ticket(String id, String hash, CreateRequest input, Skill skill, Instant expiresAt, Set<String> invited) {
            this.id = id; this.ownerHash = hash; this.scenarioId = input.scenarioId(); this.audience = input.audience();
            this.latitude = input.latitude(); this.longitude = input.longitude(); this.skill = skill; this.expiresAt = expiresAt;
            this.invited = invited;
        }
        void clearLocation() { latitude = null; longitude = null; invited.clear(); }
    }
}
