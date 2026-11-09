import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { ApiError, apiGet, coordinatesValid, formatDistance, validateFacilities, validateMapConfig } from '../maps/api'
import '../maps/facilities.css'

const FacilityMap = lazy(() => import('../maps/FacilityMap'))

class MapBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <p className="facility-feedback" role="status">Bản đồ chưa mở được. Bạn vẫn có thể xem địa chỉ và gọi từ danh sách.</p>
      : this.props.children
  }
}

export default function FacilityFinder({ location, locationStatus, onLocation, embedded = false }) {
  const [districts, setDistricts] = useState([])
  const [district, setDistrict] = useState('')
  const [mode, setMode] = useState('nearby')
  const [facilities, setFacilities] = useState([])
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [districtError, setDistrictError] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const [mapAllowed, setMapAllowed] = useState(false)
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState(false)
  const [reload, setReload] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const controllerRef = useRef(null)
  const requestId = useRef(0)
  const latestLocation = useRef(location)
  latestLocation.current = location
  const ready = coordinatesValid(location?.lat, location?.lng) && locationStatus === 'ready'
  const locationKey = ready ? `${location.lat},${location.lng}` : ''

  useEffect(() => {
    const controller = new AbortController()
    setDistrictError(false)
    apiGet('/api/districts', controller.signal).then(data => {
      if (!Array.isArray(data) || data.some(value => typeof value !== 'string')) throw new Error('Invalid districts')
      setDistricts(data)
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err instanceof ApiError && err.retryAfter) setWaitUntil(Date.now() + err.retryAfter * 1000)
      setDistrictError(true)
    })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    const milliseconds = waitUntil - Date.now()
    setWaiting(milliseconds > 0)
    if (milliseconds <= 0) return
    const timer = setTimeout(() => setWaiting(false), milliseconds)
    return () => clearTimeout(timer)
  }, [waitUntil])

  useEffect(() => {
    if (!mapAllowed) return
    const controller = new AbortController()
    setConfigError(false)
    apiGet('/api/map/config', controller.signal).then(validateMapConfig).then(data => {
      if (!controller.signal.aborted) setConfig(data)
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err instanceof ApiError && err.retryAfter) setWaitUntil(Date.now() + err.retryAfter * 1000)
      setConfigError(true)
    })
    return () => controller.abort()
  }, [mapAllowed, reload])

  async function search(path) {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const id = ++requestId.current
    setFacilities([]); setSelectedId(null); setError(''); setState('loading')
    try {
      const data = validateFacilities(await apiGet(path, controller.signal))
      if (id !== requestId.current || controller.signal.aborted) return
      setFacilities(data); setState('ready')
    } catch (err) {
      if (id !== requestId.current || controller.signal.aborted) return
      if (err instanceof ApiError && err.retryAfter) setWaitUntil(Date.now() + err.retryAfter * 1000)
      setError(err instanceof ApiError ? err.message : 'Chưa tải được danh sách cơ sở y tế. Kiểm tra mạng và thử lại.')
      setState('error')
    }
  }

  useEffect(() => {
    if (!locationKey) return
    setMode('nearby'); setDistrict('')
    const point = latestLocation.current
    search(`/api/facilities/nearby?${new URLSearchParams({ lat: point.lat, lng: point.lng, radius: 5000, limit: 5 })}`)
    return () => { controllerRef.current?.abort(); requestId.current++ }
  }, [locationKey])

  useEffect(() => () => { controllerRef.current?.abort(); requestId.current++ }, [])

  const chooseDistrict = value => {
    setDistrict(value); setMode('district')
    if (value) search(`/api/facilities?${new URLSearchParams({ district: value })}`)
    else { controllerRef.current?.abort(); requestId.current++; setFacilities([]); setSelectedId(null); setState('idle') }
  }
  const retrySearch = () => {
    if (mode === 'district' && district) chooseDistrict(district)
    else if (ready) search(`/api/facilities/nearby?${new URLSearchParams({ lat: location.lat, lng: location.lng, radius: 5000, limit: 5 })}`)
  }
  const selectFacility = id => { setSelectedId(id); setFocusVersion(value => value + 1) }

  return <section className={`facility-finder${embedded ? ' facility-finder-embedded' : ''}`} id={embedded ? undefined : 'location-help'} aria-label={embedded ? 'Bản đồ và danh sách cơ sở y tế' : undefined} aria-labelledby={embedded ? undefined : 'facility-title'}>
    <div className="facility-heading">{!embedded && <div><h2 id="facility-title"><MapPin size={22}/> Tìm cơ sở y tế gần bạn</h2><p>Xem địa điểm ngay trong Esmarch và gọi trực tiếp cho cơ sở.</p></div>}<a className="facility-call-115" href="tel:115"><Phone size={17}/> Gọi lại 115</a></div>
    <div className="facility-controls">
      {!embedded && <button type="button" className="secondary-button" onClick={onLocation} disabled={locationStatus === 'loading' || waiting}><MapPin size={17}/>{locationStatus === 'loading' ? 'Đang xác định…' : 'Dùng vị trí của tôi'}</button>}
      <label>Hoặc chọn quận/huyện<select value={district} onChange={event => chooseDistrict(event.target.value)} disabled={!districts.length || waiting}><option value="">Chọn khu vực</option>{districts.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div>
    {locationStatus === 'error' && <p className="facility-feedback" role="status">Không lấy được vị trí. Hãy chọn quận/huyện để tìm cơ sở y tế.</p>}
    {districtError && <p className="facility-feedback" role="status">Chưa tải được danh sách quận/huyện. <button type="button" disabled={waiting} onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {waiting && <p className="facility-feedback" role="status">Đã đạt giới hạn tra cứu. Vui lòng chờ trước khi thử lại; bạn vẫn có thể gọi 115.</p>}
    <div className="facility-workspace">
      <div className="facility-map-panel">
        {!mapAllowed ? <div className="facility-map-placeholder"><MapPin size={30}/><h3>Bản đồ ngay trong trang</h3><p>Khi bật, nền bản đồ được tải từ nhà cung cấp bên ngoài và họ có thể biết vùng bản đồ bạn đang xem. Vị trí tra cứu không được Esmarch lưu lại.</p><button type="button" className="primary-button" onClick={() => setMapAllowed(true)} disabled={waiting}>Hiển thị bản đồ</button></div>
          : configError ? <div className="facility-map-placeholder"><p>Chưa tải được cấu hình bản đồ. Danh sách và số điện thoại vẫn dùng độc lập.</p><button type="button" className="secondary-button" disabled={waiting} onClick={() => setReload(value => value + 1)}>Tải lại bản đồ</button></div>
            : config ? <MapBoundary><Suspense fallback={<p className="facility-feedback">Đang mở bản đồ…</p>}><FacilityMap config={config} facilities={facilities} location={mode === 'nearby' && ready ? location : null} selectedId={selectedId} focusVersion={focusVersion} onSelect={selectFacility}/></Suspense></MapBoundary>
              : <p className="facility-feedback" role="status">Đang tải bản đồ…</p>}
      </div>
      <div className="facility-results" aria-label="Danh sách cơ sở y tế" aria-busy={state === 'loading'}>
        <p className="facility-results-status" role="status">{state === 'loading' ? 'Đang tìm cơ sở y tế…' : state === 'ready' ? facilities.length ? `${facilities.length} cơ sở${mode === 'district' ? ` tại ${district}` : ' gần vị trí của bạn'}` : 'Chưa có cơ sở đã xác minh cho khu vực này. Bạn vẫn có thể gọi 115 hoặc chọn khu vực khác.' : state === 'error' ? error : 'Dùng GPS hoặc chọn quận/huyện để xem cơ sở y tế.'}</p>
        {state === 'error' && <button type="button" className="secondary-button" disabled={waiting} onClick={retrySearch}>Thử lại danh sách</button>}
        <ol>{facilities.map((facility, index) => <li key={facility.id} className={selectedId === facility.id ? 'facility-selected' : ''}>
          <h3><span>{index + 1}</span>{facility.name}</h3>
          <p>{facility.address}</p>
          <div className="facility-tags">{facility.hasEmergency && <span>Có cấp cứu</span>}{facility.hasEmergency && facility.phones.some(p => p.is24h) && <span>Có số trực 24/7</span>}{mode === 'nearby' && formatDistance(facility.distanceMeters) && <span>{formatDistance(facility.distanceMeters)} · {facility.distanceMethod === 'ROAD' ? 'đường bộ ước tính' : 'đường chim bay'}</span>}</div>
          <div className="facility-card-actions"><button type="button" aria-pressed={selectedId === facility.id} disabled={waiting && !mapAllowed} onClick={() => { selectFacility(facility.id); if (!mapAllowed) setMapAllowed(true) }}>Xem trên bản đồ</button>{facility.phones.map((phone, phoneIndex) => <a key={`${phone.number}-${phoneIndex}`} href={`tel:${phone.number}`}><Phone size={14}/>{phone.label}: {phone.number}</a>)}</div>
        </li>)}</ol>
        <p className="facility-footnote">Khoảng cách đường bộ là ước tính trong vùng có dữ liệu; nơi ngoài vùng dùng đường chim bay. Bản đồ chưa tính thời gian di chuyển.</p>
      </div>
    </div>
  </section>
}
