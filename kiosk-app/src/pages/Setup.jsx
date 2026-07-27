import { useState } from 'react'

const API_URL = 'https://cajuidapi.vartec.com.br'

export default function Setup({ onConfirmar }) {
  const [token, setToken] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState(null)

  function extrairToken(valor) {
    const limpo = valor.trim()
    const match = limpo.match(/\/kiosk\/([0-9a-f-]{36})/i)
    if (match) return match[1]
    if (/^[0-9a-f-]{36}$/i.test(limpo)) return limpo
    return limpo
  }

  async function verificar() {
    const t = extrairToken(token)
    if (!t) return setErro('Cole o código ou a URL do dispositivo acima.')
    setErro(''); setVerificando(true); setInfo(null)
    try {
      const res = await fetch(`${API_URL}/kiosk/${t}/branding`)
      if (!res.ok) throw new Error('Código inválido ou dispositivo não encontrado.')
      setInfo(await res.json())
    } catch (e) {
      setErro(e.message)
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / título */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <span className="text-3xl font-black text-white tracking-tight">CJ</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">CAJU ID Kiosk</h1>
            <p className="text-sm text-gray-500 mt-1">Ponto eletrônico por dispositivo fixo</p>
          </div>
        </div>

        <div className="h-px bg-gray-800" />

        {/* Campo do token */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Código do dispositivo
          </label>
          <textarea
            value={token}
            onChange={e => { setToken(e.target.value); setInfo(null); setErro('') }}
            placeholder="Cole aqui a URL ou o código UUID do dispositivo..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
          <p className="text-xs text-gray-600 leading-relaxed">
            No Painel RH → Dispositivos → clique em "Copiar URL" e cole aqui.{'\n'}
            Funciona com a URL completa ou só o código.
          </p>
        </div>

        {/* Resultado */}
        {info && (
          <div className="bg-emerald-950/60 border border-emerald-700/40 rounded-xl p-4">
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-3">
              ✓ Dispositivo encontrado
            </p>
            <div className="flex items-center gap-3">
              {info.empresa_logo
                ? <img src={info.empresa_logo} alt="logo" className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-black text-lg flex-shrink-0">CJ</div>
              }
              <div className="min-w-0">
                <p className="text-gray-100 font-semibold truncate">{info.empresa_nome}</p>
                <p className="text-gray-400 text-sm truncate">{info.dispositivo_nome}</p>
              </div>
            </div>
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Botões */}
        {!info ? (
          <button
            onClick={verificar}
            disabled={verificando || !token.trim()}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-900/30">
            {verificando
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando…
                </span>
              : 'Verificar dispositivo'
            }
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => onConfirmar(extrairToken(token))}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-900/30">
              Iniciar kiosk →
            </button>
            <button
              onClick={() => { setInfo(null); setToken('') }}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors">
              Usar outro código
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-700">CAJU ID · Ponto Eletrônico</p>
      </div>
    </div>
  )
}
