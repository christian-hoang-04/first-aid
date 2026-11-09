// Gọi API cho AI Voice:
// - transcribe(): gửi WAV tới AI service (Fun-ASR) `POST /transcribe`, nhận văn bản tiếng Việt
// - interpret(): gửi văn bản tới backend `POST /api/voice/interpret`, nhận tình huống và hướng dẫn
// Mặc định chạy chế độ dữ liệu mẫu; đặt VITE_VOICE_MOCK=false để gọi API thật.
const AI_URL = (import.meta.env.VITE_AI_API_URL || '').replace(/\/+$/, '')
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
export const VOICE_MOCK = import.meta.env.VITE_VOICE_MOCK !== 'false'

export const SCENARIO_TITLES = {
  cardiac: 'Ngừng tim, bất tỉnh',
  choking: 'Hóc dị vật',
  stroke: 'Dấu hiệu đột quỵ',
  bleeding: 'Chảy máu nhiều'
}
const STATUSES = ['MATCHED', 'CONTENT_UNAVAILABLE', 'NEEDS_CLARIFICATION']

export class VoiceError extends Error {}

async function request(url, options, timeoutMs) {
  let response
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs), credentials: 'omit', cache: 'no-store' })
  } catch {
    throw new VoiceError('Chưa kết nối được dịch vụ. Hãy kiểm tra mạng hoặc gõ tình huống bên dưới.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new VoiceError(response.status === 429 ? 'Bạn đã thử nhiều lần. Vui lòng chờ một chút rồi thử lại.'
      : response.status === 413 ? 'Đoạn ghi âm quá dài. Hãy nói ngắn gọn trong 60 giây.'
        : 'Chưa xử lý được yêu cầu. Hãy thử lại hoặc gõ tình huống bên dưới.')
  }
  return payload
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function transcribe(wav) {
  if (VOICE_MOCK) {
    await wait(1200)
    return 'Có người bị hóc dị vật, không ho được'
  }
  const form = new FormData()
  form.append('file', wav, 'voice.wav')
  // Mô hình chạy trên CPU và lần đầu phải tải mô hình nên cho thời gian chờ dài
  const payload = await request(`${AI_URL}/transcribe`, { method: 'POST', body: form }, 120000)
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) throw new VoiceError('Chưa nghe rõ lời nói. Hãy thử nói lại, chậm và rõ hơn.')
  return text
}

// Dữ liệu mẫu: chỉ đoán tình huống theo từ khóa, các bước là chỗ trống chờ hướng dẫn đã được duyệt
const MOCK_KEYWORDS = {
  cardiac: ['bất tỉnh', 'ngừng thở', 'không thở', 'ngừng tim', 'ngã quỵ'],
  choking: ['hóc', 'nghẹn', 'dị vật'],
  stroke: ['đột quỵ', 'méo miệng', 'yếu tay', 'nói khó', 'tai biến'],
  bleeding: ['chảy máu', 'mất máu', 'vết thương', 'đứt tay']
}

function mockInterpret(transcript) {
  const text = transcript.toLowerCase()
  const scenarioId = Object.keys(MOCK_KEYWORDS).find((id) => MOCK_KEYWORDS[id].some((word) => text.includes(word))) || null
  if (!scenarioId) {
    return { status: 'NEEDS_CLARIFICATION', suggestedScenarioId: null, requiresConfirmation: true, emergencyNumber: '115', guide: null }
  }
  const title = SCENARIO_TITLES[scenarioId]
  return {
    status: 'MATCHED',
    suggestedScenarioId: scenarioId,
    requiresConfirmation: true,
    emergencyNumber: '115',
    guide: {
      scenarioId,
      title,
      status: 'READY',
      steps: [1, 2, 3].map((number) => ({ number, title: `Bước ${number}`, text: 'Nội dung bước này sẽ lấy từ hướng dẫn đã được chuyên gia y tế duyệt.' }))
    }
  }
}

export async function interpret(transcript) {
  if (VOICE_MOCK) {
    await wait(700)
    return mockInterpret(transcript)
  }
  const payload = await request(`${API_URL}/api/voice/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ transcript, locale: 'vi', audience: 'ADULT' })
  }, 8000)
  if (!payload || !STATUSES.includes(payload.status)) throw new VoiceError('Phản hồi không hợp lệ. Hãy thử lại.')
  return payload
}
