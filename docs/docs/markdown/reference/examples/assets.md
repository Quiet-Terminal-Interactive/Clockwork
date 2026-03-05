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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.renderer.assets.AssetPack;
import com.quietterminal.clockwork.renderer.assets.AssetPackLoader;
import java.nio.file.Path;

AssetPack pack = AssetPackLoader.load(Path.of("assets/demo.pack.zip"));
byte[] configJson = pack.rawFiles().get("config.json");
if (configJson != null) {
    System.out.println(new String(configJson));
}
```

## Reload and Handle Invalidation

```js
await cache.reload('config.json')
console.log(handle.get()) // undefined (stale version)
const latest = cache.load('config.json')
await cache.waitFor(latest)
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.renderer.assets.AssetPack;
import com.quietterminal.clockwork.renderer.assets.AssetPackLoader;
import java.nio.file.Path;

Path path = Path.of("assets/demo.pack.zip");
AssetPack first = AssetPackLoader.load(path);
AssetPack latest = AssetPackLoader.load(path); // reload after file changes

System.out.println(first == latest); // false (new snapshot)
```
