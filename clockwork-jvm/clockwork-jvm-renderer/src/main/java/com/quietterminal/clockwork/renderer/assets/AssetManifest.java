package com.quietterminal.clockwork.renderer.assets;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.quietterminal.clockwork.exceptions.ClockworkAssetException;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Parsed manifest.json from an asset pack zip. */
public record AssetManifest(
        @JsonProperty("version") int version,
        @JsonProperty("name") String name,
        @JsonProperty("assets") List<AssetEntry> assets) {

    static final int CURRENT_VERSION = 1;

    private static final int MAX_NAME_LENGTH = 256;
    private static final int MAX_ASSET_ID_LENGTH = 256;
    private static final int MAX_ASSET_FILE_LENGTH = 512;

    /** Validates version, field lengths, safe path characters, and intra-pack ID uniqueness. */
    public void validate() {
        if (version != CURRENT_VERSION) {
            throw new ClockworkAssetException(
                    "Unsupported manifest version " + version + " (expected " + CURRENT_VERSION + ")");
        }
        Objects.requireNonNull(name, "manifest.name must not be null");
        if (name.isBlank() || name.length() > MAX_NAME_LENGTH) {
            throw new ClockworkAssetException("manifest.name is blank or too long: " + name.length());
        }
        Objects.requireNonNull(assets, "manifest.assets must not be null");

        Set<String> seen = new HashSet<>();
        for (AssetEntry entry : assets) {
            Objects.requireNonNull(entry.id(), "asset id must not be null");
            Objects.requireNonNull(entry.file(), "asset file must not be null");

            if (entry.id().isBlank() || entry.id().length() > MAX_ASSET_ID_LENGTH) {
                throw new ClockworkAssetException("asset id is blank or too long: " + entry.id().length());
            }
            if (entry.file().contains("..") || entry.file().startsWith("/")) {
                throw new ClockworkAssetException("asset file path is unsafe: " + entry.file());
            }
            if (entry.file().length() > MAX_ASSET_FILE_LENGTH) {
                throw new ClockworkAssetException("asset file path is too long: " + entry.file().length());
            }

            if (!seen.add(entry.id())) {
                throw new ClockworkAssetException(
                        "Duplicate asset ID within pack '" + name + "': " + entry.id());
            }
        }
    }
}
