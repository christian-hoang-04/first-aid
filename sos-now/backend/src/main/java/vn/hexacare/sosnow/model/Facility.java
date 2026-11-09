package vn.hexacare.sosnow.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "facilities", indexes = @Index(name = "idx_facilities_district", columnList = "district"))
public class Facility {
    @Id @Column(length = 100)
    private String id;
    @Column(nullable = false, length = 200)
    private String name;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    private FacilityType type;
    @Column(nullable = false, length = 500)
    private String address;
    @Column(nullable = false, length = 100)
    private String district;
    @Column(nullable = false)
    private double latitude;
    @Column(nullable = false)
    private double longitude;
    @Column(nullable = false)
    private boolean hasEmergency;
    private Instant verifiedAt;
    @Column(length = 1000)
    private String verificationSource;
    @ElementCollection
    @CollectionTable(name = "facility_phones", joinColumns = @JoinColumn(name = "facility_id"))
    @OrderColumn(name = "phone_order")
    private List<FacilityPhone> phones = new ArrayList<>();

    protected Facility() {}

    public Facility(String id, String name, FacilityType type, String address, String district,
                    double latitude, double longitude, boolean hasEmergency,
                    List<FacilityPhone> phones, Instant verifiedAt, String verificationSource) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.address = address;
        this.district = district;
        this.latitude = latitude;
        this.longitude = longitude;
        this.hasEmergency = hasEmergency;
        this.phones = new ArrayList<>(phones);
        this.verifiedAt = verifiedAt;
        this.verificationSource = verificationSource;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public FacilityType getType() { return type; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public boolean hasEmergency() { return hasEmergency; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public List<FacilityPhone> getPhones() { return List.copyOf(phones); }
}
