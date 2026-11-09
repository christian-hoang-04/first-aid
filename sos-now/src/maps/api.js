const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(status, retryAfter = 0) {
    super(status === 429 ? 'Bạn đã tra cứu nhiều lần. Vui lòng chờ rồi thử lại.'
      : status === 400 ? 'Thông tin tìm kiếm chưa hợp lệ. Hãy chọn lại vị trí hoặc quận/huyện.'
        : 'Chưa kết nối được danh mục cơ sở y tế. Hãy thử lại sau.')
    this.status = status
    this.retryAfter = retryAfter
  }
}

export async function apiGet(path, signal) {
  // A hard timeout also covers slow response bodies. Never send this URL to analytics/logs.
  const timeout = AbortSignal.timeout(8000)
  const response = await fetch(`${BASE_URL}${path}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
  })
  if (!response.ok) {
    const retry = response.headers.get('Retry-After')
    const seconds = /^\d+$/.test(retry || '') ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)
    throw new ApiError(response.status, response.status === 429 ? Math.min(3600, Math.max(1, seconds || 60)) : 0)
  }
  return response.json()
}

export function coordinatesValid(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function validateFacilities(data) {
  if (!Array.isArray(data) || data.length > 10000 || data.some(f => !f || typeof f.id !== 'string'
    || typeof f.name !== 'string' || typeof f.address !== 'string' || !coordinatesValid(f.latitude, f.longitude)
    || !Array.isArray(f.phones) || f.phones.some(p => typeof p?.label !== 'string' || !/^(?:115|\+?\d{8,15})$/.test(p.number)))) {
    throw new Error('Invalid facility response')
  }
  return data
}

export function validateMapConfig(data) {
  const https = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
  }
  if (!data || !https(data.tileUrl) || !['{x}', '{y}', '{z}'].every(key => data.tileUrl.includes(key))
    || !https(data.attributionUrl) || typeof data.providerName !== 'string' || typeof data.attributionText !== 'string'
    || !coordinatesValid(data.defaultCenter?.lat, data.defaultCenter?.lng)
    || !Number.isInteger(data.maxZoom) || data.maxZoom < 13 || data.maxZoom > 22
    || !Number.isInteger(data.defaultZoom) || data.defaultZoom < 0 || data.defaultZoom > data.maxZoom) {
    throw new Error('Invalid map configuration')
  }
  return data
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return ''
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}
