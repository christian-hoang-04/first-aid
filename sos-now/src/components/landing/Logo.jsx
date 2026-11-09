import { Link } from 'react-router-dom'
import logoMark from '../../assets/logo-mark.webp'

export default function Logo() {
  return (
    <Link className="logo" to="/" aria-label="SOSNOW - Trang chủ">
      <img src={logoMark} alt="" width="46" height="62" />
      <span>SOS NOW</span>
    </Link>
  )
}
