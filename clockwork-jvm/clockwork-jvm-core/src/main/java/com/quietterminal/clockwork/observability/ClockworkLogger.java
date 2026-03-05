package com.quietterminal.clockwork.observability;

import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

/**
 * Structured logger with subsystem tags, configurable level filtering, and token scrubbing.
 * All engine internals route through here; game code may use it too.
 */
public final class ClockworkLogger {
    
    // JWT headers, Bearer tokens, long hex digests (SHA-1/SHA-256 length secrets).
    // Anything that looks like it was generated and not typed basically.
    // If your token still gets leaked with this, get a better token format...
    private static final Pattern TOKEN_PATTERN = Pattern.compile(
        "(?i)bearer\\s+[A-Za-z0-9._+/=\\-]{16,}"
        + "|eyJ[A-Za-z0-9._+/=\\-]{16,}"
        + "|[A-Fa-f0-9]{40,}"
    );
    private static final String REDACTED = "[REDACTED]";

    private static volatile LogLevel globalLevel = LogLevel.INFO;
    private static final AtomicReference<LogHandler> globalHandler =
        new AtomicReference<>(ClockworkLogger::defaultHandle);

    private final String subsystem;

    public ClockworkLogger(String subsystem) {
        this.subsystem = Objects.requireNonNull(subsystem, "subsystem");
    }

    public static void setLevel(LogLevel level) {
        globalLevel = Objects.requireNonNull(level, "level");
    }

    public static void setHandler(LogHandler handler) {
        globalHandler.set(Objects.requireNonNull(handler, "handler"));
    }

    public static LogLevel level() {
        return globalLevel;
    }

    public void debug(String message) { log(LogLevel.DEBUG, message); }
    public void info(String message)  { log(LogLevel.INFO,  message); }
    public void warn(String message)  { log(LogLevel.WARN,  message); }
    public void error(String message) { log(LogLevel.ERROR, message); }
    public void fatal(String message) { log(LogLevel.FATAL, message); }

    private void log(LogLevel level, String message) {
        if (!level.isAtLeast(globalLevel)) {
            return;
        }
        try {
            globalHandler.get().handle(level, subsystem, scrub(message));
        } catch (RuntimeException ignored) {
            // Crash-safe: logging must never throw on the error path.
        }
    }

    /** Redacts token-shaped substrings. Public so SafeLogger and DiagnosticReport can reuse it. */
    public static String scrub(String msg) {
        if (msg == null) {
            return "(null)";
        }
        return TOKEN_PATTERN.matcher(msg).replaceAll(REDACTED);
    }

    private static void defaultHandle(LogLevel level, String subsystem, String message) {
        System.err.printf("[Clockwork:%s] %s %s: %s%n", subsystem, Instant.now(), level, message);
    }
}
