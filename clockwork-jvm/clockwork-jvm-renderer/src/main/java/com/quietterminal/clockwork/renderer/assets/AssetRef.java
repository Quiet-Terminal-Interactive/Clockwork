package com.quietterminal.clockwork.renderer.assets;

/** Handle to an atlas-packed asset with normalized UV coordinates. */
public record AssetRef(String id, int atlasPage, float u0, float v0, float u1, float v1) {
}
