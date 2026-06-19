import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRH, salvarSessao, getDashboard, limparSessao, getLoginConfig } from '../api'

const DEFAULT_CONFIG = {
  tipo: 'texto',
  cor_fundo: '#059669',
  titulo: 'Bem-vindo ao CAJU ID',
  subtitulo: 'Gerencie o ponto eletrônico da sua equipe com facilidade e segurança.',
  imagem_url: '',
  empresa_nome: '',
  empresa_logo: '',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const navigate = useNavigate()

  useEffect(() => {
    getLoginConfig().then(c => {
      if (c && Object.keys(c).length > 0) setConfig({ ...DEFAULT_CONFIG, ...c })
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const sessao = await loginRH(email, senha)
      salvarSessao(sessao)
      await getDashboard()
      navigate('/dashboard')
    } catch (err) {
      if (err.status === 403) {
        setErro('Acesso negado. Este painel é exclusivo para usuários RH.')
      } else {
        setErro(err.message || 'Email ou senha incorretos.')
      }
      limparSessao()
    } finally {
      setLoading(false)
    }
  }

  const temImagem = config.tipo === 'imagem' && config.imagem_url

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — conteúdo configurável ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: config.cor_fundo }}
      >
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-16 -right-16 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/2 -right-8 w-40 h-40 rounded-full opacity-5 bg-white" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo */}
          {config.empresa_logo && (
            <img src={config.empresa_logo} alt="logo"
              className="w-16 h-16 object-contain rounded-2xl mx-auto mb-6"
              style={{ background: 'rgba(255,255,255,0.15)', padding: 8 }} />
          )}

          {temImagem ? (
            <img src={config.imagem_url} alt="banner"
              className="w-full max-w-xs rounded-2xl shadow-2xl mx-auto mb-6 object-cover"
              style={{ maxHeight: 280 }} />
          ) : (
            /* Ilustração SVG padrão quando não há imagem */
            <div className="mb-6">
              <svg viewBox="0 0 280 200" className="w-64 mx-auto opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="40" width="200" height="130" rx="12" fill="white" fillOpacity="0.15"/>
                <rect x="60" y="60" width="80" height="10" rx="5" fill="white" fillOpacity="0.5"/>
                <rect x="60" y="78" width="120" height="8" rx="4" fill="white" fillOpacity="0.3"/>
                <rect x="60" y="94" width="100" height="8" rx="4" fill="white" fillOpacity="0.3"/>
                <rect x="60" y="120" width="60" height="28" rx="8" fill="white" fillOpacity="0.4"/>
                <circle cx="210" cy="80" r="28" fill="white" fillOpacity="0.2"/>
                <circle cx="210" cy="80" r="18" fill="white" fillOpacity="0.3"/>
                <path d="M204 80l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}

          <h2 className="text-2xl font-bold text-white mb-3 leading-snug">{config.titulo}</h2>
          {config.subtitulo && (
            <p className="text-white/75 text-sm leading-relaxed">{config.subtitulo}</p>
          )}
        </div>

        {/* Nome da empresa no rodapé */}
        {config.empresa_nome && (
          <p className="absolute bottom-6 text-white/40 text-xs">{config.empresa_nome}</p>
        )}
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Logo mobile (só aparece em telas pequenas) */}
          <div className="lg:hidden text-center mb-8">
            {config.empresa_logo
              ? <img src={config.empresa_logo} alt="logo" className="w-12 h-12 object-contain rounded-xl mx-auto mb-3" style={{ background: config.cor_fundo, padding: 6 }} />
              : <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: config.cor_fundo }}>
                  <span className="text-white text-xl font-bold">C</span>
                </div>
            }
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#18181b' }}>Entrar</h1>
            <p className="text-sm mt-1" style={{ color: '#71717a' }}>Painel de Recursos Humanos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#3f3f46' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                style={{ borderColor: '#e4e4e7', color: '#18181b', background: '#fafafa' }}
                onFocus={e => e.target.style.borderColor = config.cor_fundo}
                onBlur={e => e.target.style.borderColor = '#e4e4e7'}
                placeholder="rh@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#3f3f46' }}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                style={{ borderColor: '#e4e4e7', color: '#18181b', background: '#fafafa' }}
                onFocus={e => e.target.style.borderColor = config.cor_fundo}
                onBlur={e => e.target.style.borderColor = '#e4e4e7'}
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold rounded-lg py-2.5 text-sm transition-opacity disabled:opacity-60 mt-2"
              style={{ background: config.cor_fundo }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: '#a1a1aa' }}>
            CAJU ID · Ponto Eletrônico
          </p>
        </div>
      </div>
    </div>
  )
}
