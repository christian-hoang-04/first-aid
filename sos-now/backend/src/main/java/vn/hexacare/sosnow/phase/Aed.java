package vn.hexacare.sosnow.phase;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "aeds")
public class Aed {
    public enum Status { OPERATIONAL, OUT_OF_SERVICE, UNKNOWN }
    @Id @Column(length = 100) private String id;
    @Column(nullable = false, length = 200) private String name;
    @Column(nullable = false, length = 500) private String address;
    @Column(nullable = false, length = 100) private String district;
    private double latitude;
    private double longitude;
    @Column(nullable = false, length = 1000) private String accessInstructions;
    @Column(nullable = false, length = 200) private String openingHours;
    private boolean is24h;
    @Enumerated(EnumType.STRING) private Status status;
    private Instant verifiedAt;
    private Instant lastInspectedAt;
    @Column(length = 1000) private String verificationSource;
    protected Aed() {}
    public Aed(AedService.Input input, String district) {
        this.id = input.id(); this.name = input.name(); this.address = input.address(); this.district = district;
        this.latitude = input.latitude(); this.longitude = input.longitude(); this.accessInstructions = input.accessInstructions();
        this.openingHours = input.openingHours(); this.is24h = input.is24h(); this.status = input.status();
        this.verifiedAt = input.verifiedAt(); this.lastInspectedAt = input.lastInspectedAt(); this.verificationSource = input.verificationSource();
    }
    public String getId() { return id; }
    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public String getAccessInstructions() { return accessInstructions; }
    public String getOpeningHours() { return openingHours; }
    public boolean is24h() { return is24h; }
    public Status getStatus() { return status; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public Instant getLastInspectedAt() { return lastInspectedAt; }
}
