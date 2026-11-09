import { ArrowRight, BookX, CircleHelp, PhoneOff, Timer } from 'lucide-react'
import useInView from '../../hooks/useInView'
import { problem } from '../../content/landing'

const icons = { help: CircleHelp, timer: Timer, phone: PhoneOff, book: BookX }

export default function Problem({ id }) {
  const { label, title, subtitle, items, solution, solutionLink } = problem
  const [ref, inView] = useInView()
  return (
    <section id={id} className="section problem" aria-labelledby={`${id}-title`}>
      <div className="container">
        <span className="pill">{label}</span>
        <h2 id={`${id}-title`} className="problem-title">{title[0]} <span>{title[1]}</span></h2>
        <p className="problem-subtitle">{subtitle}</p>

        <ul ref={ref} className={`problem-grid ${inView ? 'in-view' : ''}`}>
          {items.map((item, index) => {
            const Icon = icons[item.icon]
            return (
              <li key={item.title} className="problem-card" style={{ '--i': index }}>
                <span className="problem-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="problem-icon"><Icon aria-hidden="true" /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            )
          })}
        </ul>

        <div className={`problem-solution reveal ${inView ? 'in-view' : ''}`}>
          <p>{solution}</p>
          <a href={solutionLink.href}>{solutionLink.label} <ArrowRight aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  )
}
