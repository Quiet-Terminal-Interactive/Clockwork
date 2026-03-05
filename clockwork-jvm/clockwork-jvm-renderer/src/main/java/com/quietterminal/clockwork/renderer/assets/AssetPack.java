package com.quietterminal.clockwork.renderer.assets;

import java.util.Collections;
import java.util.Map;

/** Loaded asset pack: validated manifest plus raw file bytes keyed by zip path. */
public final class AssetPack {
    public static final String KEY = "asset:pack";

    private final AssetManifest manifest;
    private final Map<String, byte[]> rawFiles;

    AssetPack(AssetManifest manifest, Map<String, byte[]> rawFiles) {
        this.manifest = manifest;
        this.rawFiles = rawFiles;
    }

    public AssetManifest manifest() {
        return manifest;
    }

    public String name() {
        return manifest.name();
    }

    public Map<String, byte[]> rawFiles() {
        return Collections.unmodifiableMap(rawFiles);
    }
}
