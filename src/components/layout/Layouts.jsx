import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'

// Rola para o topo ao trocar de página, ou para a âncora (#id) quando houver.
function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ block: 'start' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

// Páginas institucionais: header completo e footer.
export function SiteLayout() {
  return (
    <>
      <ScrollManager />
      <Header />
      <main id="conteudo">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

// Área de aplicação (editor): ocupa a tela inteira, sem footer.
export function AppLayout() {
  return (
    <>
      <ScrollManager />
      <Outlet />
    </>
  )
}
