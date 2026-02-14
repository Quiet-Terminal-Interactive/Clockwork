/** Frame scheduler and fixed timestep execution loop. */
export const packageId = '@clockwork/scheduler'

export interface CommandBufferLike {
  flush(): void
}

export type ResourceMapLike = Map<string | symbol, unknown>

export interface WorldLike {
  resources: ResourceMapLike
  commands(): CommandBufferLike
}

export interface EventBusLike {
  clear?(): void
}

export type ComponentType<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T)

export interface SystemContext {
  world: WorldLike
  deltaTime: number
  commands: CommandBufferLike
  events: EventBusLike
  resources: ResourceMapLike
}

export interface System {
  id: string
  stage: string
  order: number
  reads: ComponentType[]
  writes: ComponentType[]
  runIf?: (world: WorldLike) => boolean
  execute(ctx: SystemContext): void | Promise<void>
}

interface RegisteredSystem {
  insertionOrder: number
  system: System
}

interface StageExecutionContext {
  world: WorldLike
  deltaTime: number
  commands: CommandBufferLike
  events: EventBusLike
  resources: ResourceMapLike
}

/** Group of systems that executes in deterministic order. */
export class Stage {
  readonly systems: System[] = []

  private readonly entries: RegisteredSystem[] = []

  constructor(
    readonly name: string,
    readonly allowAsync = false
  ) {}

  addSystem(system: System, insertionOrder: number, order?: number): void {
    const normalized: System = {
      ...system,
      stage: this.name,
      order: order ?? system.order
    }

    this.entries.push({ system: normalized, insertionOrder })
    this.entries.sort((a, b) => {
      if (a.system.order === b.system.order) {
        return a.insertionOrder - b.insertionOrder
      }
      return a.system.order - b.system.order
    })
    this.systems.length = 0
    this.systems.push(...this.entries.map((entry) => entry.system))
  }

  removeSystem(systemId: string): boolean {
    const index = this.entries.findIndex(
      (entry) => entry.system.id === systemId
    )
    if (index === -1) {
      return false
    }

    this.entries.splice(index, 1)
    this.systems.length = 0
    this.systems.push(...this.entries.map((entry) => entry.system))
    return true
  }

  async execute(context: StageExecutionContext): Promise<void> {
    for (const system of this.systems) {
      if (system.runIf && !system.runIf(context.world)) {
        continue
      }

      const result = system.execute({
        world: context.world,
        deltaTime: context.deltaTime,
        commands: context.commands,
        events: context.events,
        resources: context.resources
      })

      if (result instanceof Promise) {
        if (!this.allowAsync) {
          throw new Error(`Stage "${this.name}" does not allow async systems`)
        }
        await result
      }
    }

    context.commands.flush()
  }
}

/** Mutable timing values for fixed and variable-step execution. */
export class TimeResource {
  fixedDelta: number
  elapsed = 0
  frameCount = 0
  accumulator = 0
  maxCatchUpSteps: number

  constructor(options?: { fixedDelta?: number; maxCatchUpSteps?: number }) {
    this.fixedDelta = options?.fixedDelta ?? 1 / 60
    this.maxCatchUpSteps = options?.maxCatchUpSteps ?? 5
  }
}

const BUILTIN_STAGES: Array<{ name: string; allowAsync: boolean }> = [
  { name: 'Boot', allowAsync: false },
  { name: 'PreUpdate', allowAsync: false },
  { name: 'FixedUpdate', allowAsync: false },
  { name: 'Update', allowAsync: false },
  { name: 'LateUpdate', allowAsync: false },
  { name: 'RenderPrep', allowAsync: true },
  { name: 'Render', allowAsync: true },
  { name: 'PostRender', allowAsync: true },
  { name: 'Shutdown', allowAsync: true }
]

function createDefaultWorld(): WorldLike {
  return {
    resources: new Map<string | symbol, unknown>(),
    commands() {
      return {
        flush() {}
      }
    }
  }
}

/** Fixed-timestep scheduler with stage-based system execution. */
export class Scheduler {
  readonly time: TimeResource

  private readonly stages = new Map<string, Stage>()
  private readonly world: WorldLike
  private readonly events: EventBusLike
  private insertionCounter = 0
  private isRunning = false
  private isPaused = false
  private bootExecuted = false

  constructor(options?: {
    world?: WorldLike
    events?: EventBusLike
    time?: { fixedDelta?: number; maxCatchUpSteps?: number }
  }) {
    this.world = options?.world ?? createDefaultWorld()
    this.events = options?.events ?? {}
    this.time = new TimeResource(options?.time)

    for (const stage of BUILTIN_STAGES) {
      this.addStage(new Stage(stage.name, stage.allowAsync))
    }
  }

  addStage(stage: Stage): void {
    this.stages.set(stage.name, stage)
  }

  addSystem(stageName: string, system: System, order?: number): void {
    const stage = this.stages.get(stageName)
    if (!stage) {
      throw new Error(`Unknown stage "${stageName}"`)
    }

    stage.addSystem(system, this.insertionCounter, order)
    this.insertionCounter += 1
  }

  removeSystem(systemId: string): void {
    for (const stage of this.stages.values()) {
      if (stage.removeSystem(systemId)) {
        return
      }
    }
  }

  run(): void {
    this.isRunning = true
    this.isPaused = false
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    if (!this.isRunning) {
      return
    }

    this.isPaused = false
  }

  async step(dtReal: number): Promise<void> {
    if (!this.isRunning || this.isPaused || dtReal < 0) {
      return
    }

    this.time.elapsed += dtReal

    if (!this.bootExecuted) {
      await this.runStage('Boot', dtReal)
      this.bootExecuted = true
    }

    await this.runStage('PreUpdate', dtReal)

    this.time.accumulator += dtReal
    let steps = 0
    while (
      this.time.accumulator >= this.time.fixedDelta &&
      steps < this.time.maxCatchUpSteps
    ) {
      await this.runStage('FixedUpdate', this.time.fixedDelta)
      this.time.accumulator -= this.time.fixedDelta
      steps += 1
    }

    await this.runStage('Update', dtReal)
    await this.runStage('LateUpdate', dtReal)
    await this.runStage('RenderPrep', dtReal)
    await this.runStage('Render', dtReal)
    await this.runStage('PostRender', dtReal)

    this.time.frameCount += 1
  }

  async shutdown(): Promise<void> {
    await this.runStage('Shutdown', 0)
    this.isRunning = false
    this.isPaused = false
  }

  private async runStage(stageName: string, deltaTime: number): Promise<void> {
    const stage = this.stages.get(stageName)
    if (!stage) {
      return
    }

    const commands = this.world.commands()
    await stage.execute({
      world: this.world,
      deltaTime,
      commands,
      events: this.events,
      resources: this.world.resources
    })
  }
}
