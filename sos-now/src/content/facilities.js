// Cơ sở y tế thật ở TP.HCM, dùng chung file dữ liệu với backend (backend/data/facilities.json).
// Nguồn số điện thoại và tọa độ ghi trong verificationSource của từng cơ sở.
import facilities from '../../backend/data/facilities.json'

export { facilities }

// Khi chưa có vị trí: tính khoảng cách từ trung tâm TP.HCM (chợ Bến Thành), cùng tâm mặc định với bản đồ
export const cityCenter = { lat: 10.7769, lng: 106.7009 }

// Bản đồ chạy được không cần backend: cùng cấu hình mặc định với GET /api/map/config
export const mapConfig = {
  providerName: 'OpenStreetMap',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attributionText: '© OpenStreetMap contributors',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  defaultCenter: cityCenter,
  defaultZoom: 13,
  maxZoom: 19
}

// Khoảng cách đường chim bay (công thức haversine), đơn vị mét
export function distanceMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export function nearestFacilities(point, limit = 5) {
  return facilities
    .map((facility) => ({ ...facility, distanceMeters: distanceMeters(point, { lat: facility.latitude, lng: facility.longitude }) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit)
}

// Hiển thị số dễ đọc: 028 3841 2692, 0903 023 194
export function formatPhone(number) {
  if (/^028\d{8}$/.test(number)) return `${number.slice(0, 3)} ${number.slice(3, 7)} ${number.slice(7)}`
  if (/^0\d{9}$/.test(number)) return `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`
  return number
}
