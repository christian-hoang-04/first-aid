import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { navLinks } from '../../content/landing'

// Mặc định là menu cuộn tới các mục của landing; các trang app truyền `appLinks` để chuyển trang
export default function Navbar({ appLinks }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef(null)
  const close = () => setOpen(false)

  // Kéo xuống thì thanh menu chuyển sang dạng thẻ vàng bo góc
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onClick = (event) => { if (!menuRef.current?.contains(event.target)) close() }
    const onKey = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className={`navbar ${appLinks ? 'navbar-plain' : ''} ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Logo />
        <div className="nav-wrap" ref={menuRef}>
          <button className="menu-toggle" aria-expanded={open} aria-controls="main-nav" aria-label={open ? 'Đóng menu' : 'Mở menu'} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
          <nav id="main-nav" className={`nav ${open ? 'open' : ''}`} aria-label="Điều hướng chính">
            <ul className="nav-links">
              {appLinks
                ? appLinks.map((link) => <li key={link.path}><NavLink to={link.path} onClick={close}>{link.label}</NavLink></li>)
                : navLinks.map((link) => <li key={link.id}><a href={`#${link.id}`} onClick={close}>{link.label}</a></li>)}
            </ul>
            <div className="nav-auth">
              <Link className="sign-up" to="/dang-ky" onClick={close}>Sign up</Link>
              <Link className="button button-primary sign-in" to="/dang-nhap" onClick={close}>Sign in</Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
