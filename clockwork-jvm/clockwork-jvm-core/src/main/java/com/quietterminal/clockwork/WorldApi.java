package com.quietterminal.clockwork;

import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.RawQuery;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.events.ResourceStore;

/**
 * World facade exposed to systems and plugins.
 *
 * Query results are immutable snapshots. Mutations must go through {@link #commands()}.
 */
public interface WorldApi {
    <A> Query<A, Void, Void, Void> query(Class<A> a);

    <A, B> Query<A, B, Void, Void> query(Class<A> a, Class<B> b);

    <A, B, C> Query<A, B, C, Void> query(Class<A> a, Class<B> b, Class<C> c);

    <A, B, C, D> Query<A, B, C, D> query(Class<A> a, Class<B> b, Class<C> c, Class<D> d);

    RawQuery queryRaw(Class<?>... requiredComponents);

    Commands commands();

    EventBus events();

    ResourceStore resources();

    Object serialize();

    void restore(Object snapshot);
}
