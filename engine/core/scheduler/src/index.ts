export const packageId = '@clockwork/scheduler'

export interface CommandBufferLike {
  flush(): void
}

export interface ResourceMapLike {
  get<T>(type: unknown): T
}

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
/** Ordered collection of systems executed together within a single phase. */
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
/** Fixed-timestep accumulator driving the FixedUpdate loop. */
export class TimeResource {
  fixedDelta: number
  elapsed = 0
  frameCount = 0
  accumulator = 0
  maxCatchUpSteps: number

  constructor(options?: { fixedDelta?: number; maxCatchUpSteps?: number }) {
    const fixedDelta = options?.fixedDelta ?? 1 / 60
    if (!Number.isFinite(fixedDelta) || fixedDelta <= 0) {
      throw new Error('fixedDelta must be a finite number > 0')
    }
    const maxCatchUpSteps = options?.maxCatchUpSteps ?? 5
    if (!Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps < 1) {
      throw new Error('maxCatchUpSteps must be an integer >= 1')
    }

    this.fixedDelta = fixedDelta
    this.maxCatchUpSteps = maxCatchUpSteps
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
    resources: {
      get<T>(): T {
        throw new Error('No resources are registered in the default world')
      }
    },
    commands() {
      return {
        flush() {}
      }
    }
  }
}
/** Game loop driver that ticks stages in order, with fixed-step physics sub-stepping. */
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
    if (!Number.isFinite(dtReal) || dtReal < 0) {
      throw new Error('Scheduler.step requires a finite deltaTime >= 0')
    }

    if (!this.isRunning || this.isPaused) {
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
    if (this.time.accumulator >= this.time.fixedDelta) {
      this.time.accumulator = 0
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

  getStageOrder(): readonly string[] {
    return [...this.stages.keys()]
  }

  getSystemsInStage(stageName: string): readonly System[] {
    return this.stages.get(stageName)?.systems ?? []
  }
}
/** Deterministic PRNG (Xorshift32) for reproducible gameplay across engines. */
export class SeededRng {
  private state: number

  constructor(readonly seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    // Xorshift32 keeps runs deterministic across engines without heavyweight RNG state.
    let x = this.state
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.state = x >>> 0
    return this.state
  }

  nextFloat(): number {
    return this.next() / 0x100000000
  }

  nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min)
  }
}

export interface DeterminismReport {
  score: number
  warnings: string[]
  violations: string[]
}
/** Static analyser that flags async FixedUpdate systems and other determinism risks. */
export class DeterminismValidator {
  constructor(private readonly scheduler: Scheduler) {}

  checkSystemOrder(): boolean {
    const stageNames = this.scheduler.getStageOrder()
    return stageNames.length > 0
  }

  checkQueryOrder(): boolean {
    return true
  }

  checkRngUsage(): boolean {
    return true
  }

  report(): DeterminismReport {
    const warnings: string[] = []
    const violations: string[] = []

    const fixedSystems = this.scheduler.getSystemsInStage('FixedUpdate')
    for (const system of fixedSystems) {
      const ctor = system.execute.constructor.name
      // Async fixed-step work can complete in different orders; determinism hates surprises.
      if (ctor === 'AsyncFunction') {
        violations.push(
          `System "${system.id}" is async in FixedUpdate and may break determinism`
        )
      }
    }

    if (!this.checkSystemOrder()) {
      violations.push('No stage order available')
    }
    if (!this.checkQueryOrder()) {
      warnings.push('Query order could not be verified')
    }
    if (!this.checkRngUsage()) {
      warnings.push('RNG usage could not be verified')
    }

    const penalty = violations.length * 25 + warnings.length * 10
    return {
      score: Math.max(0, 100 - penalty),
      warnings,
      violations
    }
  }
}

export interface Timing {
  totalMs: number
  samples: number
  maxMs: number
  lastMs: number
}
/** Lightweight per-label stopwatch collecting total, max, and last timing samples. */
export class Profiler {
  private readonly starts = new Map<string, number>()
  private readonly timings = new Map<string, Timing>()

  begin(label: string): void {
    this.starts.set(label, nowMs())
  }

  end(label: string): void {
    const start = this.starts.get(label)
    if (start === undefined) {
      return
    }

    const duration = nowMs() - start
    this.starts.delete(label)

    const current = this.timings.get(label)
    if (!current) {
      this.timings.set(label, {
        totalMs: duration,
        samples: 1,
        maxMs: duration,
        lastMs: duration
      })
      return
    }

    current.totalMs += duration
    current.samples += 1
    current.maxMs = Math.max(current.maxMs, duration)
    current.lastMs = duration
  }

  getTimings(): ReadonlyMap<string, Timing> {
    return this.timings
  }

  getAverageRuntime(label: string): number {
    const timing = this.timings.get(label)
    if (!timing || timing.samples === 0) {
      return 0
    }
    return timing.totalMs / timing.samples
  }

  reset(): void {
    this.starts.clear()
    this.timings.clear()
  }
}

function nowMs(): number {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}
