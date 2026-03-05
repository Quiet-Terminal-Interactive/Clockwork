# Runnable Examples: Tauri Bridge

## Memory File System

```js
import { MemoryFileSystem } from 'qti-clockwork-tauri-bridge'

const fs = new MemoryFileSystem({
  'mods/demo/mod.json': new TextEncoder().encode('{"id":"demo","version":"1.0.0"}')
})

const data = await fs.readFile('mods/demo/mod.json')
console.log(new TextDecoder().decode(data))
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.renderer.assets.AssetPack;
import com.quietterminal.clockwork.renderer.assets.AssetPackLoader;
import java.nio.file.Path;

AssetPack pack = AssetPackLoader.load(Path.of("assets/demo.pack.zip"));
byte[] manifest = pack.rawFiles().get("manifest.json");
System.out.println(manifest == null ? "missing" : manifest.length);
```

## Runtime Config Merge

```js
import { RuntimeConfigLoader, MemoryFileSystem } from 'qti-clockwork-tauri-bridge'

const fs = new MemoryFileSystem({
  'config/runtime.json': new TextEncoder().encode('{"modRoot":"mods-live"}')
})

const loader = new RuntimeConfigLoader(fs, {
  CLOCKWORK_LOG_LEVEL: 'debug'
})

const file = await loader.loadFromFile('config/runtime.json')
const env = loader.loadFromEnv()
const merged = loader.merge(env, file)
console.log(merged)
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.renderer.WindowConfig;

WindowConfig defaults = WindowConfig.builder().build();
WindowConfig merged = WindowConfig.builder()
    .title(defaults.title())
    .width(defaults.width())
    .height(defaults.height())
    .vsync(false)
    .build();

System.out.println(merged);
```
