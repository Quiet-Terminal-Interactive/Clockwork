export interface AtlasAllocation {
  x: number
  y: number
  width: number
  height: number
  /** Normalised UV offset in the atlas. */
  u0: number
  v0: number
  /** Normalised UV width of this strip. */
  uWidth: number
}

/**
 * Shelf-based 2D bin packer for the shadow atlas.
 * Lights with shadowResolution×1 strips are packed left-to-right per shelf row,
 * advancing to a new shelf when the current row is full.
 */
export class ShelfPacker {
  private shelves: Array<{ y: number; nextX: number }> = []
  private nextShelfY = 0

  constructor(
    private readonly atlasWidth: number,
    private readonly atlasHeight: number
  ) {}

  allocate(width: number, height: number): AtlasAllocation | null {
    for (const shelf of this.shelves) {
      if (shelf.nextX + width <= this.atlasWidth && shelf.y + height <= this.atlasHeight) {
        const alloc = this.makeAlloc(shelf.nextX, shelf.y, width, height)
        shelf.nextX += width
        return alloc
      }
    }

    if (this.nextShelfY + height > this.atlasHeight) {
      return null // Atlas exhausted — more lights than atlas can hold.
    }

    const shelf = { y: this.nextShelfY, nextX: 0 }
    this.shelves.push(shelf)
    this.nextShelfY += height

    const alloc = this.makeAlloc(0, shelf.y, width, height)
    shelf.nextX += width
    return alloc
  }

  reset(): void {
    this.shelves = []
    this.nextShelfY = 0
  }

  private makeAlloc(x: number, y: number, width: number, height: number): AtlasAllocation {
    return {
      x,
      y,
      width,
      height,
      u0: x / this.atlasWidth,
      v0: y / this.atlasHeight,
      uWidth: width / this.atlasWidth,
    }
  }
}
