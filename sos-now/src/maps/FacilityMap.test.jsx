// @vitest-environment jsdom
import React, { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

let FacilityMap, container, root
beforeAll(async () => {
  // Leaflet feature-detects SVG. jsdom supports the DOM but omits this detection method.
  SVGSVGElement.prototype.createSVGRect = () => ({})
  FacilityMap = (await import('./FacilityMap')).default
})
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

// jsdom không chạy được MapLibre (thư viện tải từ public/ và cần WebGL), nên bản đồ chuyển sang nền Leaflet dự phòng.
// Việc chuyển chạy sau khi tải MapLibre thất bại (bất đồng bộ), nên phải chờ Leaflet xuất hiện
it('falls back to Leaflet when MapLibre cannot load and treats provider and facility labels as text', async () => {
  const select = vi.fn()
  const facility = { id: 'one', name: '<img src=x onerror=alert(1)>', address: 'Test address', latitude: 10.8, longitude: 106.7 }
  const config = { providerName: 'Test', tileUrl: 'https://example.test/{z}/{x}/{y}.png',
    attributionUrl: 'https://example.test/copyright', attributionText: '<img src=x onerror=alert(1)>',
    defaultCenter: { lat: 10.8, lng: 106.7 }, defaultZoom: 13, maxZoom: 19 }
  await act(async () => root.render(<StrictMode><FacilityMap config={config} facilities={[facility]}
    location={{ lat: 10.79, lng: 106.69 }} selectedId="one" onSelect={select}/></StrictMode>))
  await vi.waitFor(async () => {
    await act(async () => {})
    expect(container.querySelector('.leaflet-popup-content')).not.toBeNull()
  })
  expect(container.querySelector('.leaflet-container')).not.toBeNull()
  expect(container.querySelectorAll('path.leaflet-interactive')).toHaveLength(2)
  expect(container.querySelector('.leaflet-control-attribution').textContent).toContain('<img src=x onerror=alert(1)>')
  expect(container.querySelector('.leaflet-control-attribution img')).toBeNull()
  expect(container.querySelector('.leaflet-popup-content strong').textContent).toBe(facility.name)
  expect(container.querySelector('.leaflet-popup-content img')).toBeNull()
  await act(async () => container.querySelector('.leaflet-popup-content button').click())
  expect(select).toHaveBeenCalledWith('one')
})
