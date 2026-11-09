import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Maximize2, Phone } from 'lucide-react'
import Navbar from '../components/landing/Navbar'
import { appNav } from '../content/app'

// Màn hình hướng dẫn 3D: nhúng file HTML độc lập vào khung sandbox (chỉ cho chạy script,
// không cho truy cập trang chính), kèm thanh quay lại AI Voice và nút gọi 115
export default function Guide3DPage({ title, file }) {
  useEffect(() => { window.scrollTo(0, 0) }, [file])

  return (
    <div className="page guide3d">
      <Navbar appLinks={appNav} />
      <div className="guide3d-bar">
        <Link className="guide3d-back" to="/app/ai-voice"><ArrowLeft aria-hidden="true" /> AI Voice</Link>
        <h1 className="guide3d-title">{title}</h1>
        {/* Mở riêng file 3D khi khung nhúng bị chặn hoặc muốn xem toàn màn hình */}
        <a className="guide3d-open" href={file} target="_blank" rel="noreferrer" aria-label="Mở toàn màn hình"><Maximize2 aria-hidden="true" /></a>
        <a className="guide3d-call" href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>
      </div>
      <iframe className="guide3d-frame" src={file} title={title} sandbox="allow-scripts" allow="fullscreen" />
    </div>
  )
}
