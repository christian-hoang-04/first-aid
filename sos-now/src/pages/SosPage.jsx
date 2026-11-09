import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import Navbar from '../components/landing/Navbar'
import { appNav, sosScreen } from '../content/app'

// Màn hình Nút SOS: nhấn nút chuyển sang màn Cơ sở y tế gần nhất và mở hộp Gọi 115 / Hủy (bản demo không gọi thật)
export default function SosPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const navigate = useNavigate()

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="sos-screen">
        <h1 className="sos-screen-question">{sosScreen.question}</h1>
        <p className="sos-screen-hint">{sosScreen.hint}</p>

        <div className="sos-screen-stage">
          <span className="sos-screen-ring" aria-hidden="true" />
          <span className="sos-screen-ring sos-screen-ring-2" aria-hidden="true" />
          <span className="sos-screen-ring sos-screen-ring-3" aria-hidden="true" />
          <button type="button" className="sos-screen-button" onClick={() => navigate('/app/co-so-y-te', { state: { sos: true } })} aria-label={sosScreen.buttonLabel}>{sosScreen.button}</button>
        </div>

        <p className="sos-screen-cta"><Phone aria-hidden="true" /> {sosScreen.buttonLabel}</p>
        <p className="sos-screen-note">{sosScreen.note}</p>
      </main>
    </div>
  )
}
