import { describe, expect, it } from 'vitest'
import { packageId } from '@clockwork/ecs'

describe('tauri shell web bootstrap', () => {
  it('resolves workspace dependency', () => {
    expect(packageId).toBe('@clockwork/ecs')
  })
})
