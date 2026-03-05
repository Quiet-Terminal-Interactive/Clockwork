package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.events.ResourceStore;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResourceStoreTest {
    @Test
    void insertAndGetByClass() {
        ResourceStore store = new ResourceStore();
        store.insert(String.class, "hello");
        assertEquals(Optional.of("hello"), store.get(String.class));
    }

    @Test
    void insertAndGetByStringKey() {
        ResourceStore store = new ResourceStore();
        store.insert("my-resource", 42);
        assertEquals(Optional.of(42), store.get("my-resource").map(o -> (int) (Integer) o));
    }

    @Test
    void getMissingClassKeyReturnsEmpty() {
        ResourceStore store = new ResourceStore();
        assertEquals(Optional.empty(), store.get(Integer.class));
    }

    @Test
    void getMissingStringKeyReturnsEmpty() {
        ResourceStore store = new ResourceStore();
        assertEquals(Optional.empty(), store.get("nonexistent"));
    }

    @Test
    void insertNullValueByClassThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.insert(String.class, null));
    }

    @Test
    void insertNullValueByStringThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.insert("key", null));
    }

    @Test
    void insertNullClassKeyThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.insert((Class<Object>) null, "value"));
    }

    @Test
    void insertNullStringKeyThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.insert((String) null, "value"));
    }

    @Test
    void insertOverwritesPreviousValue() {
        ResourceStore store = new ResourceStore();
        store.insert(String.class, "first");
        store.insert(String.class, "second");
        assertEquals(Optional.of("second"), store.get(String.class));
    }

    @Test
    void classKeyAndStringKeyAreIndependent() {
        ResourceStore store = new ResourceStore();
        store.insert(String.class, "class-value");
        store.insert("String", "string-value");
        assertEquals(Optional.of("class-value"), store.get(String.class));
        assertEquals(Optional.of("string-value"), store.get("String").map(Object::toString));
    }

    @Test
    void getNullClassKeyThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.get((Class<?>) null));
    }

    @Test
    void getNullStringKeyThrows() {
        ResourceStore store = new ResourceStore();
        assertThrows(NullPointerException.class, () -> store.get((String) null));
    }
}
