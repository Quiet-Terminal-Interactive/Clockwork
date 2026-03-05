package com.quietterminal.clockwork.modding;

import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.Objects;

import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;

/**
 * Loads a {@link ClockworkPlugin} from an external JAR using a child {@link URLClassLoader}.
 *
 * <p>Isolation level: {@link PluginSandboxPolicy.Level#CLASSLOADER}. Class identity conflicts
 * between plugin JARs are avoided; reflection-based escapes are not blocked.
 *
 * <p>Typical usage:
 * <pre>{@code
 * try (SandboxedPluginLoader loader = SandboxedPluginLoader.fromJar(Path.of("my-mod.jar"))) {
 *     ClockworkPlugin plugin = loader.load("com.example.MyMod");
 *     app.use(plugin);
 *     app.build();
 * }
 * // Closing the loader after build() is safe — classes are already referenced by the engine.
 * }</pre>
 */
public final class SandboxedPluginLoader implements AutoCloseable {

    private final URLClassLoader classLoader;

    private SandboxedPluginLoader(URLClassLoader classLoader) {
        this.classLoader = classLoader;
    }

    /**
     * Creates a loader backed by the given JAR, delegating to the caller's classloader for
     * engine API types ({@code com.quietterminal.clockwork.*}).
     */
    public static SandboxedPluginLoader fromJar(Path jarPath) {
        return fromJar(jarPath, SandboxedPluginLoader.class.getClassLoader());
    }

    public static SandboxedPluginLoader fromJar(Path jarPath, ClassLoader parent) {
        Objects.requireNonNull(jarPath, "jarPath");
        Objects.requireNonNull(parent, "parent");
        try {
            URL jarUrl = jarPath.toUri().toURL();
            URLClassLoader cl = new URLClassLoader(new URL[]{jarUrl}, parent);
            return new SandboxedPluginLoader(cl);
        } catch (Exception e) {
            throw new ClockworkLifecycleException("Failed to create plugin classloader for: " + jarPath, e);
        }
    }

    /**
     * Instantiates the named class from the plugin JAR.
     * The class must implement {@link ClockworkPlugin} and have a public no-arg constructor.
     */
    public ClockworkPlugin load(String className) {
        Objects.requireNonNull(className, "className");
        try {
            Class<?> clazz = classLoader.loadClass(className);
            Object instance = clazz.getDeclaredConstructor().newInstance();
            if (!(instance instanceof ClockworkPlugin plugin)) {
                throw new ClockworkLifecycleException(
                    "Plugin class " + className + " does not implement ClockworkPlugin."
                );
            }
            return plugin;
        } catch (ClassNotFoundException e) {
            throw new ClockworkLifecycleException("Plugin class not found in JAR: " + className, e);
        } catch (ClockworkLifecycleException e) {
            throw e;
        } catch (Exception e) {
            throw new ClockworkLifecycleException("Failed to instantiate plugin: " + className, e);
        }
    }

    @Override
    public void close() {
        try {
            classLoader.close();
        } catch (Exception ignored) {
            // URLClassLoader.close() can throw IOException on resource cleanup.
            // Nothing meaningful to do at this point — resources are released on GC anyway.
        }
    }
}
