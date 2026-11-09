// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FacilityFinder from './FacilityFinder'

vi.mock('../maps/FacilityMap', () => ({ default: ({ facilities, selectedId, location }) =>
  <div data-map data-selection={selectedId || ''} data-user={Boolean(location)}>{facilities.map(f => f.name).join(', ')}</div> }))

const config = { providerName: 'Test', tileUrl: 'https://example.test/{z}/{x}/{y}.png',
  attributionText: 'Test', attributionUrl: 'https://example.test/copyright',
  defaultCenter: { lat: 10.8, lng: 106.7 }, defaultZoom: 13, maxZoom: 19 }
const facility = (id, name = id) => ({ id, name, address: 'Test address', district: 'Bình Thạnh', latitude: 10.8,
  longitude: 106.7, hasEmergency: true, distanceMeters: 1250, phones: [{ label: 'Test only', number: '02800000000', is24h: true }] })
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
let container, root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove(); vi.unstubAllGlobals()
})
const settle = () => new Promise(resolve => setTimeout(resolve, 10))
async function render(props = {}) { await act(async () => { root.render(<FacilityFinder locationStatus="idle" onLocation={() => {}} {...props}/>); await settle() }) }
async function click(text) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === text)
  expect(button).toBeTruthy()
  await act(async () => { button.click(); await settle() })
}
function mockApi(search = () => json([])) {
  vi.stubGlobal('fetch', vi.fn((url, options) => url.endsWith('/api/districts') ? Promise.resolve(json(['Bình Thạnh', 'Quận 1']))
    : url.endsWith('/api/map/config') ? Promise.resolve(json(config)) : Promise.resolve(search(url, options))))
}

describe('inline facility finder', () => {
  it('fits inside the existing location card without duplicating its heading or GPS control', async () => {
    mockApi()
    await render({ embedded: true })
    expect(container.querySelector('h2')).toBeNull()
    expect([...container.querySelectorAll('button')].some(b => b.textContent === 'Dùng vị trí của tôi')).toBe(false)
    expect(container.querySelector('[aria-label="Bản đồ và danh sách cơ sở y tế"]')).not.toBeNull()
    expect(container.querySelector('select')).not.toBeNull()
    await click('Hiển thị bản đồ')
    expect(container.querySelector('[data-map]')).not.toBeNull()
  })
  it('does not contact the map provider or request map config before the user enables it', async () => {
    mockApi()
    await render()
    expect(fetch.mock.calls.map(c => c[0])).toEqual(['/api/districts'])
    expect(container.querySelector('[data-map]')).toBeNull()
    await click('Hiển thị bản đồ')
    await act(async () => { await settle() })
    expect(container.querySelector('[data-map]')).not.toBeNull()
    expect(fetch.mock.calls.some(c => c[0] === '/api/map/config')).toBe(true)
  })
  it('shows real API results, calls phones, and selects a pin without Google redirects', async () => {
    mockApi(() => json([facility('one', 'Synthetic hospital')]))
    await render({ location: { lat: 10.8, lng: 106.7 }, locationStatus: 'ready' })
    expect(fetch.mock.calls.some(c => c[0].startsWith('/api/facilities/nearby?lat=10.8&lng=106.7'))).toBe(true)
    expect(container.textContent).toContain('Synthetic hospital')
    expect(container.querySelector('a[href="tel:02800000000"]')).not.toBeNull()
    await click('Xem trên bản đồ')
    expect(container.querySelector('[data-map]').dataset.selection).toBe('one')
    expect(container.querySelector('[data-map]').dataset.user).toBe('true')
    expect(container.querySelector('a[href*="google.com"]')).toBeNull()
  })
  it('falls back to districts without transmitting an old GPS position to the map', async () => {
    mockApi(() => json([facility('one')]))
    await render({ location: { lat: 10.8, lng: 106.7 }, locationStatus: 'error' })
    await act(async () => {
      const select = container.querySelector('select'); select.value = 'Bình Thạnh'
      select.dispatchEvent(new Event('change', { bubbles: true })); await settle()
    })
    expect(fetch.mock.calls.some(c => c[0].startsWith('/api/facilities?district='))).toBe(true)
    expect(fetch.mock.calls.some(c => c[0].includes('/nearby'))).toBe(false)
    await click('Hiển thị bản đồ')
    expect(container.querySelector('[data-map]').dataset.user).toBe('false')
    expect(container.textContent).not.toContain('1.3 km')
  })
  it('discards an older response after a new district is selected', async () => {
    let resolveOld
    mockApi(url => url.includes('/nearby') ? new Promise(resolve => { resolveOld = resolve }) : json([facility('district-result')]))
    await render({ location: { lat: 10.8, lng: 106.7 }, locationStatus: 'ready' })
    await act(async () => {
      const select = container.querySelector('select'); select.value = 'Quận 1'
      select.dispatchEvent(new Event('change', { bubbles: true })); await settle()
      resolveOld(json([facility('stale-result')])); await settle()
    })
    expect(container.textContent).toContain('district-result')
    expect(container.textContent).not.toContain('stale-result')
  })
  it('distinguishes empty verified data from a network failure', async () => {
    mockApi(() => json([]))
    const props = { location: { lat: 10.8, lng: 106.7 }, locationStatus: 'ready' }
    await render(props)
    expect(container.textContent).toContain('Chưa có cơ sở đã xác minh')
    expect(container.querySelector('a[href="tel:115"]')).not.toBeNull()
    mockApi(() => Promise.reject(new Error('offline')))
    await render({ ...props, location: { lat: 10.81, lng: 106.7 } })
    expect(container.textContent).toContain('Chưa tải được danh sách')
    expect(container.textContent).not.toContain('Chưa có cơ sở đã xác minh')
  })
  it('respects Retry-After and leaves the emergency number available', async () => {
    mockApi(() => new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }))
    await render({ location: { lat: 10.8, lng: 106.7 }, locationStatus: 'ready' })
    expect(container.textContent).toContain('Đã đạt giới hạn tra cứu')
    expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Thử lại danh sách').disabled).toBe(true)
    expect(container.querySelector('a[href="tel:115"]')).not.toBeNull()
  })
})
