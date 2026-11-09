import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, ApiError, coordinatesValid, formatDistance, validateFacilities, validateMapConfig } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('map API boundary', () => {
  it('preserves rate limits for UI backoff', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '45' } })))
    await expect(apiGet('/api/map/config')).rejects.toMatchObject({ status: 429, retryAfter: 45 })
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' })
  })
  it('does not treat a server error as an empty facility list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    await expect(apiGet('/api/facilities?district=Test')).rejects.toBeInstanceOf(ApiError)
  })
  it('rejects invalid coordinates and unsafe telephone links', () => {
    expect(coordinatesValid(10.8, 106.7)).toBe(true)
    expect(coordinatesValid(NaN, 106.7)).toBe(false)
    expect(coordinatesValid(91, 106.7)).toBe(false)
    expect(() => validateFacilities([{ id: 'test', name: 'Test', address: 'Test', latitude: 10.8, longitude: 106.7,
      phones: [{ label: 'Test', number: 'javascript:alert(1)' }] }])).toThrow()
  })
  it('validates tile URL and attribution before Leaflet uses them', () => {
    const config = { providerName: 'Test', tileUrl: 'https://example.test/{z}/{x}/{y}.png',
      attributionUrl: 'https://example.test/copyright', attributionText: 'Test',
      defaultCenter: { lat: 10.8, lng: 106.7 }, defaultZoom: 13, maxZoom: 19 }
    expect(validateMapConfig(config)).toBe(config)
    for (const change of [{ tileUrl: 'javascript:alert(1)' }, { attributionUrl: 'javascript:alert(1)' },
      { tileUrl: 'https://example.test/static.png' }, { defaultZoom: 30 }]) {
      expect(() => validateMapConfig({ ...config, ...change })).toThrow()
    }
  })
  it('formats zero distance and avoids showing invalid distances', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(1250)).toBe('1.3 km')
    expect(formatDistance(undefined)).toBe('')
  })
})
