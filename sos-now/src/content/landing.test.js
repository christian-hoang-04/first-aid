import { describe, expect, it } from 'vitest'
import { faq, features, howItWorks, navLinks, pricing, sections, team } from './landing'

describe('landing content', () => {
  it('has unique section ids', () => expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length))
  it('links every nav item to a section', () => navLinks.forEach((link) => expect(sections.some((s) => s.id === link.id)).toBe(true)))
  it('gives every feature a known mockup and some points', () => {
    features.items.forEach((item) => {
      expect(['voice', 'course', 'sos']).toContain(item.visual)
      expect(item.points.length).toBeGreaterThan(0)
    })
  })
  it('answers every FAQ question', () => {
    expect(faq.items.length).toBeGreaterThan(0)
    faq.items.forEach((item) => expect(item.q && item.a).toBeTruthy())
  })
  it('lists six team members with unique ids', () => {
    expect(team.members).toHaveLength(6)
    expect(new Set(team.members.map((m) => m.id)).size).toBe(6)
  })
  it('highlights exactly one pricing plan', () => {
    expect(pricing.plans.filter((plan) => plan.featured)).toHaveLength(1)
    pricing.plans.forEach((plan) => expect(plan.features.length).toBeGreaterThan(0))
  })
  it('has four described how-it-works steps', () => {
    expect(howItWorks.steps).toHaveLength(4)
    howItWorks.steps.forEach((step) => expect(step.title && step.description).toBeTruthy())
  })
})
