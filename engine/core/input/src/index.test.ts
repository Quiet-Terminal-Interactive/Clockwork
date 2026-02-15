import { describe, expect, it } from 'vitest'
import { ActionMap, InputManager, packageId } from './index'

describe('input package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/input')
  })
})

describe('input manager', () => {
  it('tracks key transitions per frame', () => {
    const input = new InputManager()

    input.setKeyState('Space', true)
    expect(input.isKeyDown('Space')).toBe(true)
    expect(input.wasKeyPressed('Space')).toBe(true)

    input.endFrame()
    expect(input.wasKeyPressed('Space')).toBe(false)

    input.setKeyState('Space', false)
    expect(input.wasKeyReleased('Space')).toBe(true)
  })

  it('converts screen to world coordinates through camera transform', () => {
    const input = new InputManager()
    input.setMousePosition(12, 8)

    const world = input.getMousePositionWorld({
      screenToWorld(screen) {
        return { x: screen.x + 100, y: screen.y + 50 }
      }
    })

    expect(world).toEqual({ x: 112, y: 58 })
  })
})

describe('action map', () => {
  it('supports multiple bindings and runtime rebinds', () => {
    const input = new InputManager()
    const actions = new ActionMap(input)

    actions.bind('jump', { type: 'key', key: 'Space' })
    actions.bind('jump', { type: 'gamepad', gamepad: 0, button: 0 })

    input.setGamepadButtonState(0, 0, true)
    expect(actions.isActionPressed('jump')).toBe(true)

    input.setGamepadButtonState(0, 0, false)
    input.setKeyState('Space', true)
    expect(actions.getActionValue('jump')).toBe(1)

    actions.rebind('moveX', {
      type: 'axis',
      gamepad: 0,
      axis: 0,
      deadzone: 0.2
    })
    input.setGamepadAxisState(0, 0, 0.6)
    expect(actions.getActionValue('moveX')).toBeCloseTo(0.5)
  })
})
