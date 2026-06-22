import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import jsQR from 'jsqr'

const API_URL = window.__API_URL__ || 'https://caju-id-ponto-production.up.railway.app'

const TIPO_CONFIG = {
  entrada:        { cor: '#10b981', emoji: '🟢', label: 'Entrada' },
  saida_almoco:   { cor: '#f59e0b', emoji: '🟡', label: 'Saída Almoço' },
  retorno_almoco: { cor: '#3b82f6', emoji: '🔵', label: 'Retorno Almoço' },
  saida:          { cor: '#6b7280', emoji: '⚫', label: 'Saída' },
}

function fmtCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function Kiosk() {
  const { token } = useParams()

  // ── Estado global ──────────────────────────────────────────────────────────
  const [branding, setBranding]   = useState(null)
  const [info, setInfo]           = useState(null)     // após PIN validado
  const [erroGlobal, setErroGlobal] = useState('')

  // PIN
  const [pinInput, setPinInput]   = useState('')
  const [pinErro, setPinErro]     = useState('')
  const [pinOk, setPinOk]         = useState(false)
  const [autenticando, setAutenticando] = useState(false)

  // Registro
  const [modo, setModo]           = useState('qr')     // 'qr' | 'cpf'
  const [fase, setFase]           = useState('scan')   // 'scan'|'contagem'|'enviando'|'ok'|'erro'
  const [colaborador, setColaborador] = useState(null)
  const [contagem, setContagem]   = useState(3)
  const [resultado, setResultado] = useState(null)
  const [cpfInput, setCpfInput]   = useState('')
  const [cpfErro, setCpfErro]     = useState('')
  const [mostrarCpf, setMostrarCpf] = useState(false)

  const videoRef  = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const rafRef    = useRef()
  const faseRef   = useRef(fase)
  faseRef.current = fase

  const accentColor = branding?.cor_fundo || '#059669'

  // ── Carregar branding ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/kiosk/${token}/branding`)
      .then(r => { if (!r.ok) throw new Error('Dispositivo inválido'); return r.json() })
      .then(b => {
        setBranding(b)
        // Se não tem senha, autentica automaticamente
        if (!b.tem_senha) autenticar('')
      })
      .catch(e => setErroGlobal(e.message))
  }, [token])

  // ── Autenticar com PIN ─────────────────────────────────────────────────────
  async function autenticar(senha) {
    setAutenticando(true); setPinErro('')
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Senha incorreta')
      }
      const data = await res.json()
      setInfo(data)
      setPinOk(true)
    } catch (e) {
      setPinErro(e.message)
    } finally {
      setAutenticando(false) }
  }

  // ── Câmera ────────────────────────────────────────────────────────────────
  const pararCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const iniciarCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) { setErroGlobal('Câmera indisponível: ' + e.message) }
  }, [])

  useEffect(() => {
    if (!pinOk) return
    iniciarCamera()
    return pararCamera
  }, [pinOk, iniciarCamera, pararCamera])

  // ── Loop QR scan ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pinOk || modo !== 'qr') return
    const scan = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === 4 && faseRef.current === 'scan') {
        canvas.width  = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imgData.data, imgData.width, imgData.height)
        if (qr?.data) {
          const found = info?.colaboradores?.find(c => c.id === qr.data)
          if (found) {
            setColaborador(found)
            setContagem(3)
            setFase('contagem')
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan)
    }
    rafRef.current = requestAnimationFrame(scan)
    return () => cancelAnimationFrame(rafRef.current)
  }, [pinOk, modo, info])

  // ── Contagem regressiva ───────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem === 0) { capturarEEnviar(); return }
    const t = setTimeout(() => setContagem(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, contagem])

  // ── Capturar e enviar ──────────────────────────────────────────────────────
  async function capturarEEnviar(colab) {
    const c = colab || colaborador
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    canvas.width  = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const foto = canvas.toDataURL('image/jpeg', 0.85)

    setFase('enviando')
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/ponto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: c.id, foto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao registrar')
      setResultado(data)
      setFase('ok')
    } catch (e) {
      setResultado({ erro: e.message })
      setFase('erro')
    }

    setTimeout(resetar, 5000)
  }

  function resetar() {
    setFase('scan'); setColaborador(null); setContagem(3)
    setResultado(null); setCpfInput(''); setCpfErro(''); setMostrarCpf(false)
  }

  // ── Buscar por CPF ────────────────────────────────────────────────────────
  function buscarCpf() {
    const limpo = cpfInput.replace(/\D/g, '')
    if (limpo.length < 11) return setCpfErro('CPF incompleto (11 dígitos).')
    const found = info?.colaboradores?.find(
      c => (c.cpf || '').replace(/\D/g, '') === limpo
    )
    if (!found) return setCpfErro(`CPF ${fmtCpf(limpo)} não encontrado.`)
    setCpfErro('')
    setColaborador(found)
    setContagem(3)
    setFase('contagem')
    setMostrarCpf(false)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Render: erro global ────────────────────────────────────────────────────
  if (erroGlobal) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-white text-lg font-semibold mb-2">Dispositivo inválido</p>
        <p className="text-gray-400 text-sm">{erroGlobal}</p>
      </div>
    </div>
  )

  if (!branding) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Render: tela de PIN ────────────────────────────────────────────────────
  if (!pinOk) return (
    <div className="h-screen flex flex-col items-center justify-center p-8"
      style={{ background: accentColor }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white opacity-10" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white opacity-10" />
      </div>
      <div className="relative z-10 bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
        {branding.empresa_logo && (
          <img src={branding.empresa_logo} alt="logo" className="w-16 h-16 object-contain rounded-2xl mx-auto mb-4"
            style={{ background: accentColor + '18', padding: 8 }} />
        )}
        <h2 className="text-xl font-bold text-gray-900 mb-1">{branding.empresa_nome || 'CAJU ID'}</h2>
        <p className="text-gray-400 text-sm mb-6">{branding.dispositivo_nome}</p>

        <p className="text-sm font-semibold text-gray-700 mb-3">Senha do dispositivo</p>
        <input
          type="password"
          inputMode="numeric"
          value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && autenticar(pinInput)}
          maxLength={6}
          placeholder="······"
          className="w-full text-center text-2xl tracking-[0.5em] border rounded-xl px-4 py-3 outline-none mb-3"
          style={{ borderColor: pinErro ? '#ef4444' : '#e4e4e7', fontFamily: 'monospace' }}
          autoFocus
        />
        {pinErro && <p className="text-red-500 text-sm mb-3">{pinErro}</p>}
        <button
          onClick={() => autenticar(pinInput)}
          disabled={autenticando}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60"
          style={{ background: accentColor }}>
          {autenticando ? 'Verificando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )

  // ── Render: kiosk principal ────────────────────────────────────────────────
  const tipoConfig = resultado ? TIPO_CONFIG[resultado.tipo] : null

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ touchAction: 'none' }}>

      {/* Câmera — fundo full-screen */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Topo ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
        <div className="flex items-center gap-2">
          {info.empresa?.logo_url && (
            <img src={info.empresa.logo_url} alt="logo" className="w-8 h-8 rounded-lg object-contain"
              style={{ background: 'rgba(255,255,255,0.15)', padding: 3 }} />
          )}
          <div>
            <p className="text-white text-xs font-bold leading-tight">{info.empresa?.nome}</p>
            <p className="text-white/50 text-[10px]">{info.dispositivo?.nome}</p>
          </div>
        </div>
        <div className="flex gap-1 bg-black/40 rounded-lg p-1">
          <button onClick={() => { setModo('qr'); resetar() }}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${modo === 'qr' ? 'bg-white text-black' : 'text-white/60'}`}>
            QR Code
          </button>
          <button onClick={() => { setModo('cpf'); setMostrarCpf(true); resetar() }}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${modo === 'cpf' ? 'bg-white text-black' : 'text-white/60'}`}>
            CPF
          </button>
        </div>
      </div>

      {/* ── Guia QR (idle) ── */}
      {modo === 'qr' && fase === 'scan' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="border-2 border-white/40 rounded-2xl w-52 h-52 relative">
            <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
          </div>
          <p className="text-white/70 text-sm mt-4 font-medium">Aponte o QR Code do colaborador</p>
          <button onClick={() => { setModo('cpf'); setMostrarCpf(true) }}
            className="mt-3 text-white/50 text-xs underline pointer-events-auto">
            Usar CPF em vez disso
          </button>
        </div>
      )}

      {/* ── Contagem ── */}
      {fase === 'contagem' && colaborador && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-3xl font-black"
              style={{ background: accentColor, boxShadow: `0 0 60px ${accentColor}99` }}>
              {contagem}
            </div>
            <p className="text-white font-bold text-xl mt-3">{colaborador.nome}</p>
            {colaborador.cargo && <p className="text-white/50 text-sm">{colaborador.cargo}</p>}
            <p className="text-white/40 text-xs mt-2">Olhe para a câmera</p>
          </div>
        </div>
      )}

      {/* ── Enviando ── */}
      {fase === 'enviando' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white text-sm">Registrando ponto…</p>
          </div>
        </div>
      )}

      {/* ── Resultado OK ── */}
      {fase === 'ok' && resultado && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
          style={{ background: tipoConfig?.cor || '#10b981' }}>
          <div className="text-center px-8">
            <div className="text-8xl mb-4">✓</div>
            <p className="text-white text-4xl font-black mb-2">{resultado.colaborador}</p>
            <p className="text-white/90 text-2xl font-semibold">{resultado.tipo_label}</p>
            <p className="text-white text-5xl font-mono font-bold mt-4">{resultado.horario}</p>
          </div>
        </div>
      )}

      {/* ── Resultado Erro ── */}
      {fase === 'erro' && resultado && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600 z-20">
          <div className="text-center px-8">
            <div className="text-8xl mb-4">✗</div>
            <p className="text-white text-xl font-bold">{resultado.erro}</p>
            <button onClick={resetar} className="mt-6 bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-semibold">
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── Painel CPF (bottom sheet) ── */}
      {mostrarCpf && fase === 'scan' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur rounded-t-3xl p-6 pb-8">
          <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
          <p className="text-white font-bold text-center mb-4">Digite o CPF</p>
          <input
            type="text"
            inputMode="numeric"
            value={fmtCpf(cpfInput)}
            onChange={e => setCpfInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && buscarCpf()}
            placeholder="000.000.000-00"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest font-mono focus:outline-none focus:border-emerald-500 mb-2"
            autoFocus
          />
          {cpfErro && <p className="text-red-400 text-sm text-center mb-2">{cpfErro}</p>}
          <div className="flex gap-3 mt-3">
            <button onClick={() => { setMostrarCpf(false); setCpfInput(''); setCpfErro('') }}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm font-semibold">
              Cancelar
            </button>
            <button onClick={buscarCpf}
              className="flex-1 py-3 rounded-xl text-white text-sm font-bold"
              style={{ background: accentColor }}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* ── Botão CPF flutuante ── */}
      {modo === 'cpf' && !mostrarCpf && fase === 'scan' && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
          <button onClick={() => setMostrarCpf(true)}
            className="bg-white/90 text-gray-900 px-8 py-3 rounded-full text-sm font-bold shadow-xl">
            🔢 Digitar CPF
          </button>
        </div>
      )}
    </div>
  )
}
