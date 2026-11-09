import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useInView from '../../hooks/useInView'
import { team } from '../../content/landing'
import myDung from '../../assets/team/my-dung.webp'
import ngocHuu from '../../assets/team/ngoc-huu.webp'
import quynhGiao from '../../assets/team/quynh-giao.webp'
import yenNhi from '../../assets/team/yen-nhi.webp'
import thuHuyen from '../../assets/team/thu-huyen.webp'
import hoangNam from '../../assets/team/hoang-nam.webp'

const photos = { 'my-dung': myDung, 'ngoc-huu': ngocHuu, 'quynh-giao': quynhGiao, 'yen-nhi': yenNhi, 'thu-huyen': thuHuyen, 'hoang-nam': hoangNam }
const AUTOPLAY_MS = 5000
// Vị trí ngang của thẻ theo khoảng cách tới thẻ giữa, tính bằng bội số chiều rộng thẻ
const SHIFT = [0, 1.07, 2]

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Khoảng cách vòng tròn từ thẻ `index` tới thẻ đang chọn, trong khoảng [-n/2, n/2]
function offsetOf(index, active, total) {
  let offset = (index - active + total) % total
  if (offset > total / 2) offset -= total
  return offset
}

export default function Team({ id }) {
  const { label, title, subtitle, members } = team
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ref, inView] = useInView()
  const swipeStart = useRef(null)
  const total = members.length
  const go = (step) => setActive((current) => (current + step + total) % total)

  // Tự chuyển thẻ, dừng khi rê chuột/focus vào hoặc khi người dùng giảm chuyển động
  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return
    const timer = setTimeout(() => go(1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [active, inView, paused])

  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') go(-1)
    if (event.key === 'ArrowRight') go(1)
  }
  const onPointerUp = (event) => {
    if (swipeStart.current === null) return
    const dx = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }

  return (
    <section id={id} className="section team" aria-labelledby={`${id}-title`}>
      <div className="container">
        <span className="pill">{label}</span>
        <div ref={ref} className={`team-head reveal ${inView ? 'in-view' : ''}`}>
          <div>
            <h2 id={`${id}-title`} className="team-title">{title[0]} <span>{title[1]}</span></h2>
            <p className="team-subtitle">{subtitle}</p>
          </div>
          <div className="team-arrows">
            <button type="button" onClick={() => go(-1)} aria-label="Thành viên trước"><ChevronLeft /></button>
            <button type="button" onClick={() => go(1)} aria-label="Thành viên tiếp theo"><ChevronRight /></button>
          </div>
        </div>
      </div>

      <div
        className="team-stage"
        role="region"
        aria-roledescription="carousel"
        aria-label="Thành viên đội ngũ"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={(event) => { swipeStart.current = event.clientX }}
        onPointerUp={onPointerUp}
      >
        {members.map((member, index) => {
          const offset = offsetOf(index, active, total)
          const distance = Math.abs(offset)
          const hidden = distance > 2
          return (
            <article
              key={member.id}
              className={`team-card ${offset === 0 ? 'is-active' : ''}`}
              style={{ '--shift': Math.sign(offset) * SHIFT[Math.min(distance, 2)], '--tilt': `${-Math.sign(offset) * 26}deg`, '--scale': 1 - distance * 0.12, '--fade': distance * 0.32, zIndex: 10 - distance, opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : undefined }}
              aria-hidden={offset !== 0}
              onClick={() => offset !== 0 && setActive(index)}
            >
              <img src={photos[member.id]} alt={`${member.name}, ${member.role}`} width="360" height="510" draggable="false" />
              <div className="team-card-panel">
                <span><strong>SOS NOW</strong><small>{member.area}</small></span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="team-dots" role="tablist" aria-label="Chọn thành viên">
        {members.map((member, index) => (
          <button key={member.id} type="button" role="tab" aria-selected={index === active} aria-label={member.name} className={index === active ? 'active' : ''} onClick={() => setActive(index)} />
        ))}
      </div>
    </section>
  )
}
