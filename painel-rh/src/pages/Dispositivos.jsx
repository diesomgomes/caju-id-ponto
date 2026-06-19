import { useEffect, useState } from 'react'
import { getDispositivos, criarDispositivo, excluirDispositivo, getColaboradores } from '../api'
import { IconExcluir } from '../components/IconBtn'
import Portal from '../components/Portal'

const BASE_URL = window.location.origin

function qrUrl(data, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=10&bgcolor=ffffff&color=18181b`
}

function ModalQRColabs({ dispositivo, colaboradores, onFechar }) {
  const kioskUrl = `${BASE_URL}/kiosk/${dispositivo.token}`
  return (
    <Portal><div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">QR Codes para impressão</h3>
            <p className="text-sm text-gray-500 mt-0.5">Dispositivo: {dispositivo.nome}</p>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={() => window.print()}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800">
              🖨️ Imprimir
            </button>
            <button onClick={onFechar} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6 print:p-2">
          {/* QR do dispositivo (para instalar o PWA) */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center print:hidden">
            <p className="text-xs text-gray-500 mb-3 font-medium">URL DO KIOSK — escaneie para abrir/instalar</p>
            <img src={qrUrl(kioskUrl, 160)} alt="QR Kiosk" className="mx-auto rounded-lg" />
            <p className="text-xs text-gray-400 mt-2 font-mono break-all">{kioskUrl}</p>
          </div>

          {/* Grid de QR por colaborador */}
          <p className="text-sm font-semibold text-gray-700 mb-4 print:text-xs">
            QR Codes dos colaboradores ({colaboradores.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
            {colaboradores.map(c => (
              <div key={c.id} className="border border-gray-200 rounded-xl p-4 text-center print:border print:p-2 print:rounded-md">
                <img
                  src={qrUrl(c.id, 160)}
                  alt={c.nome}
                  className="mx-auto mb-2 print:w-28 print:h-28"
                  width={160} height={160}
                />
                <p className="font-semibold text-gray-900 text-sm leading-tight print:text-xs">{c.nome}</p>
                {c.cargo && <p className="text-gray-400 text-xs mt-0.5 print:text-[10px]">{c.cargo}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div></Portal>
  )
}

export default function Dispositivos() {
  const [lista, setLista] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [modalQR, setModalQR] = useState(null)
  const [copiado, setCopiado] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const [disp, colabs] = await Promise.all([getDispositivos(), getColaboradores({})])
      setLista(disp)
      setColaboradores(colabs)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  async function criar() {
    if (!nome.trim()) return setErro('Informe um nome para o dispositivo.')
    setErro(''); setSalvando(true)
    try {
      await criarDispositivo({ nome: nome.trim() })
      setNome('')
      carregar()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Remover este dispositivo? Os registros feitos por ele não serão apagados.')) return
    try { await excluirDispositivo(id); carregar() } catch (e) { alert(e.message) }
  }

  function copiarUrl(token) {
    const url = `${BASE_URL}/kiosk/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(token)
      setTimeout(() => setCopiado(''), 2000)
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Cadastro de Dispositivos</h1>
        <p className="text-sm text-gray-400 mt-1">Crie pontos fixos de registro com link único por dispositivo.</p>
      </div>

      {/* Novo dispositivo */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-300">Novo dispositivo</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && criar()}
            placeholder="Ex: Portaria Principal, Refeitório..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm"
          />
          <button onClick={criar} disabled={salvando}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {salvando ? 'Criando…' : '+ Criar'}
          </button>
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-500 text-sm">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
            Nenhum dispositivo cadastrado.
          </div>
        ) : lista.map(d => {
          const url = `${BASE_URL}/kiosk/${d.token}`
          return (
            <div key={d.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <p className="font-semibold text-gray-100">{d.nome}</p>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate">{url}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Criado em {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => copiarUrl(d.token)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${copiado === d.token ? 'border-emerald-500 text-emerald-400 bg-emerald-900/20' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {copiado === d.token ? '✓ Copiado' : 'Copiar URL'}
                  </button>
                  <button onClick={() => window.open(url, '_blank')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-600 transition-colors">
                    Abrir
                  </button>
                  <button onClick={() => setModalQR(d)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-800 text-blue-400 hover:border-blue-600 bg-blue-900/10 transition-colors">
                    QR Codes
                  </button>
                  <IconExcluir onClick={() => excluir(d.id)} />
                </div>
              </div>

              {/* Mini QR do dispositivo */}
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4">
                <img src={qrUrl(url, 80)} alt="QR" className="rounded-lg flex-shrink-0" width={80} height={80} />
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Escaneie para <strong className="text-gray-300">abrir ou instalar</strong> o kiosk neste dispositivo.</p>
                  <p className="text-gray-500">O kiosk funciona sem login — use o link único para cada local.</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modalQR && (
        <ModalQRColabs
          dispositivo={modalQR}
          colaboradores={colaboradores}
          onFechar={() => setModalQR(null)}
        />
      )}
    </div>
  )
}
