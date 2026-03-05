package com.quietterminal.clockwork.modding;

/**
 * Documents the sandboxing contract for third-party Java plugins.
 *
 * Java's SecurityManager was removed in Java 17. True bytecode-level isolation at runtime
 * requires either the module system (--add-opens restrictions) or a separate JVM process.
 * Neither is enforced here — plugins run with the same trust level as the host app.
 *
 * What we do instead:
 *
 * 1. API surface isolation — third-party plugins interact only through {@code ClockworkPlugin},
 *    {@code WorldApi}, {@code Commands}, {@code EventBus}, and {@code ResourceStore}. Internal
 *    packages use module-info.java {@code exports ... to} to restrict visibility where possible.
 *
 * 2. ClassLoader isolation — {@link SandboxedPluginLoader} loads plugin JARs in a child
 *    {@code URLClassLoader}. This prevents accidental class identity conflicts but does not
 *    prevent reflection-based escapes. Trust third-party plugins accordingly.
 *
 * 3. Thread model — plugins execute on the simulation thread and must not spawn their own
 *    threads without registering a tick-end hook or using a managed executor.
 *
 * 4. Resource limits — there is no memory or CPU quota enforcement. A runaway plugin can
 *    stall or OOM the engine. The watchdog ({@code EngineWatchdog}) will log the stall but
 *    cannot forcibly terminate plugin code short of killing the process.
 *
 * Recommendations for plugin hosts distributing third-party mods:
 * - Run the game process under a container or OS sandbox (e.g. Flatpak, Windows AppContainer).
 * - Use a separate JVM process for untrusted plugins communicating via IPC.
 * - Review plugin source or bytecode before loading if content integrity matters.
 *
 */
public final class PluginSandboxPolicy {
    private PluginSandboxPolicy() {}

    /**
     * Isolation level advertised by a plugin loading strategy.
     * The engine does not enforce these — they are declarations of intent for documentation and tooling.
     */
    public enum Level {
        /** Plugin runs in the same classloader as the engine. No isolation. First-party plugins only. */
        NONE,
        /** Plugin runs in its own {@link SandboxedPluginLoader} child classloader. Prevents class conflicts. */
        CLASSLOADER,
        /**
         * Plugin runs in a separate JVM process, communicating via IPC.
         * Not implemented by the engine — the host application must wire this up.
         */
        PROCESS
    }
}
