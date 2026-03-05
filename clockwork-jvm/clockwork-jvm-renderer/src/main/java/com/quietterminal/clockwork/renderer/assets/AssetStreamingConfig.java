package com.quietterminal.clockwork.renderer.assets;

/**
 * Memory budget and streaming strategy for large asset packs.
 * maxGpuMemoryBytes=0 means unlimited. lazyPageUpload defers GL upload until first draw.
 */
public record AssetStreamingConfig(long maxGpuMemoryBytes, boolean lazyPageUpload) {

    /** No limits — load everything eagerly at build time. Default for most games. */
    public static AssetStreamingConfig unlimited() {
        return new AssetStreamingConfig(0, false);
    }

    /** Cap GPU texture memory at the given byte limit; defer page uploads until accessed. */
    public static AssetStreamingConfig withBudget(long maxBytes) {
        return new AssetStreamingConfig(maxBytes, true);
    }
}
