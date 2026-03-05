package com.quietterminal.clockwork;

import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.plugins.ColliderComponent;
import com.quietterminal.clockwork.plugins.CollisionStartedEvent;
import com.quietterminal.clockwork.plugins.PhysicsConfig;
import com.quietterminal.clockwork.plugins.PhysicsForceCommand;
import com.quietterminal.clockwork.plugins.PhysicsPlugin;
import com.quietterminal.clockwork.plugins.RigidBodyComponent;
import com.quietterminal.clockwork.scheduler.Stage;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PhysicsPluginIntegrationTest {
    @Test
    void applyForceForSixtyTicksMovesBodyAsExpected() {
        AtomicLong trackedEntity = new AtomicLong();

        ClockworkApp app = new ClockworkApp()
            .use(new PhysicsPlugin(PhysicsConfig.builder()
                .gravity(Fixed.ZERO)
                .solverIterations(8)
                .build()))
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "physics-force-test";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    Commands commands = world.commands();
                    long entity = commands.spawn()
                        .with(newBody(0))
                        .with(ColliderComponent.circle(Fixed.from(0.5), -1))
                        .id();
                    commands.flush();
                    trackedEntity.set(entity);

                    app.addSystem(Stage.FIXED_UPDATE, ctx -> {
                        if (ctx.tick() <= 60) {
                            ctx.commands().addComponent(entity, new PhysicsForceCommand(
                                new Vec2(Fixed.ofRaw(Fixed.ONE), Fixed.ZERO)
                            ));
                        }
                    });
                }
            })
            .build();

        for (int i = 0; i < 60; i++) {
            app.step(1.0 / 60.0);
        }

        RigidBodyComponent body = app.world()
            .query(RigidBodyComponent.class)
            .iterator()
            .next()
            .a();

        assertEquals(trackedEntity.get(), app.world().query(RigidBodyComponent.class).iterator().next().entity());
        assertEquals(0.4910, Fixed.toDouble(body.position().x()), 0.01);
    }

    @Test
    void collisionEventsMapToTypedJavaEvent() {
        AtomicBoolean collisionSeen = new AtomicBoolean();

        ClockworkApp app = new ClockworkApp()
            .use(new PhysicsPlugin(PhysicsConfig.builder().gravity(Fixed.ZERO).build()))
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "collision-test";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    Commands commands = world.commands();
                    commands.spawn()
                        .with(newBody(0))
                        .with(ColliderComponent.circle(Fixed.from(0.6), -1))
                        .id();
                    commands.spawn()
                        .with(newBody(Fixed.from(0.9).raw()))
                        .with(ColliderComponent.circle(Fixed.from(0.6), -1))
                        .id();
                    commands.flush();

                    world.events().subscribe(CollisionStartedEvent.class, event -> collisionSeen.set(true));
                }
            })
            .build();

        app.step(1.0 / 60.0);
        assertTrue(collisionSeen.get());
    }

    @Test
    void physicsSnapshotsAreDetachedFromLiveState() {
        ClockworkApp app = new ClockworkApp()
            .use(new PhysicsPlugin(PhysicsConfig.builder().gravity(Fixed.ZERO).build()))
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "snapshot-test";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    Commands commands = world.commands();
                    commands.spawn().with(newBody(0)).with(ColliderComponent.circle(Fixed.from(0.5), -1)).id();
                    commands.flush();
                }
            })
            .build();

        RigidBodyComponent first = app.world().query(RigidBodyComponent.class).iterator().next().a();
        RigidBodyComponent second = app.world().query(RigidBodyComponent.class).iterator().next().a();
        assertNotSame(first, second);
    }

    private static RigidBodyComponent newBody(int xRaw) {
        Fixed one = Fixed.ofRaw(Fixed.ONE);
        return new RigidBodyComponent(
            new Vec2(Fixed.ofRaw(xRaw), Fixed.ZERO),
            new Vec2(Fixed.ZERO, Fixed.ZERO),
            Fixed.ZERO,
            Fixed.ZERO,
            one,
            one,
            one,
            one,
            Fixed.from(0.1),
            Fixed.from(0.2),
            Fixed.ZERO,
            Fixed.ZERO,
            false,
            false,
            0
        );
    }
}
