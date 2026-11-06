import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { resumeStore } from './services/resumeStore'

// Converte o rascunho único das versões anteriores para a lista de currículos (uma vez só).
// Uma falha inesperada não pode impedir o app de abrir: o rascunho antigo continua intacto.
try {
  resumeStore.migrateLegacyDraft()
} catch (error) {
  console.error('Falha ao migrar o rascunho antigo', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
