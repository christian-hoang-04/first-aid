import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import Problem from '../components/landing/Problem'
import HowItWorks from '../components/landing/HowItWorks'
import Features from '../components/landing/Features'
import Pricing from '../components/landing/Pricing'
import Team from '../components/landing/Team'
import CallToAction from '../components/landing/CallToAction'
import Faq from '../components/landing/Faq'
import Footer from '../components/landing/Footer'
import { sections } from '../content/landing'

// Component của từng mục, theo thứ tự trong `sections`
const sectionComponents = { 'van-de': Problem, 'cach-hoat-dong': HowItWorks, 'tinh-nang': Features, 'bang-gia': Pricing, 'doi-ngu': Team, faq: Faq, cta: CallToAction }

export default function Landing() {
  return (
    <div className="page">
      <Navbar />
      <main>
        <Hero />
        {sections.map((section) => {
          const Section = sectionComponents[section.id]
          return <Section key={section.id} id={section.id} />
        })}
      </main>
      <Footer />
    </div>
  )
}
