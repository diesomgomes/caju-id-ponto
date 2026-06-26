import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import {
  getJornadas, getRegistros, getColaboradores, exportarJornadas,
  excluirJornada, excluirRegistro, getFotoUrl, ajustarRegistro, getMe,
  getCalendario, criarRegistroManual,
} from '../api'
import Portal from '../components/Portal'
import { IconVer, IconAjustar, IconExcluir } from '../components/IconBtn'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TIPOS = ['', 'entrada', 'saida_almoco', 'retorno_almoco', 'saida']

function fmtHoras(interval) {
  if (!interval) return '—'
  const m = interval.match(/(\d+):(\d+)/)
  if (!m) return interval
  return `${m[1]}h ${m[2]}min`
}

// ── Modal Foto ────────────────────────────────────────────────────────────────
function ModalFoto({ registro, onClose }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    getFotoUrl(registro.id).then(d => setUrl(d.url)).catch(() => {})
  }, [registro.id])

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl overflow-hidden w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-gray-100 capitalize">{registro.tipo?.replace(/_/g,' ')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{registro.colaborador_nome} · {new Date(registro.registrado_em).toLocaleString('pt-BR')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none ml-4">×</button>
        </div>
        <div className="flex" style={{ height: 300 }}>
          <div className="w-5/12 bg-black flex items-center justify-center flex-shrink-0">
            {url ? <img src={url} alt="selfie" className="h-full w-full object-cover" /> : <p className="text-gray-500 text-sm">Carregando…</p>}
          </div>
          <div className="flex-1">
            {registro.lat_registro ? (
              <MapContainer center={[registro.lat_registro, registro.lng_registro]} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[registro.lat_registro, registro.lng_registro]}><Popup>{registro.colaborador_nome}</Popup></Marker>
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-800">
                <p className="text-gray-500 text-sm">Sem localização registrada</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-2.5 border-t border-gray-800 flex gap-4 text-xs text-gray-500">
          <span>Status: <span className="text-gray-300">{registro.status || '—'}</span></span>
          {registro.distancia_metros != null && <span>Distância: <span className="text-gray-300">{registro.distancia_metros}m</span></span>}
          {registro.local_nome && <span>Local: <span className="text-gray-300">{registro.local_nome}</span></span>}
        </div>
      </div>
    </div></Portal>
  )
}

// ── Modal Ajuste ──────────────────────────────────────────────────────────────
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
      onSalvo(); onClose()
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

// ── Aba Jornada ───────────────────────────────────────────────────────────────
function AbaJornada({ colaboradores, me }) {
  const [jornadas, setJornadas] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', mes: new Date().toISOString().slice(0, 7) })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function buscar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const params = { mes: filtros.mes }
    if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
    try { setJornadas(await getJornadas(params)) } catch (e) { console.error(e) }
    finally { if (!silencioso) setLoading(false) }
  }

  useEffect(() => { buscar() }, [])
  useEffect(() => {
    const id = setInterval(() => buscar(true), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [filtros])

  async function exportar(formato) {
    setExporting(true)
    try {
      const params = { mes: filtros.mes, formato }
      if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
      const blob = await exportarJornadas(params)
      const ext = formato === 'pdf' ? 'pdf' : formato === 'excel' ? 'xlsx' : 'csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `jornada_${filtros.mes}.${ext}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) } finally { setExporting(false) }
  }

  const totalHoras = jornadas.reduce((acc, j) => {
    const m = j.total_trabalhado?.match(/(\d+):(\d+)/)
    return acc + (m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0)
  }, 0)

  return (
    <div className="space-y-5">
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
          <label className="text-xs text-gray-400 block mb-1">Mês</label>
          <input type="month" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
        </div>
        <button onClick={buscar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Filtrar</button>
        <div className="flex gap-2 ml-auto">
          {['csv', 'excel', 'pdf'].map(fmt => (
            <button key={fmt} onClick={() => exportar(fmt)} disabled={exporting}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-2 rounded-lg text-xs uppercase font-semibold">
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {jornadas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border-l-4 border-emerald-500 rounded-xl p-4">
            <p className="text-xs text-gray-400">Dias registrados</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{jornadas.length}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-blue-500 rounded-xl p-4">
            <p className="text-xs text-gray-400">Total trabalhado</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{`${Math.floor(totalHoras/60)}h ${totalHoras%60}min`}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-yellow-500 rounded-xl p-4">
            <p className="text-xs text-gray-400">Média por dia</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">
              {jornadas.length ? `${Math.floor(totalHoras/jornadas.length/60)}h ${Math.floor(totalHoras/jornadas.length%60)}min` : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Saída Almoço</th>
              <th className="px-4 py-3">Retorno</th>
              <th className="px-4 py-3">Saída</th>
              <th className="px-4 py-3">Trabalhado</th>
              <th className="px-4 py-3">Saldo</th>
              {me?.papel === 'admin' && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={me?.papel === 'admin' ? 9 : 8} className="px-4 py-8 text-center text-gray-500">Carregando…</td></tr>
            ) : jornadas.length === 0 ? (
              <tr><td colSpan={me?.papel === 'admin' ? 9 : 8} className="px-4 py-8 text-center text-gray-500">Nenhum registro neste período.</td></tr>
            ) : jornadas.map((j, i) => {
              const saldoPositivo = j.saldo_dia && !j.saldo_dia.startsWith('-')
              return (
                <tr key={i} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                  <td className="px-4 py-3">{j.colaborador_nome}</td>
                  <td className="px-4 py-3">{new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{j.hora_entrada?.slice(0,5) || '—'}</td>
                  <td className="px-4 py-3">{j.hora_saida_almoco?.slice(0,5) || '—'}</td>
                  <td className="px-4 py-3">{j.hora_retorno_almoco?.slice(0,5) || '—'}</td>
                  <td className="px-4 py-3">{j.hora_saida?.slice(0,5) || '—'}</td>
                  <td className="px-4 py-3">{fmtHoras(j.total_trabalhado)}</td>
                  <td className={`px-4 py-3 font-medium ${saldoPositivo ? 'text-emerald-400' : 'text-red-400'}`}>{fmtHoras(j.saldo_dia)}</td>
                  {me?.papel === 'admin' && (
                    <td className="px-4 py-3">
                      <IconExcluir onClick={async () => {
                        if (!confirm(`Excluir jornada de ${j.colaborador_nome} em ${new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')}? Esta ação não pode ser desfeita.`)) return
                        try { await excluirJornada(j.id); buscar() } catch (e) { alert(e.message) }
                      }} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Modal Nova Batida ─────────────────────────────────────────────────────────
function ModalNovaBatida({ colaboradores, onClose, onSalvo }) {
  const [colaboradorId, setColaboradorId] = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [horario, setHorario] = useState(() => new Date().toISOString().slice(0, 16))
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!colaboradorId) return setErro('Selecione o colaborador.')
    if (!motivo.trim()) return setErro('Informe o motivo do lançamento.')
    setLoading(true)
    try {
      await criarRegistroManual({ colaborador_id: colaboradorId, tipo, registrado_em: horario + ':00', motivo })
      onSalvo(); onClose()
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
            {TIPOS.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
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

// ── Aba Registros ─────────────────────────────────────────────────────────────
function AbaRegistros({ colaboradores, me }) {
  const [registros, setRegistros] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', tipo: '', data: '' })
  const [loading, setLoading] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [ajusteReg, setAjusteReg] = useState(null)
  const [novaBatida, setNovaBatida] = useState(false)

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
    <div className="space-y-5">
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
        <button onClick={buscar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Filtrar</button>
        <button onClick={() => setNovaBatida(true)}
          className="ml-auto bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Nova Batida Manual
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
                  <span className="capitalize">{r.tipo?.replace(/_/g, ' ')}</span>
                  {r.origem === 'manual' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      manual
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{new Date(r.registrado_em).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-gray-500">{r.local_nome || '—'}</td>
                <td className="px-4 py-3">
                  {r.foto_url ? <IconVer onClick={() => setFotoReg(r)} /> : <span className="text-gray-600 px-1.5">—</span>}
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

// ── Aba Calendário ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ok:          { cor: 'bg-emerald-500',  texto: 'text-emerald-100', label: 'OK' },
  divergencia: { cor: 'bg-yellow-500',   texto: 'text-yellow-100',  label: 'Divergência' },
  falta:       { cor: 'bg-red-600',      texto: 'text-red-100',     label: 'Falta' },
  feriado:     { cor: 'bg-gray-600',     texto: 'text-gray-200',    label: 'Feriado' },
  folga:       { cor: 'bg-transparent',  texto: 'text-gray-700',    label: '' },
  futuro:      { cor: 'bg-transparent',  texto: 'text-gray-600',    label: '' },
}

const DIV_LABEL = {
  sem_entrada:     'Sem entrada',
  sem_saida:       'Sem saída',
  local_invalido:  'Local inválido',
  sem_foto:        'Sem foto',
  atraso_entrada:  'Atraso na entrada',
  saida_antecipada:'Saída antecipada',
}

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function AbaCalendario({ colaboradores }) {
  const hoje = new Date()
  const [colaboradorId, setColaboradorId] = useState('')
  const [mes, setMes] = useState(hoje.toISOString().slice(0, 7))
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState(null)

  async function buscar() {
    if (!colaboradorId) return
    setLoading(true)
    try { setDados(await getCalendario(colaboradorId, mes)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (colaboradorId) buscar() }, [colaboradorId, mes])

  function navMes(delta) {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Monta grid do calendário
  function montarGrid(dias) {
    if (!dias?.length) return []
    const primeiroDia = new Date(dias[0].data + 'T12:00:00').getDay() // 0=dom
    const grid = Array(primeiroDia).fill(null) // células vazias no início
    dias.forEach(d => grid.push(d))
    return grid
  }

  const legenda = [
    { status: 'ok',          label: 'Batidas ok' },
    { status: 'divergencia', label: 'Divergência' },
    { status: 'falta',       label: 'Falta' },
    { status: 'feriado',     label: 'Feriado / folga' },
  ]

  const contagem = dados?.dias?.reduce((acc, d) => {
    if (['ok','divergencia','falta','feriado'].includes(d.status))
      acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Colaborador *</label>
          <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="">Selecione um colaborador</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => navMes(-1)}
            className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg flex items-center justify-center">‹</button>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Mês</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
          <button onClick={() => navMes(1)}
            className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg flex items-center justify-center">›</button>
        </div>
      </div>

      {!colaboradorId && (
        <div className="text-center py-16 text-gray-500">Selecione um colaborador para ver o calendário.</div>
      )}

      {colaboradorId && loading && (
        <div className="text-center py-16 text-gray-500">Carregando…</div>
      )}

      {colaboradorId && !loading && dados && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { status: 'ok',          label: 'Dias OK',       cor: 'border-emerald-500 text-emerald-400' },
              { status: 'divergencia', label: 'Divergências',  cor: 'border-yellow-500 text-yellow-400'   },
              { status: 'falta',       label: 'Faltas',        cor: 'border-red-500 text-red-400'         },
              { status: 'feriado',     label: 'Feriados',      cor: 'border-gray-500 text-gray-400'       },
            ].map(({ status, label, cor }) => (
              <div key={status} className={`bg-gray-900 border-l-4 rounded-xl p-4 ${cor}`}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${cor.split(' ')[1]}`}>{contagem[status] || 0}</p>
              </div>
            ))}
          </div>

          {/* Calendário */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            {/* Cabeçalho dos dias */}
            <div className="grid grid-cols-7 mb-2 max-w-sm mx-auto">
              {SEMANA.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div className="grid grid-cols-7 gap-1 max-w-sm mx-auto">
              {montarGrid(dados.dias).map((dia, i) => {
                if (!dia) return <div key={i} />
                const cfg = STATUS_CONFIG[dia.status] || STATUS_CONFIG.futuro
                const dNum = new Date(dia.data + 'T12:00:00').getDate()
                const ehHoje = dia.data === hoje.toISOString().slice(0, 10)

                return (
                  <div
                    key={dia.data}
                    className={`relative h-9 flex flex-col items-center justify-center rounded-lg cursor-default
                      ${cfg.cor} ${dia.status === 'folga' || dia.status === 'futuro' ? '' : 'cursor-pointer'}
                      ${ehHoje ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}
                    `}
                    onMouseEnter={() => dia.status !== 'folga' && dia.status !== 'futuro' && setTooltip({ ...dia, x: i })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className={`text-xs font-bold ${cfg.texto}`}>{dNum}</span>
                    {dia.status === 'ok' && <span className="text-[8px] text-emerald-200 leading-none">✓</span>}
                  </div>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-800">
              {legenda.map(({ status, label }) => {
                const cfg = STATUS_CONFIG[status]
                return (
                  <div key={status} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${cfg.cor}`} />
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tooltip / detalhe do dia selecionado */}
          {tooltip && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-1">
              <p className="text-sm font-semibold text-gray-100">
                {new Date(tooltip.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                {' — '}
                <span className={`font-bold ${
                  tooltip.status === 'ok' ? 'text-emerald-400' :
                  tooltip.status === 'divergencia' ? 'text-yellow-400' :
                  tooltip.status === 'falta' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {STATUS_CONFIG[tooltip.status]?.label}
                </span>
              </p>
              {tooltip.divergencias?.length > 0 && (
                <ul className="text-xs text-yellow-300 list-disc list-inside space-y-0.5">
                  {tooltip.divergencias.map(d => <li key={d}>{DIV_LABEL[d] || d}</li>)}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Jornada() {
  const [aba, setAba] = useState('jornada')
  const [colaboradores, setColaboradores] = useState([])
  const [me, setMe] = useState(null)

  useEffect(() => {
    getColaboradores().then(setColaboradores).catch(() => {})
    getMe().then(setMe).catch(() => {})
  }, [])

  const abas = [
    { id: 'jornada',    label: 'Acompanhamento de jornada' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'registros',  label: 'Registro de batidas' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Acompanhamento de jornada</h1>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-800">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              aba === a.id
                ? 'bg-gray-900 text-emerald-400 border border-b-0 border-gray-800'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'jornada'    && <AbaJornada    colaboradores={colaboradores} me={me} />}
      {aba === 'calendario' && <AbaCalendario colaboradores={colaboradores} />}
      {aba === 'registros'  && <AbaRegistros  colaboradores={colaboradores} me={me} />}
    </div>
  )
}
