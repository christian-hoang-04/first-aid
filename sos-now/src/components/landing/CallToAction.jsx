import { Link } from 'react-router-dom'
import { appStart } from '../../content/app'
import useInView from '../../hooks/useInView'
import googlePlay from '../../assets/badge-google-play.webp'
import appStore from '../../assets/badge-app-store.webp'
import { callToAction } from '../../content/landing'

const badges = { 'google-play': googlePlay, 'app-store': appStore }

export default function CallToAction({ id }) {
  const { title, stores, phone } = callToAction
  const [ref, inView] = useInView()
  return (
    <section id={id} className="cta-band" aria-labelledby={`${id}-title`}>
      <div ref={ref} className={`container cta-inner reveal ${inView ? 'in-view' : ''}`}>
        <div className="cta-copy">
          <h2 id={`${id}-title`} className="cta-title">{title}</h2>
          {/* App chưa phát hành nên cả hai nút tạm dẫn về trang Nút SOS của bản web */}
          <div className="cta-stores">
            {stores.map((store) => (
              <Link key={store.id} to={appStart} aria-label={store.label}>
                <img src={badges[store.id]} alt="" width="192" height="64" />
              </Link>
            ))}
          </div>
        </div>

        {/* Điện thoại minh họa màn hình SOS, phần dưới bị cắt bởi đường kẻ cuối mục */}
        <div className="cta-phone" aria-hidden="true">
          <span className="cta-phone-island" />
          <p className="sos-question">{phone.question}</p>
          <p className="sos-hint">{phone.hint}</p>
          <div className="sos-stage">
            <span className="sos-ring" />
            <span className="sos-ring sos-ring-2" />
            <span className="sos-button">SOS</span>
          </div>
        </div>
      </div>
    </section>
  )
}
