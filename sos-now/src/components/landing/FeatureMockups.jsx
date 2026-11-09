import { Check, Lock, Mic, Play } from 'lucide-react'

// Khung minh họa giao diện app cho phần "Tính năng", dựng bằng HTML để luôn sắc nét

export function VoiceMock() {
  return (
    <div className="mock mock-voice">
      <p className="mock-caption">Hướng dẫn bằng giọng nói</p>
      <p className="voice-prompt">Tôi đang lắng nghe. Hãy mô tả điều bạn thấy, tôi sẽ hướng dẫn bạn từng bước.</p>
      <div className="voice-status">
        <span className="voice-wave" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ '--i': i }} />)}</span>
        <strong>Đang nghe<span className="voice-dots" aria-hidden="true">...</span></strong>
        <small>Tiếng Việt</small>
      </div>
      <div className="voice-input">
        <span className="voice-orb" aria-hidden="true" />
        <span className="voice-placeholder">Trò chuyện với trợ lý</span>
        <span className="voice-speak"><Mic aria-hidden="true" /> Nói</span>
      </div>
    </div>
  )
}

const lessons = [
  { title: 'Đánh giá hiện trường an toàn', meta: '5 phút', state: 'done' },
  { title: 'Ép tim ngoài lồng ngực (CPR)', meta: '8 phút', state: 'done' },
  { title: 'Xử trí hóc dị vật', meta: '6 phút', state: 'current' },
  { title: 'Nhận biết đột quỵ FAST', meta: '7 phút', state: 'locked' }
]
const lessonIcon = { done: Check, current: Play, locked: Lock }

export function CourseMock() {
  return (
    <div className="mock mock-course">
      <div className="course-head">
        <p className="mock-caption">Khóa học sơ cứu cơ bản</p>
        <span className="course-badge">Online</span>
      </div>
      <div className="course-progress">
        <span>Tiến độ 2/4 bài</span>
        <strong>50%</strong>
      </div>
      <span className="course-bar" aria-hidden="true"><span /></span>
      <ul className="course-lessons">
        {lessons.map(({ title, meta, state }) => {
          const Icon = lessonIcon[state]
          return (
            <li key={title} className={`lesson lesson-${state}`}>
              <span className="lesson-icon"><Icon aria-hidden="true" /></span>
              <span className="lesson-title">{title}</span>
              <small>{meta}</small>
            </li>
          )
        })}
      </ul>
      <div className="course-quiz">
        <span><strong>Quiz nhanh</strong><small>5 câu · khoảng 3 phút</small></span>
        <span className="course-quiz-button">Làm quiz</span>
      </div>
    </div>
  )
}

export function SosMock() {
  return (
    <div className="mock mock-sos">
      <p className="sos-question">Bạn đang gặp nguy hiểm?</p>
      <p className="sos-hint">Nhấn nút bên dưới, trợ giúp sẽ sớm tìm đến bạn.</p>
      <div className="sos-stage">
        <span className="sos-ring" aria-hidden="true" />
        <span className="sos-ring sos-ring-2" aria-hidden="true" />
        <span className="sos-button">SOS</span>
      </div>
    </div>
  )
}
