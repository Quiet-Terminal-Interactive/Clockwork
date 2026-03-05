package com.quietterminal.clockwork.renderer.assets;

import com.quietterminal.clockwork.exceptions.ClockworkAssetException;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;

import java.nio.ByteBuffer;
import java.nio.IntBuffer;
import java.util.*;
import java.util.logging.Logger;

import static org.lwjgl.opengl.GL11.*;
import static org.lwjgl.opengl.GL12.GL_CLAMP_TO_EDGE;
import static org.lwjgl.opengl.GL30.GL_RGBA8;

/**
 * GPU texture atlas built from an AssetPack.
 * All methods that touch GL must be called on the OpenGL context thread.
 */
public final class TextureAtlas {

    private static final Logger LOG = Logger.getLogger(TextureAtlas.class.getName());

    private final int[] pageTextures;
    private final AtlasPacker.PagePixels[] pendingPages;
    private final Map<String, AssetRef> refs;
    private long gpuMemoryBytes;

    private TextureAtlas(int[] pageTextures, AtlasPacker.PagePixels[] pendingPages,
                         Map<String, AssetRef> refs, AssetStreamingConfig config,
                         long gpuMemoryBytes) {
        this.pageTextures = pageTextures;
        this.pendingPages = pendingPages;
        this.refs = refs;
        this.gpuMemoryBytes = gpuMemoryBytes;
    }

    /** Decodes all textures, runs shelf packing, and uploads to the GPU. Must be called on the GL thread. */
    public static TextureAtlas build(AssetPack pack, AssetStreamingConfig config) {
        return build(pack, config, AtlasPacker.DEFAULT_PAGE_SIZE);
    }

    static TextureAtlas build(AssetPack pack, AssetStreamingConfig config, int pageSize) {
        List<AtlasPacker.PixelData> decoded = decodeAll(pack);
        AtlasPacker.PackResult packed = AtlasPacker.pack(decoded, pageSize);

        // STB buffers are fully consumed by the packer; free immediately.
        for (AtlasPacker.PixelData pd : decoded) {
            STBImage.stbi_image_free(pd.pixels());
        }

        int pageCount = packed.pages().size();
        int[] texIds = new int[pageCount];
        AtlasPacker.PagePixels[] pending = packed.pages().toArray(new AtlasPacker.PagePixels[0]);

        long totalBytes = packed.pages().stream()
                .mapToLong(p -> (long) p.width() * p.height() * 4)
                .sum();

        if (config.maxGpuMemoryBytes() > 0 && totalBytes > config.maxGpuMemoryBytes()) {
            LOG.warning("Atlas exceeds GPU memory budget: " + totalBytes + " bytes > "
                    + config.maxGpuMemoryBytes() + " limit. Consider splitting packs.");
        }

        long uploadedBytes = 0;
        if (!config.lazyPageUpload()) {
            for (int i = 0; i < pageCount; i++) {
                texIds[i] = uploadPage(pending[i]);
                pending[i] = null;
                uploadedBytes += (long) packed.pages().get(i).width() * packed.pages().get(i).height() * 4;
            }
        }

        Map<String, AssetRef> refMap = new HashMap<>();
        for (AssetRef ref : packed.refs()) {
            refMap.put(ref.id(), ref);
        }

        return new TextureAtlas(texIds, pending, Collections.unmodifiableMap(refMap),
                config, uploadedBytes);
    }

    public AssetRef get(String id) {
        return refs.get(id);
    }

    /** Returns the GL texture ID for the given atlas page. Triggers lazy upload on first access. */
    public int getPageTexture(int page) {
        if (pageTextures[page] == 0 && pendingPages[page] != null) {
            pageTextures[page] = uploadPage(pendingPages[page]);
            gpuMemoryBytes += (long) pendingPages[page].width() * pendingPages[page].height() * 4;
            pendingPages[page] = null;
        }
        return pageTextures[page];
    }

    public int pageCount() {
        return pageTextures.length;
    }

    public long gpuMemoryBytes() {
        return gpuMemoryBytes;
    }

    /** Deletes all GL textures. Must be called on the GL thread before the context is destroyed. */
    public void dispose() {
        for (int texId : pageTextures) {
            if (texId != 0) {
                glDeleteTextures(texId);
            }
        }
    }

    private static List<AtlasPacker.PixelData> decodeAll(AssetPack pack) {
        List<AtlasPacker.PixelData> result = new ArrayList<>();
        for (AssetEntry entry : pack.manifest().assets()) {
            if (!"texture".equals(entry.type())) continue;

            byte[] raw = pack.rawFiles().get(entry.file());
            if (raw == null) {
                throw new ClockworkAssetException(
                        "Asset '" + entry.id() + "' references missing file: " + entry.file());
            }
            result.add(decodeImage(entry.id(), raw));
        }
        return result;
    }

    private static AtlasPacker.PixelData decodeImage(String id, byte[] raw) {
        ByteBuffer srcBuf = MemoryUtil.memAlloc(raw.length);
        srcBuf.put(raw).flip();

        try (MemoryStack stack = MemoryStack.stackPush()) {
            IntBuffer w = stack.mallocInt(1);
            IntBuffer h = stack.mallocInt(1);
            IntBuffer channels = stack.mallocInt(1);

            // Force 4-channel RGBA so the atlas packer always sees a uniform layout.
            ByteBuffer pixels = STBImage.stbi_load_from_memory(srcBuf, w, h, channels, 4);
            if (pixels == null) {
                throw new ClockworkAssetException(
                        "STB failed to decode '" + id + "': " + STBImage.stbi_failure_reason());
            }
            return new AtlasPacker.PixelData(id, w.get(0), h.get(0), pixels);
        } finally {
            MemoryUtil.memFree(srcBuf);
        }
    }

    private static int uploadPage(AtlasPacker.PagePixels page) {
        int texId = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, texId);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8,
                page.width(), page.height(), 0,
                GL_RGBA, GL_UNSIGNED_BYTE, page.pixels());
        glBindTexture(GL_TEXTURE_2D, 0);
        LOG.fine("Uploaded atlas page " + page.width() + "×" + page.height() + " → GL texture " + texId);
        return texId;
    }
}
