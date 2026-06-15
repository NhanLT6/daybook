import { describe, it, expect } from 'vitest'

describe('useAiChat', () => {
  it('exports fileToBase64', async () => {
    const { fileToBase64 } = await import('../useAiChat')
    expect(typeof fileToBase64).toBe('function')
  })
})
