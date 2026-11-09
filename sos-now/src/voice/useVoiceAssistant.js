import { useCallback, useEffect, useReducer, useRef } from 'react'
import { MAX_RECORD_SECONDS, micSupported, startRecording } from './recorder'
import { interpret, transcribe, VoiceError } from './api'
import { initialVoiceState, voiceReducer } from './voiceState'

const message = (error, fallback) => (error instanceof VoiceError ? error.message : fallback)

// Đọc to bằng giọng tiếng Việt có sẵn trên máy (không gửi đi đâu)
export function speak(text) {
  if (!text || !('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'vi-VN'
  utterance.rate = 0.95
  window.speechSynthesis.speak(utterance)
  return true
}

export default function useVoiceAssistant() {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState)
  const recorder = useRef(null)
  const alive = useRef(true)

  const send = useCallback(async (text) => {
    const value = text.trim()
    if (value.length < 2) return
    dispatch({ type: 'interpreting' })
    try {
      const result = await interpret(value)
      if (alive.current) dispatch({ type: 'interpreted', result })
    } catch (error) {
      if (alive.current) dispatch({ type: 'error', message: message(error, 'Chưa xử lý được tình huống. Hãy thử lại.') })
    }
  }, [])

  const stopMic = useCallback(async () => {
    const active = recorder.current
    if (!active) return
    recorder.current = null
    dispatch({ type: 'transcribing' })
    try {
      const wav = await active.stop()
      if (!wav) throw new VoiceError('Chưa thu được âm thanh. Hãy thử lại.')
      const text = await transcribe(wav)
      if (alive.current) dispatch({ type: 'transcribed', text })
    } catch (error) {
      if (alive.current) dispatch({ type: 'error', message: message(error, 'Chưa nhận diện được giọng nói. Hãy thử lại.') })
    }
  }, [])

  const startMic = useCallback(async () => {
    if (!micSupported()) {
      dispatch({ type: 'error', message: 'Trình duyệt này chưa hỗ trợ micro. Hãy gõ tình huống bên dưới.' })
      return
    }
    dispatch({ type: 'requestMic' })
    try {
      recorder.current = await startRecording({
        maxSeconds: MAX_RECORD_SECONDS,
        onLevel: (level) => dispatch({ type: 'level', level }),
        onTick: (seconds) => dispatch({ type: 'tick', seconds }),
        onLimit: () => { stopMic() }
      })
      dispatch({ type: 'recording' })
    } catch {
      recorder.current = null
      dispatch({ type: 'error', message: 'Không mở được micro. Hãy cho phép quyền micro trong trình duyệt rồi thử lại.' })
    }
  }, [stopMic])

  // Rời trang khi đang ghi thì tắt micro, dừng giọng đọc.
  // Đặt lại alive khi gắn vì StrictMode gắn/gỡ component hai lần lúc phát triển
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      recorder.current?.cancel()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  return {
    state,
    startMic,
    stopMic,
    send,
    setDraft: (value) => dispatch({ type: 'draft', value }),
    confirm: () => dispatch({ type: 'confirm' }),
    reject: () => dispatch({ type: 'reject' }),
    step: (delta) => dispatch({ type: 'step', delta }),
    reset: () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); dispatch({ type: 'reset' }) }
  }
}
