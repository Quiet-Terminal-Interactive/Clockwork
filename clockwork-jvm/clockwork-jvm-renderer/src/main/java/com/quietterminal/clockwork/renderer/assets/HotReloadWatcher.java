package com.quietterminal.clockwork.renderer.assets;

import java.io.Closeable;
import java.io.IOException;
import java.nio.file.*;
import java.util.function.Consumer;
import java.util.logging.Logger;

/**
 * Watches a directory for modified asset pack files and fires a callback.
 * Only active when system property {@code clockwork.assets.hotreload=true}.
 * Intended for dev mode only — do not enable in production builds.
 */
public final class HotReloadWatcher implements Closeable {

    private static final Logger LOG = Logger.getLogger(HotReloadWatcher.class.getName());
    private static final String PROP = "clockwork.assets.hotreload";

    private final WatchService watchService;
    private final Thread watchThread;
    private volatile boolean running = true;

    public HotReloadWatcher(Path watchDir, Consumer<Path> onChanged) throws IOException {
        if (!isEnabled()) {
            watchService = null;
            watchThread = null;
            return;
        }

        watchService = FileSystems.getDefault().newWatchService();
        watchDir.register(watchService,
                StandardWatchEventKinds.ENTRY_MODIFY,
                StandardWatchEventKinds.ENTRY_CREATE);

        watchThread = Thread.ofVirtual().name("asset-hotreload").start(() -> {
            while (running) {
                try {
                    WatchKey key = watchService.take();
                    for (WatchEvent<?> event : key.pollEvents()) {
                        if (event.kind() == StandardWatchEventKinds.OVERFLOW) continue;
                        @SuppressWarnings("unchecked")
                        Path changed = watchDir.resolve(((WatchEvent<Path>) event).context());
                        LOG.info("Asset changed, triggering hot-reload: " + changed.getFileName());
                        onChanged.accept(changed);
                    }
                    key.reset();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });
    }

    public static boolean isEnabled() {
        return Boolean.getBoolean(PROP);
    }

    @Override
    public void close() {
        running = false;
        if (watchThread != null) {
            watchThread.interrupt();
        }
        if (watchService != null) {
            try {
                watchService.close();
            } catch (IOException ignored) {
                // Already closed or OS cleaned it up. Nothing actionable here.
            }
        }
    }
}
