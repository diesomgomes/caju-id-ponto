import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { limparSessao, getMe, getEmpresas } from '../api'

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', label: 'Painel de controle' },
      { to: '/jornada', label: 'Acompanhamento de jornada' },
      { to: '/colaboradores', label: 'Colaboradores' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { to: '/locais', label: 'Localizações' },
      { to: '/empresas', label: 'Cadastro de empresas' },
      { to: '/modelos-jornada', label: 'Cadastro de Jornadas' },
      { to: '/usuarios', label: 'Cadastro de usuários' },
      { to: '/feriados', label: 'Cadastro de feriados' },
    ],
  },
]

const PAGE_LABELS = {
  '/dashboard': 'Painel de controle',
  '/jornada': 'Acompanhamento de jornada',
  '/colaboradores': 'Colaboradores',
  '/locais': 'Localizações',
  '/empresas': 'Cadastro de empresas',
  '/modelos-jornada': 'Cadastro de Jornadas',
  '/usuarios': 'Cadastro de usuários',
  '/feriados': 'Cadastro de feriados',
}

const LABEL_PAPEL = { admin: 'Administrador', rh: 'Gestão', gestor: 'Gestão' }

function setFavicon(url) {
  let link = document.querySelector("link[rel~='icon']")
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  link.href = url
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [me, setMe] = useState(null)
  const [empresa, setEmpresa] = useState(null)

  useEffect(() => {
    Promise.all([getMe(), getEmpresas()]).then(([me, emps]) => {
      setMe(me)
      if (me?.empresa_id) {
        const emp = emps.find(e => e.id === me.empresa_id)
        if (emp) {
          setEmpresa(emp)
          if (emp.logo_url) setFavicon(emp.logo_url)
        }
      }
    }).catch(() => {})
  }, [])

  function sair() {
    limparSessao()
    navigate('/login')
  }

  const pageLabel = PAGE_LABELS[location.pathname] || 'CAJU ID'

  return (
    <div className="flex h-screen" style={{ background: '#f5f5f7' }}>

      {/* ── Sidebar ── */}
      <aside className="w-52 flex flex-col flex-shrink-0" style={{ background: '#0c0c0f' }}>

        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            {empresa?.logo_url ? (
              <img src={empresa.logo_url} alt="logo"
                className="w-7 h-7 rounded-lg object-contain flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)' }} />
            ) : (
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">C</span>
              </div>
            )}
            <div>
              <p className="text-white text-sm font-medium leading-tight">
                {empresa?.nome ? empresa.nome.split(' ')[0] : 'CAJU ID'}
              </p>
              <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>Ponto Eletrônico</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-2">
              <p
                className="px-5 py-1.5 text-xs font-medium uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}
              >
                {section.label}
              </p>
              {section.items.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center px-5 py-2 text-sm transition-colors ${
                      isActive ? 'sb-nav-active' : 'sb-nav-idle'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r bg-emerald-400"
                          style={{ width: 3, height: 18 }}
                        />
                      )}
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Usuário + Sair */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {me ? (
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {me.nome?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate leading-tight">{me.nome}</p>
                <p className="text-xs truncate leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {LABEL_PAPEL[me.papel] || me.papel}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-9 rounded-lg mb-3 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          )}
          <button
            onClick={sair}
            className="w-full py-1.5 rounded-lg text-xs transition-colors sb-sair-btn"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-12 bg-white flex items-center px-6 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <span className="text-xs" style={{ color: '#a1a1aa' }}>CAJU ID</span>
          <span className="text-xs" style={{ color: '#d4d4d8' }}>/</span>
          <span className="text-xs font-medium" style={{ color: '#3f3f46' }}>{pageLabel}</span>
        </header>

        {/* Conteúdo das páginas */}
        <main className="flex-1 overflow-auto p-6 rh-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
