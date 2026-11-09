import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MAPLIBRE_MODULE_URL = '/vendor/maplibre-gl/6.3.0/maplibre-gl.mjs'
const MAPLIBRE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// Leaflet treats string popup content as HTML; use text nodes for catalog/provider data.
function attribution(config) {
  const link = document.createElement('a')
  link.href = config.attributionUrl
  link.textContent = config.attributionText
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  return link.outerHTML
}

function facilityPopup(facility, onSelect) {
  const popup = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = facility.name
  const address = document.createElement('p')
  address.textContent = facility.address
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Xem thông tin cơ sở'
  button.addEventListener('click', () => onSelect(facility.id))
  popup.append(title, address, button)
  return popup
}

function markerElement(className, label, text) {
  const element = document.createElement('div')
  element.className = className
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', label)
  const markerText = document.createElement('span')
  markerText.textContent = text
  element.append(markerText)
  return element
}

export default function FacilityMap({ config, facilities, location, selectedId, focusVersion, onSelect }) {
  const container = useRef(null)
  const mapRef = useRef(null)
  const mapEngineRef = useRef(null)
  const mapLibreRef = useRef(null)
  const markersRef = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  const [mapEngine, setMapEngine] = useState('loading')
  const [mapMessage, setMapMessage] = useState('')
  const [retry, setRetry] = useState(0)
  onSelectRef.current = onSelect
  // Khung đổi kích thước (thu phóng trình duyệt, xoay màn hình): vẽ lại bản đồ cho khớp khung
  // và căn lại để mọi ghim vẫn nằm trong khung khi chưa chọn cơ sở nào
  const fitRef = useRef(null)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  useEffect(() => {
    let disposed = false
    let fallbackStarted = false
    let startupTimer
    mapRef.current = null
    mapEngineRef.current = null
    setMapEngine('loading')
    setMapMessage('')

    const removeMarkers = () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = new Map()
    }

    const resize = new ResizeObserver(() => {
      const map = mapRef.current
      if (!map) return
      if (mapEngineRef.current === 'maplibre') map.resize()
      else map.invalidateSize({ pan: false })
      if (!selectedRef.current) fitRef.current?.()
    })
    resize.observe(container.current)

    const startLeafletFallback = () => {
      if (disposed || fallbackStarted) return
      fallbackStarted = true
      clearTimeout(startupTimer)
      removeMarkers()
      if (mapRef.current && mapEngineRef.current === 'maplibre') mapRef.current.remove()
      mapRef.current = null
      mapEngineRef.current = null
      setMapMessage('vector-fallback')

      try {
        const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false })
          .setView([config.defaultCenter.lat, config.defaultCenter.lng], config.defaultZoom)
        L.control.zoom({ position: 'bottomright' }).addTo(map)
        const tiles = L.tileLayer(config.tileUrl, {
          maxZoom: config.maxZoom,
          attribution: attribution(config),
          referrerPolicy: 'strict-origin-when-cross-origin',
        }).addTo(map)
        tiles.on('tileerror', () => setMapMessage('raster-error'))
        tiles.on('tileload', () => setMapMessage(current => current === 'raster-error' ? 'vector-fallback' : current))
        mapRef.current = map
        mapEngineRef.current = 'leaflet'
        setMapEngine('leaflet')
      } catch {
        setMapEngine('failed')
        setMapMessage('unavailable')
      }
    }

    async function startMapLibre() {
      try {
        // URL đầy đủ để Vite dev không gắn ?import vào file trong public/ (gây lỗi overlay)
        const maplibregl = await import(/* @vite-ignore */ new URL(MAPLIBRE_MODULE_URL, window.location.origin).href)
        if (disposed) return
        mapLibreRef.current = maplibregl
        const map = new maplibregl.Map({
          container: container.current,
          style: MAPLIBRE_STYLE_URL,
          center: [config.defaultCenter.lng, config.defaultCenter.lat],
          zoom: config.defaultZoom,
          maxZoom: config.maxZoom,
          scrollZoom: false,
          attributionControl: false,
        })
        mapRef.current = map
        mapEngineRef.current = 'maplibre'
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
        startupTimer = setTimeout(startLeafletFallback, 20000)
        map.once('style.load', () => {
          if (disposed || mapRef.current !== map) return
          setMapEngine('maplibre')
        })
        map.once('load', () => {
          if (disposed || mapRef.current !== map) return
          clearTimeout(startupTimer)
        })
        map.on('error', event => {
          if (disposed || mapRef.current !== map) return
          if (!map.isStyleLoaded() || event.sourceId) startLeafletFallback()
        })
      } catch {
        startLeafletFallback()
      }
    }

    startMapLibre()
    return () => {
      disposed = true
      clearTimeout(startupTimer)
      resize.disconnect()
      removeMarkers()
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
      mapEngineRef.current = null
    }
  }, [config, retry])

  useEffect(() => {
    const map = mapRef.current
    if (!map || mapEngine !== mapEngineRef.current || !['maplibre', 'leaflet'].includes(mapEngine)) return
    const markers = new Map()
    const points = []
    const removeMarkers = () => markers.forEach(marker => marker.remove())

    if (mapEngine === 'maplibre') {
      const maplibregl = mapLibreRef.current
      if (!maplibregl) return
      if (location) {
        const point = [location.lng, location.lat]
        const element = markerElement('facility-map-marker facility-map-marker--user', 'Vị trí của bạn', 'U')
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(point).addTo(map)
        markers.set('__user-location__', marker)
        points.push(point)
      }
      facilities.forEach((facility, index) => {
        const point = [facility.longitude, facility.latitude]
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'facility-map-marker facility-map-marker--facility'
        element.setAttribute('aria-label', `${index + 1}. ${facility.name}`)
        const markerText = document.createElement('span')
        markerText.textContent = String(index + 1)
        element.append(markerText)
        const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat(point)
          // focusAfterOpen: false để mở popup từ danh sách không làm trình duyệt cuộn cả trang tới bản đồ
          .setPopup(new maplibregl.Popup({ offset: 23, maxWidth: '280px', focusAfterOpen: false })
            .setDOMContent(facilityPopup(facility, id => onSelectRef.current(id))))
          .addTo(map)
        element.addEventListener('click', () => onSelectRef.current(facility.id))
        markers.set(facility.id, marker)
        points.push(point)
      })
      markersRef.current = markers
      fitRef.current = () => {
        if (points.length === 1) map.setCenter(points[0]).setZoom(Math.min(15, config.maxZoom))
        else if (points.length > 1) {
          const bounds = new maplibregl.LngLatBounds()
          points.forEach(point => bounds.extend(point))
          map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 })
        } else map.setCenter([config.defaultCenter.lng, config.defaultCenter.lat]).setZoom(config.defaultZoom)
      }
      fitRef.current()
      return () => { removeMarkers(); markersRef.current = new Map(); fitRef.current = null }
    }

    const layer = L.layerGroup().addTo(map)
    if (location) {
      const point = [location.lat, location.lng]
      const label = document.createElement('span')
      label.textContent = 'Vị trí của bạn'
      L.circleMarker(point, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip(label).addTo(layer)
      points.push(point)
    }
    facilities.forEach((facility, index) => {
      const point = [facility.latitude, facility.longitude]
      const label = document.createElement('span')
      label.textContent = `${index + 1}. ${facility.name}`
      const marker = L.circleMarker(point, { radius: 10, color: '#fff', weight: 2, fillColor: '#bf2b2f', fillOpacity: 1 })
        .bindTooltip(label)
        .bindPopup(facilityPopup(facility, id => onSelectRef.current(id)), { autoPanPadding: [20, 30], keepInView: true })
        .addTo(layer)
      marker.on('click', () => onSelectRef.current(facility.id))
      markers.set(facility.id, marker)
      points.push(point)
    })
    markersRef.current = markers
    fitRef.current = () => {
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15, animate: false })
      else map.setView([config.defaultCenter.lat, config.defaultCenter.lng], config.defaultZoom)
    }
    fitRef.current()
    return () => { removeMarkers(); map.removeLayer(layer); markersRef.current = new Map(); fitRef.current = null }
  }, [mapEngine, facilities, location, config, retry])

  useEffect(() => {
    const marker = markersRef.current.get(selectedId)
    const map = mapRef.current
    if (!marker || !map || mapEngine !== mapEngineRef.current) return
    if (mapEngine === 'maplibre') {
      const point = marker.getLngLat()
      map.flyTo({ center: point, zoom: Math.min(16, config.maxZoom) })
      if (!marker.getPopup()?.isOpen()) marker.togglePopup()
    } else {
      map.setView(marker.getLatLng(), Math.min(16, config.maxZoom), { animate: false })
      marker.openPopup()
    }
  }, [selectedId, focusVersion, mapEngine, config, facilities, location, retry])

  const message = mapMessage === 'vector-fallback'
    ? 'Bản đồ chi tiết chưa tải được. Đang dùng nền bản đồ dự phòng.'
    : mapMessage === 'raster-error'
      ? 'Chưa tải được nền bản đồ. Bạn vẫn có thể xem địa chỉ và gọi trong danh sách.'
      : mapMessage === 'unavailable'
        ? 'Bản đồ chưa mở được. Bạn vẫn có thể xem địa chỉ và gọi từ danh sách.'
        : ''

  return <div className="facility-map-frame">
    <div ref={container} className={`facility-map-canvas${mapEngine === 'maplibre' ? ' facility-map-canvas--vector' : ''}`} role="region" aria-label="Bản đồ cơ sở y tế. Kéo để di chuyển, dùng nút thu phóng hoặc chọn một ghim để xem thông tin." />
    <p className="facility-map-legend"><span className="facility-pin-dot"/> Cơ sở y tế <span className="facility-user-dot"/> Vị trí của bạn</p>
    {message && <p className="facility-feedback" role="status">{message} <button type="button" onClick={() => { setMapMessage(''); setRetry(value => value + 1) }}>Tải lại bản đồ</button></p>}
  </div>
}
