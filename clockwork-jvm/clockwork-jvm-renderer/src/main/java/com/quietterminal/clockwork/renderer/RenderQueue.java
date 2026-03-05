package com.quietterminal.clockwork.renderer;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.quietterminal.clockwork.renderer.sprites.SpriteComponent;

/**
 * Render queue shared between the simulation thread (writer) and renderer thread (reader).
 *
 * Lock-free handoff design:
 *   - Simulation thread accumulates draw calls into pending buffers (unsynchronized — single writer).
 *   - At the end of each tick, commit() atomically publishes an immutable FrameSnapshot.
 *   - Renderer thread calls snapshot() which is a single atomic load — no locks, no contention.
 *
 * AtomicReference.set() happens-before any subsequent get() that observes it, so
 * the renderer always sees a consistent snapshot without any additional synchronisation.
 */
public final class RenderQueue {

    private final List<SpriteComponent> pendingSprites = new ArrayList<>();
    private final List<LightDrawCall> pendingLights = new ArrayList<>();
    private final List<ParticleDrawCall> pendingParticles = new ArrayList<>();
    private CameraState pendingCamera = new CameraState(0.0f, 0.0f, 1.0f);
    private long pendingTickNumber;

    // The committed snapshot visible to the renderer thread. Lock-free; written by simulation, read by renderer.
    private final AtomicReference<FrameSnapshot> published;

    public RenderQueue() {
        published = new AtomicReference<>(
            new FrameSnapshot(List.of(), List.of(), List.of(), new CameraState(0.0f, 0.0f, 1.0f), 0L)
        );
    }

    public List<SpriteComponent> sprites() {
        return pendingSprites;
    }

    public List<LightDrawCall> lights() {
        return pendingLights;
    }

    public List<ParticleDrawCall> particles() {
        return pendingParticles;
    }

    public CameraState camera() {
        return pendingCamera;
    }

    public void camera(CameraState camera) {
        this.pendingCamera = camera;
    }

    public long tickNumber() {
        return pendingTickNumber;
    }

    public void tickNumber(long tickNumber) {
        this.pendingTickNumber = tickNumber;
    }

    /** Clears pending draw call buffers without publishing. */
    public void clear() {
        pendingSprites.clear();
        pendingLights.clear();
        pendingParticles.clear();
    }

    /**
     * Atomically publishes the current pending state as an immutable snapshot and clears the buffers.
     * Called by the simulation thread at the end of each tick via a registered tick-end hook.
     */
    public void commit() {
        published.set(new FrameSnapshot(
            List.copyOf(pendingSprites),
            List.copyOf(pendingLights),
            List.copyOf(pendingParticles),
            pendingCamera,
            pendingTickNumber
        ));
        pendingSprites.clear();
        pendingLights.clear();
        pendingParticles.clear();
    }

    /** Returns the latest committed snapshot. Lock-free; safe to call from any thread. */
    public FrameSnapshot snapshot() {
        return published.get();
    }

    /**
     * Interpolates between two snapshots using the given alpha (0 = previous, 1 = current).
     * Used by the renderer when it outruns the simulation tick rate.
     */
    public static FrameSnapshot interpolate(FrameSnapshot previous, FrameSnapshot current, float alpha) {
        if (previous == null) {
            return current;
        }
        float t = Math.clamp(alpha, 0.0f, 1.0f);
        CameraState camera = new CameraState(
            lerp(previous.camera.x, current.camera.x, t),
            lerp(previous.camera.y, current.camera.y, t),
            lerp(previous.camera.zoom, current.camera.zoom, t)
        );

        int lightCount = Math.min(previous.lights.size(), current.lights.size());
        List<LightDrawCall> lights = new ArrayList<>(current.lights.size());
        for (int i = 0; i < lightCount; i++) {
            LightDrawCall a = previous.lights.get(i);
            LightDrawCall b = current.lights.get(i);
            lights.add(new LightDrawCall(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.radius, b.radius, t), lerp(a.intensity, b.intensity, t)));
        }
        for (int i = lightCount; i < current.lights.size(); i++) {
            lights.add(current.lights.get(i));
        }

        int particleCount = Math.min(previous.particles.size(), current.particles.size());
        List<ParticleDrawCall> particles = new ArrayList<>(current.particles.size());
        for (int i = 0; i < particleCount; i++) {
            ParticleDrawCall a = previous.particles.get(i);
            ParticleDrawCall b = current.particles.get(i);
            particles.add(new ParticleDrawCall(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.size, b.size, t)));
        }
        for (int i = particleCount; i < current.particles.size(); i++) {
            particles.add(current.particles.get(i));
        }

        return new FrameSnapshot(current.sprites, List.copyOf(lights), List.copyOf(particles), camera, current.tickNumber);
    }

    private static float lerp(float a, float b, float t) {
        return a + ((b - a) * t);
    }

    /** Immutable frame snapshot consumed by the renderer thread. */
    public record FrameSnapshot(
        List<SpriteComponent> sprites,
        List<LightDrawCall> lights,
        List<ParticleDrawCall> particles,
        CameraState camera,
        long tickNumber
    ) {}

    /** Camera snapshot for a single frame. */
    public record CameraState(float x, float y, float zoom) {}

    /** Light draw call payload. */
    public record LightDrawCall(float x, float y, float radius, float intensity) {}

    /** Particle draw call payload. */
    public record ParticleDrawCall(float x, float y, float size) {}
}
