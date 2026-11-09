import { Check } from 'lucide-react'
import lightningDouble from '../../assets/lightning-double.webp'
import useInView from '../../hooks/useInView'
import { CourseMock, SosMock, VoiceMock } from './FeatureMockups'
import { features } from '../../content/landing'

const mockups = { voice: VoiceMock, course: CourseMock, sos: SosMock }

function FeatureRow({ item, reverse }) {
  const [ref, inView] = useInView()
  const Mockup = mockups[item.visual]
  return (
    <article ref={ref} className={`feature reveal ${inView ? 'in-view' : ''} ${reverse ? 'feature-reverse' : ''}`}>
      <div className="feature-text">
        <span className="feature-tag">{item.tag}</span>
        <h3 className="feature-title">{item.title}</h3>
        <p className="feature-subtitle">{item.subtitle}</p>
        <ul className="feature-points">
          {item.points.map((point) => (
            <li key={point}><span className="feature-check"><Check aria-hidden="true" /></span>{point}</li>
          ))}
        </ul>
      </div>
      <div className="feature-visual" aria-hidden="true">
        <Mockup />
      </div>
    </article>
  )
}

export default function Features({ id }) {
  const { label, title, items } = features
  const [ref, inView] = useInView()
  return (
    <section id={id} className="section features" aria-labelledby={`${id}-title`}>
      <div className="container">
        <span className="pill">{label}</span>
        <h2 ref={ref} id={`${id}-title`} className={`features-title reveal ${inView ? 'in-view' : ''}`}>
          <span className="features-title-brand">{title[0]}</span> <span className="features-title-rest">{title[1]}</span>
          <img className="features-lightning" src={lightningDouble} alt="" width="110" height="115" />
        </h2>
        <div className="feature-list">
          {items.map((item, index) => <FeatureRow key={item.visual} item={item} reverse={index % 2 === 1} />)}
        </div>
      </div>
    </section>
  )
}
