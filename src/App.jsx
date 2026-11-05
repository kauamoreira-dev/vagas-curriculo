import { Route, Routes } from 'react-router-dom'
import { AppLayout, SiteLayout } from '@/components/layout/Layouts'
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
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="editor" element={<Editor />} />
      </Route>
    </Routes>
  )
}

export default App
