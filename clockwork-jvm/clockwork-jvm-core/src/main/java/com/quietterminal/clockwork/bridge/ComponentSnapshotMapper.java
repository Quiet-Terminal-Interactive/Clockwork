package com.quietterminal.clockwork.bridge;

import org.graalvm.polyglot.Value;

import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.RecordComponent;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Maps JS component snapshots to Java component types with schema checks. */
final class ComponentSnapshotMapper {
    private final Map<Class<?>, Mapper> cache = new ConcurrentHashMap<>();

    Object map(Value source, Class<?> targetType) {
        if (source == null || source.isNull()) {
            return null;
        }
        if (source.isHostObject()) {
            Object host = source.asHostObject();
            if (!targetType.isInstance(host)) {
                throw schemaMismatch(targetType, host.getClass().getName());
            }
            return host;
        }
        return cache.computeIfAbsent(targetType, this::compile).map(source);
    }

    private Mapper compile(Class<?> targetType) {
        if (targetType.isRecord()) {
            return compileRecordMapper(targetType);
        }
        return source -> {
            try {
                Object mapped = source.as(targetType);
                if (!targetType.isInstance(mapped)) {
                    throw schemaMismatch(targetType, mapped == null ? "null" : mapped.getClass().getName());
                }
                return mapped;
            } catch (RuntimeException e) {
                throw new ClockworkBridgeException("Failed to map component snapshot to " + targetType.getName() + ".", e);
            }
        };
    }

    private Mapper compileRecordMapper(Class<?> targetType) {
        RecordComponent[] components = targetType.getRecordComponents();
        Class<?>[] signature = new Class<?>[components.length];
        String[] names = new String[components.length];
        for (int i = 0; i < components.length; i++) {
            signature[i] = components[i].getType();
            names[i] = components[i].getName();
        }

        MethodHandle constructor;
        try {
            constructor = MethodHandles.publicLookup()
                .findConstructor(targetType, java.lang.invoke.MethodType.methodType(void.class, signature));
        } catch (NoSuchMethodException | IllegalAccessException e) {
            throw new ClockworkBridgeException("Record component mapper is not accessible for " + targetType.getName() + ".", e);
        }

        return source -> {
            Object[] args = new Object[components.length];
            for (int i = 0; i < components.length; i++) {
                String name = names[i];
                if (!source.hasMember(name)) {
                    throw new ClockworkBridgeException(
                        "Component snapshot schema mismatch for " + targetType.getName() + ": missing field '" + name + "'."
                    );
                }
                args[i] = convertValue(source.getMember(name), signature[i]);
            }
            try {
                return constructor.invokeWithArguments(args);
            } catch (Throwable throwable) {
                throw new ClockworkBridgeException("Failed to instantiate " + targetType.getName() + " from snapshot.", throwable);
            }
        };
    }

    private Object convertValue(Value value, Class<?> targetType) {
        if (value == null || value.isNull()) {
            if (targetType.isPrimitive()) {
                throw new ClockworkBridgeException("Component snapshot schema mismatch: null for primitive " + targetType.getName() + ".");
            }
            return null;
        }
        if (value.isHostObject()) {
            Object host = value.asHostObject();
            if (!targetType.isInstance(host)) {
                throw schemaMismatch(targetType, host.getClass().getName());
            }
            return host;
        }
        if (targetType == String.class) {
            return value.asString();
        }
        if (targetType == int.class || targetType == Integer.class) {
            return value.asInt();
        }
        if (targetType == long.class || targetType == Long.class) {
            return value.asLong();
        }
        if (targetType == double.class || targetType == Double.class) {
            return value.asDouble();
        }
        if (targetType == float.class || targetType == Float.class) {
            return (float) value.asDouble();
        }
        if (targetType == boolean.class || targetType == Boolean.class) {
            return value.asBoolean();
        }
        if (targetType.isEnum()) {
            String enumName = value.asString();
            @SuppressWarnings({"rawtypes", "unchecked"})
            Object enumValue = Enum.valueOf((Class<? extends Enum>) targetType.asSubclass(Enum.class), enumName);
            return enumValue;
        }
        if (targetType.isRecord()) {
            return map(value, targetType);
        }
        try {
            Object mapped = value.as(targetType);
            if (!targetType.isInstance(mapped)) {
                throw schemaMismatch(targetType, mapped == null ? "null" : mapped.getClass().getName());
            }
            return mapped;
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to map component field to " + targetType.getName() + ".", e);
        }
    }

    private static ClockworkBridgeException schemaMismatch(Class<?> expectedType, String actualType) {
        return new ClockworkBridgeException(
            "Component snapshot schema mismatch: expected " + expectedType.getName() + ", got " + actualType + "."
        );
    }

    @FunctionalInterface
    private interface Mapper {
        Object map(Value source);
    }
}
