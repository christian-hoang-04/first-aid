package vn.hexacare.sosnow.config;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;

public class IpRateLimiter {
    private final int requests;
    private final long windowNanos;
    private final int maxClients;
    private final LongSupplier ticker;
    private final Map<String, Bucket> clients = new HashMap<>();
    private long lastSweep;

    public IpRateLimiter(int requests, Duration window, int maxClients) {
        this(requests, window, maxClients, System::nanoTime);
    }

    IpRateLimiter(int requests, Duration window, int maxClients, LongSupplier ticker) {
        if (requests < 1 || maxClients < 1 || window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("Rate limit settings must be positive.");
        }
        this.requests = requests;
        this.windowNanos = window.toNanos();
        this.maxClients = maxClients;
        this.ticker = ticker;
        this.lastSweep = ticker.getAsLong();
    }

    // Bounds both requests per address and the total memory used by address buckets.
    public synchronized boolean allow(String ip) {
        long now = ticker.getAsLong();
        if (now - lastSweep >= windowNanos) {
            clients.values().removeIf(bucket -> now - bucket.started >= windowNanos);
            lastSweep = now;
        }
        Bucket bucket = clients.get(ip);
        if (bucket == null || now - bucket.started >= windowNanos) {
            if (bucket == null && clients.size() >= maxClients) return false;
            bucket = new Bucket(now);
            clients.put(ip, bucket);
        }
        if (bucket.count >= requests) return false;
        bucket.count++;
        return true;
    }

    private static class Bucket {
        private final long started;
        private int count;
        private Bucket(long started) { this.started = started; }
    }
}
