export const packageId = 'qti-clockwork-input'

export interface Vec2 {
  x: number
  y: number
}

export interface Camera2D {
  screenToWorld(screen: Vec2): Vec2
}

export type InputBinding =
  | { type: 'key'; key: string }
  | { type: 'mouse'; button: number }
  | { type: 'gamepad'; gamepad: number; button: number }
  | { type: 'axis'; gamepad: number; axis: number; deadzone?: number }

interface GamepadState {
  buttonsDown: Set<number>
  buttonsPressed: Set<number>
  buttonsReleased: Set<number>
  axes: number[]
}

export interface InputSnapshot {
  keysDown: readonly string[]
  keysPressed: readonly string[]
  keysReleased: readonly string[]
  mouseButtonsDown: readonly number[]
  mouseButtonsPressed: readonly number[]
  mouseButtonsReleased: readonly number[]
  mousePosition: Vec2
  gamepads: ReadonlyMap<
    number,
    {
      buttonsDown: readonly number[]
      buttonsPressed: readonly number[]
      buttonsReleased: readonly number[]
      axes: readonly number[]
    }
  >
}
/** Frame-scoped input state tracker for keyboard, mouse, and gamepads. */
export class InputManager {
  private readonly keysDown = new Set<string>()
  private readonly keysPressed = new Set<string>()
  private readonly keysReleased = new Set<string>()

  private readonly mouseButtonsDown = new Set<number>()
  private readonly mouseButtonsPressed = new Set<number>()
  private readonly mouseButtonsReleased = new Set<number>()
  private mousePosition: Vec2 = { x: 0, y: 0 }

  private readonly gamepads = new Map<number, GamepadState>()

  beginFrame(): void {}

  endFrame(): void {
    this.keysPressed.clear()
    this.keysReleased.clear()
    this.mouseButtonsPressed.clear()
    this.mouseButtonsReleased.clear()

    for (const state of this.gamepads.values()) {
      state.buttonsPressed.clear()
      state.buttonsReleased.clear()
    }
  }

  setKeyState(key: string, down: boolean): void {
    if (down) {
      if (!this.keysDown.has(key)) {
        this.keysDown.add(key)
        this.keysPressed.add(key)
      }
      return
    }

    if (this.keysDown.delete(key)) {
      this.keysReleased.add(key)
    }
  }

  setMouseButtonState(button: number, down: boolean): void {
    if (down) {
      if (!this.mouseButtonsDown.has(button)) {
        this.mouseButtonsDown.add(button)
        this.mouseButtonsPressed.add(button)
      }
      return
    }

    if (this.mouseButtonsDown.delete(button)) {
      this.mouseButtonsReleased.add(button)
    }
  }

  setMousePosition(x: number, y: number): void {
    this.mousePosition = { x, y }
  }

  setGamepadButtonState(gamepad: number, button: number, down: boolean): void {
    const state = this.getOrCreateGamepad(gamepad)
    if (down) {
      if (!state.buttonsDown.has(button)) {
        state.buttonsDown.add(button)
        state.buttonsPressed.add(button)
      }
      return
    }

    if (state.buttonsDown.delete(button)) {
      state.buttonsReleased.add(button)
    }
  }

  setGamepadAxisState(gamepad: number, axis: number, value: number): void {
    const state = this.getOrCreateGamepad(gamepad)
    // Some drivers report NaN on reconnect, clamping to zero keeps movement sane.
    state.axes[axis] = Number.isFinite(value) ? value : 0
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key)
  }

  wasKeyPressed(key: string): boolean {
    return this.keysPressed.has(key)
  }

  wasKeyReleased(key: string): boolean {
    return this.keysReleased.has(key)
  }

  getMousePosition(): Vec2 {
    return { ...this.mousePosition }
  }

  getMousePositionWorld(camera: Camera2D): Vec2 {
    return camera.screenToWorld(this.mousePosition)
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtonsDown.has(button)
  }

  getGamepadAxis(gamepad: number, axis: number): number {
    const state = this.gamepads.get(gamepad)
    return state?.axes[axis] ?? 0
  }

  isGamepadButtonDown(gamepad: number, button: number): boolean {
    return this.gamepads.get(gamepad)?.buttonsDown.has(button) ?? false
  }

  snapshot(): InputSnapshot {
    const gamepads = new Map<
      number,
      {
        buttonsDown: readonly number[]
        buttonsPressed: readonly number[]
        buttonsReleased: readonly number[]
        axes: readonly number[]
      }
    >()

    for (const [index, state] of this.gamepads.entries()) {
      gamepads.set(index, {
        buttonsDown: [...state.buttonsDown],
        buttonsPressed: [...state.buttonsPressed],
        buttonsReleased: [...state.buttonsReleased],
        axes: [...state.axes]
      })
    }

    return {
      keysDown: [...this.keysDown],
      keysPressed: [...this.keysPressed],
      keysReleased: [...this.keysReleased],
      mouseButtonsDown: [...this.mouseButtonsDown],
      mouseButtonsPressed: [...this.mouseButtonsPressed],
      mouseButtonsReleased: [...this.mouseButtonsReleased],
      mousePosition: this.getMousePosition(),
      gamepads
    }
  }

  private getOrCreateGamepad(index: number): GamepadState {
    let state = this.gamepads.get(index)
    if (!state) {
      state = {
        buttonsDown: new Set<number>(),
        buttonsPressed: new Set<number>(),
        buttonsReleased: new Set<number>(),
        axes: []
      }
      this.gamepads.set(index, state)
    }
    return state
  }
}
/** Maps named game actions to one or more input bindings with deadzone support. */
export class ActionMap {
  private readonly bindings = new Map<string, InputBinding[]>()

  constructor(private readonly input: InputManager) {}

  bind(action: string, binding: InputBinding): void {
    let items = this.bindings.get(action)
    if (!items) {
      items = []
      this.bindings.set(action, items)
    }
    items.push(binding)
  }

  unbind(action: string): void {
    this.bindings.delete(action)
  }

  rebind(action: string, binding: InputBinding | InputBinding[]): void {
    this.unbind(action)
    if (Array.isArray(binding)) {
      for (const item of binding) {
        this.bind(action, item)
      }
      return
    }
    this.bind(action, binding)
  }

  isActionPressed(action: string): boolean {
    return this.getActionValue(action) > 0
  }

  getActionValue(action: string): number {
    const bindings = this.bindings.get(action)
    if (!bindings || bindings.length === 0) {
      return 0
    }

    let value = 0
    for (const binding of bindings) {
      value = Math.max(value, this.evaluate(binding))
    }
    return value
  }

  private evaluate(binding: InputBinding): number {
    switch (binding.type) {
      case 'key':
        return this.input.isKeyDown(binding.key) ? 1 : 0
      case 'mouse':
        return this.input.isMouseButtonDown(binding.button) ? 1 : 0
      case 'gamepad':
        return this.input.isGamepadButtonDown(binding.gamepad, binding.button)
          ? 1
          : 0
      case 'axis': {
        const axis = this.input.getGamepadAxis(binding.gamepad, binding.axis)
        const magnitude = Math.abs(axis)
        const deadzone = Math.min(0.99, Math.max(0, binding.deadzone ?? 0.15))
        if (magnitude <= deadzone) {
          return 0
        }
        return Math.min(1, (magnitude - deadzone) / (1 - deadzone))
      }
    }
  }
}

