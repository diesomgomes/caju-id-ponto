import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const ICONES = {
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alerta:  <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 18h.01" /></>,
  lixeira: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
  check:   <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  erro:    <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
}

const TEMAS = {
  info:   { cor: '#059669', clara: '#ecfdf5', grad: 'linear-gradient(135deg,#34d399 0%,#059669 100%)', icone: 'relogio' },
  aviso:  { cor: '#d97706', clara: '#fffbeb', grad: 'linear-gradient(135deg,#fbbf24 0%,#d97706 100%)', icone: 'alerta' },
  perigo: { cor: '#dc2626', clara: '#fef2f2', grad: 'linear-gradient(135deg,#f87171 0%,#dc2626 100%)', icone: 'lixeira' },
  sucesso: { cor: '#059669', clara: '#ecfdf5', grad: 'linear-gradient(135deg,#34d399 0%,#059669 100%)', icone: 'check' },
  erro:   { cor: '#dc2626', clara: '#fef2f2', grad: 'linear-gradient(135deg,#f87171 0%,#dc2626 100%)', icone: 'erro' },
}

function Dialogo({ titulo, mensagem, itens = [], tipo = 'info', icone, confirmarLabel = 'Confirmar', cancelarLabel = 'Cancelar', unico = false, concluir }) {
  const tema = TEMAS[tipo] || TEMAS.info
  const [saindo, setSaindo] = useState(false)
  const btnRef = useRef()

  function sair(ok) {
    if (saindo) return
    setSaindo(true)
    setTimeout(() => concluir(ok), 160)
  }

  useEffect(() => {
    btnRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') sair(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`dlg-backdrop${saindo ? ' dlg-saindo' : ''}`} onClick={() => sair(false)}>
      <div className="dlg-card" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        {/* Faixa colorida com círculos decorativos */}
        <div style={{ height: 92, background: tema.grad, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }} />
          <div style={{ position: 'absolute', bottom: -50, right: -20, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ position: 'absolute', top: 18, right: 90, width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />
        </div>

        {/* Ícone sobreposto à faixa */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -34, position: 'relative', zIndex: 1 }}>
          <div className="dlg-icone" style={{ '--dlg-cor': tema.cor, background: '#fff', color: tema.cor }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {ICONES[icone || tema.icone]}
            </svg>
          </div>
        </div>

        <div style={{ padding: '14px 24px 24px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#18181b' }}>{titulo}</h3>
          {mensagem && <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: '#71717a' }}>{mensagem}</p>}

          {itens.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: '12px 14px', background: tema.clara, borderRadius: 14, textAlign: 'left', display: 'grid', gap: 9 }}>
              {itens.map((t, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#3f3f46' }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: tema.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {!unico && (
              <button type="button" onClick={() => sair(false)} className="dlg-btn"
                style={{ background: '#f4f4f5', color: '#52525b' }}>
                {cancelarLabel}
              </button>
            )}
            <button type="button" ref={btnRef} onClick={() => sair(true)} className="dlg-btn dlg-btn-ok"
              style={{ background: tema.grad, color: '#fff', boxShadow: `0 6px 16px -4px ${tema.cor}99` }}>
              {confirmarLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Substitui window.confirm por um diálogo estilizado.
 * Retorna uma Promise<boolean>: `if (!(await confirmar({ ... }))) return`
 * Opções: titulo, mensagem, itens[], tipo ('info' | 'aviso' | 'perigo'),
 * icone ('relogio' | 'alerta' | 'lixeira'), confirmarLabel, cancelarLabel.
 */
export function confirmar(opcoes) {
  return new Promise(resolve => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    const concluir = ok => {
      root.unmount()
      el.remove()
      resolve(ok)
    }
    root.render(<Dialogo {...opcoes} concluir={concluir} />)
  })
}

/** Confirmação de exclusão (vermelha, com ícone de lixeira). */
export const confirmarExclusao = opcoes =>
  confirmar({ tipo: 'perigo', icone: 'lixeira', confirmarLabel: 'Excluir', ...opcoes })

/**
 * Substitui window.alert por um diálogo estilizado com um único botão.
 * `avisar('texto')` mostra um erro; `avisar({ titulo, mensagem, tipo })` aceita
 * os tipos 'erro' | 'sucesso' | 'aviso' | 'info'. Retorna Promise<void>.
 */
export function avisar(opcoes) {
  const o = typeof opcoes === 'string' ? { mensagem: opcoes } : (opcoes || {})
  const tipo = o.tipo || 'erro'
  const tituloPadrao = { erro: 'Algo deu errado', sucesso: 'Tudo certo!', aviso: 'Atenção', info: 'Aviso' }[tipo] || 'Aviso'
  return confirmar({ titulo: tituloPadrao, confirmarLabel: 'Entendi', ...o, tipo, unico: true }).then(() => {})
}
