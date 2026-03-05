package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.QueryResult;
import com.quietterminal.clockwork.ecs.RawQueryResult;
import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;
import com.quietterminal.clockwork.exceptions.ClockworkEcsException;

import java.util.Iterator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EcsTest {
    @Test
    void spawnAndQueryRoundTrip() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        long entity = commands.spawn().with(new Position(10, 20)).with(new Velocity(1, 2)).id();
        app.world().commit(commands);

        Query<Position, Velocity, Void, Void> query = app.world().query(Position.class, Velocity.class);
        QueryResult<Position, Velocity, Void, Void> first = query.iterator().next();

        assertEquals(entity, first.entity());
        assertEquals(10, first.a().x());
        assertEquals(2, first.b().y());
        assertTrue(app.world().query(Position.class).iterator().hasNext());
    }

    @Test
    void rawQuerySupportsOptionalComponents() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        commands.spawn().with(new Position(3, 4)).id();
        app.world().commit(commands);

        Iterator<RawQueryResult> rows = app.world()
            .queryRaw(Position.class)
            .optional(Velocity.class)
            .iterator();
        RawQueryResult row = rows.next();

        assertEquals(3, ((Position) row.components().get(Position.class)).x());
        assertNull(row.components().get(Velocity.class));
    }

    @Test
    void mutableSnapshotsAreRejected() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        commands.spawn().with(new MutablePosition(1, 2)).id();
        app.world().commit(commands);

        assertThrows(ClockworkEcsException.class,
            () -> app.world().query(MutablePosition.class).iterator().next());
    }

    @Test
    void failedBatchRollsBackAppliedCommands() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        commands.spawn().with(new Position(9, 9)).id();
        commands.despawn(999L);

        assertThrows(ClockworkBridgeException.class, () -> app.world().commit(commands));
        assertFalse(app.world().query(Position.class).iterator().hasNext());
    }

    @Test
    void serializeAndRestorePreserveIdsAndEntities() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        long first = commands.spawn().with(new Position(1, 1)).id();
        long second = commands.spawn().with(new Position(2, 2)).id();
        app.world().commit(commands);

        Object snapshot = app.world().serialize();
        var restoreCommands = app.world().commands();
        restoreCommands.despawn(first);
        app.world().commit(restoreCommands);
        app.world().restore(snapshot);

        QueryResult<Position, Void, Void, Void> restored = app.world().query(Position.class).iterator().next();
        assertEquals(first, restored.entity());

        var postRestore = app.world().commands();
        long allocated = postRestore.spawn().with(new Position(3, 3)).id();
        app.world().commit(postRestore);

        assertNotEquals(first, allocated);
        assertNotEquals(second, allocated);
        assertTrue(allocated > second);
    }

    @Test
    void queryFiltersHandleWithoutOptionalAndTags() {
        ClockworkApp app = new ClockworkApp().build();
        var commands = app.world().commands();
        long awake = commands.spawn().with(new Position(10, 10)).with(new ActiveTag()).id();
        commands.spawn().with(new Position(11, 11)).with(new SleepingTag()).id();
        app.world().commit(commands);

        Iterator<QueryResult<Position, Void, Void, Void>> rows = app.world()
            .query(Position.class)
            .without(SleepingTag.class)
            .optional(SleepingTag.class)
            .iterator();

        QueryResult<Position, Void, Void, Void> row = rows.next();
        assertEquals(awake, row.entity());
        assertFalse(rows.hasNext());

        RawQueryResult raw = app.world()
            .queryRaw(Position.class)
            .without(SleepingTag.class)
            .optional(SleepingTag.class)
            .optional(ActiveTag.class)
            .iterator()
            .next();

        assertNull(raw.components().get(SleepingTag.class));
        assertTrue(raw.components().get(ActiveTag.class) instanceof ActiveTag);
    }

    record Position(int x, int y) {
    }

    record Velocity(int x, int y) {
    }

    static final class MutablePosition {
        int x;
        int y;

        MutablePosition(int x, int y) {
            this.x = x;
            this.y = y;
        }
    }

    record ActiveTag() {
    }

    record SleepingTag() {
    }
}
