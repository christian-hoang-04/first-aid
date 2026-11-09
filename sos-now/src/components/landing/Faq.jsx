import { useState } from 'react'
import { Plus } from 'lucide-react'
import useInView from '../../hooks/useInView'
import { faq } from '../../content/landing'

export default function Faq({ id }) {
  const { label, title, subtitle, items } = faq
  const [open, setOpen] = useState(0)
  const [ref, inView] = useInView()
  return (
    <section id={id} className="section faq" aria-labelledby={`${id}-title`}>
      <div ref={ref} className={`container faq-inner reveal ${inView ? 'in-view' : ''}`}>
        <div className="faq-intro">
          <span className="pill">{label}</span>
          <h2 id={`${id}-title`} className="faq-title">{title[0]} <span>{title[1]}</span></h2>
          <p className="faq-subtitle">{subtitle}</p>
        </div>

        <ul className="faq-list">
          {items.map((item, index) => {
            const isOpen = open === index
            return (
              <li key={item.q} className={`faq-item ${isOpen ? 'open' : ''}`}>
                <h3>
                  <button type="button" id={`faq-q-${index}`} aria-expanded={isOpen} aria-controls={`faq-a-${index}`} onClick={() => setOpen(isOpen ? -1 : index)}>
                    <span>{item.q}</span>
                    <span className="faq-toggle"><Plus aria-hidden="true" /></span>
                  </button>
                </h3>
                {/* Mở/đóng mượt bằng grid-template-rows 0fr -> 1fr */}
                <div id={`faq-a-${index}`} role="region" aria-labelledby={`faq-q-${index}`} className="faq-answer">
                  <div><p>{item.a}</p></div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
