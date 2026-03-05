# Decision Guide: Rendering Flow

## When to Use `SpriteBatch`

Use for high-volume sprite rendering with shared texture/material state.

Benefits:

- reduced draw calls
- deterministic sort by z/texture/blend

## When to Use `PrimitiveBatch`

Use for debug overlays and low-cost procedural shapes.

Not ideal for fully materialized production geometry pipelines.

## When to Use `RenderGraph`

Use when rendering has multiple dependent passes.

Examples:

- scene -> bloom -> composite
- gbuffer -> lighting -> post

## Pass Design Rules

1. one producer per render target id
2. explicit pass inputs/outputs
3. compile after graph changes

## Camera Utilities

- `worldToScreen` for UI markers over world objects
- `screenToWorld` for picking/cursor world coordinates

Validate zoom to avoid runtime projection errors.
