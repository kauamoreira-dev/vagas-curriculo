import { Route, Routes } from 'react-router-dom'
import { AppLayout, SiteLayout } from '@/components/layout/Layouts'
import { Curriculos } from '@/pages/Curriculos'
import { Editor } from '@/pages/Editor'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'
import { Templates } from '@/pages/Templates'

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="modelos" element={<Templates />} />
        <Route path="curriculos" element={<Curriculos />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<AppLayout />}>
        {/* /editor abre o currículo mais recente (ou um novo); /editor/:id, um específico */}
        <Route path="editor/:id?" element={<Editor />} />
      </Route>
    </Routes>
  )
}

export default App
