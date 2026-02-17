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
