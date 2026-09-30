import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/index.css'
import App from './app/App.tsx'
import { CreatureCatalog } from './features/catalog/CreatureCatalog.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.replace(/\/+$/, '') === '/creatures' ? <CreatureCatalog /> : <App />}
  </StrictMode>,
)
