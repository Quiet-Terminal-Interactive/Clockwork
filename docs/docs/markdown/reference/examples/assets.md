# Runnable Examples: Assets

## JSON Asset Load

```js
import { AssetCache, JsonLoader } from 'qti-clockwork-assets'

const source = {
  async fetch(url) {
    const bytes = await this.readFile(url)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  },
  async readFile(path) {
    if (path === 'config.json') return new TextEncoder().encode('{"name":"demo"}')
    throw new Error('missing')
  }
}

const cache = new AssetCache(source)
cache.registerLoader(new JsonLoader())

const handle = cache.load('config.json')
const value = await cache.waitFor(handle)
console.log(value.name)
```

## Reload and Handle Invalidation

```js
await cache.reload('config.json')
console.log(handle.get()) // undefined (stale version)
const latest = cache.load('config.json')
await cache.waitFor(latest)
```
