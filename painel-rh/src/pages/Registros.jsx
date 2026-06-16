import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getRegistros, getColaboradores, getFotoUrl, ajustarRegistro } from '../api'

const TIPOS = ['', 'entrada', 'saida_almoco', 'retorno_almoco', 'saida']

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function ModalFoto({ registro, onClose }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    getFotoUrl(registro.id).then(d => setUrl(d.url)).catch(() => {})
  }, [registro.id])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-4 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">Selfie — {registro.tipo?.replace(/_/g,' ')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        {url
          ? <img src={url} alt="selfie" className="w-full rounded-lg" />
          : <p className="text-gray-400 text-sm">Carregando foto…</p>
        }
        {registro.lat_registro && (
          <div className="h-48 rounded-lg overflow-hidden">
            <MapContainer center={[registro.lat_registro, registro.lng_registro]} zoom={16} style={{ height: '100%' }} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[registro.lat_registro, registro.lng_registro]}>
                <Popup>{registro.colaborador_nome}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function ModalAjuste({ registro, onClose, onSalvo }) {
  const [novoTipo, setNovoTipo] = useState(registro.tipo)
  const [novoHorario, setNovoHorario] = useState(registro.registrado_em?.slice(0, 16))
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!motivo.trim()) return setErro('Informe o motivo do ajuste.')
    setLoading(true)
    try {
      await ajustarRegistro(registro.id, { tipo: novoTipo, registrado_em: novoHorario + ':00', motivo })
      onSalvo()
      onClose()
    } catch(e) { setErro(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">Ajuste de Registro</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        <div>
          <label className="text-sm text-gray-400">Tipo</label>
          <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100">
            {TIPOS.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400">Horário</label>
          <input type="datetime-local" value={novoHorario} onChange={e => setNovoHorario(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100" />
        </div>
        <div>
          <label className="text-sm text-gray-400">Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 resize-none"
            placeholder="Descreva o motivo do ajuste" />
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Registros() {
  const [registros, setRegistros] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', tipo: '', data: '' })
  const [loading, setLoading] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [ajusteReg, setAjusteReg] = useState(null)

  useEffect(() => { getColaboradores().then(setColaboradores).catch(() => {}) }, [])

  async function buscar() {
    setLoading(true)
    const params = {}
    if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
    if (filtros.tipo) params.tipo = filtros.tipo
    if (filtros.data) params.data = filtros.data
    try { setRegistros(await getRegistros(params)) } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { buscar() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Registros de Ponto</h1>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Colaborador</label>
          <select value={filtros.colaborador_id} onChange={e => setFiltros(f => ({ ...f, colaborador_id: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="">Todos</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Tipo</label>
          <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            {TIPOS.map(t => <option key={t} value={t}>{t ? t.replace(/_/g,' ') : 'Todos'}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data</label>
          <input type="date" value={filtros.data} onChange={e => setFiltros(f => ({ ...f, data: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
        </div>
        <button onClick={buscar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Filtrar
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Horário</th>
              <th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando…</td></tr>
            ) : registros.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
            ) : registros.map(r => (
              <tr key={r.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3">{r.colaborador_nome}</td>
                <td className="px-4 py-3 capitalize">{r.tipo?.replace(/_/g,' ')}</td>
                <td className="px-4 py-3">{new Date(r.registrado_em).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-gray-500">{r.local_nome || '—'}</td>
                <td className="px-4 py-3">
                  {r.foto_url
                    ? <button onClick={() => setFotoReg(r)} className="text-emerald-400 hover:text-emerald-300 text-xs underline">Ver</button>
                    : <span className="text-gray-600">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setAjusteReg(r)} className="text-yellow-400 hover:text-yellow-300 text-xs underline">Ajustar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fotoReg && <ModalFoto registro={fotoReg} onClose={() => setFotoReg(null)} />}
      {ajusteReg && <ModalAjuste registro={ajusteReg} onClose={() => setAjusteReg(null)} onSalvo={buscar} />}
    </div>
  )
}
