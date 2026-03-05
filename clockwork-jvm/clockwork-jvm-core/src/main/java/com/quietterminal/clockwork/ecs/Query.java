package com.quietterminal.clockwork.ecs;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Fluent ECS query over component stores. */
public final class Query<A, B, C, D> implements Iterable<QueryResult<A, B, C, D>> {
    private final QuerySource source;
    private final Class<A> a;
    private final Class<B> b;
    private final Class<C> c;
    private final Class<D> d;
    private final Set<Class<?>> without = new LinkedHashSet<>();
    private final Set<Class<?>> optional = new LinkedHashSet<>();

    public Query(QuerySource source, Class<A> a, Class<B> b, Class<C> c, Class<D> d) {
        this.source = Objects.requireNonNull(source, "source");
        this.a = Objects.requireNonNull(a, "a");
        this.b = Objects.requireNonNull(b, "b");
        this.c = Objects.requireNonNull(c, "c");
        this.d = Objects.requireNonNull(d, "d");
    }

    public Query<A, B, C, D> without(Class<?> excluded) {
        Class<?> excludedType = Objects.requireNonNull(excluded, "excluded");
        without.add(excludedType);
        optional.remove(excludedType);
        return this;
    }

    public Query<A, B, C, D> optional(Class<?> component) {
        optional.add(Objects.requireNonNull(component, "component"));
        return this;
    }

    @Override
    public Iterator<QueryResult<A, B, C, D>> iterator() {
        List<Class<?>> required = requiredTypes();
        Set<Class<?>> requiredSet = Set.copyOf(required);
        Set<Class<?>> excludedSet = new LinkedHashSet<>(without);
        Set<Class<?>> optionalSet = new LinkedHashSet<>(optional);
        optionalSet.removeAll(requiredSet);
        optionalSet.removeAll(excludedSet);
        List<Class<?>> optionalTypes = List.copyOf(optionalSet);
        List<Class<?>> excluded = List.copyOf(excludedSet);
        List<QuerySnapshot> rows = source.fetch(required, optionalTypes, excluded);
        List<QueryResult<A, B, C, D>> results = new ArrayList<>();
        for (QuerySnapshot row : rows) {
            results.add(new QueryResult<>(
                row.entity(),
                value(row, a),
                value(row, b),
                value(row, c),
                value(row, d)
            ));
        }
        return results.iterator();
    }

    private List<Class<?>> requiredTypes() {
        List<Class<?>> required = new ArrayList<>(4);
        addIfRequired(required, a);
        addIfRequired(required, b);
        addIfRequired(required, c);
        addIfRequired(required, d);
        return required;
    }

    private static void addIfRequired(List<Class<?>> required, Class<?> key) {
        if (key != Void.class) {
            required.add(key);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T value(QuerySnapshot row, Class<T> key) {
        if (key == Void.class) {
            return null;
        }
        Object component = row.components().get(key);
        return (T) SnapshotGuard.enforceImmutable(component, key);
    }

    @FunctionalInterface
    public interface QuerySource {
        List<QuerySnapshot> fetch(List<Class<?>> required, List<Class<?>> optional, List<Class<?>> without);
    }
}
