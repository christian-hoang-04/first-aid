import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Award, BookOpenCheck, ChevronLeft, ChevronRight, HeartPulse,
  LocateFixed, MapPin, Mic, Navigation, Phone, Play, RotateCcw, ShieldCheck,
  Sparkles, Users, Volume2, VolumeX, X
} from 'lucide-react'
import { classifyEmergency, quiz, scenarios } from './data'
import FacilityFinder from './components/FacilityFinder'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

function speak(text) {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'vi-VN'
  utterance.rate = 0.94
  window.speechSynthesis.speak(utterance)
  return true
}

function Logo() {
  return <div className="brand-mark" aria-hidden="true"><HeartPulse size={23} strokeWidth={2.4} /></div>
}

function EmergencyGuide({ scenario, onClose, onOpenCpr }) {
  const [step, setStep] = useState(0)
  const [reading, setReading] = useState(false)
  const current = scenario.steps[step]

  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  const read = () => {
    if (reading) { window.speechSynthesis?.cancel(); setReading(false); return }
    if (speak(`Bước ${step + 1}. ${current}`)) {
      setReading(true)
      setTimeout(() => setReading(false), Math.max(3000, current.length * 65))
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Hướng dẫn ${scenario.title}`}>
      <div className="guide-modal">
        <button className="icon-button close" onClick={onClose} aria-label="Đóng hướng dẫn"><X /></button>
        <div className="guide-head">
          <div className={`scenario-icon ${scenario.tone}`}><HeartPulse /></div>
          <div><span className="eyebrow">HƯỚNG DẪN KHẨN CẤP</span><h2>{scenario.title}</h2></div>
        </div>
        <div className="warning"><AlertTriangle size={20} /><span>{scenario.warning}</span></div>
        <div className="step-progress" aria-label={`Bước ${step + 1} trên ${scenario.steps.length}`}>
          {scenario.steps.map((_, i) => <span key={i} className={i <= step ? 'active' : ''} />)}
        </div>
        <div className="step-card">
          <span className="step-number">BƯỚC {step + 1}/{scenario.steps.length}</span>
          <p>{current}</p>
          <button className="listen-button" onClick={read}>{reading ? <VolumeX /> : <Volume2 />}{reading ? 'Dừng đọc' : 'Đọc hướng dẫn'}</button>
        </div>
        <div className="guide-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft /> Quay lại</button>
          {scenario.id === 'cardiac' && <button className="secondary-button pulse-button" onClick={onOpenCpr}><Play /> Mở nhịp CPR</button>}
          {step < scenario.steps.length - 1
            ? <button className="primary-button" onClick={() => setStep(step + 1)}>Bước tiếp theo <ChevronRight /></button>
            : <a className="primary-button" href="tel:115"><Phone /> Gọi 115</a>}
        </div>
      </div>
    </div>
  )
}

function CprMeter({ onClose }) {
  const [active, setActive] = useState(false)
  const [count, setCount] = useState(0)
  const timer = useRef(null)
  const audio = useRef(null)

  const beep = () => {
    audio.current ||= new AudioContext()
    const oscillator = audio.current.createOscillator()
    const gain = audio.current.createGain()
    oscillator.frequency.value = 520
    gain.gain.value = 0.06
    oscillator.connect(gain); gain.connect(audio.current.destination)
    oscillator.start(); oscillator.stop(audio.current.currentTime + 0.08)
  }
  useEffect(() => {
    clearInterval(timer.current)
    if (active) timer.current = setInterval(() => { setCount((value) => value + 1); beep() }, 60000 / 110)
    return () => clearInterval(timer.current)
  }, [active])

  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="cpr-modal">
    <button className="icon-button close" onClick={onClose} aria-label="Đóng"><X /></button>
    <span className="eyebrow">CPR METRONOME</span><h2>Giữ nhịp ép tim</h2>
    <button className={`cpr-circle ${active ? 'beating' : ''}`} onClick={() => setActive(!active)}>
      <HeartPulse size={42}/><strong>110</strong><span>lần / phút</span>
    </button>
    <p className="cpr-count">Đã đếm: <strong>{count}</strong> lần ép</p>
    <p className="fine-print">Đặt tay giữa ngực, giữ tay thẳng. Chỉ thực hiện khi nạn nhân không phản ứng và không thở bình thường.</p>
    <button className="primary-button wide" onClick={() => { setActive(false); setCount(0) }}>{active ? 'Tạm dừng & đặt lại' : 'Bắt đầu nhịp'}</button>
  </div></div>
}

function QuizPanel() {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const answer = (choice) => {
    if (selected !== null) return
    setSelected(choice)
    if (choice === quiz[index].answer) setScore(score + 1)
  }
  const next = () => {
    if (index === quiz.length - 1) {
      setDone(true)
      localStorage.setItem('sos-now-quiz', JSON.stringify({ score: score + (selected === quiz[index].answer ? 0 : 0), completed: true }))
    } else { setIndex(index + 1); setSelected(null) }
  }
  const reset = () => { setIndex(0); setScore(0); setSelected(null); setDone(false) }
  if (done) return <div className="quiz-result"><Award size={48}/><span className="eyebrow">HOÀN THÀNH BÀI KIỂM TRA</span><h3>{score}/{quiz.length} câu đúng</h3><p>{score === quiz.length ? 'Xuất sắc! Bạn đã nắm chắc kiến thức nền.' : 'Ôn lại hướng dẫn để phản ứng tự tin hơn.'}</p><button className="secondary-button" onClick={reset}><RotateCcw/> Làm lại</button></div>
  return <div className="quiz-box">
    <div className="quiz-meta"><span>Câu {index + 1}/{quiz.length}</span><span>{Math.round(index / quiz.length * 100)}% hoàn thành</span></div>
    <h3>{quiz[index].question}</h3>
    <div className="quiz-options">{quiz[index].options.map((option, i) => <button key={option} onClick={() => answer(i)} className={selected === null ? '' : i === quiz[index].answer ? 'correct' : selected === i ? 'wrong' : 'muted'}>{String.fromCharCode(65 + i)}<span>{option}</span></button>)}</div>
    <button className="primary-button" disabled={selected === null} onClick={next}>{index === quiz.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'} <ChevronRight/></button>
  </div>
}

export default function App() {
  const [activeScenario, setActiveScenario] = useState(null)
  const [cprOpen, setCprOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [activeTab, setActiveTab] = useState('emergency')
  const [childMode, setChildMode] = useState(false)
  const [location, setLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [mapOpen, setMapOpen] = useState(false)
  const recognition = useRef(null)

  const greeting = useMemo(() => new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối', [])

  const startVoice = () => {
    if (!SpeechRecognition) { setTranscript('Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Hãy chọn tình huống bên dưới.'); return }
    recognition.current = new SpeechRecognition()
    recognition.current.lang = 'vi-VN'; recognition.current.interimResults = false
    recognition.current.onstart = () => setListening(true)
    recognition.current.onerror = () => { setListening(false); setTranscript('Chưa nghe rõ. Hãy thử lại hoặc chọn tình huống bên dưới.') }
    recognition.current.onend = () => setListening(false)
    recognition.current.onresult = async (event) => {
      const value = event.results[0][0].transcript
      setTranscript(value)
      let result
      const aiUrl = import.meta.env.VITE_AI_API_URL
      if (aiUrl) {
        try {
          const response = await fetch(`${aiUrl}/triage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: value }) })
          const payload = await response.json()
          result = { scenario: scenarios.find((item) => item.id === payload.scenario_id) || classifyEmergency(value).scenario }
        } catch { result = classifyEmergency(value) }
      } else result = classifyEmergency(value)
      setTimeout(() => setActiveScenario(result.scenario), 450)
    }
    recognition.current.start()
  }

  const findLocation = () => {
    setLocationStatus('loading')
    if (!navigator.geolocation) { setLocationStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocationStatus('ready') },
      () => setLocationStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const controller = new AbortController()
    const tools = [
      { name: 'start_emergency_guide', title: 'Mở hướng dẫn sơ cứu', description: 'Mở hướng dẫn sơ cứu khẩn cấp theo loại tình huống.', inputSchema: { type: 'object', properties: { scenarioId: { type: 'string', enum: scenarios.map((item) => item.id) } }, required: ['scenarioId'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ scenarioId }) => { const item = scenarios.find((scenario) => scenario.id === scenarioId); if (!item) throw new Error('Tình huống không hợp lệ'); setActiveScenario(item); return { opened: true, scenario: item.title } } },
      { name: 'start_cpr_metronome', title: 'Mở nhịp CPR', description: 'Mở công cụ đếm nhịp ép tim 110 lần mỗi phút.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: () => { setCprOpen(true); return { opened: true, bpm: 110 } } }
    ]
    tools.forEach((tool) => Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}))
    return () => controller.abort()
  }, [])

  return <div className={childMode ? 'app child-mode' : 'app'}>
    <header>
      <a className="brand" href="#top"><Logo/><div><strong>SOS NOW</strong><span>HEXA<span>CARE</span></span></div></a>
      <nav aria-label="Điều hướng chính">
        <button className={activeTab === 'emergency' ? 'active' : ''} onClick={() => setActiveTab('emergency')}>Khẩn cấp</button>
        <button className={activeTab === 'learn' ? 'active' : ''} onClick={() => setActiveTab('learn')}>Học & luyện tập</button>
        <button className={activeTab === 'community' ? 'active' : ''} onClick={() => setActiveTab('community')}>Cộng đồng</button>
      </nav>
      <button className="child-toggle" onClick={() => setChildMode(!childMode)}><ShieldCheck/> {childMode ? 'Chế độ thường' : 'Chế độ trẻ em'}</button>
    </header>

    <main id="top">
      {activeTab === 'emergency' && <>
        <section className="hero-grid">
          <div className="intro">
            <div className="status-line"><span></span> Sẵn sàng hỗ trợ 24/7</div>
            <p className="eyebrow">{greeting}</p>
            <h1>Bạn đang gặp<br/><em>tình huống gì?</em></h1>
            <p className="lede">Nói ngắn gọn điều bạn quan sát được. SOS NOW sẽ mở hướng dẫn sơ cứu phù hợp để bạn hành động từng bước.</p>
            <div className="trust-row"><span><ShieldCheck/> Quy trình 3A</span><span><HeartPulse/> Chuẩn ABCDE</span></div>
          </div>
          <div className="voice-panel">
            <div className="voice-top"><span>TRỢ LÝ GIỌNG NÓI</span><Sparkles size={18}/></div>
            <button className={`voice-orb ${listening ? 'listening' : ''}`} onClick={startVoice} aria-label="Bắt đầu nói tình huống"><span className="orb-ring"></span><Mic size={46}/></button>
            <h2>{listening ? 'Mình đang nghe…' : 'Chạm và nói tình huống'}</h2>
            <p>{transcript || 'Ví dụ: “Có người bị méo miệng và yếu một bên tay”'}</p>
            <div className="emergency-call"><span>Trường hợp nguy hiểm tính mạng</span><a href="tel:115"><Phone/> GỌI 115</a></div>
          </div>
        </section>

        <section className="quick-section">
          <div className="section-title"><div><span className="eyebrow">CHỌN NHANH</span><h2>Tình huống thường gặp</h2></div><p>Nếu không thể nói, hãy chọn dấu hiệu gần nhất.</p></div>
          <div className="scenario-grid">{scenarios.map((item) => <button key={item.id} className="scenario-card" onClick={() => setActiveScenario(item)}><span className={`scenario-icon ${item.tone}`}><HeartPulse/></span><span><strong>{item.title}</strong><small>{item.short}</small></span><ChevronRight/></button>)}</div>
        </section>

        <section className="action-grid">
          <article className="location-card">
            <div className="card-heading"><span className="map-icon"><MapPin/></span><div><span className="eyebrow">VỊ TRÍ KHẨN CẤP</span><h2>Tìm cơ sở y tế gần bạn</h2></div></div>
            <p>Cho phép truy cập vị trí để xem bệnh viện gần nhất ngay trong trang.</p>
            {locationStatus === 'ready' && <div className="location-result"><LocateFixed/><span><strong>Đã xác định vị trí</strong><small>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</small></span></div>}
            {locationStatus === 'error' && <div className="location-error">Không thể lấy vị trí. Bạn vẫn có thể tìm thủ công trên bản đồ.</div>}
            <div className="location-actions"><button className="secondary-button" onClick={findLocation}><LocateFixed/>{locationStatus === 'loading' ? 'Đang xác định…' : 'Dùng vị trí của tôi'}</button><button type="button" className="primary-button" aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}><Navigation/> {mapOpen ? 'Đóng bản đồ' : 'Mở bản đồ'}</button></div>
            {mapOpen && <FacilityFinder embedded location={location} locationStatus={locationStatus} onLocation={findLocation}/>}
          </article>
          <article className="sos-card">
            <Users/><div><span className="eyebrow">MẠNG LƯỚI CỘNG ĐỒNG</span><h2>Phát tín hiệu SOS</h2><p>Thông báo vị trí và loại tình huống cho người đã học sơ cứu ở gần.</p></div><button onClick={() => setActiveTab('community')}>Tạo tín hiệu</button>
          </article>
          <article className="cpr-card"><div><span className="eyebrow">CÔNG CỤ THAO TÁC</span><h2>CPR Metronome</h2><p>Giữ đúng nhịp 110 lần/phút.</p></div><button onClick={() => setCprOpen(true)}><Play fill="currentColor"/> Bắt đầu</button></article>
        </section>
      </>}

      {activeTab === 'learn' && <section className="page-section">
        <div className="page-hero"><div><span className="eyebrow">HỌC ĐỂ KHÔNG HOẢNG LOẠN</span><h1>Luyện phản xạ.<br/><em>Cứu người tự tin hơn.</em></h1><p>Ba phút ôn tập hôm nay có thể giúp bạn hành động đúng trong thời khắc quan trọng.</p></div><div className="progress-orbit"><strong>3</strong><span>bài nền tảng</span></div></div>
        <div className="learn-grid"><article className="course-list"><h2>Lộ trình cơ bản</h2>{['Nhận diện hiện trường an toàn', 'Quy trình CPR cho người lớn', 'FAST — Nhận biết đột quỵ'].map((title, i) => <div className="course-row" key={title}><span>{i + 1}</span><div><strong>{title}</strong><small>{i === 0 ? 'Đã hoàn thành' : `${5 + i * 2} phút`}</small></div>{i === 0 ? <BookOpenCheck/> : <ChevronRight/>}</div>)}</article><article className="quiz-panel"><span className="eyebrow">KIỂM TRA NHANH</span><QuizPanel/></article></div>
        <p className="medical-note"><ShieldCheck/> Nội dung minh họa cho MVP, không thay thế đào tạo trực tiếp hoặc tư vấn của nhân viên y tế.</p>
      </section>}

      {activeTab === 'community' && <section className="page-section community-page">
        <div className="page-hero"><div><span className="eyebrow">SOS BUMP · BẢN DEMO</span><h1>Kết nối người biết sơ cứu<br/><em>ở gần bạn.</em></h1><p>Bản thử nghiệm mô phỏng luồng tạo tín hiệu. Khi vận hành thật, tính năng cần xác thực người dùng, định vị và kiểm duyệt an toàn.</p></div><div className="community-radar"><Users/><span></span><span></span></div></div>
        <div className="community-grid"><article><span className="eyebrow">TẠO TÍN HIỆU</span><h2>Chọn tình huống cần hỗ trợ</h2><div className="signal-options">{scenarios.map((item) => <button key={item.id} onClick={() => { setActiveScenario(item) }}><span className={`dot ${item.tone}`}></span>{item.title}<ChevronRight/></button>)}</div><button className="sos-broadcast" onClick={() => alert('Bản demo đã ghi nhận tín hiệu. Trong sản phẩm thật, vị trí sẽ chỉ gửi cho người hỗ trợ đã xác minh.')}><AlertTriangle/> PHÁT TÍN HIỆU SOS</button></article><article className="responder-card"><ShieldCheck/><span className="eyebrow">NGƯỜI HỖ TRỢ ĐÃ XÁC MINH</span><h2>Mạng lưới an toàn, không phải đám đông.</h2><p>Người hoàn thành khóa học được cấp mã định danh. Tín hiệu ưu tiên người ở gần và có năng lực phù hợp.</p><div className="mock-stat"><strong>12</strong><span>người hỗ trợ mẫu<br/>trong bán kính 3 km</span></div></article></div>
      </section>}
    </main>

    <footer><div className="brand"><Logo/><strong>SOS NOW</strong></div><p>Technology with Heart · Sản phẩm MVP của HexaCare</p><p>Trong nguy hiểm tính mạng, hãy gọi <a href="tel:115">115</a>.</p></footer>
    {activeScenario && <EmergencyGuide scenario={activeScenario} onClose={() => setActiveScenario(null)} onOpenCpr={() => setCprOpen(true)}/>}
    {cprOpen && <CprMeter onClose={() => setCprOpen(false)}/>}
  </div>
}
