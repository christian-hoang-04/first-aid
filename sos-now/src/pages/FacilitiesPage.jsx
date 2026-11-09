import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LocateFixed, MapPin, Phone, PhoneOff } from 'lucide-react'
import Navbar from '../components/landing/Navbar'
import { appNav, facilityScreen } from '../content/app'
import { cityCenter, formatPhone, mapConfig, nearestFacilities } from '../content/facilities'
import hcmcLandmarks from '../data/hcmc-landmarks.json'
import { cardinalDirectionFromLandmark, nearestNearbyLandmark } from '../location/location-context'
import { apiGet, formatDistance, validateFacilities } from '../maps/api'
import '../maps/facilities.css'

const FacilityMap = lazy(() => import('../maps/FacilityMap'))

// Bản đồ lỗi thì vẫn giữ danh sách và số điện thoại
class MapBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p className="facilities-map-note">Bản đồ chưa mở được. Danh sách bên dưới vẫn dùng được.</p> : this.props.children }
}

function callPhoneForFacility(facility) {
  return facility.phones.find(phone => /^\s*tổng đài/i.test(phone.label))
    ?? (facility.phones.length === 1 ? facility.phones[0] : null)
}

// Màn hình Cơ sở y tế gần nhất. Đến từ nút SOS thì mở ngay hộp Gọi 115 / Hủy,
// danh sách và bản đồ vẫn hiện phía sau. Bản demo: không gọi thật
export default function FacilitiesPage() {
  const s = facilityScreen
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState(routerLocation.state?.sos ? 'ask' : null)
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('loading')
  const [apiFacilities, setApiFacilities] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const initialLocateStarted = useRef(false)
  const callRef = useRef(null)

  const locate = () => {
    setStatus('loading')
    if (!navigator.geolocation) { setStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude, accuracy: result.coords.accuracy })
        setStatus('ready')
      },
      () => setStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    if (!initialLocateStarted.current) {
      initialLocateStarted.current = true
      locate()
    }
    // Bỏ cờ SOS khỏi lịch sử để tải lại trang không mở lại hộp gọi
    if (routerLocation.state?.sos) navigate('.', { replace: true, state: null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dialog) return
    callRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') setDialog(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const fallbackFacilities = useMemo(() => nearestFacilities(status === 'ready' ? position : cityCenter), [status, position])
  const facilities = apiFacilities ?? fallbackFacilities
  const select = (id) => { setSelectedId(id); setFocusVersion((value) => value + 1) }
  const nearbyLandmark = useMemo(
    () => status === 'ready' ? nearestNearbyLandmark(position, hcmcLandmarks) : null,
    [position, status]
  )
  const landmarkDirection = nearbyLandmark ? cardinalDirectionFromLandmark(position, nearbyLandmark) : null
  const landmarkFallback = nearbyLandmark
    ? landmarkDirection
      ? s.locatedInDirectionOfLandmark
        .replace('{direction}', s.cardinalDirections[landmarkDirection])
        .replace('{landmark}', nearbyLandmark.name)
      : s.locatedNearLandmark.replace('{landmark}', nearbyLandmark.name)
    : null
  const statusText = status === 'ready'
    ? landmarkFallback || s.located
    : { loading: s.locating, error: s.failed }[status]

  useEffect(() => {
    if (status !== 'ready' || !position) {
      setApiFacilities(null)
      return
    }
    const controller = new AbortController()
    setApiFacilities(null)
    const query = new URLSearchParams({ lat: position.lat, lng: position.lng, radius: 5000, limit: 5 })
    apiGet(`/api/facilities/nearby?${query}`, controller.signal)
      .then(validateFacilities)
      .then(data => { if (!controller.signal.aborted) setApiFacilities(data) })
      .catch(() => { if (!controller.signal.aborted) setApiFacilities(null) })
    return () => controller.abort()
  }, [status, position])

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="container facilities">
        <div className="facilities-head">
          <div>
            <h1 className="facilities-title">{s.title}</h1>
            <p className={`facilities-status ${status === 'error' ? 'is-error' : ''}`} role="status">
              <LocateFixed aria-hidden="true" /> {statusText}
              {status === 'error' && <button type="button" onClick={locate}>{s.retry}</button>}
            </p>
          </div>
          <button type="button" className="facilities-call" onClick={() => setDialog('ask')}><Phone aria-hidden="true" /> {s.call115}</button>
        </div>

        <div className="facilities-body">
          <div className="facilities-map">
            <MapBoundary>
              <Suspense fallback={<p className="facilities-map-note">Đang mở bản đồ…</p>}>
                <FacilityMap config={mapConfig} facilities={facilities} location={status === 'ready' ? position : null} selectedId={selectedId} focusVersion={focusVersion} onSelect={select} />
              </Suspense>
            </MapBoundary>
          </div>

          <ol className="facilities-list" aria-label="Danh sách cơ sở y tế">
            {facilities.map((facility, index) => {
              const callPhone = callPhoneForFacility(facility)
              const callHref = callPhone ? `tel:${String(callPhone.number).replace(/[^\d+]/g, '')}` : null
              return <li key={facility.id} className={selectedId === facility.id ? 'is-selected' : ''}>
                <h2><span>{index + 1}</span>{facility.name}</h2>
                <p className="facilities-address"><MapPin aria-hidden="true" /> {facility.address || 'Chưa có địa chỉ trong danh sách nguồn'}</p>
                <div className="facilities-tags">
                  {facility.hasEmergency && <span className="is-red">{s.emergency}</span>}
                  <span>{formatDistance(facility.distanceMeters)}{facility.distanceMethod === 'ROAD' && <> · {s.roadDistanceNote}</>}</span>
                </div>
                <ul className="facilities-phones">
                  {facility.phones.map((phone) => (
                    <li key={phone.number}><Phone aria-hidden="true" /> {phone.label}: <strong>{formatPhone(phone.number)}</strong>{phone.is24h && <em>{s.hours24}</em>}</li>
                  ))}
                </ul>
                <div className="facilities-card-actions">
                  <button type="button" className="facilities-show" aria-pressed={selectedId === facility.id} onClick={() => select(facility.id)}>{s.showOnMap}</button>
                  {callHref && <a className="facilities-call-link" href={callHref} aria-label={`Gọi điện ngay đến ${facility.name}`}><Phone aria-hidden="true" /> Gọi điện ngay</a>}
                </div>
              </li>
            })}
          </ol>
        </div>
        <p className="facilities-source">{s.source}</p>
      </main>

      {dialog && (
        <div className="sos-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="sos-dialog" role="dialog" aria-modal="true" aria-labelledby="sos-dialog-title" onClick={(event) => event.stopPropagation()}>
            {dialog === 'ask' ? (
              <>
                <span className="sos-dialog-icon" aria-hidden="true"><Phone /></span>
                <h2 id="sos-dialog-title" className="sos-dialog-title">{s.dialog.title}</h2>
                <p className="sos-dialog-text">{s.dialog.text}</p>
                <div className="sos-dialog-actions">
                  <button type="button" className="button button-outline" onClick={() => setDialog(null)}>{s.dialog.cancel}</button>
                  <button ref={callRef} type="button" className="button button-primary" onClick={() => setDialog('calling')}><Phone aria-hidden="true" /> {s.dialog.call}</button>
                </div>
              </>
            ) : (
              <>
                <span className="sos-dialog-icon is-calling" aria-hidden="true"><Phone /></span>
                <h2 id="sos-dialog-title" className="sos-dialog-title">{s.dialog.calling}</h2>
                <p className="sos-dialog-text">{s.dialog.demo}</p>
                <div className="sos-dialog-actions is-single">
                  <button ref={callRef} type="button" className="button button-primary" onClick={() => setDialog(null)}><PhoneOff aria-hidden="true" /> {s.dialog.end}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
