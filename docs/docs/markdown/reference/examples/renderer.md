# Runnable Examples: Renderer

## Compile Shader

```js
import { ShaderCompiler } from 'qti-clockwork-shaders'

const compiler = new ShaderCompiler(gl)
const shader = compiler.compile(
  '#version 300 es\nvoid main(){gl_Position=vec4(0.0);}',
  '#version 300 es\nprecision mediump float; out vec4 o; void main(){o=vec4(1.0);}'
)
shader.use()
```

## Sprite Batch Stats

```js
import { SpriteBatch } from 'qti-clockwork-passes'

const batch = new SpriteBatch(1024)
batch.begin(camera)
batch.draw(transform, sprite)
const stats = batch.end()
console.log(stats.drawCalls, stats.spriteCount)
```

## Render Graph

```js
import { RenderGraph } from 'qti-clockwork-passes'

const graph = new RenderGraph()
graph.addPass({ name: 'scene', inputs: [], outputs: ['sceneColor'], execute() {} })
graph.addPass({ name: 'post', inputs: ['sceneColor'], outputs: ['final'], execute() {} })
graph.compile()
graph.execute()
```
