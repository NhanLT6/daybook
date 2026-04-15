import { describe, it, expect } from 'vitest'

describe('parseLogsFromText', () => {
  it('extracts a JSON array from AI response text', async () => {
    const { parseLogsFromText } = await import('../useAiChat')
    const text = `Found 2 logs.\n\n\`\`\`json\n[{"project":"DS-1","task":"Dev","date":"2026-04-15","duration":120}]\n\`\`\``
    const result = parseLogsFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0].project).toBe('DS-1')
    expect(result[0].duration).toBe(120)
  })

  it('returns empty array when no JSON block present', async () => {
    const { parseLogsFromText } = await import('../useAiChat')
    expect(parseLogsFromText('Can you clarify which project?')).toEqual([])
  })

  it('strips the JSON block from the display text', async () => {
    const { stripJsonBlock } = await import('../useAiChat')
    const text = `Found 1 log.\n\n\`\`\`json\n[{}]\n\`\`\``
    expect(stripJsonBlock(text).trim()).toBe('Found 1 log.')
  })
})
