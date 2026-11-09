import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LocateFixed, MapPin, Phone, PhoneOff } from 'lucide-react'
import Navbar from '../components/landing/Navbar'
import { appNav, facilityScreen } from '../content/app'
import { cityCenter, formatPhone, mapConfig, nearestFacilities } from '../content/facilities'
import { formatDistance } from '../maps/api'
import '../maps/facilities.css'

const FacilityMap = lazy(() => import('../maps/FacilityMap'))

// Bản đồ lỗi thì vẫn giữ danh sách và số điện thoại
class MapBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p className="facilities-map-note">Bản đồ chưa mở được. Danh sách bên dưới vẫn dùng được.</p> : this.props.children }
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
  const [selectedId, setSelectedId] = useState(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const callRef = useRef(null)

  const locate = () => {
    setStatus('loading')
    if (!navigator.geolocation) { setStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (result) => { setPosition({ lat: result.coords.latitude, lng: result.coords.longitude }); setStatus('ready') },
      () => setStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    locate()
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

  const facilities = useMemo(() => nearestFacilities(status === 'ready' ? position : cityCenter), [status, position])
  const select = (id) => { setSelectedId(id); setFocusVersion((value) => value + 1) }
  const statusText = { loading: s.locating, ready: s.located, error: s.failed }[status]

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
            {facilities.map((facility, index) => (
              <li key={facility.id} className={selectedId === facility.id ? 'is-selected' : ''}>
                <h2><span>{index + 1}</span>{facility.name}</h2>
                <p className="facilities-address"><MapPin aria-hidden="true" /> {facility.address}</p>
                <div className="facilities-tags">
                  {facility.hasEmergency && <span className="is-red">{s.emergency}</span>}
                  <span>{formatDistance(facility.distanceMeters)} · {s.distanceNote}</span>
                </div>
                {/* Bản demo: số điện thoại chỉ để xem, không mở trình gọi */}
                <ul className="facilities-phones">
                  {facility.phones.map((phone) => (
                    <li key={phone.number}><Phone aria-hidden="true" /> {phone.label}: <strong>{formatPhone(phone.number)}</strong>{phone.is24h && <em>{s.hours24}</em>}</li>
                  ))}
                </ul>
                <button type="button" className="facilities-show" aria-pressed={selectedId === facility.id} onClick={() => select(facility.id)}>{s.showOnMap}</button>
              </li>
            ))}
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
