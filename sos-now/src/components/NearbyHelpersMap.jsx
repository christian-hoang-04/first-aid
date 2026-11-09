import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapPin, Users } from 'lucide-react'
import { mapConfig } from '../content/facilities'
import { formatDistance } from '../maps/api'
import userCatPortrait from '../assets/nearby-user-cat.png'
import helperCatPortrait from '../assets/nearby-helper-cat.png'
import 'leaflet/dist/leaflet.css'

function markerIcon(type) {
  const isHelper = type === 'helper'
  const pinColor = isHelper ? '#83c84f' : '#f3c83f'
  const portraitBackground = isHelper ? '#d7f0d3' : '#cceafa'
  const shirtColor = isHelper ? '#197b64' : '#dc5a43'
  const hairColor = isHelper ? '#302b35' : '#4a3026'
  const portraitImage = isHelper ? helperCatPortrait : userCatPortrait
  const clipId = `nearby-helper-portrait-${type}`

  return L.divIcon({
    className: `nearby-helpers-map-leaflet-icon nearby-helpers-map-leaflet-icon--${type}`,
    html: `
      <span class="nearby-helpers-map-pin">
        <svg class="nearby-helpers-map-portrait" viewBox="0 0 76 90" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="${clipId}"><circle cx="38" cy="33" r="20.5" /></clipPath>
          </defs>
          <path d="M38 86C30 74 5 54 5 34 5 16 19 3 38 3s33 13 33 31c0 20-25 40-33 52Z" fill="${pinColor}" stroke="#fff" stroke-width="4" stroke-linejoin="round" />
          <circle cx="38" cy="33" r="22" fill="#fff" />
          <g clip-path="url(#${clipId})">
            <rect x="17" y="12" width="42" height="43" fill="${portraitBackground}" />
            <path d="M18 43c7-6 12-5 19-2 7-3 13-4 21 2v15H18Z" fill="${isHelper ? '#b8dfa9' : '#8fcce3'}" />
            <path d="M16 58c2-11 9-17 22-17s20 6 22 17v9H16Z" fill="${shirtColor}" />
            <path d="M31 40h14l3 9-10 8-10-8Z" fill="#f5c9a8" />
            <ellipse cx="38" cy="31" rx="11" ry="13" fill="#f5c9a8" />
            <path d="${isHelper
              ? 'M27 31c-1-12 5-18 13-18 9 0 14 7 11 19l-4-4-2-7c-4 4-9 5-16 5l-1 6Z'
              : 'M26 30c-2-12 4-19 13-19 10 0 15 8 11 20l-3-3-2-8c-4 4-10 5-18 4l-1 6Z'}" fill="${hairColor}" />
            <circle cx="34" cy="32" r="1" fill="#49352f" />
            <circle cx="42" cy="32" r="1" fill="#49352f" />
            <path d="M35 37c2 2 4 2 6 0" fill="none" stroke="#ad6552" stroke-width="1.2" stroke-linecap="round" />
            ${isHelper ? '<path d="M38 47v7m-3.5-3.5h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />' : ''}
            <image href="${portraitImage}" x="17" y="12" width="42" height="43" preserveAspectRatio="xMidYMid slice" />
          </g>
          <circle cx="38" cy="33" r="21" fill="none" stroke="#fff" stroke-width="3" />
        </svg>
        ${isHelper ? '<span class="nearby-helpers-map-pin-heart" aria-hidden="true">♥</span>' : ''}
      </span>
    `,
    iconSize: [76, 90],
    iconAnchor: [38, 86],
  })
}

export default function NearbyHelpersMap({ userLocation, helper }) {
  const mapElement = useRef(null)

  useEffect(() => {
    if (!mapElement.current || !helper?.location) return undefined

    const userPoint = [userLocation.lat, userLocation.lng]
    const helperPoint = [helper.location.lat, helper.location.lng]
    const map = L.map(mapElement.current, { scrollWheelZoom: false })
    const attribution = `<a href="${mapConfig.attributionUrl}" target="_blank" rel="noreferrer">${mapConfig.attributionText}</a>`

    L.tileLayer(mapConfig.tileUrl, { maxZoom: mapConfig.maxZoom, attribution }).addTo(map)
    L.polyline([userPoint, helperPoint], {
      className: 'nearby-helpers-map-route',
      color: '#278764',
      weight: 5,
      opacity: 0.95,
      dashArray: '3 8',
      lineCap: 'round',
      interactive: false,
    }).addTo(map)

    L.marker(userPoint, { icon: markerIcon('user'), alt: 'Vị trí của bạn' })
      .addTo(map)
      .bindTooltip('Bạn', { permanent: true, direction: 'top', offset: [0, -84], className: 'nearby-helpers-map-label nearby-helpers-map-label--user' })
    L.marker(helperPoint, { icon: markerIcon('helper'), alt: 'Người hỗ trợ gần nhất' })
      .addTo(map)
      .bindTooltip('Người hỗ trợ', { permanent: true, direction: 'top', offset: [0, -84], className: 'nearby-helpers-map-label nearby-helpers-map-label--helper' })

    map.fitBounds(L.latLngBounds(userPoint, helperPoint), {
      paddingTopLeft: [42, 176],
      paddingBottomRight: [42, 185],
      maxZoom: 16,
    })

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => map.invalidateSize())
    resizeObserver?.observe(mapElement.current)

    return () => {
      resizeObserver?.disconnect()
      map.remove()
    }
  }, [userLocation.lat, userLocation.lng, helper?.location?.lat, helper?.location?.lng])

  return (
    <div className="nearby-helpers-map">
      <div className="nearby-helpers-map-canvas" ref={mapElement} role="application" aria-label="Bản đồ vị trí của bạn và người hỗ trợ gần nhất" />
      <div className="nearby-helpers-map-wash" aria-hidden="true" />
      <div className="nearby-helpers-map-footer-wash" aria-hidden="true" />
      <div className="nearby-helpers-map-distance">
        <span><i aria-hidden="true">★</i> Người hỗ trợ gần nhất</span>
        <strong>{formatDistance(helper.approximateDistanceMeters)}</strong>
      </div>
      <div className="nearby-helpers-map-legend" aria-label="Ký hiệu bản đồ">
        <span><i className="nearby-helpers-map-legend-dot nearby-helpers-map-legend-dot--user" /> <MapPin aria-hidden="true" /> Bạn</span>
        <span><i className="nearby-helpers-map-legend-dot nearby-helpers-map-legend-dot--helper" /> <Users aria-hidden="true" /> Người hỗ trợ</span>
      </div>
    </div>
  )
}
