package com.quietterminal.clockwork.renderer.assets;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quietterminal.clockwork.exceptions.ClockworkAssetException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Loads asset pack zips, validates manifests, and merges packs with unique-ID enforcement. */
public final class AssetPackLoader {

    // Limits are generous enough for real packs while blocking zip-bomb and memory exhaustion attacks.
    private static final long MAX_ENTRY_BYTES = 256L * 1024 * 1024;
    private static final long MAX_TOTAL_BYTES = 1024L * 1024 * 1024;
    private static final int MAX_ENTRY_COUNT = 10_000;

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private static final Path SAFE_ROOT = Path.of("/safe-root");

    public static AssetPack load(Path path) {
        Map<String, byte[]> rawFiles = new HashMap<>();
        long totalBytes = 0;
        int entryCount = 0;

        try (ZipInputStream zis = new ZipInputStream(Files.newInputStream(path))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }

                if (++entryCount > MAX_ENTRY_COUNT) {
                    throw new ClockworkAssetException(
                            "Asset pack exceeds maximum entry count (" + MAX_ENTRY_COUNT + "): " + path);
                }

                String name = entry.getName();
                validateEntryPath(name);

                long reportedSize = entry.getSize();
                if (reportedSize > MAX_ENTRY_BYTES) {
                    throw new ClockworkAssetException(
                            "Entry exceeds size limit (" + MAX_ENTRY_BYTES + " bytes): " + name);
                }

                byte[] data = readBounded(zis, name, MAX_ENTRY_BYTES);
                totalBytes += data.length;
                if (totalBytes > MAX_TOTAL_BYTES) {
                    throw new ClockworkAssetException(
                            "Asset pack total size exceeds limit (" + MAX_TOTAL_BYTES + " bytes): " + path);
                }

                rawFiles.put(name, data);
            }
        } catch (IOException e) {
            throw new ClockworkAssetException("Failed to read asset pack: " + path, e);
        }

        byte[] manifestBytes = rawFiles.get("manifest.json");
        if (manifestBytes == null) {
            throw new ClockworkAssetException("Asset pack missing manifest.json: " + path);
        }

        AssetManifest manifest;
        try {
            manifest = JSON.readValue(manifestBytes, AssetManifest.class);
        } catch (IOException e) {
            throw new ClockworkAssetException("Invalid manifest.json in pack: " + path, e);
        }

        manifest.validate();
        return new AssetPack(manifest, rawFiles);
    }

    /**
     * Merges multiple packs into one, enforcing globally unique asset IDs across all of them.
     * Earlier packs win on raw file name collisions; asset IDs are never shared.
     */
    public static AssetPack merge(List<AssetPack> packs) {
        if (packs.isEmpty()) {
            throw new IllegalArgumentException("Cannot merge an empty pack list");
        }
        if (packs.size() == 1) {
            return packs.get(0);
        }

        Set<String> seenIds = new HashSet<>();
        List<AssetEntry> mergedAssets = new ArrayList<>();
        Map<String, byte[]> mergedFiles = new HashMap<>();

        for (AssetPack pack : packs) {
            for (AssetEntry assetEntry : pack.manifest().assets()) {
                if (!seenIds.add(assetEntry.id())) {
                    throw new ClockworkAssetException(
                            "Duplicate asset ID across packs: '" + assetEntry.id()
                            + "' (conflict in pack '" + pack.name() + "')");
                }
                mergedAssets.add(assetEntry);
            }
            pack.rawFiles().forEach(mergedFiles::putIfAbsent);
        }

        String mergedName = packs.stream()
                .map(AssetPack::name)
                .reduce((a, b) -> a + "+" + b)
                .orElse("merged");

        AssetManifest mergedManifest = new AssetManifest(
                AssetManifest.CURRENT_VERSION,
                mergedName,
                Collections.unmodifiableList(mergedAssets));

        return new AssetPack(mergedManifest, mergedFiles);
    }

    public static AssetPack loadAll(List<Path> paths) {
        List<AssetPack> packs = new ArrayList<>();
        for (Path p : paths) {
            packs.add(load(p));
        }
        return merge(packs);
    }

    private static void validateEntryPath(String name) {
        if (name == null || name.isEmpty()) {
            throw new ClockworkAssetException("Zip entry has empty name.");
        }
        Path resolved = SAFE_ROOT.resolve(name).normalize();
        if (!resolved.startsWith(SAFE_ROOT)) {
            throw new ClockworkAssetException("Zip-slip attempt blocked: " + name);
        }
    }

    private static byte[] readBounded(ZipInputStream zis, String name, long maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        long total = 0;
        int read;
        while ((read = zis.read(buf)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new ClockworkAssetException(
                        "Entry exceeds size limit (" + maxBytes + " bytes) during read: " + name);
            }
            out.write(buf, 0, read);
        }
        return out.toByteArray();
    }

    private AssetPackLoader() {}
}
