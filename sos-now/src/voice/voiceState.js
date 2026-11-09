// Các trạng thái của màn AI Voice (hàm thuần để dễ test):
// idle → requesting (xin quyền micro) → recording → transcribing → review (sửa lời vừa nói)
// → interpreting → confirm (MATCHED) | clarify (NEEDS_CLARIFICATION) | unavailable (CONTENT_UNAVAILABLE)
// confirm → guide (đi từng bước). error có thể xảy ra ở mọi bước.
export const initialVoiceState = { phase: 'idle', draft: '', seconds: 0, level: 0, result: null, step: 0, error: '' }

export function voiceReducer(state, action) {
  switch (action.type) {
    case 'draft': return { ...state, draft: action.value }
    case 'requestMic': return { ...state, phase: 'requesting', error: '' }
    case 'recording': return { ...state, phase: 'recording', seconds: 0, level: 0 }
    case 'tick': return { ...state, seconds: action.seconds }
    case 'level': return { ...state, level: action.level }
    case 'transcribing': return { ...state, phase: 'transcribing', level: 0 }
    case 'transcribed': return { ...state, phase: 'review', draft: action.text }
    case 'interpreting': return { ...state, phase: 'interpreting', error: '' }
    case 'interpreted': {
      const { result } = action
      const phase = result.status === 'MATCHED' ? 'confirm' : result.status === 'CONTENT_UNAVAILABLE' ? 'unavailable' : 'clarify'
      return { ...state, phase, result, step: 0 }
    }
    case 'confirm': return { ...state, phase: 'guide', step: 0 }
    case 'reject': return { ...state, phase: 'clarify' }
    case 'step': {
      const total = state.result?.guide?.steps?.length || 0
      return { ...state, step: Math.max(0, Math.min(total - 1, state.step + action.delta)) }
    }
    case 'error': return { ...state, phase: 'error', error: action.message, level: 0 }
    case 'reset': return { ...initialVoiceState }
    default: return state
  }
}

export const isBusy = (phase) => ['requesting', 'transcribing', 'interpreting'].includes(phase)
