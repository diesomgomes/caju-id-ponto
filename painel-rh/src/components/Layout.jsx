import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { limparSessao, getMe } from '../api'

const NAV_TODOS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/registros', label: 'Registros' },
  { to: '/jornada', label: 'Jornada' },
  { to: '/colaboradores', label: 'Colaboradores' },
  { to: '/locais', label: 'Locais' },
  { to: '/empresas', label: 'Empresas' },
  { to: '/modelos-jornada', label: 'Tipos de Jornada' },
  { to: '/usuarios', label: 'Usuários RH' },
]

const LABEL_PAPEL = { admin: 'Administrador', rh: 'Gestão' }
const COR_PAPEL = {
  admin: 'text-purple-400 bg-purple-900/30',
  rh: 'text-emerald-400 bg-emerald-900/30',
}

export default function Layout() {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)

  useEffect(() => {
    getMe().then(setMe).catch(() => {})
  }, [])

  function sair() {
    limparSessao()
    navigate('/login')
  }

  const nav = NAV_TODOS

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 bg-gray-900 flex flex-col border-r border-gray-800">
        <div className="px-5 py-6 border-b border-gray-800">
          <span className="text-emerald-400 font-bold text-lg">CAJU ID</span>
          <p className="text-xs text-gray-500 mt-1">Painel RH</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400 border-r-2 border-emerald-400'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Info do usuário logado */}
        <div className="mx-3 mb-3 p-3 bg-gray-800 rounded-xl border border-gray-700">
          {me ? (
            <>
              <p className="text-sm font-semibold text-gray-100 truncate">{me.nome}</p>
              <p className="text-xs text-gray-500 truncate mb-2">{me.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COR_PAPEL[me.papel] || ''}`}>
                {LABEL_PAPEL[me.papel] || me.papel}
              </span>
            </>
          ) : (
            <div className="h-10 animate-pulse bg-gray-700 rounded" />
          )}
        </div>

        <button
          onClick={sair}
          className="mx-4 mb-5 py-2 rounded bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 text-sm transition-colors"
        >
          Sair
        </button>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
