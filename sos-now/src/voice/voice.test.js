import { describe, expect, it } from 'vitest'
import { encodeWav } from './recorder'
import { initialVoiceState, isBusy, voiceReducer } from './voiceState'
import { interpret } from './api'

const run = (actions, state = initialVoiceState) => actions.reduce(voiceReducer, state)

describe('encodeWav', () => {
  it('writes a 16-bit mono WAV header and clipped samples', async () => {
    const blob = encodeWav([new Float32Array([0, 1, -1, 2])], 16000)
    const view = new DataView(await blob.arrayBuffer())
    const text = (offset) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4))
    expect(blob.type).toBe('audio/wav')
    expect([text(0), text(8), text(36)]).toEqual(['RIFF', 'WAVE', 'data'])
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(8)
    expect([1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 32767])
  })
})

describe('voiceReducer', () => {
  it('goes from recording to review with the transcript', () => {
    const state = run([{ type: 'requestMic' }, { type: 'recording' }, { type: 'transcribing' }, { type: 'transcribed', text: 'có người bị hóc' }])
    expect(state.phase).toBe('review')
    expect(state.draft).toBe('có người bị hóc')
  })

  it('maps each interpret status to its screen', () => {
    const phase = (status) => run([{ type: 'interpreted', result: { status } }]).phase
    expect(phase('MATCHED')).toBe('confirm')
    expect(phase('CONTENT_UNAVAILABLE')).toBe('unavailable')
    expect(phase('NEEDS_CLARIFICATION')).toBe('clarify')
  })

  it('keeps the step inside the guide', () => {
    const result = { status: 'MATCHED', guide: { steps: [{ number: 1 }, { number: 2 }] } }
    const start = run([{ type: 'interpreted', result }, { type: 'confirm' }])
    expect(run([{ type: 'step', delta: -1 }], start).step).toBe(0)
    expect(run([{ type: 'step', delta: 1 }, { type: 'step', delta: 1 }], start).step).toBe(1)
  })

  it('marks network phases as busy', () => {
    expect(['requesting', 'transcribing', 'interpreting'].every(isBusy)).toBe(true)
    expect(isBusy('recording')).toBe(false)
  })
})

describe('interpret (sample data)', () => {
  it('asks for clarification when nothing matches', async () => {
    expect((await interpret('xin chào')).status).toBe('NEEDS_CLARIFICATION')
  })
  it('matches choking keywords', async () => {
    const result = await interpret('Có người bị hóc dị vật')
    expect(result.status).toBe('MATCHED')
    expect(result.suggestedScenarioId).toBe('choking')
  })
})
