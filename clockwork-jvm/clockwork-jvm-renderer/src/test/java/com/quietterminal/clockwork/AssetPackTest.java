package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.quietterminal.clockwork.exceptions.ClockworkAssetException;
import com.quietterminal.clockwork.renderer.assets.AssetEntry;
import com.quietterminal.clockwork.renderer.assets.AssetManifest;
import com.quietterminal.clockwork.renderer.assets.AssetPack;
import com.quietterminal.clockwork.renderer.assets.AssetPackLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssetPackTest {

    @Test
    void validManifestPasses() {
        AssetManifest manifest = new AssetManifest(
            1, "my-pack",
            List.of(new AssetEntry("sprite:hero", "textures/hero.png", "texture"))
        );
        manifest.validate();
    }

    @Test
    void wrongVersionThrows() {
        AssetManifest manifest = new AssetManifest(
            99, "pack", List.of()
        );
        assertThrows(ClockworkAssetException.class, manifest::validate);
    }

    @Test
    void blankNameThrows() {
        AssetManifest manifest = new AssetManifest(1, "   ", List.of());
        assertThrows(ClockworkAssetException.class, manifest::validate);
    }

    @Test
    void duplicateAssetIdWithinPackThrows() {
        AssetManifest manifest = new AssetManifest(1, "pack", List.of(
            new AssetEntry("same-id", "a.png", "texture"),
            new AssetEntry("same-id", "b.png", "texture")
        ));
        assertThrows(ClockworkAssetException.class, manifest::validate);
    }

    @Test
    void unsafeAssetFilePathWithDotDotThrows() {
        AssetManifest manifest = new AssetManifest(1, "pack", List.of(
            new AssetEntry("bad", "../escape.png", "texture")
        ));
        assertThrows(ClockworkAssetException.class, manifest::validate);
    }

    @Test
    void unsafeAssetFilePathAbsoluteThrows() {
        AssetManifest manifest = new AssetManifest(1, "pack", List.of(
            new AssetEntry("bad", "/etc/passwd", "texture")
        ));
        assertThrows(ClockworkAssetException.class, manifest::validate);
    }

    @Test
    void loadValidZipReturnsPackWithCorrectName(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("pack.zip");
        writeZip(zipPath, validManifestJson("test-pack"), null);
        AssetPack pack = AssetPackLoader.load(zipPath);
        assertEquals("test-pack", pack.name());
    }

    @Test
    void loadZipWithAssetEntryContainsRawFiles(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("pack.zip");
        writeZipWithExtra(zipPath, validManifestJson("assets-pack"),
            "textures/hero.png", new byte[]{0x01, 0x02});
        AssetPack pack = AssetPackLoader.load(zipPath);
        assertTrue(pack.rawFiles().containsKey("textures/hero.png"));
    }

    @Test
    void loadZipMissingManifestThrows(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("no-manifest.zip");
        writeZip(zipPath, null, null);
        assertThrows(ClockworkAssetException.class, () -> AssetPackLoader.load(zipPath));
    }

    @Test
    void loadZipBadManifestJsonThrows(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("bad-json.zip");
        writeZip(zipPath, "{ not valid json at all %%%%", null);
        assertThrows(ClockworkAssetException.class, () -> AssetPackLoader.load(zipPath));
    }

    @Test
    void loadZipSlipEntryThrows(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("zipslip.zip");
        try (var out = new java.util.zip.ZipOutputStream(java.nio.file.Files.newOutputStream(zipPath))) {
            putEntry(out, "manifest.json", validManifestJson("slip-pack").getBytes(StandardCharsets.UTF_8));
            putEntry(out, "../evil.txt", "pwned".getBytes(StandardCharsets.UTF_8));
        }
        assertThrows(ClockworkAssetException.class, () -> AssetPackLoader.load(zipPath));
    }

    @Test
    void loadZipWrongManifestVersionThrows(@TempDir Path tmp) throws IOException {
        Path zipPath = tmp.resolve("bad-version.zip");
        String manifest = """
            {
              "version": 999,
              "name": "old-pack",
              "assets": []
            }
            """;
        writeZip(zipPath, manifest, null);
        assertThrows(ClockworkAssetException.class, () -> AssetPackLoader.load(zipPath));
    }

    @Test
    void mergeSinglePackReturnsSamePack(@TempDir Path tmp) throws IOException {
        Path zip = tmp.resolve("a.zip");
        writeZip(zip, validManifestJson("single"), null);
        AssetPack pack = AssetPackLoader.load(zip);
        AssetPack merged = AssetPackLoader.merge(List.of(pack));
        assertEquals("single", merged.name());
    }

    @Test
    void mergeMultiplePacksCombinesAssets(@TempDir Path tmp) throws IOException {
        Path zip1 = tmp.resolve("a.zip");
        Path zip2 = tmp.resolve("b.zip");
        writeZip(zip1, manifestJson("pack-a", "sprite:a", "a.png"), null);
        writeZip(zip2, manifestJson("pack-b", "sprite:b", "b.png"), null);
        AssetPack a = AssetPackLoader.load(zip1);
        AssetPack b = AssetPackLoader.load(zip2);
        AssetPack merged = AssetPackLoader.merge(List.of(a, b));
        assertEquals(2, merged.manifest().assets().size());
    }

    @Test
    void mergeDuplicateIdAcrossPacksThrows(@TempDir Path tmp) throws IOException {
        Path zip1 = tmp.resolve("a.zip");
        Path zip2 = tmp.resolve("b.zip");
        writeZip(zip1, manifestJson("pack-a", "dup-id", "a.png"), null);
        writeZip(zip2, manifestJson("pack-b", "dup-id", "b.png"), null);
        AssetPack a = AssetPackLoader.load(zip1);
        AssetPack b = AssetPackLoader.load(zip2);
        assertThrows(ClockworkAssetException.class, () -> AssetPackLoader.merge(List.of(a, b)));
    }

    @Test
    void mergeEmptyListThrows() {
        assertThrows(IllegalArgumentException.class, () -> AssetPackLoader.merge(List.of()));
    }

    @Test
    void loadAllMergesAllPaths(@TempDir Path tmp) throws IOException {
        Path zip1 = tmp.resolve("x.zip");
        Path zip2 = tmp.resolve("y.zip");
        writeZip(zip1, manifestJson("x", "x:1", "x.png"), null);
        writeZip(zip2, manifestJson("y", "y:1", "y.png"), null);
        AssetPack merged = AssetPackLoader.loadAll(List.of(zip1, zip2));
        assertNotNull(merged);
        assertEquals(2, merged.manifest().assets().size());
    }

    @Test
    void assetPackRawFilesIsUnmodifiable(@TempDir Path tmp) throws IOException {
        Path zip = tmp.resolve("unmod.zip");
        writeZip(zip, validManifestJson("unmod"), null);
        AssetPack pack = AssetPackLoader.load(zip);
        assertThrows(UnsupportedOperationException.class,
            () -> pack.rawFiles().put("injected", new byte[0]));
    }

    private static String validManifestJson(String name) {
        return """
            {
              "version": 1,
              "name": "%s",
              "assets": []
            }
            """.formatted(name);
    }

    private static String manifestJson(String packName, String assetId, String file) {
        return """
            {
              "version": 1,
              "name": "%s",
              "assets": [{"id": "%s", "file": "%s", "type": "texture"}]
            }
            """.formatted(packName, assetId, file);
    }

    private static void writeZip(Path target, String manifestContent, byte[] extra) throws IOException {
        try (ZipOutputStream out = new ZipOutputStream(java.nio.file.Files.newOutputStream(target))) {
            if (manifestContent != null) {
                putEntry(out, "manifest.json", manifestContent.getBytes(StandardCharsets.UTF_8));
            }
            if (extra != null) {
                putEntry(out, "extra.bin", extra);
            }
        }
    }

    private static void writeZipWithExtra(Path target, String manifestContent, String extraName, byte[] extra) throws IOException {
        try (ZipOutputStream out = new ZipOutputStream(java.nio.file.Files.newOutputStream(target))) {
            putEntry(out, "manifest.json", manifestContent.getBytes(StandardCharsets.UTF_8));
            putEntry(out, extraName, extra);
        }
    }

    private static void putEntry(ZipOutputStream out, String name, byte[] data) throws IOException {
        out.putNextEntry(new ZipEntry(name));
        out.write(data);
        out.closeEntry();
    }
}
