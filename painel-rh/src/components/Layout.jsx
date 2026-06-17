import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { limparSessao } from '../api'

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/registros', label: 'Registros' },
  { to: '/jornada', label: 'Jornada' },
  { to: '/colaboradores', label: 'Colaboradores' },
  { to: '/locais', label: 'Locais' },
  { to: '/empresas', label: 'Empresas' },
  { to: '/modelos-jornada', label: 'Tipos de Jornada' },
]

export default function Layout() {
  const navigate = useNavigate()

  function sair() {
    limparSessao()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 bg-gray-900 flex flex-col border-r border-gray-800">
        <div className="px-5 py-6 border-b border-gray-800">
          <span className="text-emerald-400 font-bold text-lg">CAJU ID</span>
          <p className="text-xs text-gray-500 mt-1">Painel RH</p>
        </div>
        <nav className="flex-1 py-4">
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
        <button
          onClick={sair}
          className="mx-4 mb-6 py-2 rounded bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 text-sm transition-colors"
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
