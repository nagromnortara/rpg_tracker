import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/themes.css'
import App from './App'

document.documentElement.setAttribute('data-theme', 'fallout1945')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/rpg_tracker">
      <App />
    </BrowserRouter>
  </StrictMode>
)
