package com.quietterminal.clockwork.renderer.assets;

import com.quietterminal.clockwork.exceptions.ClockworkAssetException;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Shelf bin-packing for texture atlases.
 *
 * Algorithm: sort images tallest-first, pack left-to-right into shelves,
 * open a new shelf when the row is full, new atlas page when the column is full.
 * 1px padding between sprites prevents bilinear bleed at atlas seams.
 */
public final class AtlasPacker {

    public static final int DEFAULT_PAGE_SIZE = 4096;
    private static final int PADDING = 1;

    public record PixelData(String id, int width, int height, ByteBuffer pixels) {}

    public record PagePixels(int width, int height, ByteBuffer pixels) {}

    public record PackResult(List<AssetRef> refs, List<PagePixels> pages) {}

    public static PackResult pack(List<PixelData> images, int pageSize) {
        // Tallest images first — fills shelves more tightly, wastes less vertical space.
        List<PixelData> sorted = new ArrayList<>(images);
        sorted.sort(Comparator.comparingInt(PixelData::height).reversed());

        List<AssetRef> refs = new ArrayList<>();
        List<PagePixels> pages = new ArrayList<>();

        int[] pageBuf = null;
        int currentPage = -1;
        int shelfX = 0, shelfY = 0, shelfHeight = 0;

        for (PixelData img : sorted) {
            if (img.width() > pageSize || img.height() > pageSize) {
                throw new ClockworkAssetException(
                        "Asset '" + img.id() + "' (" + img.width() + "×" + img.height()
                        + ") exceeds atlas page size " + pageSize);
            }

            if (pageBuf == null || shelfX + img.width() + PADDING > pageSize) {
                int nextShelfY = shelfY + shelfHeight + PADDING;
                if (pageBuf == null || nextShelfY + img.height() > pageSize) {
                    // Current page (if any) is full — emit it and start fresh.
                    if (pageBuf != null) {
                        pages.add(toPagePixels(pageBuf, pageSize));
                    }
                    pageBuf = new int[pageSize * pageSize];
                    currentPage++;
                    shelfX = 0;
                    shelfY = 0;
                    shelfHeight = 0;
                } else {
                    shelfY = nextShelfY;
                    shelfX = 0;
                    shelfHeight = 0;
                }
            }

            copyPixels(img, pageBuf, pageSize, shelfX, shelfY);

            float u0 = (float) shelfX / pageSize;
            float v0 = (float) shelfY / pageSize;
            float u1 = (float) (shelfX + img.width()) / pageSize;
            float v1 = (float) (shelfY + img.height()) / pageSize;
            refs.add(new AssetRef(img.id(), currentPage, u0, v0, u1, v1));

            shelfX += img.width() + PADDING;
            shelfHeight = Math.max(shelfHeight, img.height());
        }

        if (pageBuf != null) {
            pages.add(toPagePixels(pageBuf, pageSize));
        }

        return new PackResult(refs, pages);
    }

    // Copies RGBA source pixels into an ARGB int[] atlas buffer at (destX, destY).
    private static void copyPixels(PixelData src, int[] dest, int pageWidth, int destX, int destY) {
        ByteBuffer px = src.pixels();
        for (int y = 0; y < src.height(); y++) {
            for (int x = 0; x < src.width(); x++) {
                int si = (y * src.width() + x) * 4;
                int r = px.get(si)     & 0xFF;
                int g = px.get(si + 1) & 0xFF;
                int b = px.get(si + 2) & 0xFF;
                int a = px.get(si + 3) & 0xFF;
                dest[(destY + y) * pageWidth + (destX + x)] = (a << 24) | (r << 16) | (g << 8) | b;
            }
        }
    }

    // Converts ARGB int[] → packed RGBA ByteBuffer for GL upload.
    private static PagePixels toPagePixels(int[] buf, int pageSize) {
        ByteBuffer out = ByteBuffer.allocateDirect(pageSize * pageSize * 4);
        for (int px : buf) {
            out.put((byte) ((px >> 16) & 0xFF)); // R
            out.put((byte) ((px >>  8) & 0xFF)); // G
            out.put((byte)  (px        & 0xFF)); // B
            out.put((byte) ((px >> 24) & 0xFF)); // A
        }
        out.flip();
        return new PagePixels(pageSize, pageSize, out);
    }

    private AtlasPacker() {}
}
