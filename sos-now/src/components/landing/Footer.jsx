import { Link } from 'react-router-dom'
import Logo from './Logo'
import { footer } from '../../content/landing'

export default function Footer() {
  const { developer, contactLabel, contact, columns } = footer
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Logo />
          <p>Được phát triển: <strong>{developer}</strong></p>
          <p>{contactLabel} <span className="footer-muted">{contact}</span></p>
        </div>
        <nav className="footer-columns" aria-label="Liên kết cuối trang">
          {columns.map((column) => (
            <div key={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {/* Link tới mục trên landing (#) dùng thẻ a để trình duyệt tự cuộn tới mục */}
                {column.links.map((link) => <li key={link.label}>{link.to.includes('#') ? <a href={link.to}>{link.label}</a> : <Link to={link.to}>{link.label}</Link>}</li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} SOS NOW · {developer}</span>
        <span>Trong nguy hiểm tính mạng, hãy gọi <a href="tel:115">115</a>.</span>
      </div>
    </footer>
  )
}
