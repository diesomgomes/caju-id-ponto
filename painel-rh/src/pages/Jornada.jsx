import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  getJornadas, getRegistros, getColaboradores, exportarJornadas,
  excluirJornada, excluirRegistro, getFotoUrl, ajustarRegistro, getMe,
  getCalendario, criarRegistroManual, getRelatorio,
  criarAtestado, getAtestados, getArquivoAtestado, excluirAtestado,
  getAjustesBanco, criarAjusteBanco, excluirAjusteBanco, atualizarColaborador,
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
  const [novoHorario, setNovoHorario] = useState(() => {
    const d = new Date(registro.registrado_em)
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!motivo.trim()) return setErro('Informe o motivo do ajuste.')
    setLoading(true)
    try {
      await ajustarRegistro(registro.id, { tipo: novoTipo, registrado_em: new Date(novoHorario).toISOString(), motivo })
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

// ── Modal Ver Atestado ────────────────────────────────────────────────────────
function ModalVerAtestado({ atestado, nomeColab, onClose, onExcluir }) {
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlArquivo, setUrlArquivo] = useState(null)
  const [erroUrl, setErroUrl] = useState('')

  const dInicio = new Date(atestado.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')
  const dFim    = new Date(atestado.data_fim    + 'T12:00:00').toLocaleDateString('pt-BR')

  async function abrirArquivo() {
    setLoadingUrl(true); setErroUrl('')
    try {
      const d = await getArquivoAtestado(atestado.id)
      setUrlArquivo(d.url)
      const a = document.createElement('a')
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener noreferrer'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch { setErroUrl('Não foi possível abrir o arquivo. Verifique se o bucket "atestados" existe no Supabase Storage.') }
    finally { setLoadingUrl(false) }
  }

  async function baixarArquivo() {
    setLoadingUrl(true); setErroUrl('')
    try {
      const d = urlArquivo ? { url: urlArquivo } : await getArquivoAtestado(atestado.id)
      const res = await fetch(d.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = atestado.arquivo_url?.split('.').pop() || 'pdf'
      a.href = url; a.download = `atestado_${nomeColab.replace(/\s+/g,'_')}_${atestado.data_inicio}.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { setErroUrl('Erro ao baixar arquivo.') }
    finally { setLoadingUrl(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <h3 className="font-semibold text-gray-100">Atestado Médico</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Colaborador</span>
            <span className="text-gray-100 font-medium">{nomeColab}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Data início</span>
            <span className="text-gray-100">{dInicio}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Data fim</span>
            <span className="text-gray-100">{dFim}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duração</span>
            <span className="text-blue-400 font-semibold">{atestado.qtd_dias} dia{atestado.qtd_dias !== 1 ? 's' : ''}</span>
          </div>
          {atestado.observacao && (
            <div className="pt-1 border-t border-gray-700">
              <span className="text-gray-400">Observação: </span>
              <span className="text-gray-200">{atestado.observacao}</span>
            </div>
          )}
        </div>
        {atestado.arquivo_url ? (
          <div className="flex gap-2">
            <button onClick={abrirArquivo} disabled={loadingUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              {loadingUrl ? 'Abrindo…' : 'Abrir arquivo'}
            </button>
            <button onClick={baixarArquivo} disabled={loadingUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Baixar
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-700 rounded-lg">
            Nenhum arquivo anexado a este atestado
          </p>
        )}
        {erroUrl && <p className="text-xs text-red-400">{erroUrl}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">Fechar</button>
          <button onClick={onExcluir} className="py-2 px-4 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 text-sm border border-red-800/50">
            Remover atestado
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

// ── Modal Nova Batida ─────────────────────────────────────────────────────────
function ModalNovaBatida({ colaboradores, onClose, onSalvo }) {
  const [colaboradorId, setColaboradorId] = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [horario, setHorario] = useState(() => {
    const now = new Date()
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [motivo, setMotivo] = useState('')
  // Campos de atestado
  const [dataAtestado, setDataAtestado] = useState(() => new Date().toISOString().slice(0, 10))
  const [qtdDias, setQtdDias] = useState(1)
  const [arquivo, setArquivo] = useState(null)
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = { current: null }

  const isAtestado = tipo === 'atestado'

  async function salvar() {
    if (!colaboradorId) return setErro('Selecione o colaborador.')
    setLoading(true)
    try {
      if (isAtestado) {
        const form = new FormData()
        form.append('colaborador_id', colaboradorId)
        form.append('data_inicio', dataAtestado)
        form.append('qtd_dias', String(qtdDias))
        form.append('observacao', observacao)
        if (arquivo) form.append('arquivo', arquivo)
        await criarAtestado(form)
      } else {
        if (!motivo.trim()) { setLoading(false); return setErro('Informe o motivo do lançamento.') }
        await criarRegistroManual({ colaborador_id: colaboradorId, tipo, registrado_em: new Date(horario).toISOString(), motivo })
      }
      onSalvo(); onClose()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Nova Batida Manual</h3>
            <p className="text-xs text-amber-400 mt-0.5">
              {isAtestado ? 'Os dias serão marcados como atestado no calendário.' : 'Este registro ficará marcado como lançamento manual.'}
            </p>
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
            <option value="atestado">Atestado</option>
          </select>
        </div>

        {isAtestado ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Data do atestado</label>
                <input type="date" value={dataAtestado} onChange={e => setDataAtestado(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-400">Quantidade de dias</label>
                <input type="number" min={1} value={qtdDias} onChange={e => setQtdDias(Math.max(1, Number(e.target.value)))}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100" />
              </div>
            </div>
            {qtdDias > 0 && (
              <p className="text-xs text-blue-400">
                Período: {new Date(dataAtestado + 'T12:00:00').toLocaleDateString('pt-BR')} até{' '}
                {new Date(new Date(dataAtestado + 'T12:00:00').getTime() + (qtdDias - 1) * 86400000).toLocaleDateString('pt-BR')}
              </p>
            )}
            <div>
              <label className="text-sm text-gray-400">Arquivo do atestado (opcional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={e => setArquivo(e.target.files[0] || null)}
                className="w-full mt-1 text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
              />
              {arquivo && <p className="text-xs text-gray-500 mt-1">{arquivo.name}</p>}
            </div>
            <div>
              <label className="text-sm text-gray-400">Observação (opcional)</label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 resize-none text-sm"
                placeholder="Ex: Consulta médica, cirurgia…" />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={loading}
            className={`flex-1 py-2 rounded-lg disabled:opacity-50 text-white font-semibold ${isAtestado ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
            {loading ? 'Salvando…' : isAtestado ? 'Registrar Atestado' : 'Lançar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

// ── Aba Registros ─────────────────────────────────────────────────────────────
function AbaRegistros({ colaboradores, me }) {
  const [registros, setRegistros] = useState([])
  const [atestados, setAtestados] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', tipo: '', data: '' })
  const [loading, setLoading] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [ajusteReg, setAjusteReg] = useState(null)
  const [atestadoVer, setAtestadoVer] = useState(null)
  const [novaBatida, setNovaBatida] = useState(false)

  async function buscar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const params = {}
    if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
    if (filtros.tipo) params.tipo = filtros.tipo
    if (filtros.data) params.data = filtros.data
    const mesAtestado = filtros.data ? filtros.data.slice(0, 7) : new Date().toISOString().slice(0, 7)
    const ateParams = { mes: mesAtestado }
    if (filtros.colaborador_id) ateParams.colaborador_id = filtros.colaborador_id
    try {
      const [regs, ates] = await Promise.all([
        getRegistros(params),
        filtros.tipo ? Promise.resolve([]) : getAtestados(ateParams),
      ])
      setRegistros(regs)
      setAtestados(ates)
    } catch (e) { console.error(e) }
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
              <th className="px-4 py-3">Horário / Período</th>
              <th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Arquivo / Foto</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando…</td></tr>
            ) : registros.length === 0 && atestados.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
            ) : (
              <>
                {atestados.map(a => {
                  const nomeColab = colaboradores.find(c => c.id === a.colaborador_id)?.nome || '—'
                  const dInicio = new Date(a.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')
                  const dFim    = new Date(a.data_fim    + 'T12:00:00').toLocaleDateString('pt-BR')
                  return (
                    <tr key={'at-' + a.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-blue-950/20 bg-blue-950/10">
                      <td className="px-4 py-3">{nomeColab}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          🏥 Atestado
                        </span>
                        {a.observacao && <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[140px]">{a.observacao}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {dInicio === dFim ? dInicio : `${dInicio} a ${dFim}`}
                        <span className="ml-2 text-xs text-gray-500">({a.qtd_dias} dia{a.qtd_dias !== 1 ? 's' : ''})</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">—</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setAtestadoVer({ atestado: a, nomeColab })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-blue-400 border border-blue-700/50 hover:border-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          {a.arquivo_url ? 'Ver / Baixar' : 'Ver detalhes'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {me?.papel === 'admin' && (
                          <IconExcluir onClick={async () => {
                            if (!confirm(`Remover atestado de ${nomeColab}?`)) return
                            try { await excluirAtestado(a.id); buscar() } catch (e) { alert(e.message) }
                          }} />
                        )}
                      </td>
                    </tr>
                  )
                })}

                {registros.map(r => (
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
              </>
            )}
          </tbody>
        </table>
      </div>

      {fotoReg && <ModalFoto registro={fotoReg} onClose={() => setFotoReg(null)} />}
      {ajusteReg && <ModalAjuste registro={ajusteReg} onClose={() => setAjusteReg(null)} onSalvo={buscar} />}
      {novaBatida && <ModalNovaBatida colaboradores={colaboradores} onClose={() => setNovaBatida(false)} onSalvo={buscar} />}
      {atestadoVer && (
        <ModalVerAtestado
          atestado={atestadoVer.atestado}
          nomeColab={atestadoVer.nomeColab}
          onClose={() => setAtestadoVer(null)}
          onExcluir={async () => {
            if (!confirm(`Remover atestado de ${atestadoVer.nomeColab}?`)) return
            try { await excluirAtestado(atestadoVer.atestado.id); setAtestadoVer(null); buscar() }
            catch (e) { alert(e.message) }
          }}
        />
      )}
    </div>
  )
}

// ── Painel de Atestado ────────────────────────────────────────────────────────
function PainelAtestado({ atestado, onExcluir }) {
  const [urlArquivo, setUrlArquivo] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  async function abrirArquivo() {
    setLoadingUrl(true)
    try {
      const d = await getArquivoAtestado(atestado.id)
      window.open(d.url, '_blank')
    } catch (e) { alert('Erro ao abrir arquivo.') }
    finally { setLoadingUrl(false) }
  }

  return (
    <div className="bg-blue-950/40 border border-blue-700/40 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <span className="text-sm font-semibold text-blue-300">Atestado médico</span>
          </div>
          <p className="text-xs text-gray-400">
            Período:{' '}
            <span className="text-gray-200">
              {new Date(atestado.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
              {' '}até{' '}
              {new Date(atestado.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
              {' '}({atestado.qtd_dias} dia{atestado.qtd_dias !== 1 ? 's' : ''})
            </span>
          </p>
          {atestado.observacao && (
            <p className="text-xs text-gray-400">
              Obs: <span className="text-gray-300">{atestado.observacao}</span>
            </p>
          )}
        </div>
        <button onClick={onExcluir}
          className="shrink-0 text-xs text-red-400 hover:text-red-300 border border-red-700/50 hover:border-red-500 rounded-lg px-2 py-1 transition-colors">
          Remover
        </button>
      </div>
      {atestado.arquivo_url && (
        <button onClick={abrirArquivo} disabled={loadingUrl}
          className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 border border-blue-700/50 hover:border-blue-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {loadingUrl ? 'Abrindo…' : 'Ver arquivo do atestado'}
        </button>
      )}
    </div>
  )
}

// ── Aba Calendário ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ok:                  { cor: 'bg-emerald-500',  texto: 'text-emerald-100', label: 'OK' },
  divergencia:         { cor: 'bg-yellow-500',   texto: 'text-yellow-100',  label: 'Divergência' },
  falta:               { cor: 'bg-red-600',      texto: 'text-red-100',     label: 'Falta' },
  feriado:             { cor: 'bg-gray-600',     texto: 'text-gray-200',    label: 'Feriado' },
  atestado:            { cor: 'bg-blue-600',     texto: 'text-blue-100',    label: 'Atestado' },
  folga:               { cor: 'bg-transparent',  texto: 'text-gray-700',    label: '' },
  futuro:              { cor: 'bg-transparent',  texto: 'text-gray-600',    label: '' },
  sem_acompanhamento:  { cor: 'bg-transparent',  texto: 'text-gray-400',    label: '' },
}

const DIV_LABEL = {
  sem_entrada:      'Sem entrada',
  sem_saida:        'Sem saída',
  local_invalido:   'Local inválido',
  sem_foto:         'Sem foto',
  atraso_entrada:   'Atraso na entrada',
  saida_antecipada: 'Saída antecipada',
}

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const TIPO_LABEL = {
  entrada: 'Entrada',
  saida_almoco: 'Saída Almoço',
  retorno_almoco: 'Retorno Almoço',
  saida: 'Saída',
}

function CardRegistro({ registro, onClick }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (registro.foto_url) {
      getFotoUrl(registro.id).then(d => setUrl(d.url)).catch(() => {})
    }
  }, [registro.id])

  return (
    <div
      onClick={() => onClick(registro)}
      className="bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
    >
      <div className="h-32 bg-gray-700 flex items-center justify-center">
        {url
          ? <img src={url} alt="selfie" className="h-full w-full object-cover" />
          : <span className="text-gray-500 text-xs">{registro.foto_url ? 'Carregando…' : 'Sem foto'}</span>
        }
      </div>
      <div className="px-3 py-2 space-y-0.5">
        <p className="text-xs font-semibold text-gray-100">{TIPO_LABEL[registro.tipo] || registro.tipo}</p>
        <p className="text-xs text-gray-400">{new Date(registro.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        {registro.ajustado && registro.horario_original && !isNaN(new Date(registro.horario_original)) && (
          <p className="text-[10px] text-gray-500 line-through">
            orig: {new Date(registro.horario_original).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {registro.local_nome && <p className="text-xs text-gray-500 truncate">{registro.local_nome}</p>}
        {registro.ajustado && (
          <div className="space-y-0.5 pt-0.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">ajustado</span>
            {registro.ajuste_por && <p className="text-[9px] text-gray-500 truncate">por {registro.ajuste_por}</p>}
            {registro.ajuste_motivo && <p className="text-[9px] text-gray-400 italic leading-tight line-clamp-2" title={registro.ajuste_motivo}>"{registro.ajuste_motivo}"</p>}
          </div>
        )}
        {registro.origem === 'manual' && (
          <div className="space-y-0.5 pt-0.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">manual</span>
            {registro.lancado_por && <p className="text-[9px] text-gray-500 truncate">por {registro.lancado_por}</p>}
            {registro.motivo && <p className="text-[9px] text-gray-400 italic leading-tight line-clamp-2" title={registro.motivo}>"{registro.motivo}"</p>}
          </div>
        )}
      </div>
    </div>
  )
}

async function exportarRelatorio(mes, colaboradorId, colaboradores, formato) {
  const rows = await getRelatorio(mes, colaboradorId || null)
  if (!rows?.length) { alert('Nenhum dado para exportar.'); return }

  const [ano, m] = mes.split('-')
  const nomeMes = new Date(Number(ano), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long' })
  const nomeColab = colaboradorId
    ? (colaboradores.find(c => c.id === colaboradorId)?.nome || 'colaborador')
    : 'Todos os colaboradores'
  const titulo = `Relatório de Ponto — ${nomeColab} — ${nomeMes}/${ano}`

  const cabecalho = ['#', 'Data', 'Dia', 'Colaborador', 'Entrada', 'Saída Almoço', 'Retorno Almoço', 'Saída', 'Divergências']
  const linhas = rows.map(r => [
    r.num, r.data, r.dia_semana, r.colaborador,
    r.entrada, r.saida_almoco, r.retorno_almoco, r.saida, r.divergencias,
  ])

  if (formato === 'xlsx') {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [], cabecalho, ...linhas])
    ws['!cols'] = [4,12,10,28,10,14,16,10,30].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    XLSX.writeFile(wb, `relatorio_ponto_${mes}.xlsx`)
  } else {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(12)
    doc.text(titulo, 14, 14)
    autoTable(doc, {
      startY: 20,
      head: [cabecalho],
      body: linhas,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 8: { cellWidth: 40 } },
    })
    doc.save(`relatorio_ponto_${mes}.pdf`)
  }
}

function AbaCalendario({ colaboradores }) {
  const hoje = new Date()
  const [colaboradorId, setColaboradorId] = useState('')
  const [mes, setMes] = useState(hoje.toISOString().slice(0, 7))
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [registrosDia, setRegistrosDia] = useState([])
  const [loadingDia, setLoadingDia] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [exportando, setExportando] = useState(false)

  async function buscar() {
    if (!colaboradorId) return
    setLoading(true)
    setDiaSelecionado(null)
    setRegistrosDia([])
    try { setDados(await getCalendario(colaboradorId, mes)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (colaboradorId) buscar() }, [colaboradorId, mes])

  async function selecionarDia(dia) {
    if (dia.status === 'folga' || dia.status === 'futuro') return
    setDiaSelecionado(dia)
    if (dia.status === 'atestado') { setRegistrosDia([]); return }
    setLoadingDia(true)
    try {
      const regs = await getRegistros({ colaborador_id: colaboradorId, data: dia.data })
      setRegistrosDia(regs)
    } catch (e) { console.error(e) }
    finally { setLoadingDia(false) }
  }

  function navMes(delta) {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function montarGrid(dias) {
    if (!dias?.length) return []
    const primeiroDia = new Date(dias[0].data + 'T12:00:00').getDay()
    const grid = Array(primeiroDia).fill(null)
    dias.forEach(d => grid.push(d))
    return grid
  }

  const contagem = dados?.dias?.reduce((acc, d) => {
    if (['ok','divergencia','falta','feriado','atestado'].includes(d.status))
      acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {}) || {}

  async function handleExportar(fmt) {
    setExportando(true)
    try { await exportarRelatorio(mes, colaboradorId, colaboradores, fmt) }
    catch (e) { console.error(e); alert('Erro ao gerar relatório.') }
    finally { setExportando(false) }
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Colaborador</label>
            <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
              <option value="">Todos os colaboradores</option>
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

        {/* Botões exportar */}
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Exportar relatório</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleExportar('xlsx')}
                disabled={exportando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {exportando ? '…' : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )} XLSX
              </button>
              <button
                onClick={() => handleExportar('pdf')}
                disabled={exportando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {exportando ? '…' : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )} PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {!colaboradorId && (
        <div className="text-center py-16 text-gray-500">Selecione um colaborador para ver o calendário, ou use os botões acima para exportar o relatório de todos.</div>
      )}

      {colaboradorId && loading && (
        <div className="text-center py-16 text-gray-500">Carregando…</div>
      )}

      {colaboradorId && !loading && dados && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { status: 'ok',          label: 'Dias OK',      cor: 'border-emerald-500 text-emerald-400' },
              { status: 'divergencia', label: 'Divergências', cor: 'border-yellow-500 text-yellow-400'   },
              { status: 'falta',       label: 'Faltas',       cor: 'border-red-500 text-red-400'         },
              { status: 'atestado',    label: 'Atestados',    cor: 'border-blue-500 text-blue-400'       },
              { status: 'feriado',     label: 'Feriados',     cor: 'border-gray-500 text-gray-400'       },
            ].map(({ status, label, cor }) => (
              <div key={status} className={`bg-gray-900 border-l-4 rounded-xl p-4 ${cor}`}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${cor.split(' ')[1]}`}>{contagem[status] || 0}</p>
              </div>
            ))}
          </div>

          {/* Layout: calendário esquerda | mosaico direita */}
          <div className="flex gap-5 items-start">

            {/* Calendário */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 shrink-0 w-72">
              <div className="grid grid-cols-7 mb-2">
                {SEMANA.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {montarGrid(dados.dias).map((dia, i) => {
                  if (!dia) return <div key={i} />
                  const cfg = STATUS_CONFIG[dia.status] || STATUS_CONFIG.futuro
                  const dNum = new Date(dia.data + 'T12:00:00').getDate()
                  const ehHoje = dia.data === hoje.toISOString().slice(0, 10)
                  const selecionado = diaSelecionado?.data === dia.data
                  const clicavel = !['folga','futuro','sem_acompanhamento'].includes(dia.status)

                  return (
                    <div
                      key={dia.data}
                      onClick={() => clicavel && selecionarDia(dia)}
                      className={`h-9 flex flex-col items-center justify-center rounded-lg
                        ${cfg.cor}
                        ${clicavel ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                        ${ehHoje ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}
                        ${selecionado ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110 z-10 relative' : ''}
                      `}
                    >
                      <span className={`text-xs font-bold ${cfg.texto}`}>{dNum}</span>
                      {dia.status === 'ok' && <span className="text-[7px] text-emerald-200 leading-none">✓</span>}
                    </div>
                  )
                })}
              </div>

              {/* Legenda */}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-800">
                {[
                  { status: 'ok',          label: 'Batidas ok' },
                  { status: 'divergencia', label: 'Divergência' },
                  { status: 'falta',       label: 'Falta' },
                  { status: 'atestado',    label: 'Atestado' },
                  { status: 'feriado',     label: 'Feriado / folga' },
                ].map(({ status, label }) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm shrink-0 ${STATUS_CONFIG[status].cor}`} />
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Painel direito: mosaico do dia selecionado */}
            <div className="flex-1 min-h-[300px]">
              {!diaSelecionado && (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl py-20">
                  Clique em um dia para ver os registros
                </div>
              )}

              {diaSelecionado && (
                <div className="space-y-4">
                  {/* Cabeçalho do dia */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-100 capitalize">
                        {new Date(diaSelecionado.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${
                        diaSelecionado.status === 'ok' ? 'text-emerald-400' :
                        diaSelecionado.status === 'divergencia' ? 'text-yellow-400' :
                        diaSelecionado.status === 'falta' ? 'text-red-400' :
                        diaSelecionado.status === 'atestado' ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {STATUS_CONFIG[diaSelecionado.status]?.label}
                        {diaSelecionado.divergencias?.length > 0 && ' — ' + diaSelecionado.divergencias.map(d => DIV_LABEL[d] || d).join(', ')}
                      </p>
                    </div>
                    {diaSelecionado.status !== 'atestado' && (
                      <span className="text-xs text-gray-500">{registrosDia.length} batida{registrosDia.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {/* Painel de atestado */}
                  {diaSelecionado.status === 'atestado' && diaSelecionado.atestado && (
                    <PainelAtestado atestado={diaSelecionado.atestado} onExcluir={async () => {
                      if (!confirm('Remover este atestado?')) return
                      try { await excluirAtestado(diaSelecionado.atestado.id); buscar() }
                      catch (e) { alert(e.message) }
                    }} />
                  )}

                  {diaSelecionado.status !== 'atestado' && loadingDia && (
                    <div className="text-center py-10 text-gray-500 text-sm">Carregando registros…</div>
                  )}

                  {diaSelecionado.status !== 'atestado' && !loadingDia && registrosDia.length === 0 && (
                    <div className="text-center py-10 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">
                      Nenhum registro neste dia
                    </div>
                  )}

                  {diaSelecionado.status !== 'atestado' && !loadingDia && registrosDia.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[...registrosDia].sort((a, b) => new Date(a.registrado_em) - new Date(b.registrado_em)).map(r => (
                        <CardRegistro key={r.id} registro={r} onClick={setFotoReg} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {fotoReg && <ModalFoto registro={fotoReg} onClose={() => setFotoReg(null)} />}
    </div>
  )
}

// ── Banco de Horas ────────────────────────────────────────────────────────────
function fmtMinutos(min) {
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sinal = min < 0 ? '−' : '+'
  return `${sinal}${h}h${m > 0 ? ` ${m}min` : ''}`
}

function AbaBancoHoras({ colaboradores }) {
  const [colaboradorId, setColaboradorId] = useState('')
  const [colaborador, setColaborador] = useState(null)
  const [ajustes, setAjustes] = useState([])
  const [sinal, setSinal] = useState('+')
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('0')
  const [descricao, setDescricao] = useState('')
  const [dataRef, setDataRef] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvandoBloqueio, setSalvandoBloqueio] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const bloqueado = !!colaborador?.banco_horas_bloqueado

  async function carregarColaborador(id) {
    if (!id) { setColaborador(null); setAjustes([]); return }
    setLoading(true)
    try {
      const c = colaboradores.find(x => x.id === id) || null
      setColaborador(c)
      const lista = await getAjustesBanco(id)
      setAjustes(lista)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { carregarColaborador(colaboradorId) }, [colaboradorId])

  async function toggleBloqueio() {
    if (!colaborador) return
    setSalvandoBloqueio(true)
    try {
      const novo = !bloqueado
      await atualizarColaborador(colaborador.id, { banco_horas_bloqueado: novo })
      setColaborador(c => ({ ...c, banco_horas_bloqueado: novo }))
    } catch (e) { alert(e.message) } finally { setSalvandoBloqueio(false) }
  }

  async function salvar() {
    if (bloqueado) return
    const h = parseInt(horas) || 0
    const m = parseInt(minutos) || 0
    const total = (h * 60 + m) * (sinal === '-' ? -1 : 1)
    if (total === 0) return setErro('Informe pelo menos 1 minuto.')
    if (!descricao.trim()) return setErro('Informe uma descrição.')
    setErro(''); setSalvando(true)
    try {
      await criarAjusteBanco(colaboradorId, { minutos: total, descricao: descricao.trim(), data_referencia: dataRef || null })
      setHoras(''); setMinutos('0'); setDescricao(''); setDataRef('')
      setAjustes(await getAjustesBanco(colaboradorId))
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function remover(id) {
    if (bloqueado) return
    if (!confirm('Remover este ajuste?')) return
    try {
      await excluirAjusteBanco(id)
      setAjustes(a => a.filter(x => x.id !== id))
    } catch (e) { alert(e.message) }
  }

  const totalGeral = ajustes.reduce((s, a) => s + a.minutos, 0)

  return (
    <div className="space-y-5">
      {/* Seletor de colaborador */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Colaborador</label>
          <select
            value={colaboradorId}
            onChange={e => setColaboradorId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm min-w-[220px]"
          >
            <option value="">Selecione um colaborador…</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {!colaboradorId && (
        <div className="text-center py-16 text-gray-500">Selecione um colaborador para gerenciar o banco de horas.</div>
      )}

      {colaboradorId && loading && (
        <div className="text-center py-16 text-gray-500">Carregando…</div>
      )}

      {colaboradorId && !loading && colaborador && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Painel esquerdo: status + formulário */}
          <div className="space-y-4">
            {/* Toggle bloqueio */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-4 border ${bloqueado ? 'bg-red-900/20 border-red-800/50' : 'bg-emerald-900/20 border-emerald-800/50'}`}>
              <div>
                <p className={`text-sm font-semibold ${bloqueado ? 'text-red-400' : 'text-emerald-400'}`}>
                  {bloqueado ? '🔒 Banco de horas bloqueado' : '🔓 Banco de horas ativo'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bloqueado ? 'Nenhum ajuste pode ser adicionado ou removido.' : 'Ajustes manuais permitidos.'}
                </p>
              </div>
              <button
                onClick={toggleBloqueio}
                disabled={salvandoBloqueio}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${bloqueado ? 'bg-red-600' : 'bg-emerald-500'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${bloqueado ? 'translate-x-1' : 'translate-x-6'}`} />
              </button>
            </div>

            {/* Saldo total */}
            <div className={`rounded-xl px-4 py-4 text-center border ${totalGeral >= 0 ? 'bg-emerald-900/30 border-emerald-800/40' : 'bg-red-900/30 border-red-800/40'}`}>
              <p className="text-xs text-gray-400 mb-0.5">Saldo de ajustes manuais</p>
              <p className={`text-3xl font-bold ${totalGeral >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMinutos(totalGeral)}</p>
            </div>

            {/* Formulário novo ajuste */}
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 ${bloqueado ? 'opacity-40 pointer-events-none select-none' : ''}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Novo ajuste</p>
              <div className="flex gap-2 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
                  <button onClick={() => setSinal('+')}
                    className={`px-3 py-2 text-sm font-bold transition-colors ${sinal === '+' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>+</button>
                  <button onClick={() => setSinal('-')}
                    className={`px-3 py-2 text-sm font-bold transition-colors ${sinal === '-' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>−</button>
                </div>
                <input type="number" min="0" placeholder="Horas" value={horas} onChange={e => setHoras(e.target.value)}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm text-center" />
                <span className="self-center text-gray-400 text-sm">h</span>
                <input type="number" min="0" max="59" placeholder="Min" value={minutos} onChange={e => setMinutos(e.target.value)}
                  className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm text-center" />
                <span className="self-center text-gray-400 text-sm">min</span>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Motivo / descrição *" value={descricao} onChange={e => setDescricao(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
                <input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)}
                  title="Data de referência (opcional)"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              </div>
              {erro && <p className="text-red-400 text-xs">{erro}</p>}
              <button onClick={salvar} disabled={salvando}
                className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold">
                {salvando ? 'Salvando…' : 'Registrar ajuste'}
              </button>
            </div>
          </div>

          {/* Painel direito: histórico */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Histórico de ajustes</p>
            {ajustes.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">Nenhum ajuste registrado.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {ajustes.map(a => {
                  const isAuto = a.origem === 'automatico'
                  return (
                    <div key={a.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 gap-3 ${isAuto ? 'bg-indigo-950/40 border border-indigo-800/30' : 'bg-gray-800/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isAuto && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                              automático
                            </span>
                          )}
                          <p className="text-xs text-gray-300 truncate">{a.descricao}</p>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {a.data_referencia
                            ? <><span className="text-blue-400">📅 {new Date(a.data_referencia + 'T12:00:00').toLocaleDateString('pt-BR')}</span> · registrado em {new Date(a.criado_em).toLocaleDateString('pt-BR')}</>
                            : <>registrado em {new Date(a.criado_em).toLocaleDateString('pt-BR')}</>
                          }
                        </p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${a.minutos >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMinutos(a.minutos)}</span>
                      {!bloqueado && !isAuto && (
                        <button onClick={() => remover(a.id)} className="text-gray-600 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                      )}
                      {isAuto && <div className="w-5 flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Jornada() {
  const [aba, setAba] = useState('calendario')
  const [colaboradores, setColaboradores] = useState([])
  const [me, setMe] = useState(null)

  useEffect(() => {
    getColaboradores().then(setColaboradores).catch(() => {})
    getMe().then(setMe).catch(() => {})
  }, [])

  const abas = [
    { id: 'calendario',  label: 'Calendário' },
    { id: 'registros',   label: 'Registro de batidas' },
    { id: 'banco_horas', label: 'Banco de horas' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Ponto</h1>

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

      {aba === 'calendario'  && <AbaCalendario  colaboradores={colaboradores} />}
      {aba === 'registros'   && <AbaRegistros   colaboradores={colaboradores} me={me} />}
      {aba === 'banco_horas' && <AbaBancoHoras   colaboradores={colaboradores} />}
    </div>
  )
}
