// Botão de ação com ícone SVG + tooltip nativo (title)
export default function IconBtn({ onClick, title, color = 'text-gray-400', children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors hover:bg-gray-800/60 ${color}`}
    >
      {children}
    </button>
  )
}

// ── Ícones reutilizáveis ──────────────────────────────────────────────────────

export function IconEditar(props) {
  return (
    <IconBtn color="text-blue-400 hover:text-blue-300" title="Editar" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </IconBtn>
  )
}

export function IconExcluir(props) {
  return (
    <IconBtn color="text-red-400 hover:text-red-300" title="Excluir" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </IconBtn>
  )
}

export function IconJornada(props) {
  return (
    <IconBtn color="text-emerald-400 hover:text-emerald-300" title="Configurar Jornada" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </IconBtn>
  )
}

export function IconLocais(props) {
  return (
    <IconBtn color="text-yellow-400 hover:text-yellow-300" title="Configurar Locais" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </IconBtn>
  )
}

export function IconVer(props) {
  return (
    <IconBtn color="text-emerald-400 hover:text-emerald-300" title="Ver foto" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </IconBtn>
  )
}

export function IconSenha(props) {
  return (
    <IconBtn color="text-purple-400 hover:text-purple-300" title="Alterar senha" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </IconBtn>
  )
}

export function IconQR(props) {
  return (
    <IconBtn color="text-teal-400 hover:text-teal-300" title="QR Code" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 21h4M21 14v4"/>
      </svg>
    </IconBtn>
  )
}

export function IconBanco(props) {
  return (
    <IconBtn color="text-orange-400 hover:text-orange-300" title="Ajustar banco de horas" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
        <line x1="12" y1="3" x2="12" y2="1"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="3" y1="12" x2="1" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
      </svg>
    </IconBtn>
  )
}

export function IconAjustar(props) {
  return (
    <IconBtn color="text-yellow-400 hover:text-yellow-300" title="Ajustar registro" {...props}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    </IconBtn>
  )
}
