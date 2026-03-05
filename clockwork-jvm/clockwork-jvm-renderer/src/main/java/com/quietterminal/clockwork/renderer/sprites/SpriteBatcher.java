package com.quietterminal.clockwork.renderer.sprites;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Batches sprites by atlas page and layer for deterministic instanced draws. */
public final class SpriteBatcher {
    public List<SpriteComponent> batch(List<SpriteComponent> sprites) {
        List<SpriteComponent> sorted = new ArrayList<>(sprites);
        sorted.sort(Comparator
            .comparingInt((SpriteComponent sprite) -> sprite.texture().atlasPage())
            .thenComparingInt(SpriteComponent::layer));
        return sorted;
    }

    public List<Batch> buildBatches(List<SpriteComponent> sprites) {
        List<SpriteComponent> sorted = batch(sprites);
        if (sorted.isEmpty()) {
            return List.of();
        }
        List<Batch> batches = new ArrayList<>();
        int start = 0;
        int currentAtlas = sorted.getFirst().texture().atlasPage();
        int currentLayer = sorted.getFirst().layer();

        for (int i = 1; i < sorted.size(); i++) {
            SpriteComponent sprite = sorted.get(i);
            if (sprite.texture().atlasPage() != currentAtlas || sprite.layer() != currentLayer) {
                batches.add(new Batch(currentAtlas, currentLayer, sorted.subList(start, i)));
                start = i;
                currentAtlas = sprite.texture().atlasPage();
                currentLayer = sprite.layer();
            }
        }

        batches.add(new Batch(currentAtlas, currentLayer, sorted.subList(start, sorted.size())));
        return batches;
    }

    public record Batch(int atlasPage, int layer, List<SpriteComponent> sprites) {
    }
}
