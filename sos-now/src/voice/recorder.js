// Thu âm micro thành WAV PCM16 mono cho Fun-ASR (AI service chỉ nhận WAV, tối đa 60 giây)
export const MAX_RECORD_SECONDS = 60

// Đóng các khối mẫu Float32 [-1, 1] thành file WAV 16-bit mono
export function encodeWav(chunks, sampleRate) {
  const sampleCount = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const writeText = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }
  writeText(0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true)
  writeText(8, 'WAVE'); writeText(12, 'fmt '); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeText(36, 'data'); view.setUint32(40, sampleCount * 2, true)
  let offset = 44
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clipped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clipped < 0 ? clipped * 32768 : clipped * 32767, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// AudioWorklet chép từng khối mẫu ra luồng chính; nạp từ Blob để không cần file riêng trong public/
const WORKLET = `class PcmCapture extends AudioWorkletProcessor {
  process(inputs) { const channel = inputs[0] && inputs[0][0]; if (channel) this.port.postMessage(channel.slice(0)); return true }
}
registerProcessor('pcm-capture', PcmCapture)`

export function micSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.AudioContext === 'function'
}

/**
 * Bắt đầu ghi âm. Trả về { stop, cancel }:
 * - stop(): dừng và trả về Blob WAV (null nếu không thu được gì)
 * - cancel(): dừng và bỏ bản ghi
 * onLevel(0..1) báo âm lượng cho hiệu ứng, onTick(giây) báo thời gian, onLimit() khi chạm 60 giây.
 */
export async function startRecording({ maxSeconds = MAX_RECORD_SECONDS, onLevel, onTick, onLimit } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  })
  let context
  try { context = new AudioContext({ sampleRate: 16000 }) } catch { context = new AudioContext() }

  const chunks = []
  let sampleCount = 0
  let finished = false
  let frame = 0
  const limit = context.sampleRate * maxSeconds

  const push = (samples) => {
    if (finished) return
    const remaining = limit - sampleCount
    if (remaining <= 0) return
    const chunk = samples.length > remaining ? samples.subarray(0, remaining) : samples
    chunks.push(chunk)
    sampleCount += chunk.length
    onTick?.(sampleCount / context.sampleRate)
    if (sampleCount >= limit) onLimit?.()
  }

  try {
    await context.resume()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    let capture
    if (context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
      await context.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      capture = new AudioWorkletNode(context, 'pcm-capture')
      capture.port.onmessage = (event) => push(event.data)
    } else {
      // Trình duyệt cũ chưa có AudioWorklet
      capture = context.createScriptProcessor(4096, 1, 1)
      capture.onaudioprocess = (event) => push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    const silent = context.createGain()
    silent.gain.value = 0
    source.connect(capture); capture.connect(silent); silent.connect(context.destination)

    // Đo âm lượng (RMS) cho hiệu ứng quả cầu
    const samples = new Float32Array(analyser.fftSize)
    const measure = () => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const value of samples) sum += value * value
      onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 4))
      frame = requestAnimationFrame(measure)
    }
    if (onLevel) measure()
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    if (context.state !== 'closed') await context.close()
    throw error
  }

  const finish = async () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(frame)
    stream.getTracks().forEach((track) => track.stop())
    if (context.state !== 'closed') await context.close()
  }

  return {
    async stop() {
      await finish()
      return sampleCount ? encodeWav(chunks, context.sampleRate) : null
    },
    cancel: finish
  }
}
