import { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'

const API_URL = 'https://cajuidapi.vartec.com.br'

const TIPO_CONFIG = {
  entrada:        { cor: '#10b981', label: 'Entrada' },
  saida_almoco:   { cor: '#f59e0b', label: 'Saída Almoço' },
  retorno_almoco: { cor: '#3b82f6', label: 'Retorno Almoço' },
  saida:          { cor: '#6b7280', label: 'Saída' },
}

function fmtCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function Kiosk({ token, onResetar }) {
  const [branding, setBranding]     = useState(null)
  const [info, setInfo]             = useState(null)
  const [offline, setOffline]       = useState(false)  // banner vermelho
  const [cameraErro, setCameraErro] = useState('')     // erro permanente de câmera

  const [pinInput, setPinInput]     = useState('')
  const [pinErro, setPinErro]       = useState('')
  const [pinOk, setPinOk]           = useState(false)
  const [autenticando, setAutenticando] = useState(false)

  const [modo, setModo]           = useState('qr')
  const [fase, setFase]           = useState('scan')
  const [colaborador, setColaborador] = useState(null)
  const [contagem, setContagem]   = useState(3)
  const [resultado, setResultado] = useState(null)
  const [cpfInput, setCpfInput]   = useState('')
  const [cpfErro, setCpfErro]     = useState('')
  const [mostrarCpf, setMostrarCpf] = useState(false)
  const [mostrarReset, setMostrarReset] = useState(false)

  const longPressRef = useRef(null)
  const videoRef  = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const rafRef    = useRef()
  const faseRef   = useRef(fase)
  const pinRef    = useRef('')
  const infoRef   = useRef(info)
  faseRef.current = fase
  infoRef.current = info

  const accentColor = branding?.cor_fundo || '#059669'

  // ── Câmera: inicia uma vez, nunca para por rede ─────────────────────────────
  const iniciarCamera = useCallback(async () => {
    if (streamRef.current) return // já está rodando
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      setCameraErro('Câmera indisponível: ' + e.message)
    }
  }, [])

  useEffect(() => {
    if (!pinOk) return
    iniciarCamera()
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [pinOk, iniciarCamera])

  // ── Buscar branding com retry infinito (não bloqueia câmera) ───────────────
  const buscarBranding = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/kiosk/${token}/branding`, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) throw new Error('status ' + r.status)
      const b = await r.json()
      setBranding(b)
      setOffline(false)
      return b
    } catch {
      setOffline(true)
      return null
    }
  }, [token])

  // Atualização silenciosa dos dados (lista de colaboradores etc.) sem reload
  const atualizarInfo = useCallback(async () => {
    const senha = pinRef.current
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        setInfo(data)
        setOffline(false)
      } else {
        setOffline(true)
      }
    } catch {
      setOffline(true)
    }
  }, [token])

  // ── Inicialização: branding + auto-login ───────────────────────────────────
  useEffect(() => {
    const pinSalvo = localStorage.getItem(`kiosk_pin_${token}`) || ''
    let cancelado = false

    async function iniciar() {
      let b = null
      while (!b && !cancelado) {
        b = await buscarBranding()
        if (!b) {
          setOffline(true)
          await new Promise(r => setTimeout(r, 10000))
        }
      }
      if (cancelado || !b) return
      if (!b.tem_senha) autenticar('')
      else if (pinSalvo) autenticar(pinSalvo)
    }

    iniciar()
    return () => { cancelado = true }
  }, [token, buscarBranding])

  // ── Retry loop quando offline ──────────────────────────────────────────────
  useEffect(() => {
    if (!offline) return
    const id = setInterval(async () => {
      if (pinOk) await atualizarInfo()
      else {
        const b = await buscarBranding()
        if (b && !pinOk) {
          const pinSalvo = localStorage.getItem(`kiosk_pin_${token}`) || ''
          if (!b.tem_senha) autenticar('')
          else if (pinSalvo) autenticar(pinSalvo)
        }
      }
    }, 10000)
    return () => clearInterval(id)
  }, [offline, pinOk, buscarBranding, atualizarInfo, token])

  // ── Atualização silenciosa periódica (substitui window.location.reload) ────
  useEffect(() => {
    if (!pinOk) return
    // Atualiza lista de colaboradores a cada 30s
    const idInfo = setInterval(atualizarInfo, 30000)
    // Re-busca branding a cada hora
    const idBranding = setInterval(buscarBranding, 3600000)
    return () => { clearInterval(idInfo); clearInterval(idBranding) }
  }, [pinOk, atualizarInfo, buscarBranding])

  // ── Detectar online/offline do dispositivo ─────────────────────────────────
  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => { if (pinOk) atualizarInfo(); else buscarBranding() }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [pinOk, atualizarInfo, buscarBranding])

  async function autenticar(senha) {
    setAutenticando(true); setPinErro('')
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Senha incorreta') }
      const data = await res.json()
      setInfo(data); setPinOk(true); pinRef.current = senha
      setOffline(false)
      localStorage.setItem(`kiosk_pin_${token}`, senha)
    } catch (e) {
      if (e.name === 'TimeoutError' || e.message?.includes('fetch')) {
        setOffline(true)
        // Mantém pinOk se já estava autenticado
      } else {
        setPinErro(e.message)
      }
    } finally { setAutenticando(false) }
  }

  // ── Loop QR ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pinOk || modo !== 'qr') return
    const scan = () => {
      const video = videoRef.current; const canvas = canvasRef.current
      if (video && canvas && video.readyState === 4 && faseRef.current === 'scan') {
        canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imgData.data, imgData.width, imgData.height)
        if (qr?.data) {
          const found = infoRef.current?.colaboradores?.find(c => c.id === qr.data)
          if (found) { setColaborador(found); setContagem(3); setFase('contagem') }
        }
      }
      rafRef.current = requestAnimationFrame(scan)
    }
    rafRef.current = requestAnimationFrame(scan)
    return () => cancelAnimationFrame(rafRef.current)
  }, [pinOk, modo])

  // ── Contagem regressiva ────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem === 0) { capturarEEnviar(); return }
    const t = setTimeout(() => setContagem(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, contagem])

  async function capturarEEnviar(colab) {
    const c = colab || colaborador
    const canvas = canvasRef.current; const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const foto = canvas.toDataURL('image/jpeg', 0.85)
    setFase('enviando')
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/ponto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id: c.id, foto }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao registrar')
      setResultado(data); setFase('ok')
      setOffline(false)
    } catch (e) {
      setResultado({ erro: e.name === 'TimeoutError' ? 'Sem conexão — tente novamente' : e.message })
      setFase('erro')
      if (e.name === 'TimeoutError' || e.message?.includes('fetch')) setOffline(true)
    }
    setTimeout(resetar, 5000)
  }

  function resetar() {
    setFase('scan'); setColaborador(null); setContagem(3)
    setResultado(null); setCpfInput(''); setCpfErro(''); setMostrarCpf(false)
  }

  function buscarCpf() {
    const limpo = cpfInput.replace(/\D/g, '')
    if (limpo.length < 11) return setCpfErro('CPF incompleto (11 dígitos).')
    const found = infoRef.current?.colaboradores?.find(c => (c.cpf || '').replace(/\D/g, '') === limpo)
    if (!found) return setCpfErro(`CPF ${fmtCpf(limpo)} não encontrado.`)
    setCpfErro(''); setColaborador(found); setContagem(3); setFase('contagem'); setMostrarCpf(false)
  }

  function iniciarLongPress() { longPressRef.current = setTimeout(() => setMostrarReset(true), 5000) }
  function cancelarLongPress() { clearTimeout(longPressRef.current) }

  // ── Estados de carregamento inicial ───────────────────────────────────────
  if (!branding && !offline) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!branding && offline) return (
    <div className="h-screen bg-gray-950 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-red-400 font-semibold">Sem conexão</p>
      <p className="text-gray-500 text-sm">Tentando conectar ao servidor…</p>
    </div>
  )

  if (!pinOk) return (
    <div className="h-screen flex flex-col items-center justify-center p-8" style={{ background: accentColor }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white opacity-10" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white opacity-10" />
      </div>
      <div className="relative z-10 bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
        {branding.empresa_logo
          ? <img src={branding.empresa_logo} alt="logo"
              className="w-16 h-16 object-contain rounded-2xl mx-auto mb-4"
              style={{ background: accentColor + '18', padding: 8 }}
              onMouseDown={iniciarLongPress} onMouseUp={cancelarLongPress}
              onTouchStart={iniciarLongPress} onTouchEnd={cancelarLongPress} />
          : <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black"
              style={{ background: accentColor }}
              onMouseDown={iniciarLongPress} onMouseUp={cancelarLongPress}
              onTouchStart={iniciarLongPress} onTouchEnd={cancelarLongPress}>
              CJ
            </div>
        }
        <h2 className="text-xl font-bold text-gray-900 mb-1">{branding.empresa_nome || 'CAJU ID'}</h2>
        <p className="text-gray-400 text-sm mb-6">{branding.dispositivo_nome}</p>
        <p className="text-sm font-semibold text-gray-700 mb-3">Senha do dispositivo</p>
        <input type="password" inputMode="numeric" value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && autenticar(pinInput)}
          maxLength={6} placeholder="······"
          className="w-full text-center text-2xl tracking-[0.5em] border rounded-xl px-4 py-3 outline-none mb-3"
          style={{ borderColor: pinErro ? '#ef4444' : '#e4e4e7', fontFamily: 'monospace' }} autoFocus />
        {pinErro && <p className="text-red-500 text-sm mb-3">{pinErro}</p>}
        <button onClick={() => autenticar(pinInput)} disabled={autenticando}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60"
          style={{ background: accentColor }}>
          {autenticando ? 'Verificando…' : 'Entrar'}
        </button>
      </div>

      {mostrarReset && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-bold text-center">Configurações</h3>
            <p className="text-gray-400 text-sm text-center">Reconfigurar apagará o código deste dispositivo e voltará para a tela de setup.</p>
            <button onClick={onResetar}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold">
              Reconfigurar dispositivo
            </button>
            <button onClick={() => setMostrarReset(false)}
              className="w-full py-2 rounded-xl bg-gray-800 text-gray-300 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const tipoConfig = resultado ? TIPO_CONFIG[resultado.tipo] : null

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} muted playsInline autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      {/* Banner offline — sempre visível no topo, não bloqueia câmera */}
      {offline && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-600 flex items-center justify-center gap-2 py-1.5 px-4">
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-white text-xs font-semibold tracking-wide">Tentando conexão com o servidor…</p>
        </div>
      )}

      {/* Erro permanente de câmera */}
      {cameraErro && (
        <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center z-30 p-8 text-center">
          <p className="text-red-400 font-semibold mb-2">Câmera indisponível</p>
          <p className="text-gray-500 text-sm">{cameraErro}</p>
        </div>
      )}

      {/* Topo */}
      <div className={`absolute left-0 right-0 z-10 px-4 pb-10 ${offline ? 'top-7' : 'top-0'} pt-4`}
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0"
            onMouseDown={iniciarLongPress} onMouseUp={cancelarLongPress}
            onTouchStart={iniciarLongPress} onTouchEnd={cancelarLongPress}>
            {info?.empresa?.logo_url
              ? <img src={info.empresa.logo_url} alt="logo" className="w-9 h-9 rounded-xl object-contain flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', padding: 4 }} />
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ background: accentColor }}>CJ</div>
            }
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-tight truncate">{info?.empresa?.nome}</p>
              <p className="text-white/50 text-xs truncate">{info?.dispositivo?.nome}</p>
            </div>
          </div>
          <div className="flex gap-1 bg-black/50 rounded-xl p-1 ml-3 flex-shrink-0">
            <button onClick={() => { setModo('qr'); resetar() }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modo === 'qr' ? 'bg-white text-gray-900 shadow' : 'text-white/60 hover:text-white/90'}`}>
              QR Code
            </button>
            <button onClick={() => { setModo('cpf'); setMostrarCpf(true); resetar() }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modo === 'cpf' ? 'bg-white text-gray-900 shadow' : 'text-white/60 hover:text-white/90'}`}>
              CPF
            </button>
          </div>
        </div>
      </div>

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

      {fase === 'contagem' && colaborador && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
          <div className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-3xl font-black"
            style={{ background: accentColor, boxShadow: `0 0 60px ${accentColor}99` }}>
            {contagem}
          </div>
          <p className="text-white font-bold text-xl mt-3">{colaborador.nome}</p>
          {colaborador.cargo && <p className="text-white/50 text-sm">{colaborador.cargo}</p>}
          <p className="text-white/40 text-xs mt-2">Olhe para a câmera</p>
        </div>
      )}

      {fase === 'enviando' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white text-sm">Registrando ponto…</p>
          </div>
        </div>
      )}

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

      {mostrarCpf && fase === 'scan' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur rounded-t-3xl p-6 pb-8">
          <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
          <p className="text-white font-bold text-center mb-4">Digite o CPF</p>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={fmtCpf(cpfInput)}
            onChange={e => setCpfInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && buscarCpf()}
            placeholder="000.000.000-00"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest font-mono focus:outline-none focus:border-emerald-500 mb-2"
            autoFocus />
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

      {modo === 'cpf' && !mostrarCpf && fase === 'scan' && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
          <button onClick={() => setMostrarCpf(true)}
            className="bg-white/90 text-gray-900 px-8 py-3 rounded-full text-sm font-bold shadow-xl">
            🔢 Digitar CPF
          </button>
        </div>
      )}

      {mostrarReset && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-bold text-center">Configurações</h3>
            <p className="text-gray-400 text-sm text-center">Reconfigurar apagará o código deste dispositivo e voltará para a tela de setup.</p>
            <button onClick={onResetar}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold">
              Reconfigurar dispositivo
            </button>
            <button onClick={() => setMostrarReset(false)}
              className="w-full py-2 rounded-xl bg-gray-800 text-gray-300 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
