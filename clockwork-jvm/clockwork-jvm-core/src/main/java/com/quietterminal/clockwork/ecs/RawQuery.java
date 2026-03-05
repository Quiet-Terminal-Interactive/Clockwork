package com.quietterminal.clockwork.ecs;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Untyped query builder for dynamic component access. */
public final class RawQuery implements Iterable<RawQueryResult> {
    private final Query.QuerySource source;
    private final List<Class<?>> required;
    private final Set<Class<?>> optional = new LinkedHashSet<>();
    private final Set<Class<?>> without = new LinkedHashSet<>();

    public RawQuery(Query.QuerySource source, List<Class<?>> required) {
        this.source = Objects.requireNonNull(source, "source");
        this.required = List.copyOf(Objects.requireNonNull(required, "required"));
    }

    public RawQuery without(Class<?> excluded) {
        Class<?> excludedType = Objects.requireNonNull(excluded, "excluded");
        without.add(excludedType);
        optional.remove(excludedType);
        return this;
    }

    public RawQuery optional(Class<?> type) {
        Class<?> optionalType = Objects.requireNonNull(type, "type");
        if (!required.contains(optionalType) && !without.contains(optionalType)) {
            optional.add(optionalType);
        }
        return this;
    }

    @Override
    public Iterator<RawQueryResult> iterator() {
        List<Class<?>> optionalTypes = new ArrayList<>(optional);
        List<QuerySnapshot> rows = source.fetch(required, optionalTypes, List.copyOf(without));
        List<RawQueryResult> results = new ArrayList<>(rows.size());
        for (QuerySnapshot row : rows) {
            results.add(new RawQueryResult(row.entity(), row.components()));
        }
        return results.iterator();
    }
}
