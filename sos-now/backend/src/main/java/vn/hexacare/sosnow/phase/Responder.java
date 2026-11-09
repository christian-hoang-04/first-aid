package vn.hexacare.sosnow.phase;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "verified_responders")
public class Responder {
    @Id private String id;
    @Column(nullable = false, length = 100) private String displayName;
    @Column(nullable = false, length = 30) private String contactPhone;
    @ElementCollection @Enumerated(EnumType.STRING)
    @CollectionTable(name = "responder_skills", joinColumns = @JoinColumn(name = "responder_id"))
    private Set<SupportService.Skill> skills = new HashSet<>();
    private Instant verifiedAt;
    @Column(nullable = false, length = 1000) private String verificationSource;
    @Column(nullable = false, unique = true, length = 64) private String tokenHash;
    protected Responder() {}
    Responder(String id, SupportService.Enrollment enrollment, String tokenHash) {
        this.id = id; this.displayName = enrollment.displayName(); this.contactPhone = enrollment.contactPhone();
        this.skills = new HashSet<>(enrollment.skills()); this.verifiedAt = enrollment.verifiedAt();
        this.verificationSource = enrollment.verificationSource(); this.tokenHash = tokenHash;
    }
    public String getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getContactPhone() { return contactPhone; }
    public Set<SupportService.Skill> getSkills() { return Set.copyOf(skills); }
    public Instant getVerifiedAt() { return verifiedAt; }
    public void setTokenHash(String hash) { this.tokenHash = hash; }
}
