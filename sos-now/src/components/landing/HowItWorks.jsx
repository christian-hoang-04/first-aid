import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, PhoneCall, Siren } from 'lucide-react'
import lightning from '../../assets/lightning.webp'
import stepSos from '../../assets/step-sos.webp'
import stepLocation from '../../assets/step-location.webp'
import stepCall from '../../assets/step-call.webp'
import stepNavigation from '../../assets/step-navigation.webp'
import { howItWorks } from '../../content/landing'

const STEP_MS = 4000
const media = [
  { image: stepSos, Icon: Siren },
  { image: stepLocation, Icon: MapPin },
  { image: stepCall, Icon: PhoneCall },
  { image: stepNavigation, Icon: Navigation }
]

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function HowItWorks({ id }) {
  const { label, title, steps } = howItWorks
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [seen, setSeen] = useState(false)
  const [paused, setPaused] = useState(false)
  const sectionRef = useRef(null)
  const autoplay = visible && !paused && !prefersReducedMotion()

  // Chỉ tự chuyển bước khi phần này đang nằm trong màn hình
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setSeen(true)
    }, { threshold: 0.2 })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Hẹn giờ gắn với `active` nên bấm chọn bước sẽ đếm lại từ đầu
  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(() => setActive((current) => (current + 1) % steps.length), STEP_MS)
    return () => clearTimeout(timer)
  }, [active, autoplay, steps.length])

  return (
    <section id={id} ref={sectionRef} className={`section hiw ${seen ? 'is-seen' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="container">
        <div className={`reveal ${seen ? 'in-view' : ''}`}>
          <span className="pill">{label}</span>
          <h2 id={`${id}-title`} className="hiw-title">
            <span className="hiw-title-small">{title[0]}</span> <span className="hiw-title-big">{title[1]}</span>
            <img className="hiw-lightning" src={lightning} alt="" width="90" height="120" />
          </h2>
        </div>

        <ol className="steps" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          {steps.map((step, index) => {
            const { image, Icon } = media[index]
            const isActive = index === active
            return (
              <li key={step.title} className={`step ${isActive ? 'active' : ''}`} style={{ '--i': index }}>
                <button type="button" className="step-card" aria-current={isActive ? 'step' : undefined} onClick={() => setActive(index)}>
                  <span className="step-media"><img src={image} alt="" loading="lazy" /></span>
                  <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="step-body">
                    <span className="step-icon"><Icon aria-hidden="true" /></span>
                    <span className="step-title">{step.title}</span>
                    <span className="step-desc">{step.description}</span>
                  </span>
                  {isActive && <span key={active} className={`step-progress ${autoplay ? '' : 'is-paused'}`} style={{ '--duration': `${STEP_MS}ms` }} />}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
