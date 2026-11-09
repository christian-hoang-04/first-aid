package vn.hexacare.sosnow.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.net.URI;

/** Public display settings only. This endpoint receives no visitor location. */
@RestController
public class MapController {
    public record Center(double lat, double lng) {}
    public record MapConfig(String providerName, String tileUrl, String attributionText, String attributionUrl,
                            Center defaultCenter, int defaultZoom, int maxZoom) {}
    private final MapConfig config;

    public MapController(@Value("${app.map.provider-name:OpenStreetMap}") String providerName,
                         @Value("${app.map.tile-url:}") String tileUrl,
                         @Value("${app.map.attribution-text:© OpenStreetMap contributors}") String attributionText,
                         @Value("${app.map.attribution-url:https://www.openstreetmap.org/copyright}") String attributionUrl,
                         @Value("${app.map.max-zoom:19}") int maxZoom) {
        if (tileUrl.isBlank()) tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
        if (!tileUrl.contains("{z}") || !tileUrl.contains("{x}") || !tileUrl.contains("{y}")) {
            throw new IllegalArgumentException("MAP_TILE_URL must contain {z}, {x}, {y}.");
        }
        requireHttps(tileUrl.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"));
        requireHttps(attributionUrl);
        if (providerName.isBlank() || attributionText.isBlank() || maxZoom < 13 || maxZoom > 22) {
            throw new IllegalArgumentException("Invalid map display settings.");
        }
        config = new MapConfig(providerName, tileUrl, attributionText, attributionUrl,
                new Center(10.7769, 106.7009), 13, maxZoom);
    }

    @GetMapping("/api/map/config")
    public MapConfig config() { return config; }

    private static void requireHttps(String value) {
        URI uri = URI.create(value);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Map URLs must use HTTPS without embedded credentials.");
        }
    }
}
