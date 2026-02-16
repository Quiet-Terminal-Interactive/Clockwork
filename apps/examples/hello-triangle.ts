import { HeadlessRendererPlugin, AppBuilder } from 'qti-clockwork-app'

export function runHelloTriangleDemo(): Promise<void> {
  const app = new AppBuilder().use(HeadlessRendererPlugin).build()
  app.run()
  return app.step(1 / 60)
}

