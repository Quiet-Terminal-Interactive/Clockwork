package com.quietterminal.clockwork.renderer;

import static org.lwjgl.glfw.GLFW.glfwGetFramebufferSize;
import static org.lwjgl.opengl.GL11C.GL_BLEND;
import static org.lwjgl.opengl.GL11C.GL_COLOR_BUFFER_BIT;
import static org.lwjgl.opengl.GL11C.GL_FLOAT;
import static org.lwjgl.opengl.GL11C.GL_LINEAR;
import static org.lwjgl.opengl.GL11C.GL_NONE;
import static org.lwjgl.opengl.GL11C.GL_ONE;
import static org.lwjgl.opengl.GL11C.GL_ONE_MINUS_SRC_ALPHA;
import static org.lwjgl.opengl.GL11C.GL_RGBA;
import static org.lwjgl.opengl.GL11C.GL_RGBA8;
import static org.lwjgl.opengl.GL11C.GL_SRC_ALPHA;
import static org.lwjgl.opengl.GL11C.GL_TEXTURE_2D;
import static org.lwjgl.opengl.GL11C.GL_TEXTURE_MAG_FILTER;
import static org.lwjgl.opengl.GL11C.GL_TEXTURE_MIN_FILTER;
import static org.lwjgl.opengl.GL11C.GL_TRIANGLES;
import static org.lwjgl.opengl.GL11C.GL_UNSIGNED_BYTE;
import static org.lwjgl.opengl.GL11C.glBindTexture;
import static org.lwjgl.opengl.GL11C.glBlendFunc;
import static org.lwjgl.opengl.GL11C.glClear;
import static org.lwjgl.opengl.GL11C.glClearColor;
import static org.lwjgl.opengl.GL11C.glDeleteTextures;
import static org.lwjgl.opengl.GL11C.glDisable;
import static org.lwjgl.opengl.GL11C.glDrawArrays;
import static org.lwjgl.opengl.GL11C.glDrawBuffer;
import static org.lwjgl.opengl.GL11C.glEnable;
import static org.lwjgl.opengl.GL11C.glGenTextures;
import static org.lwjgl.opengl.GL11C.glTexImage2D;
import static org.lwjgl.opengl.GL11C.glTexParameteri;
import static org.lwjgl.opengl.GL11C.glViewport;
import static org.lwjgl.opengl.GL11C.glReadBuffer;
import static org.lwjgl.opengl.GL12C.GL_CLAMP_TO_EDGE;
import static org.lwjgl.opengl.GL13C.GL_TEXTURE0;
import static org.lwjgl.opengl.GL13C.GL_TEXTURE1;
import static org.lwjgl.opengl.GL13C.GL_TEXTURE2;
import static org.lwjgl.opengl.GL13C.glActiveTexture;
import static org.lwjgl.opengl.GL14C.GL_DEPTH_COMPONENT24;
import static org.lwjgl.opengl.GL15C.GL_ARRAY_BUFFER;
import static org.lwjgl.opengl.GL15C.GL_DYNAMIC_DRAW;
import static org.lwjgl.opengl.GL15C.GL_STATIC_DRAW;
import static org.lwjgl.opengl.GL15C.glBindBuffer;
import static org.lwjgl.opengl.GL15C.glBufferData;
import static org.lwjgl.opengl.GL15C.glDeleteBuffers;
import static org.lwjgl.opengl.GL15C.glGenBuffers;
import static org.lwjgl.opengl.GL20C.GL_COMPILE_STATUS;
import static org.lwjgl.opengl.GL20C.GL_FRAGMENT_SHADER;
import static org.lwjgl.opengl.GL20C.GL_LINK_STATUS;
import static org.lwjgl.opengl.GL20C.GL_VERTEX_SHADER;
import static org.lwjgl.opengl.GL20C.glAttachShader;
import static org.lwjgl.opengl.GL20C.glCompileShader;
import static org.lwjgl.opengl.GL20C.glCreateProgram;
import static org.lwjgl.opengl.GL20C.glCreateShader;
import static org.lwjgl.opengl.GL20C.glDeleteProgram;
import static org.lwjgl.opengl.GL20C.glDeleteShader;
import static org.lwjgl.opengl.GL20C.glEnableVertexAttribArray;
import static org.lwjgl.opengl.GL20C.glGetProgramInfoLog;
import static org.lwjgl.opengl.GL20C.glGetProgrami;
import static org.lwjgl.opengl.GL20C.glGetShaderInfoLog;
import static org.lwjgl.opengl.GL20C.glGetShaderi;
import static org.lwjgl.opengl.GL20C.glGetUniformLocation;
import static org.lwjgl.opengl.GL20C.glLinkProgram;
import static org.lwjgl.opengl.GL20C.glShaderSource;
import static org.lwjgl.opengl.GL20C.glUniform1f;
import static org.lwjgl.opengl.GL20C.glUniform1i;
import static org.lwjgl.opengl.GL20C.glUniform2f;
import static org.lwjgl.opengl.GL20C.glUniform3f;
import static org.lwjgl.opengl.GL20C.glUniform4f;
import static org.lwjgl.opengl.GL20C.glUseProgram;
import static org.lwjgl.opengl.GL20C.glVertexAttribPointer;
import static org.lwjgl.opengl.GL30C.GL_COLOR_ATTACHMENT0;
import static org.lwjgl.opengl.GL30C.GL_COLOR_ATTACHMENT1;
import static org.lwjgl.opengl.GL30C.GL_COLOR_ATTACHMENT2;
import static org.lwjgl.opengl.GL30C.GL_DEPTH_ATTACHMENT;
import static org.lwjgl.opengl.GL30C.GL_DEPTH_BUFFER_BIT;
import static org.lwjgl.opengl.GL30C.GL_DEPTH_COMPONENT;
import static org.lwjgl.opengl.GL30C.GL_DEPTH_STENCIL_ATTACHMENT;
import static org.lwjgl.opengl.GL30C.GL_DEPTH24_STENCIL8;
import static org.lwjgl.opengl.GL30C.GL_FRAMEBUFFER;
import static org.lwjgl.opengl.GL30C.GL_FRAMEBUFFER_COMPLETE;
import static org.lwjgl.opengl.GL30C.GL_RENDERBUFFER;
import static org.lwjgl.opengl.GL30C.glBindFramebuffer;
import static org.lwjgl.opengl.GL30C.glBindRenderbuffer;
import static org.lwjgl.opengl.GL30C.glBindVertexArray;
import static org.lwjgl.opengl.GL30C.glCheckFramebufferStatus;
import static org.lwjgl.opengl.GL30C.glDeleteFramebuffers;
import static org.lwjgl.opengl.GL30C.glDeleteRenderbuffers;
import static org.lwjgl.opengl.GL30C.glDeleteVertexArrays;
import static org.lwjgl.opengl.GL30C.glDrawBuffers;
import static org.lwjgl.opengl.GL30C.glFramebufferRenderbuffer;
import static org.lwjgl.opengl.GL30C.glFramebufferTexture2D;
import static org.lwjgl.opengl.GL30C.glGenFramebuffers;
import static org.lwjgl.opengl.GL30C.glGenRenderbuffers;
import static org.lwjgl.opengl.GL30C.glGenVertexArrays;
import static org.lwjgl.opengl.GL30C.glRenderbufferStorage;
import static org.lwjgl.opengl.GL31C.glDrawArraysInstanced;
import static org.lwjgl.opengl.GL33C.glVertexAttribDivisor;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL;
import org.lwjgl.opengl.GLCapabilities;
import org.lwjgl.system.MemoryStack;

import com.quietterminal.clockwork.exceptions.ClockworkRenderException;
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.renderer.sprites.SpriteBatcher;
import com.quietterminal.clockwork.renderer.sprites.SpriteComponent;

/** Mutable render context shared by passes. Carries G-buffer, shadow atlas, and shader programs. */
public final class RenderContext {
    private static final int SHADOW_ATLAS_SIZE = 2048;
    private static final int SHADOW_TILE_SIZE = 256;

    private final long window;
    private final String baseTitle;
    private final ShaderOverrideRegistry shaderOverrides;
    private final SpriteBatcher spriteBatcher = new SpriteBatcher();

    private final Map<String, Integer> programs = new HashMap<>();
    private final Map<Integer, Integer> atlasPageTextures = new HashMap<>();
    private final List<ShadowSlot> shadowSlots = new ArrayList<>();

    private int width;
    private int height;
    private int quadVao;
    private int quadVbo;
    private int spriteVao;
    private int spriteVbo;
    private int spriteInstanceVbo;
    private int whiteTexture;

    private int gBufferFbo;
    private int gAlbedoTexture;
    private int gNormalTexture;
    private int gEmissiveTexture;
    private int gDepthRbo;

    private int shadowFbo;
    private int shadowAtlasTexture;

    private int lightFbo;
    private int lightTexture;

    private int compositeFbo;
    private int compositeTexture;

    private final int[] postFbos = new int[2];
    private final int[] postTextures = new int[2];

    private long frameNumber;
    private long lastTitleUpdateNanos;
    private RenderQueue.FrameSnapshot activeFrame;

    private int drawCalls;
    private int batchCount;
    private double frameTimeMillis;

    private final boolean instancingSupported;
    private final boolean renderingSupported;

    public RenderContext(long window, WindowConfig config, ShaderOverrideRegistry shaderOverrides) {
        this.window = window;
        this.baseTitle = Objects.requireNonNull(config, "config").title();
        this.shaderOverrides = Objects.requireNonNull(shaderOverrides, "shaderOverrides");
        GL.createCapabilities();
        GLCapabilities caps = GL.getCapabilities();
        this.renderingSupported = caps.OpenGL33;
        this.instancingSupported = caps.OpenGL33;

        try (MemoryStack stack = MemoryStack.stackPush()) {
            IntBuffer widthOut = stack.mallocInt(1);
            IntBuffer heightOut = stack.mallocInt(1);
            glfwGetFramebufferSize(window, widthOut, heightOut);
            this.width = Math.max(widthOut.get(0), 1);
            this.height = Math.max(heightOut.get(0), 1);
        }

        if (!renderingSupported) {
            return;
        }

        initQuadGeometry();
        initSpriteGeometry();
        initDefaultTextures();
        initPrograms();
        recreateFramebuffers(width, height);
    }

    public boolean renderingSupported() {
        return renderingSupported;
    }

    public boolean instancingSupported() {
        return instancingSupported;
    }

    public void beginFrame(double frameTimeMillis) {
        this.frameTimeMillis = frameTimeMillis;
        this.drawCalls = 0;
        this.batchCount = 0;
        this.shadowSlots.clear();
        frameNumber++;
        resizeIfNeeded();
        if (!renderingSupported) {
            glViewport(0, 0, width, height);
            glClearColor(0.08f, 0.08f, 0.1f, 1.0f);
            glClear(GL_COLOR_BUFFER_BIT);
        }
    }

    public void setActiveFrame(RenderQueue.FrameSnapshot snapshot) {
        this.activeFrame = Objects.requireNonNull(snapshot, "snapshot");
    }

    public void geometryPass() {
        if (!renderingSupported) {
            return;
        }
        RenderQueue.FrameSnapshot queue = requireActiveFrame();

        glBindFramebuffer(GL_FRAMEBUFFER, gBufferFbo);
        glViewport(0, 0, width, height);
        glClearColor(0f, 0f, 0f, 1f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        int geometryProgram = program("geometry");
        glUseProgram(geometryProgram);
        uniform2f(geometryProgram, "uViewport", width, height);
        uniform3f(geometryProgram, "uCamera", queue.camera().x(), queue.camera().y(), queue.camera().zoom());

        List<SpriteBatcher.Batch> batches = spriteBatcher.buildBatches(queue.sprites());
        batchCount += batches.size();

        glBindVertexArray(spriteVao);
        for (SpriteBatcher.Batch batch : batches) {
            int texture = atlasPageTextures.getOrDefault(batch.atlasPage(), whiteTexture);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, texture);
            uniform1i(geometryProgram, "uAtlas", 0);
            drawSpriteBatch(batch);
        }
        glBindVertexArray(0);
    }

    public void shadowPass() {
        if (!renderingSupported) {
            return;
        }
        RenderQueue.FrameSnapshot queue = requireActiveFrame();
        glBindFramebuffer(GL_FRAMEBUFFER, shadowFbo);
        glClear(GL_DEPTH_BUFFER_BIT);

        int shadowProgram = program("shadow");
        glUseProgram(shadowProgram);

        int cursorX = 0;
        int cursorY = 0;
        for (int i = 0; i < queue.lights().size(); i++) {
            if (cursorX + SHADOW_TILE_SIZE > SHADOW_ATLAS_SIZE) {
                cursorX = 0;
                cursorY += SHADOW_TILE_SIZE;
            }
            if (cursorY + SHADOW_TILE_SIZE > SHADOW_ATLAS_SIZE) {
                break;
            }
            RenderQueue.LightDrawCall light = queue.lights().get(i);
            glViewport(cursorX, cursorY, SHADOW_TILE_SIZE, SHADOW_TILE_SIZE);
            glClear(GL_DEPTH_BUFFER_BIT);
            uniform2f(shadowProgram, "uLightPosition", light.x(), light.y());
            uniform1f(shadowProgram, "uLightRadius", light.radius());
            glBindVertexArray(quadVao);
            glDrawArrays(GL_TRIANGLES, 0, 6);
            drawCalls++;
            shadowSlots.add(new ShadowSlot(light, cursorX, cursorY, SHADOW_TILE_SIZE, SHADOW_TILE_SIZE));
            cursorX += SHADOW_TILE_SIZE;
        }
    }

    public void lightPass() {
        if (!renderingSupported) {
            return;
        }
        RenderQueue.FrameSnapshot queue = requireActiveFrame();
        glBindFramebuffer(GL_FRAMEBUFFER, lightFbo);
        glViewport(0, 0, width, height);
        glClearColor(0f, 0f, 0f, 1f);
        glClear(GL_COLOR_BUFFER_BIT);

        int lightProgram = program("light_accum");
        glUseProgram(lightProgram);
        uniform2f(lightProgram, "uViewport", width, height);
        uniform3f(lightProgram, "uCamera", queue.camera().x(), queue.camera().y(), queue.camera().zoom());

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gNormalTexture);
        uniform1i(lightProgram, "uNormal", 0);

        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, shadowAtlasTexture);
        uniform1i(lightProgram, "uShadowAtlas", 1);

        glBindVertexArray(quadVao);
        glEnable(GL_BLEND);
        glBlendFunc(GL_ONE, GL_ONE);
        for (int i = 0; i < queue.lights().size(); i++) {
            RenderQueue.LightDrawCall light = queue.lights().get(i);
            uniform2f(lightProgram, "uLightPosition", light.x(), light.y());
            uniform1f(lightProgram, "uLightRadius", light.radius());
            uniform1f(lightProgram, "uLightIntensity", light.intensity());
            ShadowSlot slot = i < shadowSlots.size() ? shadowSlots.get(i) : null;
            if (slot != null) {
                uniform4f(
                    lightProgram,
                    "uShadowUv",
                    slot.x / (float) SHADOW_ATLAS_SIZE,
                    slot.y / (float) SHADOW_ATLAS_SIZE,
                    slot.w / (float) SHADOW_ATLAS_SIZE,
                    slot.h / (float) SHADOW_ATLAS_SIZE
                );
            } else {
                uniform4f(lightProgram, "uShadowUv", 0f, 0f, 0f, 0f);
            }
            glDrawArrays(GL_TRIANGLES, 0, 6);
            drawCalls++;
        }
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        glDisable(GL_BLEND);
    }

    public void compositePass() {
        if (!renderingSupported) {
            return;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, compositeFbo);
        glViewport(0, 0, width, height);
        glClearColor(0f, 0f, 0f, 1f);
        glClear(GL_COLOR_BUFFER_BIT);

        int compositeProgram = program("composite");
        glUseProgram(compositeProgram);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, gAlbedoTexture);
        uniform1i(compositeProgram, "uAlbedo", 0);

        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, lightTexture);
        uniform1i(compositeProgram, "uLight", 1);

        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, gEmissiveTexture);
        uniform1i(compositeProgram, "uEmissive", 2);

        glBindVertexArray(quadVao);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        drawCalls++;
    }

    public void postProcessPass() {
        if (!renderingSupported) {
            return;
        }

        glBindFramebuffer(GL_FRAMEBUFFER, postFbos[0]);
        glViewport(0, 0, width, height);
        glClear(GL_COLOR_BUFFER_BIT);
        int downsampleProgram = program("bloom_downsample");
        glUseProgram(downsampleProgram);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, compositeTexture);
        uniform1i(downsampleProgram, "uInput", 0);
        glBindVertexArray(quadVao);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        drawCalls++;

        glBindFramebuffer(GL_FRAMEBUFFER, postFbos[1]);
        glViewport(0, 0, width, height);
        glClear(GL_COLOR_BUFFER_BIT);
        int upsampleProgram = program("bloom_upsample");
        glUseProgram(upsampleProgram);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, postTextures[0]);
        uniform1i(upsampleProgram, "uInput", 0);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        drawCalls++;
    }

    public void outputPass() {
        if (!renderingSupported) {
            return;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, width, height);

        int outputProgram = program("output");
        glUseProgram(outputProgram);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, postTextures[1]);
        uniform1i(outputProgram, "uScene", 0);

        glBindVertexArray(quadVao);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        drawCalls++;
    }

    public String buildOverlayTitle() {
        long now = System.nanoTime();
        if (now - lastTitleUpdateNanos < 250_000_000L) {
            return null;
        }
        lastTitleUpdateNanos = now;
        return String.format(
            "%s | frame %.2fms | draws %d | batches %d",
            baseTitle,
            frameTimeMillis,
            drawCalls,
            batchCount
        );
    }

    public void dispose() {
        programs.values().forEach(RenderContext::safeDeleteProgram);
        programs.clear();

        if (quadVbo != 0) {
            glDeleteBuffers(quadVbo);
        }
        if (spriteVbo != 0) {
            glDeleteBuffers(spriteVbo);
        }
        if (spriteInstanceVbo != 0) {
            glDeleteBuffers(spriteInstanceVbo);
        }
        if (quadVao != 0) {
            glDeleteVertexArrays(quadVao);
        }
        if (spriteVao != 0) {
            glDeleteVertexArrays(spriteVao);
        }

        if (whiteTexture != 0) {
            glDeleteTextures(whiteTexture);
        }
        atlasPageTextures.values().forEach(RenderContext::safeDeleteTexture);
        atlasPageTextures.clear();

        deleteFramebuffers();
    }

    public long frameNumber() {
        return frameNumber;
    }

    private RenderQueue.FrameSnapshot requireActiveFrame() {
        if (activeFrame == null) {
            throw new ClockworkRenderException("Render pass executed without an active frame snapshot.");
        }
        return activeFrame;
    }

    private void drawSpriteBatch(SpriteBatcher.Batch batch) {
        if (!instancingSupported) {
            for (int i = 0; i < batch.sprites().size(); i++) {
                glDrawArrays(GL_TRIANGLES, 0, 6);
                drawCalls++;
            }
            return;
        }

        FloatBuffer instanceBuffer = BufferUtils.createFloatBuffer(batch.sprites().size() * 13);
        for (SpriteComponent sprite : batch.sprites()) {
            float px = (float) Fixed.to(sprite.origin().x());
            float py = (float) Fixed.to(sprite.origin().y());
            float sx = (float) Fixed.to(sprite.size().x());
            float sy = (float) Fixed.to(sprite.size().y());
            float[] color = sprite.colour();

            // Queue currently has no transform component. Treating origin as world-space anchor keeps sprites stable.
            instanceBuffer.put(px).put(py);
            instanceBuffer.put(sx).put(sy);
            instanceBuffer.put(0.5f).put(0.5f);
            instanceBuffer.put(sprite.layer());
            instanceBuffer.put(color[0]).put(color[1]).put(color[2]).put(color[3]);
            instanceBuffer.put(sprite.flipX() ? 1f : 0f).put(sprite.flipY() ? 1f : 0f);
        }
        instanceBuffer.flip();

        glBindBuffer(GL_ARRAY_BUFFER, spriteInstanceVbo);
        glBufferData(GL_ARRAY_BUFFER, instanceBuffer, GL_DYNAMIC_DRAW);
        glDrawArraysInstanced(GL_TRIANGLES, 0, 6, batch.sprites().size());
        drawCalls++;
    }

    private void initPrograms() {
        programs.put("geometry", compileProgram("geometry", "shaders/geometry.vert", "shaders/geometry.frag"));
        programs.put("shadow", compileProgram("shadow", "shaders/shadow.vert", "shaders/shadow.frag"));
        programs.put("light_accum", compileProgram("light_accum", "shaders/light_accum.vert", "shaders/light_accum.frag"));
        programs.put("composite", compileProgram("composite", "shaders/fullscreen.vert", "shaders/composite.frag"));
        programs.put("bloom_downsample", compileProgram("bloom_downsample", "shaders/fullscreen.vert", "shaders/bloom_downsample.frag"));
        programs.put("bloom_upsample", compileProgram("bloom_upsample", "shaders/fullscreen.vert", "shaders/bloom_upsample.frag"));
        programs.put("output", compileProgram("output", "shaders/fullscreen.vert", "shaders/output.frag"));
    }

    private void initQuadGeometry() {
        float[] quad = {
            -1f, -1f,
             1f, -1f,
             1f,  1f,
            -1f, -1f,
             1f,  1f,
            -1f,  1f
        };
        quadVao = glGenVertexArrays();
        quadVbo = glGenBuffers();

        glBindVertexArray(quadVao);
        glBindBuffer(GL_ARRAY_BUFFER, quadVbo);
        glBufferData(GL_ARRAY_BUFFER, quad, GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 2, GL_FLOAT, false, 2 * Float.BYTES, 0L);
        glBindVertexArray(0);
    }

    private void initSpriteGeometry() {
        float[] unitQuad = {
            0f, 0f,
            1f, 0f,
            1f, 1f,
            0f, 0f,
            1f, 1f,
            0f, 1f
        };

        spriteVao = glGenVertexArrays();
        spriteVbo = glGenBuffers();
        spriteInstanceVbo = glGenBuffers();

        glBindVertexArray(spriteVao);

        glBindBuffer(GL_ARRAY_BUFFER, spriteVbo);
        glBufferData(GL_ARRAY_BUFFER, unitQuad, GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 2, GL_FLOAT, false, 2 * Float.BYTES, 0L);

        glBindBuffer(GL_ARRAY_BUFFER, spriteInstanceVbo);
        glBufferData(GL_ARRAY_BUFFER, 16L * 1024L * Float.BYTES, GL_DYNAMIC_DRAW);

        int stride = 13 * Float.BYTES;
        int offset = 0;

        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 2, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(1, 1);
        offset += 2 * Float.BYTES;

        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(2, 1);
        offset += 2 * Float.BYTES;

        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 2, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(3, 1);
        offset += 2 * Float.BYTES;

        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 1, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(4, 1);
        offset += Float.BYTES;

        glEnableVertexAttribArray(5);
        glVertexAttribPointer(5, 4, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(5, 1);
        offset += 4 * Float.BYTES;

        glEnableVertexAttribArray(6);
        glVertexAttribPointer(6, 2, GL_FLOAT, false, stride, offset);
        glVertexAttribDivisor(6, 1);

        glBindVertexArray(0);
    }

    private void initDefaultTextures() {
        whiteTexture = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, whiteTexture);
        ByteBuffer pixel = BufferUtils.createByteBuffer(4);
        pixel.put((byte) 0xFF).put((byte) 0xFF).put((byte) 0xFF).put((byte) 0xFF).flip();
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 1, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixel);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    }

    private int compileProgram(String name, String vertexResource, String fragmentResource) {
        String vertex = shaderOverrides.hasOverride(name) ? shaderOverrides.vertexSource(name) : loadResource(vertexResource);
        String fragment = shaderOverrides.hasOverride(name) ? shaderOverrides.fragmentSource(name) : loadResource(fragmentResource);

        int vertexShader = compileShader(GL_VERTEX_SHADER, vertex, name + " vertex");
        int fragmentShader = compileShader(GL_FRAGMENT_SHADER, fragment, name + " fragment");

        int program = glCreateProgram();
        glAttachShader(program, vertexShader);
        glAttachShader(program, fragmentShader);
        glLinkProgram(program);

        if (glGetProgrami(program, GL_LINK_STATUS) == 0) {
            String info = glGetProgramInfoLog(program);
            glDeleteShader(vertexShader);
            glDeleteShader(fragmentShader);
            glDeleteProgram(program);
            throw new ClockworkRenderException("Failed to link shader program '" + name + "':\n" + info);
        }

        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);
        return program;
    }

    private int compileShader(int type, String source, String label) {
        int shader = glCreateShader(type);
        glShaderSource(shader, source);
        glCompileShader(shader);
        if (glGetShaderi(shader, GL_COMPILE_STATUS) == 0) {
            String info = glGetShaderInfoLog(shader);
            glDeleteShader(shader);
            throw new ClockworkRenderException("Failed to compile " + label + " shader:\n" + info + "\n--- source ---\n" + source);
        }
        return shader;
    }

    private String loadResource(String resourcePath) {
        try (InputStream input = RenderContext.class.getClassLoader().getResourceAsStream(resourcePath)) {
            if (input == null) {
                throw new ClockworkRenderException("Missing shader resource: " + resourcePath);
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ClockworkRenderException("Failed to load shader resource: " + resourcePath, e);
        }
    }

    private void resizeIfNeeded() {
        try (MemoryStack stack = MemoryStack.stackPush()) {
            IntBuffer widthOut = stack.mallocInt(1);
            IntBuffer heightOut = stack.mallocInt(1);
            glfwGetFramebufferSize(window, widthOut, heightOut);
            int nextWidth = Math.max(widthOut.get(0), 1);
            int nextHeight = Math.max(heightOut.get(0), 1);
            if (nextWidth != width || nextHeight != height) {
                width = nextWidth;
                height = nextHeight;
                if (renderingSupported) {
                    recreateFramebuffers(width, height);
                }
            }
        }
    }

    private void recreateFramebuffers(int width, int height) {
        deleteFramebuffers();

        gBufferFbo = glGenFramebuffers();
        glBindFramebuffer(GL_FRAMEBUFFER, gBufferFbo);
        gAlbedoTexture = createColorTexture(width, height);
        gNormalTexture = createColorTexture(width, height);
        gEmissiveTexture = createColorTexture(width, height);
        gDepthRbo = glGenRenderbuffers();

        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gAlbedoTexture, 0);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, gNormalTexture, 0);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT2, GL_TEXTURE_2D, gEmissiveTexture, 0);

        glBindRenderbuffer(GL_RENDERBUFFER, gDepthRbo);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, width, height);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, gDepthRbo);
        glDrawBuffers(new int[] {GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2});
        assertFramebufferComplete("G-buffer");

        shadowFbo = glGenFramebuffers();
        glBindFramebuffer(GL_FRAMEBUFFER, shadowFbo);
        shadowAtlasTexture = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, shadowAtlasTexture);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_DEPTH_COMPONENT24,
            SHADOW_ATLAS_SIZE,
            SHADOW_ATLAS_SIZE,
            0,
            GL_DEPTH_COMPONENT,
            GL_UNSIGNED_BYTE,
            (ByteBuffer) null
        );
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, org.lwjgl.opengl.GL11C.GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, org.lwjgl.opengl.GL11C.GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, shadowAtlasTexture, 0);
        glDrawBuffer(GL_NONE);
        glReadBuffer(GL_NONE);
        assertFramebufferComplete("Shadow atlas");

        lightFbo = glGenFramebuffers();
        glBindFramebuffer(GL_FRAMEBUFFER, lightFbo);
        lightTexture = createColorTexture(width, height);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, lightTexture, 0);
        glDrawBuffers(new int[] {GL_COLOR_ATTACHMENT0});
        assertFramebufferComplete("Light accumulation");

        compositeFbo = glGenFramebuffers();
        glBindFramebuffer(GL_FRAMEBUFFER, compositeFbo);
        compositeTexture = createColorTexture(width, height);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, compositeTexture, 0);
        glDrawBuffers(new int[] {GL_COLOR_ATTACHMENT0});
        assertFramebufferComplete("Composite");

        for (int i = 0; i < 2; i++) {
            postFbos[i] = glGenFramebuffers();
            glBindFramebuffer(GL_FRAMEBUFFER, postFbos[i]);
            postTextures[i] = createColorTexture(width, height);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, postTextures[i], 0);
            glDrawBuffers(new int[] {GL_COLOR_ATTACHMENT0});
            assertFramebufferComplete("Post-process " + i);
        }

        glBindFramebuffer(GL_FRAMEBUFFER, 0);
    }

    private int createColorTexture(int width, int height) {
        int texture = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, (ByteBuffer) null);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, org.lwjgl.opengl.GL11C.GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, org.lwjgl.opengl.GL11C.GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        return texture;
    }

    private void deleteFramebuffers() {
        safeDeleteFramebuffer(gBufferFbo);
        safeDeleteFramebuffer(shadowFbo);
        safeDeleteFramebuffer(lightFbo);
        safeDeleteFramebuffer(compositeFbo);
        for (int i = 0; i < postFbos.length; i++) {
            safeDeleteFramebuffer(postFbos[i]);
            postFbos[i] = 0;
        }

        safeDeleteRenderbuffer(gDepthRbo);

        safeDeleteTexture(gAlbedoTexture);
        safeDeleteTexture(gNormalTexture);
        safeDeleteTexture(gEmissiveTexture);
        safeDeleteTexture(shadowAtlasTexture);
        safeDeleteTexture(lightTexture);
        safeDeleteTexture(compositeTexture);
        for (int i = 0; i < postTextures.length; i++) {
            safeDeleteTexture(postTextures[i]);
            postTextures[i] = 0;
        }

        gBufferFbo = 0;
        shadowFbo = 0;
        lightFbo = 0;
        compositeFbo = 0;
        gDepthRbo = 0;
        gAlbedoTexture = 0;
        gNormalTexture = 0;
        gEmissiveTexture = 0;
        shadowAtlasTexture = 0;
        lightTexture = 0;
        compositeTexture = 0;
    }

    private void assertFramebufferComplete(String name) {
        int status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
        if (status != GL_FRAMEBUFFER_COMPLETE) {
            throw new ClockworkRenderException(name + " framebuffer is incomplete (status=" + status + ")");
        }
    }

    private int program(String key) {
        Integer program = programs.get(key);
        if (program == null) {
            throw new ClockworkRenderException("Missing render program: " + key);
        }
        return program;
    }

    private static void safeDeleteProgram(int id) {
        if (id != 0) {
            glDeleteProgram(id);
        }
    }

    private static void safeDeleteFramebuffer(int id) {
        if (id != 0) {
            glDeleteFramebuffers(id);
        }
    }

    private static void safeDeleteRenderbuffer(int id) {
        if (id != 0) {
            glDeleteRenderbuffers(id);
        }
    }

    private static void safeDeleteTexture(int id) {
        if (id != 0) {
            glDeleteTextures(id);
        }
    }

    private static void uniform1i(int program, String name, int value) {
        int location = glGetUniformLocation(program, name);
        if (location >= 0) {
            glUniform1i(location, value);
        }
    }

    private static void uniform1f(int program, String name, float value) {
        int location = glGetUniformLocation(program, name);
        if (location >= 0) {
            glUniform1f(location, value);
        }
    }

    private static void uniform2f(int program, String name, float x, float y) {
        int location = glGetUniformLocation(program, name);
        if (location >= 0) {
            glUniform2f(location, x, y);
        }
    }

    private static void uniform3f(int program, String name, float x, float y, float z) {
        int location = glGetUniformLocation(program, name);
        if (location >= 0) {
            glUniform3f(location, x, y, z);
        }
    }

    private static void uniform4f(int program, String name, float x, float y, float z, float w) {
        int location = glGetUniformLocation(program, name);
        if (location >= 0) {
            glUniform4f(location, x, y, z, w);
        }
    }

    private record ShadowSlot(RenderQueue.LightDrawCall light, int x, int y, int w, int h) {
    }
}
