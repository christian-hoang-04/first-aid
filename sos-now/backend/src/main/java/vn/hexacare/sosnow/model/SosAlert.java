package vn.hexacare.sosnow.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Entity
public class SosAlert {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private String id;
    @NotBlank private String scenarioId;
    @NotNull private Double latitude;
    @NotNull private Double longitude;
    private String note;
    private String status = "OPEN";
    private Instant createdAt = Instant.now();

    public String getId() { return id; }
    public String getScenarioId() { return scenarioId; }
    public void setScenarioId(String scenarioId) { this.scenarioId = scenarioId; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
