import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RoomAudioRenderer, SessionProvider, useAgent, useSession, useSessionMessages, useTrackToggle, useTrackVolume } from '@livekit/components-react'
import { TokenSource, Track } from 'livekit-client'
import { ArrowUp, Bone, ChevronLeft, ChevronRight, Languages, Mic, MicOff, PersonStanding, Phone, PhoneOff, RotateCcw, Square, Volume2, Wind } from 'lucide-react'
import Navbar from '../components/landing/Navbar'
import { appNav, voiceScreen } from '../content/app'
import useVoiceAssistant, { speak } from '../voice/useVoiceAssistant'
import { isBusy } from '../voice/voiceState'
import { MAX_RECORD_SECONDS } from '../voice/recorder'
import { SCENARIO_TITLES, VOICE_MOCK } from '../voice/api'
import { guideForScenario, guideForText, guides3d } from '../content/guides3d'

const tokenSource = TokenSource.endpoint('/voice-runtime')
const GUIDE_RPC = 'first-aid.showStep'
const GUIDE_STEP_COUNTS = { 'ep-bung': 8, 'gay-xuong-dui': 9, 'xuc-thia': 7 }

const icons = { wind: Wind, bone: Bone, carry: PersonStanding }
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// Dòng chính và dòng phụ dưới quả cầu theo từng trạng thái
function heading(state, s) {
  switch (state.phase) {
    case 'requesting': return ['Đang mở micro…', 'Hãy cho phép trình duyệt dùng micro.']
    case 'recording': return ['Mình đang nghe…', `${clock(state.seconds)} / ${clock(MAX_RECORD_SECONDS)} · Nhấn nút dừng khi nói xong`]
    case 'transcribing': return ['Đang nhận diện giọng nói…', 'Thường mất vài giây.']
    case 'review': return ['Đây có phải điều bạn vừa nói?', 'Sửa lại bên dưới nếu chưa đúng, rồi nhấn gửi.']
    case 'interpreting': return ['Đang tìm hướng dẫn phù hợp…', '']
    case 'clarify': return ['Mình chưa rõ tình huống', 'Bạn mô tả thêm, hoặc chọn một tình huống bên dưới.']
    case 'error': return ['Có lỗi xảy ra', state.error]
    default: return [s.question, '']
  }
}

// Màn hình AI Voice, phẳng không đặt trong thẻ: quả cầu AI ở giữa, gợi ý quanh quả cầu, ô nhập ở dưới
export default function VoicePage() {
  const session = useSession(tokenSource, { agentConnectTimeoutMilliseconds: 30000 })

  return (
    <SessionProvider session={session}>
      <VoicePageContent session={session} />
    </SessionProvider>
  )
}

function VoicePageContent({ session }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const s = voiceScreen
  const voice = useVoiceAssistant()
  const { state } = voice
  const agent = useAgent(session)
  const liveMessages = useSessionMessages(session)
  const microphone = useTrackToggle({ source: Track.Source.Microphone, room: session.room })
  const userVolume = useTrackVolume(session.local.microphoneTrack)
  const { messages } = liveMessages
  const agentLine = messages.findLast((message) => message.type === 'agentTranscript')?.message
  const userLine = messages.findLast((message) => message.type === 'userTranscript')?.message
  const liveConnected = session.isConnected
  const connecting = session.connectionState === 'connecting'
  useEffect(() => {
    if (!liveConnected || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
  }, [liveConnected])
  const busy = connecting || (!liveConnected && isBusy(state.phase))
  const recording = liveConnected ? microphone.enabled : state.phase === 'recording'
  const [liveGuide, setLiveGuide] = useState(null)
  const [guideNarrating, setGuideNarrating] = useState(false)
  const [liveError, setLiveError] = useState('')
  const guideFrame = useRef(null)
  const result = state.result
  const title = result ? (result.guide?.title || SCENARIO_TITLES[result.suggestedScenarioId] || '') : ''
  const steps = result?.guide?.steps || []
  const current = steps[state.step]
  const showResult = !liveGuide && ['confirm', 'unavailable', 'guide'].includes(state.phase)
  const [defaultLine, defaultSub] = heading(state, s)
  const livePhase = agent.attributes?.['first-aid.phase']
  const line = connecting
    ? 'Đang kết nối trợ lý…'
    : liveConnected
      ? agent.state === 'speaking'
        ? agentLine || 'Trợ lý đang trả lời…'
        : agent.state === 'thinking'
          ? 'Đang xử lý tình huống…'
          : agent.state === 'failed'
            ? 'Trợ lý mất kết nối'
            : livePhase === 'confirming'
              ? 'Hãy xác nhận tình huống với trợ lý'
              : livePhase === 'guiding'
                ? 'Đang hướng dẫn sơ cứu'
                : 'Mình đang nghe…'
      : defaultLine
  const sub = liveConnected
    ? liveError || [userLine && `Bạn: ${userLine}`, agent.state !== 'speaking' && agentLine && `Trợ lý: ${agentLine}`].filter(Boolean).join(' · ') || 'Hãy kể bằng tiếng Việt; trợ lý sẽ trả lời bằng giọng nói.'
    : defaultSub

  const navigate = useNavigate()
  const guide = liveGuide ? guides3d.find((item) => item.id === liveGuide.guideId) : null
  const liveGuideOpen = Boolean(liveGuide && guide)

  useEffect(() => {
    const room = session.room
    room.registerRpcMethod(GUIDE_RPC, async ({ payload }) => {
      try {
        const value = JSON.parse(payload)
        const matched = guides3d.find((item) => item.id === value.guideId)
        const total = GUIDE_STEP_COUNTS[value.guideId]
        if (!matched || !Number.isInteger(value.stepIndex) || value.stepIndex < 0 || value.stepIndex >= total) {
          return JSON.stringify({ ok: false, error: 'Hướng dẫn hoặc bước không hợp lệ' })
        }
        setGuideNarrating(true)
        setLiveGuide({ guideId: value.guideId, stepIndex: value.stepIndex })
        return JSON.stringify({ ok: true })
      } catch {
        return JSON.stringify({ ok: false, error: 'Payload không phải JSON hợp lệ' })
      }
    })
    return () => room.unregisterRpcMethod(GUIDE_RPC)
  }, [session.room])

  useEffect(() => {
    if (!session.isConnected) return
    session.room.localParticipant.setAttributes({
      'first-aid.guide': liveGuide?.guideId ?? '',
      'first-aid.step': String(liveGuide?.stepIndex ?? 0),
    }).catch((error) => console.warn('Không cập nhật được bước hướng dẫn', error))
  }, [liveGuide, session.isConnected, session.room])

  useEffect(() => {
    if (!liveGuide) setGuideNarrating(false)
  }, [liveGuide])

  useEffect(() => {
    const onGuideMessage = (event) => {
      if (event.source !== guideFrame.current?.contentWindow) return
      if (event.data?.type === 'sosnow-live-guide-narration') {
        setGuideNarrating(event.data.active === true)
        return
      }
      if (event.data?.type !== 'sosnow-live-guide-step-change') return
      const stepIndex = Number(event.data.stepIndex)
      if (!Number.isInteger(stepIndex)) return
      setLiveGuide((current) => {
        if (!current) return current
        const total = GUIDE_STEP_COUNTS[current.guideId]
        return stepIndex >= 0 && stepIndex < total ? { ...current, stepIndex } : current
      })
    }
    window.addEventListener('message', onGuideMessage)
    return () => window.removeEventListener('message', onGuideMessage)
  }, [])

  const syncGuideFrame = () => {
    if (!liveGuide) return
    guideFrame.current?.contentWindow?.postMessage({
      type: 'sosnow-live-guide-step',
      stepIndex: liveGuide.stepIndex,
    }, '*')
  }

  useEffect(syncGuideFrame, [liveGuide])

  const startOrToggleMicrophone = async () => {
    setLiveError('')
    if (liveConnected) {
      try { await microphone.toggle() } catch { setLiveError('Không đổi được trạng thái micro. Hãy thử lại.') }
      return
    }
    if (connecting) return
    voice.reset()
    try {
      await session.start({ tracks: { microphone: { enabled: true } } })
    } catch {
      setLiveError('Không mở được micro hoặc trợ lý chưa kết nối. Hãy kiểm tra quyền micro và dịch vụ đang chạy.')
    }
  }

  const endLiveCall = async () => {
    setLiveError('')
    setLiveGuide(null)
    voice.reset()
    try { await session.end() } catch { setLiveError('Không kết thúc được cuộc gọi. Hãy thử lại.') }
  }

  // Gọi thẳng tên kỹ thuật có hướng dẫn 3D (ví dụ "ép bụng") thì mở ngay màn 3D, còn lại gửi đi nhận diện tình huống
  const ask = (text) => {
    if (liveConnected) {
      liveMessages.send(text).catch(() => setLiveError('Chưa gửi được lời nhắn cho trợ lý. Hãy thử nói trực tiếp vào micro.'))
      return
    }
    const guide = guideForText(text)
    if (guide) navigate(guide.path)
    else voice.send(text)
  }
  // Xác nhận tình huống có hướng dẫn 3D thì mở màn 3D thay cho các bước chữ
  const confirm = () => {
    const guide = guideForScenario(result?.suggestedScenarioId)
    if (guide) navigate(guide.path)
    else voice.confirm()
  }
  const submit = (event) => {
    event.preventDefault()
    ask(state.draft)
    if (liveConnected) voice.setDraft('')
  }

  return (
    <div className={`page${liveGuideOpen ? ' voice-page-live-guide' : ''}`}>
      <Navbar appLinks={appNav} />
      <main className={`container voice${liveGuideOpen ? ' voice-live-mode' : ''}`}>
        <h1 className="sr-only">{s.title}</h1>

        {liveGuide && guide ? (
          <section className="voice-live-guide" aria-label="Hướng dẫn sơ cứu bằng giọng nói">
            <header className="voice-live-guide-head">
              <button type="button" className="voice-live-back" aria-label="Quay lại trò chuyện" onClick={() => setLiveGuide(null)}>
                <ChevronLeft aria-hidden="true" /><span>AI Voice</span>
              </button>
              <div className="voice-live-guide-heading" aria-live="polite">
                <h2 className="voice-live-guide-title">{guide.title}</h2>
                <p className="voice-live-guide-status">{line}</p>
                {sub && <small className="voice-live-guide-transcript">{sub}</small>}
              </div>
              <div className="voice-live-guide-actions">
                <a className="voice-live-call" href="tel:115" aria-label="Gọi cấp cứu 115"><Phone aria-hidden="true" /><span>Gọi 115</span></a>
                <button type="button" className="voice-mic voice-live-mic" aria-label={microphone.enabled ? 'Tắt micro' : 'Bật micro'} aria-pressed={microphone.enabled} onClick={startOrToggleMicrophone}>
                  {microphone.enabled ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
                </button>
                <button type="button" className="voice-live-end" aria-label="Kết thúc trợ lý giọng nói" onClick={endLiveCall}><PhoneOff aria-hidden="true" /></button>
              </div>
            </header>
            <iframe
              ref={guideFrame}
              className="voice-live-guide-frame"
              src={guide.file}
              title={guide.title}
              sandbox="allow-scripts allow-same-origin"
              allow="autoplay; fullscreen"
              onLoad={syncGuideFrame}
            />
          </section>
        ) : !showResult ? (
          <>
            <div className="voice-hero">
              <div className={`voice-orb-wrap ${recording ? 'is-recording' : ''} ${busy ? 'is-busy' : ''}`} style={{ '--level': liveConnected ? userVolume : state.level }}>
                <span className="voice-orb-glow" aria-hidden="true" />
                <span className="voice-orb" aria-hidden="true" />
                <ul className="voice-chips" aria-label="Tình huống gợi ý">
                  {s.suggestions.map(({ icon, label }, index) => {
                    const Icon = icons[icon]
                    return <li key={label} style={{ '--i': index }}><button type="button" disabled={busy || recording} onClick={() => ask(label)}><Icon aria-hidden="true" /> {label}</button></li>
                  })}
                </ul>
              </div>
              <div aria-live="polite">
                <p className={`voice-question ${state.phase === 'error' ? 'is-error' : ''}`}>{line}</p>
                {sub && <p className="voice-sub">{sub}</p>}
              </div>
            </div>
          </>
        ) : (
          <section className="voice-result" aria-live="polite">
            {state.phase === 'confirm' && (
              <>
                <p className="voice-result-label">Có phải tình huống</p>
                <h2 className="voice-result-title">{title}?</h2>
                <div className="voice-result-actions">
                  <button type="button" className="button button-primary" onClick={confirm}>Đúng vậy, hướng dẫn tôi</button>
                  <button type="button" className="button button-outline" onClick={voice.reject}>Không phải</button>
                </div>
              </>
            )}
            {state.phase === 'unavailable' && (
              <>
                <p className="voice-result-label">Nhận diện được</p>
                <h2 className="voice-result-title">{title}</h2>
                <p className="voice-result-text">Hướng dẫn cho tình huống này đang chờ chuyên gia y tế duyệt. Hãy gọi ngay 115 để được hướng dẫn qua điện thoại.</p>
                <div className="voice-result-actions">
                  <a className="button button-primary" href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>
                  <button type="button" className="button button-outline" onClick={voice.reset}>Thử lại</button>
                </div>
              </>
            )}
            {state.phase === 'guide' && current && (
              <>
                <p className="voice-result-label">{title}</p>
                <div className="voice-steps-progress" aria-hidden="true">
                  {steps.map((step, index) => <span key={step.number} className={index <= state.step ? 'done' : ''} />)}
                </div>
                <p className="voice-step-count">Bước {state.step + 1}/{steps.length}</p>
                <h2 className="voice-result-title">{current.title}</h2>
                <p className="voice-result-text">{current.text}</p>
                <button type="button" className="voice-read" onClick={() => speak(`${current.title}. ${current.text}`)}><Volume2 aria-hidden="true" /> Đọc bước này</button>
                <div className="voice-result-actions">
                  <button type="button" className="button button-outline" onClick={() => voice.step(-1)} disabled={state.step === 0}><ChevronLeft aria-hidden="true" /> Bước trước</button>
                  {state.step < steps.length - 1
                    ? <button type="button" className="button button-primary" onClick={() => voice.step(1)}>Bước tiếp <ChevronRight aria-hidden="true" /></button>
                    : <a className="button button-primary" href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>}
                </div>
              </>
            )}
            <button type="button" className="voice-restart" onClick={voice.reset}><RotateCcw aria-hidden="true" /> Mô tả tình huống khác</button>
          </section>
        )}

        {!showResult && !liveGuide && (
          <form className={`voice-composer ${state.phase === 'review' ? 'is-review' : ''}`} onSubmit={submit}>
            <textarea
              rows="2"
              value={state.draft}
              onChange={(event) => voice.setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) submit(event) }}
              placeholder={s.inputPlaceholder}
              aria-label={s.inputPlaceholder}
              maxLength={500}
              disabled={busy || (recording && !liveConnected)}
            />
            <div className="voice-composer-bar">
              <span className="voice-composer-lang"><Languages aria-hidden="true" /> {liveConnected ? 'Trợ lý trực tiếp' : s.language}</span>
              <div className="voice-composer-actions">
                <button type="button" className={`voice-mic ${recording ? 'is-recording' : ''}`} aria-label={liveConnected ? (microphone.enabled ? 'Tắt micro' : 'Bật micro') : s.micLabel} aria-pressed={liveConnected ? microphone.enabled : recording} disabled={busy} onClick={startOrToggleMicrophone}>
                  {liveConnected ? (microphone.enabled ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />) : recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                </button>
                {liveConnected && <button type="button" className="voice-live-end" aria-label="Kết thúc trợ lý giọng nói" onClick={endLiveCall}><PhoneOff aria-hidden="true" /></button>}
                <button type="submit" className="voice-send" aria-label={s.sendLabel} disabled={busy || (recording && !liveConnected) || (liveConnected && liveMessages.isSending) || state.draft.trim().length < 2}><ArrowUp aria-hidden="true" /></button>
              </div>
            </div>
          </form>
        )}

        <a className="voice-emergency" href="tel:115"><Phone aria-hidden="true" /> {s.emergency}</a>
      </main>
      <RoomAudioRenderer muted={guideNarrating} />
    </div>
  )
}
