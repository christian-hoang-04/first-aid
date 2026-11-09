import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import AppPage from './pages/AppPage'
import SosPage from './pages/SosPage'
import VoicePage from './pages/VoicePage'
import FacilitiesPage from './pages/FacilitiesPage'
import NearbyHelpersPage from './pages/NearbyHelpersPage'
import Guide3DPage from './pages/Guide3DPage'
import { guides3d } from './content/guides3d'
import { appPages, appStart, authPages } from './content/app'
import './styles/tokens.css'
import './styles/landing.css'
import './styles/problem.css'
import './styles/features.css'
import './styles/pricing.css'
import './styles/team.css'
import './styles/faq.css'
import './styles/cta-footer.css'
import './styles/app.css'
import './styles/sos.css'
import './styles/voice.css'
import './styles/facilities-page.css'
import './styles/responsive-scale.css'
import './styles/mobile-experience.css'

// Trang đã có giao diện thật; các trang khác vẫn là trang rỗng chỉ có mô tả
const builtPages = {
  '/app/sos': SosPage,
  '/app/co-so-y-te': FacilitiesPage,
  '/app/ai-voice': VoicePage,
  '/app/aed': NearbyHelpersPage,
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Navigate to={appStart} replace />} />
        {[...appPages, ...authPages].map((page) => {
          const Page = builtPages[page.path]
          return <Route key={page.path} path={page.path} element={Page ? <Page /> : <AppPage {...page} />} />
        })}
        {guides3d.map((guide) => <Route key={guide.path} path={guide.path} element={<Guide3DPage title={guide.title} file={guide.file} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
