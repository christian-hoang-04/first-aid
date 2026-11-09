// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FacilitiesPage from './FacilitiesPage'

vi.mock('../maps/FacilityMap', () => ({ default: () => <div data-map /> }))

let container, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'geolocation', { configurable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 10.8039, longitude: 106.6941 } }) } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
async function render(state) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[{ pathname: '/app/co-so-y-te', state }]}><Routes><Route path="/app/co-so-y-te" element={<FacilitiesPage />} /></Routes></MemoryRouter>)
    await settle()
  })
}

describe('facility screen', () => {
  it('opens the call dialog when coming from the SOS button, with the list behind it', async () => {
    await render({ sos: true })
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(container.textContent).toContain('BỆNH VIỆN ĐA KHOA BÌNH THẠNH')
    expect(container.textContent).toContain('0918 517 900')
  })
  it('never dials in the demo: Call only shows a calling state', async () => {
    await render({ sos: true })
    await act(async () => { button('Gọi').click(); await settle() })
    expect(document.querySelector('[role="dialog"]').textContent).toContain('không thực hiện cuộc gọi thật')
    expect(document.querySelector('[role="dialog"] a[href^="tel:"]')).toBeNull()
    await act(async () => { button('Kết thúc').click(); await settle() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
  it('cancels the dialog and opens no dialog when visited directly', async () => {
    await render({ sos: true })
    await act(async () => { button('Hủy').click(); await settle() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await act(async () => root.unmount()); root = createRoot(container)
    await render(null)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
