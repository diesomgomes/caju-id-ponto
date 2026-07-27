import { useState } from 'react'

const API_URL = 'https://cajuidapi.vartec.com.br'

export default function Setup({ onConfirmar }) {
  const [token, setToken] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState(null)

  async function verificar() {
    const t = token.trim()
    if (!t) return setErro('Cole o código do dispositivo acima.')
    setErro(''); setVerificando(true); setInfo(null)
    try {
      const res = await fetch(`${API_URL}/kiosk/${t}/branding`)
      if (!res.ok) throw new Error('Código inválido ou dispositivo não encontrado.')
      const data = await res.json()
      setInfo(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / título */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto text-3xl font-black text-white">
            CJ
          </div>
          <h1 className="text-2xl font-bold text-gray-100">CAJU ID Kiosk</h1>
          <p className="text-sm text-gray-400">Configure este dispositivo colando o código gerado no painel RH.</p>
        </div>

        {/* Campo do token */}
        <div className="space-y-3">
          <label className="text-xs text-gray-400 block">Código do dispositivo</label>
          <textarea
            value={token}
            onChange={e => { setToken(e.target.value); setInfo(null); setErro('') }}
            placeholder="Cole aqui o código UUID do dispositivo..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm font-mono resize-none focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-600">
            Vá em Painel RH → Dispositivos → copie a URL do dispositivo.{'\n'}
            O código é a parte após /kiosk/ na URL.
          </p>
        </div>

        {/* Resultado da verificação */}
        {info && (
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 space-y-2">
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Dispositivo encontrado</p>
            {info.empresa_logo && (
              <img src={info.empresa_logo} alt="logo" className="w-10 h-10 rounded-lg object-contain" />
            )}
            <p className="text-gray-100 font-semibold">{info.empresa_nome}</p>
            <p className="text-gray-400 text-sm">{info.dispositivo_nome}</p>
          </div>
        )}

        {erro && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{erro}</p>
        )}

        {/* Botões */}
        {!info ? (
          <button
            onClick={verificar}
            disabled={verificando || !token.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors">
            {verificando ? 'Verificando…' : 'Verificar dispositivo'}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => onConfirmar(token.trim())}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors">
              Confirmar e iniciar kiosk
            </button>
            <button
              onClick={() => { setInfo(null); setToken('') }}
              className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
              Usar outro código
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
