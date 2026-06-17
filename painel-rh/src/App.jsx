import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getSessao } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Registros from './pages/Registros'
import Jornada from './pages/Jornada'
import Colaboradores from './pages/Colaboradores'
import Locais from './pages/Locais'
import Empresas from './pages/Empresas'
import ModelosJornada from './pages/ModelosJornada'
import Usuarios from './pages/Usuarios'

function RotaProtegida({ children }) {
  return getSessao() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RotaProtegida><Layout /></RotaProtegida>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="registros" element={<Registros />} />
          <Route path="jornada" element={<Jornada />} />
          <Route path="colaboradores" element={<Colaboradores />} />
          <Route path="locais" element={<Locais />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="modelos-jornada" element={<ModelosJornada />} />
          <Route path="usuarios" element={<Usuarios />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
