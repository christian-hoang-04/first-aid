import { describe, expect, it } from 'vitest'
import { appNav, appPages, appStart, authPages } from './app'

describe('app pages', () => {
  const all = [...appPages, ...authPages]
  it('starts on an existing page', () => expect(appPages.some((p) => p.path === appStart)).toBe(true))
  it('only links to existing pages in the menu', () => appNav.forEach((l) => expect(appPages.some((p) => p.path === l.path)).toBe(true)))
  it('has unique paths', () => expect(new Set(all.map((p) => p.path)).size).toBe(all.length))
  it('describes every page that is not coming soon', () => all.forEach((p) => expect(p.title && (p.comingSoon || p.description)).toBeTruthy()))
})
