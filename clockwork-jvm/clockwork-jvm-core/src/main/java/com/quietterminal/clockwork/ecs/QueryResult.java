package com.quietterminal.clockwork.ecs;

/** Query result tuple. */
public record QueryResult<A, B, C, D>(long entity, A a, B b, C c, D d) {
}
