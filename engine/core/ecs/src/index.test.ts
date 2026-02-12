import { describe, expect, it } from 'vitest'
import { packageId } from './index'

describe('ecs package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/ecs')
  })
})
