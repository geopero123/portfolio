import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { ProjectViewer } from './pages/ProjectViewer'
import { NotFound } from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/work/:slug" element={<ProjectViewer />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
