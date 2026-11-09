package vn.hexacare.sosnow.phase;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;

public final class ApiChecks {
    private ApiChecks() {}
    public static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
    public static void require(boolean condition, String message) {
        if (!condition) throw error(HttpStatus.BAD_REQUEST, message);
    }
    public static String text(String value, int max, String field) {
        require(value != null && !value.isBlank() && value.length() <= max, "Invalid " + field + ".");
        return value.strip();
    }
    public static String locale(String value) {
        String language = text(value, 10, "locale").toLowerCase(Locale.ROOT);
        return switch (language) {
            case "vi", "vi-vn" -> "vi";
            case "en", "en-us", "en-gb" -> "en";
            default -> throw error(HttpStatus.BAD_REQUEST, "Supported locales: vi, en.");
        };
    }
    public static void location(double lat, double lng) {
        require(Double.isFinite(lat) && Double.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180,
                "Invalid coordinates.");
    }
    public static void nearby(double lat, double lng, int radius, int limit) {
        location(lat, lng);
        require(radius >= 1 && radius <= 50000 && limit >= 1 && limit <= 50, "Invalid radius or limit.");
    }
    public static boolean reviewed(Instant date, Instant now) { return date != null && !date.isAfter(now); }
    public static void https(String value) {
        try {
            URI uri = URI.create(value);
            require("https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null,
                    "Media URLs must use HTTPS.");
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw error(HttpStatus.BAD_REQUEST, "Invalid media URL.");
        }
    }
    public static String normalized(String text) {
        return Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('đ', 'd').replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ").strip();
    }
    public static boolean containsPhrase(String input, String phrase) {
        return (" " + normalized(input) + " ").contains(" " + normalized(phrase) + " ");
    }
    public static double meters(double lat1, double lng1, double lat2, double lng2) {
        double a = Math.pow(Math.sin(Math.toRadians(lat2 - lat1) / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.pow(Math.sin(Math.toRadians(lng2 - lng1) / 2), 2);
        return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.clamp(a, 0, 1)));
    }
}
