package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.renderer.RenderQueue;
import com.quietterminal.clockwork.renderer.RenderQueue.CameraState;
import com.quietterminal.clockwork.renderer.RenderQueue.FrameSnapshot;
import com.quietterminal.clockwork.renderer.RenderQueue.LightDrawCall;
import com.quietterminal.clockwork.renderer.RenderQueue.ParticleDrawCall;
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;
import com.quietterminal.clockwork.renderer.assets.AssetRef;
import com.quietterminal.clockwork.renderer.sprites.SpriteComponent;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RendererHeadlessTest {

    @Test
    void defaultSnapshotIsNonNull() {
        RenderQueue queue = new RenderQueue();
        assertNotNull(queue.snapshot());
    }

    @Test
    void defaultSnapshotHasTickZero() {
        RenderQueue queue = new RenderQueue();
        assertEquals(0L, queue.snapshot().tickNumber());
    }

    @Test
    void commitPublishesPendingSprites() {
        RenderQueue queue = new RenderQueue();
        SpriteComponent sprite = makeSprite();
        queue.sprites().add(sprite);
        queue.commit();
        assertEquals(1, queue.snapshot().sprites().size());
        assertSame(sprite, queue.snapshot().sprites().get(0));
    }

    @Test
    void commitPublishesLightsAndParticles() {
        RenderQueue queue = new RenderQueue();
        queue.lights().add(new LightDrawCall(10f, 20f, 5f, 1f));
        queue.particles().add(new ParticleDrawCall(1f, 2f, 0.5f));
        queue.commit();
        FrameSnapshot snap = queue.snapshot();
        assertEquals(1, snap.lights().size());
        assertEquals(1, snap.particles().size());
    }

    @Test
    void commitClearsPendingBuffers() {
        RenderQueue queue = new RenderQueue();
        queue.sprites().add(makeSprite());
        queue.commit();
        queue.commit();
        assertEquals(0, queue.snapshot().sprites().size());
    }

    @Test
    void clearRemovesPendingWithoutAffectingPublished() {
        RenderQueue queue = new RenderQueue();
        queue.sprites().add(makeSprite());
        queue.commit();

        queue.sprites().add(makeSprite());
        queue.clear();

        assertEquals(1, queue.snapshot().sprites().size());
        queue.commit();
        assertEquals(0, queue.snapshot().sprites().size());
    }

    @Test
    void tickNumberIsPublishedOnCommit() {
        RenderQueue queue = new RenderQueue();
        queue.tickNumber(42L);
        queue.commit();
        assertEquals(42L, queue.snapshot().tickNumber());
    }

    @Test
    void cameraStateIsPublishedOnCommit() {
        RenderQueue queue = new RenderQueue();
        queue.camera(new CameraState(100f, 200f, 2.0f));
        queue.commit();
        CameraState cam = queue.snapshot().camera();
        assertEquals(100f, cam.x(), 0.001f);
        assertEquals(200f, cam.y(), 0.001f);
        assertEquals(2.0f, cam.zoom(), 0.001f);
    }

    @Test
    void publishedSnapshotListsAreImmutable() {
        RenderQueue queue = new RenderQueue();
        queue.lights().add(new LightDrawCall(0f, 0f, 1f, 1f));
        queue.commit();
        assertThrows(UnsupportedOperationException.class,
            () -> queue.snapshot().lights().clear());
    }

    @Test
    void snapshotIsConsistentAcrossMultipleReads() {
        RenderQueue queue = new RenderQueue();
        queue.lights().add(new LightDrawCall(5f, 5f, 2f, 0.8f));
        queue.commit();
        FrameSnapshot a = queue.snapshot();
        FrameSnapshot b = queue.snapshot();
        assertSame(a, b, "Multiple reads of snapshot() before next commit must return the same instance");
    }

    @Test
    void interpolateAlphaZeroReturnsPreviousCamera() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = makeSnapshot(new CameraState(100f, 100f, 2f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 0.0f);
        assertEquals(0f, interp.camera().x(), 0.01f);
        assertEquals(0f, interp.camera().y(), 0.01f);
        assertEquals(1f, interp.camera().zoom(), 0.01f);
    }

    @Test
    void interpolateAlphaOneReturnsCurrentCamera() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = makeSnapshot(new CameraState(100f, 200f, 3f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 1.0f);
        assertEquals(100f, interp.camera().x(), 0.01f);
        assertEquals(200f, interp.camera().y(), 0.01f);
        assertEquals(3f, interp.camera().zoom(), 0.01f);
    }

    @Test
    void interpolateAlphaHalfBlendsCamera() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = makeSnapshot(new CameraState(100f, 200f, 3f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 0.5f);
        assertEquals(50f, interp.camera().x(), 0.1f);
        assertEquals(100f, interp.camera().y(), 0.1f);
        assertEquals(2f, interp.camera().zoom(), 0.1f);
    }

    @Test
    void interpolateNullPreviousReturnsCurrentUnchanged() {
        FrameSnapshot curr = makeSnapshot(new CameraState(10f, 20f, 1.5f), 5L);
        FrameSnapshot interp = RenderQueue.interpolate(null, curr, 0.5f);
        assertSame(curr, interp);
    }

    @Test
    void interpolateAlphaBelowZeroClampsToPrevious() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = makeSnapshot(new CameraState(100f, 0f, 1f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, -5.0f);
        assertEquals(0f, interp.camera().x(), 0.01f);
    }

    @Test
    void interpolateAlphaAboveOneClampsToCurrent() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = makeSnapshot(new CameraState(100f, 0f, 1f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 99.0f);
        assertEquals(100f, interp.camera().x(), 0.01f);
    }

    @Test
    void interpolateExtraCurrentLightsAppendedWithoutBlending() {
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L,
            List.of(new LightDrawCall(0f, 0f, 1f, 1f)), List.of());
        FrameSnapshot curr = makeSnapshot(new CameraState(0f, 0f, 1f), 2L,
            List.of(new LightDrawCall(10f, 10f, 2f, 0.5f), new LightDrawCall(99f, 99f, 5f, 1f)),
            List.of());
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 0.5f);
        assertEquals(2, interp.lights().size());
        assertEquals(99f, interp.lights().get(1).x(), 0.01f);
    }

    @Test
    void interpolateSpriteListAlwaysComesFromCurrent() {
        SpriteComponent sprite = makeSprite();
        FrameSnapshot prev = makeSnapshot(new CameraState(0f, 0f, 1f), 1L);
        FrameSnapshot curr = new FrameSnapshot(
            List.of(sprite), List.of(), List.of(), new CameraState(0f, 0f, 1f), 2L);
        FrameSnapshot interp = RenderQueue.interpolate(prev, curr, 0.5f);
        assertSame(curr.sprites(), interp.sprites());
    }

    @Test
    void concurrentCommitAndSnapshotDoNotDeadlock() throws InterruptedException {
        RenderQueue queue = new RenderQueue();
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Throwable> error = new AtomicReference<>();

        Thread writer = new Thread(() -> {
            try {
                start.await();
                for (int i = 0; i < 1000; i++) {
                    queue.lights().add(new LightDrawCall(i, i, 1f, 1f));
                    queue.commit();
                }
            } catch (Throwable t) {
                error.set(t);
            }
        });

        Thread reader = new Thread(() -> {
            try {
                start.await();
                for (int i = 0; i < 1000; i++) {
                    assertNotNull(queue.snapshot());
                }
            } catch (Throwable t) {
                error.set(t);
            }
        });

        writer.start();
        reader.start();
        start.countDown();
        writer.join(5000);
        reader.join(5000);

        assertNull(error.get(), "Concurrent commit/snapshot produced: " + error.get());
    }

    private static SpriteComponent makeSprite() {
        AssetRef ref = new AssetRef("test:sprite", 0, 0f, 0f, 1f, 1f);
        Vec2 size = Vec2.create(Fixed.from(1.0), Fixed.from(1.0));
        Vec2 origin = Vec2.create(Fixed.from(0.5), Fixed.from(0.5));
        return new SpriteComponent(ref, size, origin, 0, null, false, false);
    }

    private static FrameSnapshot makeSnapshot(CameraState camera, long tick) {
        return new FrameSnapshot(List.of(), List.of(), List.of(), camera, tick);
    }

    private static FrameSnapshot makeSnapshot(CameraState camera, long tick,
                                              List<LightDrawCall> lights,
                                              List<ParticleDrawCall> particles) {
        return new FrameSnapshot(List.of(), lights, particles, camera, tick);
    }
}
