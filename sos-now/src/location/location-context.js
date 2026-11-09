export const MAX_LANDMARK_DISTANCE_METERS = 5000
export const MAX_GEOLOCATION_ACCURACY_METERS = 1000

function validCoordinates(point) {
  return Number.isFinite(point?.lat)
    && Number.isFinite(point?.lng)
    && point.lat >= -90
    && point.lat <= 90
    && point.lng >= -180
    && point.lng <= 180
}

export function distanceMeters(from, to) {
  if (!validCoordinates(from) || !validCoordinates(to)) return Infinity

  const radians = degrees => (degrees * Math.PI) / 180
  const latitudeDelta = radians(to.lat - from.lat)
  const longitudeDelta = radians(to.lng - from.lng)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, haversine)))
}

export function nearestNearbyLandmark(position, landmarks, {
  maxDistanceMeters = MAX_LANDMARK_DISTANCE_METERS,
  maxAccuracyMeters = MAX_GEOLOCATION_ACCURACY_METERS
} = {}) {
  if (!validCoordinates(position)
    || !Number.isFinite(position.accuracy)
    || position.accuracy < 0
    || position.accuracy > maxAccuracyMeters
    || !Array.isArray(landmarks)) return null

  let nearest = null

  for (const landmark of landmarks) {
    if (!validCoordinates({ lat: landmark?.latitude, lng: landmark?.longitude })) continue

    const distance = distanceMeters(position, { lat: landmark.latitude, lng: landmark.longitude })
    if (distance + position.accuracy > maxDistanceMeters) continue
    if (!nearest || distance < nearest.distanceMeters) {
      nearest = { ...landmark, distanceMeters: distance }
    }
  }

  return nearest
}

export function cardinalDirectionFromLandmark(position, landmark) {
  if (!validCoordinates(position)
    || !validCoordinates({ lat: landmark?.latitude, lng: landmark?.longitude })
    || !Number.isFinite(position.accuracy)
    || position.accuracy < 0
    || position.accuracy > MAX_GEOLOCATION_ACCURACY_METERS) return null

  const radians = degrees => (degrees * Math.PI) / 180
  const meanLatitude = radians((position.lat + landmark.latitude) / 2)
  const eastMeters = radians(position.lng - landmark.longitude) * 6371000 * Math.cos(meanLatitude)
  const northMeters = radians(position.lat - landmark.latitude) * 6371000
  const eastOffset = Math.abs(eastMeters)
  const northOffset = Math.abs(northMeters)
  const dominantOffset = Math.max(eastOffset, northOffset)
  const secondaryOffset = Math.min(eastOffset, northOffset)

  // Avoid a directional claim when the GPS uncertainty could cross a cardinal-sector boundary.
  if (dominantOffset <= position.accuracy
    || dominantOffset - secondaryOffset <= Math.SQRT2 * position.accuracy) return null

  if (eastOffset > northOffset) return eastMeters > 0 ? 'east' : 'west'
  return northMeters > 0 ? 'north' : 'south'
}
