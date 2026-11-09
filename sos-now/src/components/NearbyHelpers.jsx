import { HeartPulse } from 'lucide-react'

function HelperHero({ className = '' }) {
  return (
    <span className={`nearby-helpers-hero ${className}`} aria-hidden="true">
      <svg viewBox="0 0 56 56" focusable="false">
        <circle className="nearby-helpers-hero-bg" cx="28" cy="28" r="26" />
        <path className="nearby-helpers-cape" d="M17 30 9 47l19-5 19 5-8-17Z" />
        <path className="nearby-helpers-shirt" d="M17 28c1-5 5-8 11-8s10 3 11 8l4 14H13Z" />
        <circle className="nearby-helpers-face" cx="28" cy="17" r="9" />
        <path className="nearby-helpers-hair" d="M19 17c0-7 4-11 9-11 6 0 10 4 10 11l-3 1-2-5-4 3-7-1Z" />
        <path className="nearby-helpers-cross" d="M27 27h3v4h4v3h-4v4h-3v-4h-4v-3h4Z" />
      </svg>
    </span>
  )
}

export default function NearbyHelpers({ mode = 'idle', count = 0 }) {
  const hasHelpers = count > 0
  const heroCount = mode === 'searching' ? 3 : mode === 'waiting' ? Math.min(Math.max(count, 1), 3)
    : mode === 'accepted' ? 1 : ['results'].includes(mode) && hasHelpers ? Math.min(count, 3) : 0

  return (
    <div className={`nearby-helpers-art is-${mode}`} aria-hidden="true">
      <div className="nearby-helpers-radar">
        <span className="nearby-helpers-ring nearby-helpers-ring--outer" />
        <span className="nearby-helpers-ring nearby-helpers-ring--inner" />
        <span className="nearby-helpers-center"><HeartPulse /></span>
        {Array.from({ length: heroCount }, (_, index) => (
          <span className={`nearby-helpers-orbit nearby-helpers-orbit--${index + 1}`} key={index}>
            <HelperHero className={`nearby-helpers-hero--${index + 1}`} />
          </span>
        ))}
      </div>
      <span className="nearby-helpers-art-caption">
        {mode === 'searching' ? 'Đang dò tín hiệu quanh bạn'
          : mode === 'waiting' ? 'Đang chờ người hỗ trợ phản hồi'
            : mode === 'accepted' ? 'Đã có người nhận tín hiệu'
              : mode === 'results' ? `${count} người hỗ trợ phù hợp`
                : 'Mạng lưới sơ cứu gần bạn'}
      </span>
    </div>
  )
}
