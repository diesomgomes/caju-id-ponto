import { useEffect, useRef, useState } from 'react'
import { getLoginConfig, salvarLoginConfig } from '../api'

const DEFAULT = {
  tipo: 'texto',
  cor_fundo: '#059669',
  titulo: 'Bem-vindo ao CAJU ID',
  subtitulo: 'Gerencie o ponto eletrônico da sua equipe com facilidade e segurança.',
  imagem_url: '',
}

const CORES_SUGERIDAS = [
  '#059669', '#2563eb', '#7c3aed', '#dc2626',
  '#d97706', '#0891b2', '#be185d', '#0f172a',
]

export default function AparenciaLogin() {
  const [config, setConfig] = useState(DEFAULT)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploadando, setUploadando] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    getLoginConfig().then(c => {
      if (c && Object.keys(c).length > 0) setConfig(prev => ({ ...prev, ...c }))
    })
  }, [])

  function set(key, val) { setConfig(c => ({ ...c, [key]: val })) }

  async function uploadImagem(file) {
    if (!file) return
    setUploadando(true)
    try {
      const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://kgrpynemusujedajtsas.supabase.co'
      const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtncnB5bmVtdXN1amVkYWp0c2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDIyOTcsImV4cCI6MjA5NzE3ODI5N30.Pobruun9mqxyl5hD51v6_eeyzts0NQYkFjraNsGP0HU'
      const sessao = JSON.parse(localStorage.getItem('rh_session') || '{}')
      const token = sessao.access_token

      const ext = file.name.split('.').pop()
      const path = `login-bg/banner.${ext}`

      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: file,
      })
      if (!res.ok) throw new Error('Erro ao fazer upload')

      const url = `${SUPABASE_URL}/storage/v1/object/public/fotos/${path}?t=${Date.now()}`
      set('imagem_url', url)
      set('tipo', 'imagem')
    } catch (e) {
      alert('Erro no upload: ' + e.message)
    } finally {
      setUploadando(false)
    }
  }

  async function salvar() {
    setSalvando(true); setMsg('')
    try {
      await salvarLoginConfig(config)
      setMsg('Configurações salvas com sucesso!')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg('Erro: ' + e.message) } finally { setSalvando(false) }
  }

  const temImagem = config.tipo === 'imagem' && config.imagem_url

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Aparência do Login</h1>
        <p className="text-sm text-gray-400 mt-1">Configure o visual do painel lateral na tela de login.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Configurações ── */}
        <div className="space-y-5">

          {/* Tipo de conteúdo */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-300">Conteúdo do painel lateral</p>
            <div className="flex gap-3">
              <button
                onClick={() => set('tipo', 'texto')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${config.tipo === 'texto' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                Texto
              </button>
              <button
                onClick={() => set('tipo', 'imagem')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${config.tipo === 'imagem' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                Imagem
              </button>
            </div>
          </div>

          {/* Cor de fundo */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-300">Cor de fundo</p>
            <div className="flex flex-wrap gap-2">
              {CORES_SUGERIDAS.map(cor => (
                <button key={cor} onClick={() => set('cor_fundo', cor)}
                  className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${config.cor_fundo === cor ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''}`}
                  style={{ background: cor }} />
              ))}
              <label className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors" title="Cor personalizada">
                <span className="text-gray-400 text-xs">+</span>
                <input type="color" value={config.cor_fundo} onChange={e => set('cor_fundo', e.target.value)} className="sr-only" />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex-shrink-0" style={{ background: config.cor_fundo }} />
              <input type="text" value={config.cor_fundo} onChange={e => set('cor_fundo', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100 text-xs font-mono w-24" />
            </div>
          </div>

          {/* Título e subtítulo */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-300">Textos</p>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Título</label>
              <input type="text" value={config.titulo} onChange={e => set('titulo', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subtítulo</label>
              <textarea rows={3} value={config.subtitulo} onChange={e => set('subtitulo', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm resize-none" />
            </div>
          </div>

          {/* Imagem */}
          {config.tipo === 'imagem' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-300">Imagem do banner</p>
              <div>
                <label className="text-xs text-gray-400 block mb-1">URL da imagem</label>
                <input type="url" value={config.imagem_url} onChange={e => set('imagem_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">ou</span>
                <button onClick={() => fileRef.current?.click()} disabled={uploadando}
                  className="text-sm px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  {uploadando ? 'Enviando…' : '↑ Upload de arquivo'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => uploadImagem(e.target.files?.[0])} />
              </div>
            </div>
          )}

          {/* Salvar */}
          <div className="flex items-center gap-3">
            <button onClick={salvar} disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
              {salvando ? 'Salvando…' : 'Salvar configurações'}
            </button>
            {msg && <p className={`text-sm ${msg.startsWith('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-300">Pré-visualização</p>
          <div className="rounded-xl overflow-hidden border border-gray-800 shadow-xl" style={{ height: 480 }}>
            <div className="flex h-full">
              {/* Painel esquerdo */}
              <div className="w-1/2 flex flex-col items-center justify-center p-6 relative overflow-hidden"
                style={{ background: config.cor_fundo }}>
                <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full opacity-10 bg-white" />
                <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
                <div className="relative z-10 text-center">
                  {temImagem ? (
                    <img src={config.imagem_url} alt="banner"
                      className="w-full rounded-xl shadow-lg object-cover mb-3" style={{ maxHeight: 140 }} />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                        <circle cx="12" cy="10" r="3"/>
                        <path d="M6 21v-1a6 6 0 0 1 12 0v1"/>
                      </svg>
                    </div>
                  )}
                  <p className="text-white font-bold text-xs leading-snug mb-1 line-clamp-2">{config.titulo}</p>
                  <p className="text-white/65 text-[10px] leading-snug line-clamp-3">{config.subtitulo}</p>
                </div>
              </div>
              {/* Painel direito */}
              <div className="w-1/2 flex flex-col items-center justify-center p-5 bg-white">
                <div className="w-full">
                  <p className="text-xs font-bold mb-3" style={{ color: '#18181b' }}>Entrar</p>
                  <div className="space-y-2">
                    <div className="h-7 rounded border text-[10px] px-2 flex items-center" style={{ borderColor: '#e4e4e7', color: '#a1a1aa' }}>Email</div>
                    <div className="h-7 rounded border text-[10px] px-2 flex items-center" style={{ borderColor: '#e4e4e7', color: '#a1a1aa' }}>Senha</div>
                    <div className="h-7 rounded text-[10px] flex items-center justify-center text-white font-semibold" style={{ background: config.cor_fundo }}>Entrar</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
