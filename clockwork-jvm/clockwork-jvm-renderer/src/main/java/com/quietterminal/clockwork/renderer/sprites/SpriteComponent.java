package com.quietterminal.clockwork.renderer.sprites;

import com.quietterminal.clockwork.math.Vec2;
import com.quietterminal.clockwork.renderer.assets.AssetRef;

/** Sprite component used by the render queue. */
public final class SpriteComponent {
    private final AssetRef texture;
    private final Vec2 size;
    private final Vec2 origin;
    private final int layer;
    private final float[] colour;
    private final boolean flipX;
    private final boolean flipY;

    public SpriteComponent(AssetRef texture, Vec2 size, Vec2 origin, int layer, float[] colour, boolean flipX, boolean flipY) {
        this.texture = texture;
        this.size = size;
        this.origin = origin;
        this.layer = layer;
        this.colour = colour == null ? new float[]{1f, 1f, 1f, 1f} : colour;
        this.flipX = flipX;
        this.flipY = flipY;
    }

    public AssetRef texture() {
        return texture;
    }

    public Vec2 size() {
        return size;
    }

    public Vec2 origin() {
        return origin;
    }

    public int layer() {
        return layer;
    }

    public float[] colour() {
        return colour;
    }

    public boolean flipX() {
        return flipX;
    }

    public boolean flipY() {
        return flipY;
    }
}
