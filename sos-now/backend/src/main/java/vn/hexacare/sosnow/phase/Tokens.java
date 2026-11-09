package vn.hexacare.sosnow.phase;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import static vn.hexacare.sosnow.phase.ApiChecks.error;

final class Tokens {
    private static final SecureRandom RANDOM = new SecureRandom();
    static String issue() {
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    static boolean equal(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
    static String bearerHash(String header) {
        if (header == null || !header.matches("Bearer [A-Za-z0-9_-]{43}")) throw error(HttpStatus.UNAUTHORIZED, "A valid bearer token is required.");
        return hash(header.substring(7));
    }
}
