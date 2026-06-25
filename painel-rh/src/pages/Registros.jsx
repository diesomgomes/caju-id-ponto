import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getRegistros, getColaboradores, getFotoUrl, ajustarRegistro, excluirRegistro, getMe, criarRegistroManual } from '../api'
import Portal from '../components/Portal'
import { IconVer, IconAjustar, IconExcluir } from '../components/IconBtn'

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
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl overflow-hidden w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-gray-100 capitalize">
              {registro.tipo?.replace(/_/g,' ')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {registro.colaborador_nome} · {new Date(registro.registrado_em).toLocaleString('pt-BR')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none ml-4">×</button>
        </div>

        {/* Corpo: foto | mapa lado a lado */}
        <div className="flex" style={{ height: 300 }}>
          {/* Foto */}
          <div className="w-5/12 bg-black flex items-center justify-center flex-shrink-0">
            {url
              ? <img src={url} alt="selfie" className="h-full w-full object-cover" />
              : <p className="text-gray-500 text-sm">Carregando…</p>
            }
          </div>
          {/* Mapa */}
          <div className="flex-1">
            {registro.lat_registro
              ? (
                <MapContainer
                  center={[registro.lat_registro, registro.lng_registro]}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[registro.lat_registro, registro.lng_registro]}>
                    <Popup>{registro.colaborador_nome}</Popup>
                  </Marker>
                </MapContainer>
              )
              : (
                <div className="h-full flex items-center justify-center bg-gray-800">
                  <p className="text-gray-500 text-sm">Sem localização registrada</p>
                </div>
              )
            }
          </div>
        </div>

        {/* Rodapé com metadados */}
        <div className="px-5 py-2.5 border-t border-gray-800 flex gap-4 text-xs text-gray-500">
          <span>Status: <span className="text-gray-300">{registro.status || '—'}</span></span>
          {registro.distancia_metros != null && (
            <span>Distância: <span className="text-gray-300">{registro.distancia_metros}m</span></span>
          )}
          {registro.local_nome && (
            <span>Local: <span className="text-gray-300">{registro.local_nome}</span></span>
          )}
        </div>
      </div>
    </div></Portal>
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
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
    </div></Portal>
  )
}

function ModalNovaBatida({ colaboradores, onClose, onSalvo }) {
  const [colaboradorId, setColaboradorId] = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [horario, setHorario] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!colaboradorId) return setErro('Selecione o colaborador.')
    if (!motivo.trim()) return setErro('Informe o motivo do lançamento.')
    setLoading(true)
    try {
      await criarRegistroManual({
        colaborador_id: colaboradorId,
        tipo,
        registrado_em: horario + ':00',
        motivo,
      })
      onSalvo()
      onClose()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Nova Batida Manual</h3>
            <p className="text-xs text-amber-400 mt-0.5">Este registro ficará marcado como lançamento manual.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl ml-4">×</button>
        </div>
        <div>
          <label className="text-sm text-gray-400">Colaborador</label>
          <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100">
            <option value="">Selecione…</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100">
            {TIPOS.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400">Horário</label>
          <input type="datetime-local" value={horario} onChange={e => setHorario(e.target.value)}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100" />
        </div>
        <div>
          <label className="text-sm text-gray-400">Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 resize-none"
            placeholder="Descreva o motivo do lançamento manual" />
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Lançar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

export default function Registros() {
  const [registros, setRegistros] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', tipo: '', data: '' })
  const [loading, setLoading] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [ajusteReg, setAjusteReg] = useState(null)
  const [novaBatida, setNovaBatida] = useState(false)
  const [me, setMe] = useState(null)

  useEffect(() => {
    getColaboradores().then(setColaboradores).catch(() => {})
    getMe().then(setMe).catch(() => {})
  }, [])

  async function buscar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const params = {}
    if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
    if (filtros.tipo) params.tipo = filtros.tipo
    if (filtros.data) params.data = filtros.data
    try { setRegistros(await getRegistros(params)) } catch (e) { console.error(e) }
    finally { if (!silencioso) setLoading(false) }
  }

  useEffect(() => { buscar() }, [])

  useEffect(() => {
    const id = setInterval(() => buscar(true), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [filtros])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Registros de Ponto</h1>
        <button onClick={() => setNovaBatida(true)}
          className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Nova Batida Manual
        </button>
      </div>

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
                <td className="px-4 py-3">
                  <span className="capitalize">{r.tipo?.replace(/_/g,' ')}</span>
                  {r.origem === 'manual' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      manual
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{new Date(r.registrado_em).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-gray-500">{r.local_nome || '—'}</td>
                <td className="px-4 py-3">
                  {r.foto_url
                    ? <IconVer onClick={() => setFotoReg(r)} />
                    : <span className="text-gray-600 px-1.5">—</span>
                  }
                </td>
                <td className="px-4 py-3 flex gap-1 items-center">
                  <IconAjustar onClick={() => setAjusteReg(r)} />
                  {me?.papel === 'admin' && (
                    <IconExcluir onClick={async () => {
                      if (!confirm(`Excluir este registro de ${r.colaborador_nome}? Esta ação não pode ser desfeita.`)) return
                      try { await excluirRegistro(r.id); buscar() } catch (e) { alert(e.message) }
                    }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fotoReg && <ModalFoto registro={fotoReg} onClose={() => setFotoReg(null)} />}
      {ajusteReg && <ModalAjuste registro={ajusteReg} onClose={() => setAjusteReg(null)} onSalvo={buscar} />}
      {novaBatida && <ModalNovaBatida colaboradores={colaboradores} onClose={() => setNovaBatida(false)} onSalvo={buscar} />}
    </div>
  )
}
