package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SafeLoggerTest {
    @Test
    void scrubNullReturnsNullPlaceholder() {
        assertEquals("(null)", SafeLogger.scrub(null));
    }

    @Test
    void scrubPlainMessageUnchanged() {
        String msg = "hello world from test";
        assertEquals(msg, SafeLogger.scrub(msg));
    }

    @Test
    void scrubBearerTokenIsRedacted() {
        String msg = "Authorization: Bearer eyJsomeLongTokenValue123456";
        assertFalse(SafeLogger.scrub(msg).contains("eyJsomeLongTokenValue123456"));
    }

    @Test
    void scrubJwtHeaderIsRedacted() {
        // No, this isn't a real token, don't even try.
        String msg = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
        assertFalse(SafeLogger.scrub(msg).contains("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    }

    @Test
    void scrubLongHexDigestIsRedacted() {
        String hex = "a".repeat(64);
        String msg = "hash=" + hex;
        assertFalse(SafeLogger.scrub(msg).contains(hex));
    }

    @Test
    void scrubShortHexStringIsNotRedacted() {
        String shortHex = "deadbeef";
        assertEquals(shortHex, SafeLogger.scrub(shortHex));
    }

    @Test
    void scrubMultipleTokensInMessage() {
        String msg = "Bearer eyJtokenA12345678901234 and eyJtokenB12345678901234";
        String scrubbed = SafeLogger.scrub(msg);
        assertFalse(scrubbed.contains("eyJtokenA12345678901234"));
        assertFalse(scrubbed.contains("eyJtokenB12345678901234"));
    }

    @Test
    void warnDoesNotThrow() {
        SafeLogger log = new SafeLogger("Test");
        assertDoesNotThrow(() -> log.warn("something happened"));
    }

    @Test
    void errorDoesNotThrow() {
        SafeLogger log = new SafeLogger("Test");
        assertDoesNotThrow(() -> log.error("error occurred"));
    }

    @Test
    void fatalDoesNotThrow() {
        SafeLogger log = new SafeLogger("Test");
        assertDoesNotThrow(() -> log.fatal("fatal condition"));
    }

    @Test
    void logWithNullMessageDoesNotThrow() {
        SafeLogger log = new SafeLogger("Test");
        assertDoesNotThrow(() -> log.warn(null));
    }
}
