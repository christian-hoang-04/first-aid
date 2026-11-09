import { Check } from 'lucide-react'
import useInView from '../../hooks/useInView'
import { pricing } from '../../content/landing'

function PlanCard({ plan, includesLabel, index }) {
  return (
    <article className={`plan plan-${plan.id} ${plan.featured ? 'plan-featured' : ''}`} style={{ '--i': index }} aria-labelledby={`plan-${plan.id}`}>
      {plan.ribbon && <span className="plan-ribbon">{plan.ribbon}</span>}
      <div className="plan-body">
        <h3 id={`plan-${plan.id}`} className="plan-name">{plan.name}</h3>
        <p className="plan-price"><strong>{plan.price}</strong><span>{plan.period}</span></p>
        <p className="plan-includes">{includesLabel}</p>
        <ul className="plan-features">
          {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}
        </ul>
      </div>
    </article>
  )
}

export default function Pricing({ id }) {
  const { label, includesLabel, plans } = pricing
  const [ref, inView] = useInView()
  return (
    <section id={id} className="section pricing" aria-labelledby={`${id}-title`}>
      <div className="container">
        <h2 id={`${id}-title`} className="pill">{label}</h2>
        <div ref={ref} className={`plans ${inView ? 'in-view' : ''}`}>
          {plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} includesLabel={includesLabel} index={index} />)}
        </div>
      </div>
    </section>
  )
}
