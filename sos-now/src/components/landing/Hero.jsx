import { Link } from 'react-router-dom'
import { appStart } from '../../content/app'
import { ChevronRight } from 'lucide-react'
// Hình động SVG nhúng bằng <img> để CSS bên trong không ảnh hưởng tới trang
import heroAnimation from '../../assets/hero-animation.svg'
import { hero } from '../../content/landing'

export default function Hero() {
  const [line1, line2, line3] = hero.title
  return (
    <section id="hero" className="hero" aria-labelledby="hero-title">
      <div className="container hero-inner">
        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">
            <span className="hero-title-dark">{line1}</span>
            <span><span className="hero-title-yellow">{line2}</span> <span className="hero-title-red">{line3}</span></span>
          </h1>
          <p className="hero-description">{hero.description}</p>
          <div className="hero-actions">
            <Link className="button button-primary hero-cta" to={appStart}>{hero.cta}</Link>
            <a className="hero-next" href="#van-de" aria-label="Xem phần tiếp theo"><ChevronRight /></a>
          </div>
        </div>
        <img className="hero-image" src={heroAnimation} alt={hero.imageAlt} width="680" height="540" />
      </div>
    </section>
  )
}
