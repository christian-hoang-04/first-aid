package vn.hexacare.sosnow.config;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import static org.assertj.core.api.Assertions.assertThat;

class IpRateLimiterTests {
    @Test
    void limitsEachIpAndResetsAfterWindow() {
        var clock = new AtomicLong();
        var limiter = new IpRateLimiter(2, Duration.ofSeconds(60), 10, clock::get);
        assertThat(limiter.allow("one")).isTrue();
        assertThat(limiter.allow("one")).isTrue();
        assertThat(limiter.allow("one")).isFalse();
        assertThat(limiter.allow("two")).isTrue();
        clock.addAndGet(Duration.ofSeconds(60).toNanos());
        assertThat(limiter.allow("one")).isTrue();
    }

    @Test
    void boundsClientCountAndReclaimsExpiredEntries() {
        var clock = new AtomicLong();
        var limiter = new IpRateLimiter(1, Duration.ofSeconds(60), 1, clock::get);
        assertThat(limiter.allow("one")).isTrue();
        assertThat(limiter.allow("two")).isFalse();
        clock.addAndGet(Duration.ofSeconds(60).toNanos());
        assertThat(limiter.allow("two")).isTrue();
    }
}
