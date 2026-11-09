import { useEffect } from 'react'
import Navbar from '../components/landing/Navbar'
import { appNav } from '../content/app'

// Trang rỗng dùng chung: tiêu đề kèm mô tả chức năng, hoặc dòng Coming Soon với tính năng chưa làm
export default function AppPage({ title, description, comingSoon = false }) {
  // Chuyển trang từ cuối landing thì mở trang mới từ đầu
  useEffect(() => { window.scrollTo(0, 0) }, [title])

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className={`container app-page ${comingSoon ? 'app-page-soon' : ''}`}>
        <h1 className="app-title">{title}</h1>
        {comingSoon
          ? <p className="app-soon">Coming Soon</p>
          : <p className="app-description">{description}</p>}
        <p className="app-emergency">Trong nguy hiểm tính mạng, hãy gọi ngay <a href="tel:115">115</a>.</p>
      </main>
    </div>
  )
}
