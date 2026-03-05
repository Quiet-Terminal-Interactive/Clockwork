/** Returns one pixel-index set per 4-connected component of non-empty pixels. */
export function floodFillComponents(
  pixels: Uint8Array,
  width: number,
  height: number
): number[][] {
  const visited = new Uint8Array(pixels.length)
  const components: number[][] = []

  // Iterative BFS — pixel buffers can be large enough to overflow the call stack.
  for (let start = 0; start < pixels.length; start++) {
    if (!pixels[start] || visited[start]) continue

    const component: number[] = []
    const queue: number[] = [start]
    visited[start] = 1

    while (queue.length > 0) {
      const idx = queue.pop()!
      component.push(idx)

      const x = idx % width
      const y = Math.floor(idx / width)

      const neighbours = [
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1
      ]

      for (const n of neighbours) {
        if (n >= 0 && pixels[n] && !visited[n]) {
          visited[n] = 1
          queue.push(n)
        }
      }
    }

    components.push(component)
  }

  return components
}
