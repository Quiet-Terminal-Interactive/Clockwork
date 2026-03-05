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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.WindowConfig;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkRendererPlugin(
        WindowConfig.builder().title("Clockwork").width(1280).height(720).vsync(true).build()
    ))
    .build();

app.step(1.0 / 60.0);
app.shutdown();
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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.RenderQueue;
import com.quietterminal.clockwork.renderer.WindowConfig;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkRendererPlugin(WindowConfig.builder().build()))
    .build();

app.step(1.0 / 60.0);
RenderQueue queue = (RenderQueue) app.world().resources().get(ClockworkRendererPlugin.RENDER_QUEUE_KEY).orElseThrow();
System.out.println(queue.snapshot().sprites().size());
app.shutdown();
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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.RenderQueue;
import com.quietterminal.clockwork.renderer.WindowConfig;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkRendererPlugin(WindowConfig.builder().build()))
    .build();
app.step(1.0 / 60.0);
RenderQueue queue = (RenderQueue) app.world().resources().get(ClockworkRendererPlugin.RENDER_QUEUE_KEY).orElseThrow();
RenderQueue.FrameSnapshot previous = queue.snapshot();
RenderQueue.FrameSnapshot current = queue.snapshot();
RenderQueue.FrameSnapshot interpolated = RenderQueue.interpolate(previous, current, 0.5f);
System.out.println(interpolated.tickNumber());
app.shutdown();
```
