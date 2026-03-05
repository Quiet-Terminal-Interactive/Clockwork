package com.quietterminal.clockwork.ecs;

import java.util.ArrayDeque;
import java.util.ArrayList;

/** Thread-local pool for command queue lists to reduce per-tick allocation. */
public final class CommandPool {
    private static final int MAX_POOLED = 8;
    private static final int INITIAL_CAPACITY = 16;

    private static final ThreadLocal<CommandPool> INSTANCE =
        ThreadLocal.withInitial(CommandPool::new);

    private final ArrayDeque<ArrayList<Commands.CommandOperation>> pool =
        new ArrayDeque<>(MAX_POOLED);

    public static CommandPool forCurrentThread() {
        return INSTANCE.get();
    }

    public ArrayList<Commands.CommandOperation> acquire() {
        ArrayList<Commands.CommandOperation> list = pool.pollFirst();
        return list != null ? list : new ArrayList<>(INITIAL_CAPACITY);
    }

    public void release(ArrayList<Commands.CommandOperation> list) {
        if (pool.size() < MAX_POOLED) {
            list.clear();
            pool.addFirst(list);
        }
    }
}
