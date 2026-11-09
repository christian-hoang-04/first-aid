const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 8000
const SUPPORT_RADIUS_METERS = 5000

export class SupportApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'SupportApiError'
    this.status = status
  }
}

function messageForStatus(status, fallback) {
  if (status === 400) return 'Thông tin tìm kiếm chưa hợp lệ. Hãy chọn lại tình huống và thử lại.'
  if (status === 401 || status === 403) return 'Yêu cầu không còn hợp lệ. Hãy tìm người hỗ trợ lại.'
  if (status === 404) return 'Yêu cầu đã hết hạn hoặc dịch vụ chưa sẵn sàng.'
  if (status === 409) return 'Không còn người hỗ trợ phù hợp đang trực trong bán kính 5 km.'
  if (status === 429) return 'Bạn vừa gửi nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.'
  if (status >= 500) return 'Máy chủ người hỗ trợ đang bận. Nếu cần trợ giúp khẩn cấp, hãy gọi 115.'
  return fallback
}

async function request(path, { method = 'GET', body, token, signal, fallbackMessage } = {}) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combinedSignal,
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (error?.name === 'TimeoutError') {
      throw new SupportApiError(0, 'Máy chủ người hỗ trợ phản hồi quá lâu. Hãy thử lại sau.')
    }
    throw new SupportApiError(0, 'Chưa kết nối được máy chủ người hỗ trợ. Nếu nguy hiểm tính mạng, hãy gọi 115.')
  }

  if (response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new SupportApiError(response.status, 'Máy chủ người hỗ trợ chưa được kết nối hoặc chưa sẵn sàng.')
  }
  if (!response.ok) throw new SupportApiError(response.status, messageForStatus(response.status, fallbackMessage))
  return payload
}

function validPosition(position) {
  return Number.isFinite(position?.lat) && position.lat >= -90 && position.lat <= 90
    && Number.isFinite(position?.lng) && position.lng >= -180 && position.lng <= 180
}

function validateNearby(data) {
  if (!Array.isArray(data) || data.length > 5 || data.some((responder) => !responder
    || typeof responder.responderId !== 'string'
    || typeof responder.displayName !== 'string'
    || !Array.isArray(responder.skills)
    || !Number.isFinite(responder.approximateDistanceMeters)
    || responder.approximateDistanceMeters < 0)) {
    throw new SupportApiError(0, 'Danh sách người hỗ trợ nhận được chưa hợp lệ. Hãy thử lại sau.')
  }
  return data
}

function validateRequest(data) {
  if (!data || typeof data.id !== 'string' || typeof data.requesterToken !== 'string'
    || data.status !== 'OPEN' || typeof data.expiresAt !== 'string'
    || !Number.isInteger(data.invitedCount) || data.invitedCount < 1) {
    throw new SupportApiError(0, 'Máy chủ chưa thể tạo yêu cầu trợ giúp. Hãy gọi 115 nếu cần hỗ trợ khẩn cấp.')
  }
  return data
}

function validateState(data) {
  if (!data || !['OPEN', 'ACCEPTED', 'CANCELLED', 'COMPLETED'].includes(data.status)) {
    throw new SupportApiError(0, 'Trạng thái yêu cầu chưa hợp lệ. Hãy thử cập nhật lại.')
  }
  if (data.status === 'ACCEPTED' && (!data.responder || typeof data.responder.displayName !== 'string')) {
    throw new SupportApiError(0, 'Không thể xác nhận thông tin người hỗ trợ. Hãy gọi 115 nếu cần trợ giúp ngay.')
  }
  return data
}

export async function findNearbyHelpers(position, skill, audience, signal) {
  if (!validPosition(position) || !['FIRST_AID', 'CPR', 'AED', 'PEDIATRIC'].includes(skill)
    || !['ADULT', 'CHILD', 'INFANT'].includes(audience)) {
    throw new SupportApiError(400, messageForStatus(400))
  }
  const query = new URLSearchParams({
    lat: String(position.lat),
    lng: String(position.lng),
    radius: String(SUPPORT_RADIUS_METERS),
    limit: '5',
    skill,
    audience,
  })
  const data = await request(`/api/responders/nearby?${query}`, {
    signal,
    fallbackMessage: 'Chưa thể tìm người hỗ trợ gần bạn. Hãy thử lại sau.',
  })
  return validateNearby(data)
}

export async function createSupportRequest({ position, scenarioId, audience }, signal) {
  if (!validPosition(position) || typeof scenarioId !== 'string'
    || !['ADULT', 'CHILD', 'INFANT'].includes(audience)) {
    throw new SupportApiError(400, messageForStatus(400))
  }
  const data = await request('/api/support-requests', {
    method: 'POST',
    signal,
    fallbackMessage: 'Chưa thể gửi yêu cầu trợ giúp. Hãy gọi 115 nếu cần hỗ trợ khẩn cấp.',
    body: {
      scenarioId,
      locale: 'vi',
      audience,
      latitude: position.lat,
      longitude: position.lng,
      radius: SUPPORT_RADIUS_METERS,
      shareLocationWithAcceptedResponder: true,
    },
  })
  return validateRequest(data)
}

export async function getSupportRequest(id, token, signal) {
  if (typeof id !== 'string' || !id || typeof token !== 'string' || !token) {
    throw new SupportApiError(401, messageForStatus(401))
  }
  const data = await request(`/api/support-requests/${encodeURIComponent(id)}`, { token, signal })
  return validateState(data)
}

export async function cancelSupportRequest(id, token, signal) {
  if (typeof id !== 'string' || !id || typeof token !== 'string' || !token) {
    throw new SupportApiError(401, messageForStatus(401))
  }
  await request(`/api/support-requests/${encodeURIComponent(id)}`, { method: 'DELETE', token, signal })
}
