import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import jsQR from 'jsqr'

const API_URL = window.__API_URL__ || 'https://caju-id-ponto-production.up.railway.app'

const TIPO_COR = {
  entrada:        { bg: 'bg-emerald-500', text: 'Entrada registrada!' },
  saida_almoco:   { bg: 'bg-yellow-500', text: 'Saída para almoço!' },
  retorno_almoco: { bg: 'bg-blue-500',   text: 'Retorno do almoço!' },
  saida:          { bg: 'bg-gray-600',   text: 'Saída registrada!' },
}

function fmtCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function Kiosk() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)          // { dispositivo, empresa, colaboradores }
  const [erroInfo, setErroInfo] = useState('')
  const [modo, setModo] = useState('qr')           // 'qr' | 'cpf'
  const [fase, setFase] = useState('scan')          // 'scan' | 'confirmar' | 'contagem' | 'ok' | 'erro'
  const [colaborador, setColaborador] = useState(null)
  const [contagem, setContagem] = useState(3)
  const [resultado, setResultado] = useState(null)  // { tipo, tipo_label, horario } | { erro }
  const [cpfInput, setCpfInput] = useState('')
  const [cpfErro, setCpfErro] = useState('')

  const videoRef  = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const rafRef    = useRef()
  const faseRef   = useRef(fase)
  faseRef.current = fase

  // ── Carregar info do dispositivo ──────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/kiosk/${token}`)
      .then(r => { if (!r.ok) throw new Error('Dispositivo não encontrado'); return r.json() })
      .then(setInfo)
      .catch(e => setErroInfo(e.message))
  }, [token])

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
    } catch (e) {
      setErroInfo('Câmera não disponível: ' + e.message)
    }
  }, [])

  useEffect(() => {
    iniciarCamera()
    return pararCamera
  }, [iniciarCamera, pararCamera])

  // ── Loop de scan QR ───────────────────────────────────────────────────────
  useEffect(() => {
    if (modo !== 'qr') return

    const scan = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === 4 && faseRef.current === 'scan') {
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imageData.data, imageData.width, imageData.height)
        if (qr?.data) {
          // Verificar se é UUID de um colaborador
          const found = info?.colaboradores?.find(c => c.id === qr.data)
          if (found) {
            setColaborador(found)
            setFase('confirmar')
            setTimeout(() => { setContagem(3); setFase('contagem') }, 800)
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan)
    }

    if (info) rafRef.current = requestAnimationFrame(scan)
    return () => cancelAnimationFrame(rafRef.current)
  }, [modo, info])

  // ── Contagem regressiva ───────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem === 0) { capturarEEnviar(); return }
    const t = setTimeout(() => setContagem(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, contagem])

  // ── Capturar foto e enviar ────────────────────────────────────────────────
  async function capturarEEnviar(colaboradorParam) {
    const colab = colaboradorParam || colaborador
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const foto = canvas.toDataURL('image/jpeg', 0.85)

    setFase('enviando')
    try {
      const res = await fetch(`${API_URL}/kiosk/${token}/ponto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: colab.id,
          foto,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro ao registrar')
      setResultado(data)
      setFase('ok')
    } catch (e) {
      setResultado({ erro: e.message })
      setFase('erro')
    }

    // Resetar após 5s
    setTimeout(() => {
      setFase('scan')
      setColaborador(null)
      setContagem(3)
      setResultado(null)
      setCpfInput('')
      setCpfErro('')
    }, 5000)
  }

  // ── Modo CPF ──────────────────────────────────────────────────────────────
  function buscarPorCpf() {
    const limpo = cpfInput.replace(/\D/g, '')
    if (limpo.length < 11) return setCpfErro('CPF incompleto.')
    const found = info?.colaboradores?.find(c => c.cpf?.replace(/\D/g, '') === limpo)
    if (!found) return setCpfErro('CPF não encontrado.')
    setCpfErro('')
    setColaborador(found)
    setContagem(3)
    setFase('contagem')
  }

  // ── Tela de erro de dispositivo ───────────────────────────────────────────
  if (erroInfo) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-white text-lg font-semibold mb-2">Dispositivo inválido</p>
        <p className="text-gray-400 text-sm">{erroInfo}</p>
      </div>
    </div>
  )

  if (!info) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">Carregando kiosk…</p>
    </div>
  )

  const empresa = info.empresa
  const accentColor = empresa?.login_config?.cor_fundo || '#059669'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none" style={{ userSelect: 'none' }}>

      {/* ── Topo ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          {empresa?.logo_url && (
            <img src={empresa.logo_url} alt="logo" className="w-9 h-9 rounded-xl object-contain"
              style={{ background: accentColor + '22', padding: 4 }} />
          )}
          <div>
            <p className="text-white font-bold text-sm">{empresa?.nome || 'CAJU ID'}</p>
            <p className="text-gray-500 text-xs">{info.dispositivo?.nome}</p>
          </div>
        </div>

        {/* Seletor de modo */}
        <div className="flex rounded-lg overflow-hidden border border-gray-800">
          <button onClick={() => { setModo('qr'); setFase('scan'); setColaborador(null); setContagem(3) }}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${modo === 'qr' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            📷 QR Code
          </button>
          <button onClick={() => { setModo('cpf'); setFase('scan'); setColaborador(null); setContagem(3) }}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${modo === 'cpf' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            🔢 CPF
          </button>
        </div>
      </div>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Camera */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay de estados */}
          {fase === 'confirmar' && colaborador && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-2xl p-8 text-center shadow-2xl mx-4">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ background: accentColor }}>
                  {colaborador.nome.charAt(0).toUpperCase()}
                </div>
                <p className="font-bold text-gray-900 text-xl">{colaborador.nome}</p>
                {colaborador.cargo && <p className="text-gray-400 text-sm mt-1">{colaborador.cargo}</p>}
                <p className="text-gray-500 text-sm mt-3">Preparando câmera…</p>
              </div>
            </div>
          )}

          {fase === 'contagem' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <div className="text-center">
                <p className="text-white text-lg font-semibold mb-2">{colaborador?.nome}</p>
                <div className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: accentColor, boxShadow: `0 0 40px ${accentColor}88` }}>
                  <span className="text-white text-6xl font-black">{contagem}</span>
                </div>
                <p className="text-white/60 text-sm">Olhe para a câmera</p>
              </div>
            </div>
          )}

          {fase === 'enviando' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white text-sm">Registrando…</p>
              </div>
            </div>
          )}

          {fase === 'ok' && resultado && (
            <div className={`absolute inset-0 flex items-center justify-center ${TIPO_COR[resultado.tipo]?.bg || 'bg-emerald-500'}`}>
              <div className="text-center px-8">
                <div className="text-7xl mb-4">✓</div>
                <p className="text-white text-3xl font-black mb-2">{resultado.colaborador}</p>
                <p className="text-white/90 text-xl font-bold">{resultado.tipo_label}</p>
                <p className="text-white/70 text-4xl font-mono mt-3">{resultado.horario}</p>
              </div>
            </div>
          )}

          {fase === 'erro' && resultado && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-600">
              <div className="text-center px-8">
                <div className="text-7xl mb-4">✗</div>
                <p className="text-white text-xl font-bold">{resultado.erro}</p>
              </div>
            </div>
          )}

          {/* Guia de scan QR (quando idle) */}
          {modo === 'qr' && fase === 'scan' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/30 rounded-2xl w-56 h-56 flex items-center justify-center">
                <p className="text-white/50 text-xs text-center px-4">Aponte o QR Code do colaborador aqui</p>
              </div>
            </div>
          )}
        </div>

        {/* Painel lateral CPF */}
        {modo === 'cpf' && (
          <div className="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col items-center justify-center p-8 gap-6">
            <div className="text-center">
              <p className="text-white font-bold text-lg">Identificação por CPF</p>
              <p className="text-gray-400 text-sm mt-1">Digite o CPF e tire a foto</p>
            </div>

            {fase === 'scan' && (
              <div className="w-full space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">CPF</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtCpf(cpfInput)}
                    onChange={e => setCpfInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && buscarPorCpf()}
                    placeholder="000.000.000-00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg tracking-widest font-mono focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  {cpfErro && <p className="text-red-400 text-xs mt-1.5 text-center">{cpfErro}</p>}
                </div>
                <button onClick={buscarPorCpf}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: accentColor }}>
                  Confirmar e tirar foto
                </button>
              </div>
            )}

            {(fase === 'contagem' || fase === 'enviando') && colaborador && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ background: accentColor }}>
                  {colaborador.nome.charAt(0).toUpperCase()}
                </div>
                <p className="text-white font-bold">{colaborador.nome}</p>
                {colaborador.cargo && <p className="text-gray-400 text-sm">{colaborador.cargo}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
