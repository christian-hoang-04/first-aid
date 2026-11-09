import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, HeartPulse, LocateFixed, MapPin, Phone, ShieldCheck, Users, X } from 'lucide-react'
import NearbyHelpers from '../components/NearbyHelpers'
import Navbar from '../components/landing/Navbar'
import { appNav } from '../content/app'
import { cityCenter, distanceMeters } from '../content/facilities'
import { scenarios } from '../data'
import {
  cancelSupportRequest,
  createSupportRequest,
  findNearbyHelpers,
  getSupportRequest,
  SupportApiError,
} from '../support/api'
import '../components/nearby-helpers.css'

const SUPPORTER_FINDER_DEMO_ENABLED = true

const NearbyHelpersMap = SUPPORTER_FINDER_DEMO_ENABLED ? lazy(() => import('../components/NearbyHelpersMap')) : null

const AUDIENCES = [
  { value: 'ADULT', label: 'Người lớn' },
  { value: 'CHILD', label: 'Trẻ em' },
  { value: 'INFANT', label: 'Trẻ sơ sinh' },
]

function createDemoSearchResult(searchNumber, scenarioId) {
  const userLocation = {
    lat: cityCenter.lat + (Math.random() - 0.5) * 0.018,
    lng: cityCenter.lng + (Math.random() - 0.5) * 0.02,
  }
  const skills = scenarioId === 'cardiac' ? ['CPR', 'AED'] : ['FIRST_AID']
  const helpers = Array.from({ length: 6 }, (_, index) => {
    const location = {
      lat: userLocation.lat + (Math.random() - 0.5) * 0.03,
      lng: userLocation.lng + (Math.random() - 0.5) * 0.034,
    }
    return {
      responderId: `demo-helper-${searchNumber}-${index + 1}`,
      displayName: 'Người hỗ trợ gần nhất',
      skills,
      location,
      approximateDistanceMeters: Math.round(distanceMeters(userLocation, location)),
    }
  }).sort((first, second) => first.approximateDistanceMeters - second.approximateDistanceMeters)

  return { userLocation, helper: helpers[0] }
}

function audienceLabel(value) {
  return AUDIENCES.find((item) => item.value === value)?.label || 'người cần trợ giúp'
}

function geolocationMessage(error) {
  if (error?.code === 1) return 'Bạn chưa cho phép dùng vị trí. Chưa có tọa độ nào được gửi lên máy chủ.'
  if (error?.code === 3) return 'Định vị quá lâu. Hãy kiểm tra GPS rồi thử lại.'
  return 'Không lấy được vị trí của bạn. Hãy bật dịch vụ vị trí rồi thử lại.'
}

function HelperConsentDialog({ checked, onCheckedChange, onClose, onConfirm, busy, error, checkboxRef }) {
  return (
    <div className="nearby-helper-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        className="nearby-helper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nearby-helper-dialog-title"
        aria-describedby="nearby-helper-dialog-copy"
        onKeyDown={(event) => { if (event.key === 'Escape' && !busy) onClose() }}
      >
        <button type="button" className="nearby-helper-dialog-close" onClick={onClose} disabled={busy} aria-label="Đóng xác nhận chia sẻ vị trí"><X /></button>
        <span className="nearby-helper-dialog-icon"><MapPin aria-hidden="true" /></span>
        <h2 id="nearby-helper-dialog-title">Chia sẻ vị trí với người nhận?</h2>
        <p id="nearby-helper-dialog-copy">
          Khi một người hỗ trợ chấp nhận, họ sẽ được xem vị trí chính xác của bạn để tìm đến. Yêu cầu hết hạn sau 10 phút;
          nếu hủy, quyền xem vị trí tiếp theo sẽ bị thu hồi, nhưng người nhận có thể đã xem thông tin trước đó.
        </p>
        <label className="nearby-helper-consent-check">
          <input ref={checkboxRef} type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
          <span>Tôi đồng ý gửi yêu cầu và chia sẻ vị trí chính xác với người hỗ trợ chấp nhận.</span>
        </label>
        {error && <p className="nearby-helpers-error" role="alert">{error}</p>}
        <div className="nearby-helper-dialog-actions">
          <button type="button" className="nearby-helper-button nearby-helper-button--quiet" onClick={onClose} disabled={busy}>Để sau</button>
          <button type="button" className="nearby-helper-button nearby-helper-button--primary" onClick={onConfirm} disabled={!checked || busy}>
            {busy ? 'Đang gửi…' : 'Đồng ý gửi yêu cầu'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function NearbyHelpersPage() {
  const [scenarioId, setScenarioId] = useState(SUPPORTER_FINDER_DEMO_ENABLED ? 'choking' : '')
  const [audience, setAudience] = useState('ADULT')
  const [searchConsent, setSearchConsent] = useState(false)
  const [searchState, setSearchState] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [nearby, setNearby] = useState([])
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoMap, setDemoMap] = useState(null)
  const [demoConnectionStatus, setDemoConnectionStatus] = useState('idle')
  const [demoCallStatus, setDemoCallStatus] = useState('idle')
  const [position, setPosition] = useState(null)
  const [supportRequest, setSupportRequest] = useState(null)
  const [requestError, setRequestError] = useState('')
  const [pollError, setPollError] = useState('')
  const [consentOpen, setConsentOpen] = useState(false)
  const [requestConsent, setRequestConsent] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const demoSearchCount = useRef(0)
  const searchAbort = useRef(null)
  const requestAbort = useRef(null)
  const cancelAbort = useRef(null)
  const mounted = useRef(false)
  const consentCheckbox = useRef(null)
  const demoConnectionTimer = useRef(null)
  const demoCallTimer = useRef(null)

  const requestActive = supportRequest?.status === 'OPEN' || supportRequest?.status === 'ACCEPTED'
  const requestEnded = ['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(supportRequest?.status)
  const searchBusy = searchState === 'locating' || searchState === 'searching'
  const visualMode = requestBusy || supportRequest?.status === 'OPEN' ? 'waiting'
    : supportRequest?.status === 'ACCEPTED' ? 'accepted'
      : searchBusy ? 'searching'
        : searchState === 'results' ? 'results'
          : 'idle'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      searchAbort.current?.abort()
      requestAbort.current?.abort()
      cancelAbort.current?.abort()
      window.clearTimeout(demoConnectionTimer.current)
      window.clearTimeout(demoCallTimer.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (consentOpen) consentCheckbox.current?.focus()
  }, [consentOpen])

  useEffect(() => {
    const id = supportRequest?.id
    const token = supportRequest?.requesterToken
    const status = supportRequest?.status
    const expiresAt = supportRequest?.expiresAt
    if (!id || !token || status !== 'OPEN') return undefined

    let disposed = false
    let timer
    const poll = async () => {
      if (Number.isFinite(Date.parse(expiresAt)) && Date.now() >= Date.parse(expiresAt)) {
        setSupportRequest((current) => current?.id === id ? { ...current, status: 'EXPIRED' } : current)
        return
      }
      try {
        const state = await getSupportRequest(id, token)
        if (disposed) return
        setPollError('')
        setSupportRequest((current) => current?.id === id ? { ...current, ...state } : current)
        if (state.status === 'OPEN') timer = window.setTimeout(poll, 4000)
      } catch (error) {
        if (disposed) return
        if (error instanceof SupportApiError && error.status === 404) {
          setSupportRequest((current) => current?.id === id ? { ...current, status: 'EXPIRED' } : current)
          return
        }
        setPollError(error.message || 'Chưa cập nhật được trạng thái yêu cầu.')
        timer = window.setTimeout(poll, 8000)
      }
    }
    timer = window.setTimeout(poll, 2200)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [supportRequest?.id, supportRequest?.requesterToken, supportRequest?.status, supportRequest?.expiresAt])

  const startDemoCall = () => {
    if (!SUPPORTER_FINDER_DEMO_ENABLED || demoConnectionStatus !== 'connected') return
    window.clearTimeout(demoCallTimer.current)
    setDemoCallStatus('calling')
    demoCallTimer.current = window.setTimeout(() => {
      if (mounted.current) setDemoCallStatus('active')
      demoCallTimer.current = null
    }, 1200)
  }

  const endDemoCall = () => {
    window.clearTimeout(demoCallTimer.current)
    demoCallTimer.current = null
    setDemoCallStatus('idle')
  }

  const findHelpers = () => {
    if (!scenarioId) { setSearchError('Hãy chọn tình huống cần hỗ trợ trước khi tìm.'); return }
    if (requestBusy || requestActive) return

    if (SUPPORTER_FINDER_DEMO_ENABLED) {
      demoSearchCount.current += 1
      const result = createDemoSearchResult(demoSearchCount.current, scenarioId)
      searchAbort.current?.abort()
      searchAbort.current = null
      window.clearTimeout(demoConnectionTimer.current)
      window.clearTimeout(demoCallTimer.current)
      demoCallTimer.current = null
      setDemoCallStatus('idle')
      setDemoConnectionStatus('connecting')
      demoConnectionTimer.current = window.setTimeout(() => {
        if (mounted.current) setDemoConnectionStatus('connected')
        demoConnectionTimer.current = null
      }, 10_000)
      setIsDemoMode(true)
      setSearchConsent(false)
      setSearchError('')
      setRequestError('')
      setPollError('')
      setNearby([result.helper])
      setDemoMap(result)
      setPosition(null)
      setSupportRequest(null)
      setRequestConsent(false)
      setConsentOpen(false)
      setSearchState('results')
      return
    }

    if (!searchConsent) { setSearchError('Hãy đồng ý gửi vị trí để tìm người hỗ trợ gần bạn.'); return }
    if (!navigator.geolocation) { setSearchError('Trình duyệt này chưa hỗ trợ định vị. Hãy gọi 115 nếu cần trợ giúp khẩn cấp.'); setSearchState('error'); return }

    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setIsDemoMode(false)
    setSearchError('')
    setRequestError('')
    setPollError('')
    setNearby([])
    setDemoMap(null)
    setSupportRequest(null)
    setSearchState('locating')

    navigator.geolocation.getCurrentPosition(async (result) => {
      if (!mounted.current || controller.signal.aborted) return
      const nextPosition = { lat: result.coords.latitude, lng: result.coords.longitude }
      setPosition(nextPosition)
      setSearchState('searching')
      try {
        const skill = scenarioId === 'cardiac' ? 'CPR' : 'FIRST_AID'
        const responders = await findNearbyHelpers(nextPosition, skill, audience, controller.signal)
        if (!mounted.current || controller.signal.aborted) return
        setNearby(responders)
        setSearchState(responders.length ? 'results' : 'empty')
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return
        setSearchError(error.message || 'Chưa tìm được người hỗ trợ. Hãy thử lại sau.')
        setSearchState('error')
      }
    }, (error) => {
      if (!mounted.current || controller.signal.aborted) return
      setSearchError(geolocationMessage(error))
      setSearchState('error')
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  const createRequest = async () => {
    if (!position || !scenarioId || !requestConsent) return
    requestAbort.current?.abort()
    const controller = new AbortController()
    requestAbort.current = controller
    setRequestBusy(true)
    setRequestError('')
    setPollError('')
    try {
      const created = await createSupportRequest({ position, scenarioId, audience }, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      setSupportRequest(created)
      setPosition(null)
      setConsentOpen(false)
      setRequestConsent(false)
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return
      setRequestError(error.message || 'Chưa gửi được yêu cầu. Hãy gọi 115 nếu cần trợ giúp khẩn cấp.')
    } finally {
      if (mounted.current && !controller.signal.aborted) setRequestBusy(false)
    }
  }

  const cancelRequest = async () => {
    if (!supportRequest?.id || !supportRequest?.requesterToken || !requestActive) return
    cancelAbort.current?.abort()
    const controller = new AbortController()
    cancelAbort.current = controller
    setCancelBusy(true)
    setPollError('')
    try {
      await cancelSupportRequest(supportRequest.id, supportRequest.requesterToken, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      setSupportRequest((current) => current?.id === supportRequest.id ? { ...current, status: 'CANCELLED' } : current)
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return
      setPollError(error.message || 'Chưa hủy được yêu cầu. Hãy thử lại.')
    } finally {
      if (mounted.current && !controller.signal.aborted) setCancelBusy(false)
    }
  }

  const resetRequest = () => {
    setSupportRequest(null)
    setRequestError('')
    setPollError('')
    setSearchState(nearby.length ? 'results' : 'idle')
  }

  const changeScenario = (value) => {
    setIsDemoMode(false)
    setDemoMap(null)
    setScenarioId(value)
    setSearchConsent(false)
    setSearchState('idle')
    setSearchError('')
    setNearby([])
    setPosition(null)
    setSupportRequest(null)
    setRequestError('')
    setPollError('')
  }

  const changeAudience = (value) => {
    setIsDemoMode(false)
    setDemoMap(null)
    setAudience(value)
    setSearchConsent(false)
    setSearchState('idle')
    setSearchError('')
    setNearby([])
    setPosition(null)
    setSupportRequest(null)
    setRequestError('')
    setPollError('')
  }

  const statusMessage = isDemoMode ? `Tìm thấy ${nearby.length} người hỗ trợ gần bạn.`
    : searchState === 'locating' ? 'Đang xác định vị trí của bạn…'
    : searchState === 'searching' ? 'Đang tìm người hỗ trợ phù hợp trong bán kính 5 km…'
      : supportRequest?.status === 'OPEN' ? `Yêu cầu đã được ghi nhận. Đang chờ người hỗ trợ kiểm tra ứng dụng${supportRequest.invitedCount ? ` (${supportRequest.invitedCount} người phù hợp)` : ''}.`
        : supportRequest?.status === 'ACCEPTED' ? 'Một người hỗ trợ đã xác nhận yêu cầu của bạn.'
          : supportRequest?.status === 'CANCELLED' ? 'Yêu cầu đã được hủy.'
            : supportRequest?.status === 'COMPLETED' ? 'Yêu cầu hỗ trợ đã hoàn tất.'
              : supportRequest?.status === 'EXPIRED' ? 'Yêu cầu đã hết hạn, chưa có người xác nhận.'
                : searchState === 'empty' ? 'Chưa có người hỗ trợ phù hợp đang trực trong bán kính 5 km.'
                  : searchState === 'results' ? `Tìm thấy ${nearby.length} người hỗ trợ phù hợp.` : ''

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="container nearby-helpers-page">
        <header className="nearby-helpers-page-head">
          <div>
            <span className="nearby-helpers-eyebrow">MẠNG LƯỚI SƠ CỨU</span>
            <h1>Người hỗ trợ <em>gần bạn</em></h1>
            <p>Tìm người đã xác minh kỹ năng sơ cứu ở gần bạn.</p>
          </div>
          <a className="nearby-helpers-call" href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>
        </header>

        <section className="nearby-helpers-workspace" aria-label="Tìm người hỗ trợ sơ cứu">
          <div className="nearby-helpers-search-card">
            <div className="nearby-helpers-card-heading">
              <span className="nearby-helpers-card-icon"><Users aria-hidden="true" /></span>
              <div><span className="nearby-helpers-eyebrow">{SUPPORTER_FINDER_DEMO_ENABLED ? 'TÌM NGƯỜI HỖ TRỢ' : 'TÌM KIẾM CÓ ĐỒNG Ý'}</span><h2>Ai có thể giúp bạn?</h2></div>
            </div>

            {!SUPPORTER_FINDER_DEMO_ENABLED && (
              <div className="nearby-helpers-fields">
                <label htmlFor="nearby-helper-scenario">Tình huống cần hỗ trợ</label>
                <select id="nearby-helper-scenario" value={scenarioId} onChange={(event) => changeScenario(event.target.value)} disabled={(isDemoMode && !SUPPORTER_FINDER_DEMO_ENABLED) || searchBusy || requestBusy || Boolean(requestActive)}>
                  <option value="">Chọn tình huống</option>
                  {scenarios.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <label htmlFor="nearby-helper-audience">Người cần trợ giúp</label>
                <select id="nearby-helper-audience" value={audience} onChange={(event) => changeAudience(event.target.value)} disabled={(isDemoMode && !SUPPORTER_FINDER_DEMO_ENABLED) || searchBusy || requestBusy || Boolean(requestActive)}>
                  {AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            )}

            {!SUPPORTER_FINDER_DEMO_ENABLED && !isDemoMode && <label className="nearby-helper-search-consent">
              <input type="checkbox" checked={searchConsent} onChange={(event) => setSearchConsent(event.target.checked)} disabled={searchBusy || requestBusy || Boolean(requestActive)} />
              <span>Khi bắt đầu tìm, vị trí hiện tại sẽ được gửi tới SOS NOW để lọc người hỗ trợ phù hợp trong bán kính 5 km. Chưa gửi yêu cầu hay chia sẻ vị trí với người hỗ trợ.</span>
            </label>}

            {(!isDemoMode || SUPPORTER_FINDER_DEMO_ENABLED) && <>
              <button type="button" className="nearby-helper-button nearby-helper-button--primary nearby-helper-search-button" onClick={findHelpers} disabled={(!SUPPORTER_FINDER_DEMO_ENABLED && !searchConsent) || searchBusy || requestBusy || Boolean(requestActive)}>
                {SUPPORTER_FINDER_DEMO_ENABLED ? <Users aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
                {SUPPORTER_FINDER_DEMO_ENABLED
                  ? isDemoMode ? 'Tìm lại người hỗ trợ' : 'Tìm người hỗ trợ gần bạn'
                  : searchState === 'locating' ? 'Đang xác định vị trí…' : searchState === 'searching' ? 'Đang tìm người hỗ trợ…' : searchState === 'results' ? 'Tìm lại người hỗ trợ' : 'Chia sẻ vị trí và tìm'}
                {searchState !== 'locating' && searchState !== 'searching' && <ChevronRight aria-hidden="true" />}
              </button>
            </>}

            {statusMessage && <p className={`nearby-helpers-status${searchState === 'error' ? ' is-error' : ''}`} role="status"><span className="nearby-helpers-status-dot" />{statusMessage}</p>}
            {SUPPORTER_FINDER_DEMO_ENABLED && isDemoMode && searchState === 'results' && nearby.length > 0 && (
              <section className={`nearby-helpers-connection${demoConnectionStatus === 'connected' ? ' is-connected' : ''}`} aria-label="Kết nối người hỗ trợ">
                <span className="nearby-helpers-connection-icon"><Users aria-hidden="true" /></span>
                <div>
                  <h3>Tìm người hỗ trợ</h3>
                  <p role="status" aria-live="polite">
                    {demoConnectionStatus === 'connected'
                      ? <Check className="nearby-helpers-connection-success" aria-hidden="true" />
                      : <span className="nearby-helpers-connection-dot" aria-hidden="true" />}
                    {demoConnectionStatus === 'connected' ? 'Kết nối thành công' : 'Đang kết nối với người hỗ trợ'}
                  </p>
                </div>
                {demoConnectionStatus === 'connected' && (
                  <div className="nearby-helpers-demo-call">
                    {demoCallStatus === 'idle' ? (
                      <button type="button" className="nearby-helper-button nearby-helper-button--primary" onClick={startDemoCall}>
                        <Phone aria-hidden="true" /> Gọi người hỗ trợ
                      </button>
                    ) : (
                      <div className="nearby-helpers-demo-call-panel">
                        <span className="nearby-helpers-demo-call-icon"><Phone aria-hidden="true" /></span>
                        <div className="nearby-helpers-demo-call-copy">
                          <strong>{demoMap?.helper?.displayName || 'Người hỗ trợ gần nhất'}</strong>
                          <p role="status" aria-live="polite">
                            {demoCallStatus === 'calling' ? 'Đang gọi người hỗ trợ mô phỏng…' : 'Cuộc gọi mô phỏng đang diễn ra'}
                          </p>
                        </div>
                        <button type="button" className="nearby-helper-button nearby-helper-button--quiet nearby-helpers-demo-call-end" onClick={endDemoCall}>
                          <Phone aria-hidden="true" /> Kết thúc
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
            {searchError && <p className="nearby-helpers-error" role="alert">{searchError}</p>}
            {!isDemoMode && searchState === 'results' && !supportRequest && (
              <button type="button" className="nearby-helper-button nearby-helper-button--primary nearby-helpers-request-button" onClick={() => { setRequestConsent(false); setRequestError(''); setConsentOpen(true) }}>
                <HeartPulse aria-hidden="true" /> Gửi tín hiệu tới {nearby.length} người phù hợp
              </button>
            )}

            {!SUPPORTER_FINDER_DEMO_ENABLED && <p className="nearby-helpers-privacy"><ShieldCheck aria-hidden="true" /> Tọa độ chỉ được dùng để tìm người phù hợp; không lưu trong trình duyệt.</p>}
          </div>

          <aside className={`nearby-helpers-visual-card${isDemoMode && demoMap ? ' nearby-helpers-visual-card--map' : ''}`} aria-label={isDemoMode && demoMap ? 'Bản đồ người hỗ trợ gần bạn' : 'Tìm người hỗ trợ'}>
            {isDemoMode && demoMap
              ? <Suspense fallback={null}><NearbyHelpersMap userLocation={demoMap.userLocation} helper={demoMap.helper} /></Suspense>
              : <>
                <NearbyHelpers mode={visualMode} count={nearby.length} />
                {!SUPPORTER_FINDER_DEMO_ENABLED && <p className="nearby-helpers-visual-note">Hình minh họa quá trình kết nối; không hiển thị vị trí hay đường đi trực tiếp của người hỗ trợ.</p>}
              </>}
          </aside>
        </section>

        {searchState === 'empty' && !supportRequest && (
          <section className="nearby-helpers-empty" aria-live="polite">
            <span className="nearby-helpers-empty-icon"><Users aria-hidden="true" /></span>
            <div><h2>Chưa có người hỗ trợ đang trực</h2><p>Hãy gọi 115 nếu cần cấp cứu. Bạn có thể thử tìm lại sau.</p></div>
            <a href="tel:115" className="nearby-helper-button nearby-helper-button--emergency"><Phone aria-hidden="true" /> Gọi 115</a>
          </section>
        )}

        {supportRequest && (
          <section className={`nearby-helpers-request nearby-helpers-request--${supportRequest.status.toLowerCase()}`} aria-labelledby="nearby-helpers-request-title" aria-live="polite">
            <div className="nearby-helpers-request-heading">
              <span className="nearby-helpers-request-icon"><HeartPulse aria-hidden="true" /></span>
              <div><span className="nearby-helpers-eyebrow">YÊU CẦU HỖ TRỢ</span><h2 id="nearby-helpers-request-title">{supportRequest.status === 'ACCEPTED' ? 'Đã có người xác nhận' : supportRequest.status === 'OPEN' ? 'Đang chờ phản hồi' : supportRequest.status === 'CANCELLED' ? 'Đã hủy yêu cầu' : supportRequest.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Yêu cầu đã hết hạn'}</h2></div>
            </div>

            {supportRequest.status === 'ACCEPTED' && supportRequest.responder ? (
              <div className="nearby-helpers-accepted">
                <p><Check aria-hidden="true" /> <strong>{supportRequest.responder.displayName}</strong> đã nhận yêu cầu sơ cứu cho {audienceLabel(audience).toLowerCase()}.</p>
                {supportRequest.responder.contactPhone && <a className="nearby-helper-button nearby-helper-button--primary" href={`tel:${supportRequest.responder.contactPhone.replace(/[^\d+]/g, '')}`}><Phone aria-hidden="true" /> Gọi người hỗ trợ</a>}
                <p className="nearby-helpers-results-note">Không có định vị trực tiếp hay thời gian đến dự kiến. Nếu cần xe cấp cứu, gọi 115.</p>
              </div>
            ) : supportRequest.status === 'OPEN' ? (
              <div className="nearby-helpers-waiting">
                <p><span className="nearby-helpers-waiting-pulse" /> Yêu cầu đã được ghi nhận. Người hỗ trợ cần đang kiểm tra ứng dụng để thấy tín hiệu.</p>
                <p className="nearby-helpers-dispatch-note">Thông báo tự động chưa được kết nối; không chờ yêu cầu này thay cho 115.</p>
              </div>
            ) : (
              <p className="nearby-helpers-results-note">Nếu vẫn cần trợ giúp, hãy gọi 115 hoặc bắt đầu một lần tìm kiếm mới.</p>
            )}

            {pollError && supportRequest.status === 'OPEN' && <p className="nearby-helpers-error" role="alert">{pollError}</p>}
            {requestError && <p className="nearby-helpers-error" role="alert">{requestError}</p>}
            {requestActive && <button type="button" className="nearby-helper-button nearby-helper-button--quiet nearby-helpers-cancel-button" onClick={cancelRequest} disabled={cancelBusy}>
              {cancelBusy ? 'Đang hủy…' : 'Hủy yêu cầu'}
            </button>}
            {requestEnded && <button type="button" className="nearby-helper-button nearby-helper-button--quiet nearby-helpers-reset-button" onClick={resetRequest}>Quay lại người hỗ trợ gần bạn</button>}
          </section>
        )}

        <p className="nearby-helpers-footer-note"><Phone aria-hidden="true" /> Người hỗ trợ cộng đồng có thể phản hồi chậm hoặc không có mặt. Khi nguy hiểm tính mạng, gọi <a href="tel:115">115</a> ngay.</p>
      </main>

      {consentOpen && <HelperConsentDialog
        checked={requestConsent}
        onCheckedChange={setRequestConsent}
        onClose={() => { if (!requestBusy) { setConsentOpen(false); setRequestConsent(false) } }}
        onConfirm={createRequest}
        busy={requestBusy}
        error={requestError}
        checkboxRef={consentCheckbox}
      />}
    </div>
  )
}
