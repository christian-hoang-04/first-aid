package vn.hexacare.sosnow.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.hexacare.sosnow.model.SosAlert;
import vn.hexacare.sosnow.repository.SosAlertRepository;
import vn.hexacare.sosnow.service.ScenarioService;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class EmergencyController {
    private final ScenarioService scenarios;
    private final SosAlertRepository alerts;
    public EmergencyController(ScenarioService scenarios, SosAlertRepository alerts) { this.scenarios = scenarios; this.alerts = alerts; }

    @GetMapping("/health") public Map<String, String> health() { return Map.of("status", "ok", "service", "sos-now-api"); }
    @GetMapping("/scenarios") public List<Map<String, Object>> getScenarios() { return scenarios.all(); }
    @GetMapping("/alerts") public List<SosAlert> getAlerts() { return alerts.findTop20ByOrderByCreatedAtDesc(); }
    @PostMapping("/alerts") @ResponseStatus(HttpStatus.CREATED)
    public SosAlert createAlert(@Valid @RequestBody SosAlert alert) { return alerts.save(alert); }
}
