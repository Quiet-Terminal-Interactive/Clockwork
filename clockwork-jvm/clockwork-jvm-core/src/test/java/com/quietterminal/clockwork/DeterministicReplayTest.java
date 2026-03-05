package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.ecs.QueryResult;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeterministicReplayTest {
    record Pos(int x, int y) {}
    record Vel(int dx, int dy) {}

    @Test
    void sameCommandSequenceProducesSameEntityIds() {
        long[] ids1 = spawnThree();
        long[] ids2 = spawnThree();
        for (int i = 0; i < 3; i++) {
            assertEquals(ids1[i], ids2[i], "Entity IDs must be deterministic across runs");
        }
    }

    @Test
    void sameCommandSequenceProducesSameComponentData() {
        ClockworkApp app = new ClockworkApp().build();
        @SuppressWarnings("unused")
        long[] ids = applySpawnSequence(app);
        List<Pos> first = collectPositions(app);

        ClockworkApp app2 = new ClockworkApp().build();
        applySpawnSequence(app2);
        List<Pos> second = collectPositions(app2);

        assertEquals(first.size(), second.size());
        for (int i = 0; i < first.size(); i++) {
            assertEquals(first.get(i), second.get(i));
        }
    }

    @Test
    void serializeRestorePreservesEntitiesAndComponents() {
        ClockworkApp app = new ClockworkApp().build();
        applySpawnSequence(app);
        List<Pos> beforeSnapshot = collectPositions(app);

        Object snapshot = app.world().serialize();

        Iterator<QueryResult<Pos, Void, Void, Void>> it = app.world().query(Pos.class).iterator();
        long firstId = it.next().entity();
        var cmds = app.world().commands();
        cmds.despawn(firstId);
        app.world().commit(cmds);

        assertFalse(collectPositions(app).size() == beforeSnapshot.size(),
            "Should have fewer entities after despawn");

        app.world().restore(snapshot);
        List<Pos> afterRestore = collectPositions(app);
        assertEquals(beforeSnapshot.size(), afterRestore.size());
    }

    @Test
    void postRestoreSpawnDoesNotCollideWithRestoredIds() {
        ClockworkApp app = new ClockworkApp().build();
        long[] original = applySpawnSequence(app);
        Object snapshot = app.world().serialize();

        for (long id : original) {
            var cmds = app.world().commands();
            cmds.despawn(id);
            app.world().commit(cmds);
        }
        app.world().restore(snapshot);

        var cmds = app.world().commands();
        long newId = cmds.spawn().with(new Pos(99, 99)).id();
        app.world().commit(cmds);

        for (long id : original) {
            assertNotEquals(id, newId, "Post-restore spawn must not collide with restored IDs");
        }
        assertTrue(newId > original[original.length - 1],
            "Post-restore IDs must be monotonically increasing past last restored ID");
    }

    @Test
    void multipleRestoreCyclesAreIdempotent() {
        ClockworkApp app = new ClockworkApp().build();
        applySpawnSequence(app);
        Object snapshot = app.world().serialize();

        for (int i = 0; i < 3; i++) {
            app.world().restore(snapshot);
        }
        List<Pos> positions = collectPositions(app);
        assertEquals(3, positions.size(), "State must be identical after repeated restores");
    }

    @Test
    void addAndRemoveComponentsIsFullyReplayable() {
        ClockworkApp app1 = new ClockworkApp().build();
        long id1 = applyAddRemoveSequence(app1);

        ClockworkApp app2 = new ClockworkApp().build();
        long id2 = applyAddRemoveSequence(app2);

        assertEquals(id1, id2);

        assertFalse(app1.world().query(Vel.class).iterator().hasNext());
        assertFalse(app2.world().query(Vel.class).iterator().hasNext());
    }

    @Test
    void steppingDoesNotAffectEntityIdDeterminism() {
        ClockworkApp app = new ClockworkApp().build();
        app.step(1.0 / 60.0);
        app.step(1.0 / 60.0);
        var cmds = app.world().commands();
        long id = cmds.spawn().with(new Pos(0, 0)).id();
        app.world().commit(cmds);

        ClockworkApp app2 = new ClockworkApp().build();
        app2.step(1.0 / 60.0);
        app2.step(1.0 / 60.0);
        var cmds2 = app2.world().commands();
        long id2 = cmds2.spawn().with(new Pos(0, 0)).id();
        app2.world().commit(cmds2);

        assertEquals(id, id2);
    }

    private static long[] spawnThree() {
        ClockworkApp app = new ClockworkApp().build();
        return applySpawnSequence(app);
    }

    private static long[] applySpawnSequence(ClockworkApp app) {
        var cmds = app.world().commands();
        long a = cmds.spawn().with(new Pos(1, 2)).id();
        long b = cmds.spawn().with(new Pos(3, 4)).id();
        long c = cmds.spawn().with(new Pos(5, 6)).id();
        app.world().commit(cmds);
        return new long[]{a, b, c};
    }

    private static List<Pos> collectPositions(ClockworkApp app) {
        List<Pos> result = new ArrayList<>();
        for (QueryResult<Pos, Void, Void, Void> r : app.world().query(Pos.class)) {
            result.add(r.a());
        }
        return result;
    }

    private static long applyAddRemoveSequence(ClockworkApp app) {
        var cmds = app.world().commands();
        long id = cmds.spawn().with(new Pos(10, 20)).id();
        app.world().commit(cmds);

        var cmds2 = app.world().commands();
        cmds2.addComponent(id, new Vel(1, 2));
        app.world().commit(cmds2);

        var cmds3 = app.world().commands();
        cmds3.removeComponent(id, Vel.class);
        app.world().commit(cmds3);

        return id;
    }
}
