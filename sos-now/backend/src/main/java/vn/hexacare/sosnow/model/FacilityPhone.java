package vn.hexacare.sosnow.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class FacilityPhone {
    @Column(nullable = false, length = 100)
    private String label;
    @Column(nullable = false, length = 30)
    private String number;
    @Column(name = "is_24h", nullable = false)
    private boolean available24h;

    protected FacilityPhone() {}

    public FacilityPhone(String label, String number, boolean available24h) {
        this.label = label;
        this.number = number;
        this.available24h = available24h;
    }

    public String getLabel() { return label; }
    public String getNumber() { return number; }
    public boolean isAvailable24h() { return available24h; }
}
