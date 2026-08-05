import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getRegistros, getColaboradores, getFotoUrl, ajustarRegistro, excluirRegistro, getMe, criarRegistroManual, criarAtestado, getAtestados, getArquivoAtestado, excluirAtestado } from '../api'
import Portal from '../components/Portal'
import { IconVer, IconAjustar, IconExcluir } from '../components/IconBtn'

const TIPOS = ['', 'entrada', 'saida_almoco', 'retorno_almoco', 'saida']

function ModalVerAtestado({ atestado, nomeColab, onClose, onExcluir }) {
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlArquivo, setUrlArquivo] = useState(null)
  const [erroUrl, setErroUrl] = useState('')

  const dInicio = new Date(atestado.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')
  const dFim    = new Date(atestado.data_fim    + 'T12:00:00').toLocaleDateString('pt-BR')

  async function abrirArquivo() {
    setLoadingUrl(true)
    setErroUrl('')
    try {
      const d = await getArquivoAtestado(atestado.id)
      setUrlArquivo(d.url)
      // Cria link temporário e clica — mais confiável que window.open
      const a = document.createElement('a')
      a.href = d.url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      setErroUrl('Não foi possível abrir o arquivo. Verifique se o bucket "atestados" existe no Supabase Storage.')
    } finally { setLoadingUrl(false) }
  }

  async function baixarArquivo() {
    setLoadingUrl(true)
    setErroUrl('')
    try {
      const d = urlArquivo ? { url: urlArquivo } : await getArquivoAtestado(atestado.id)
      const res = await fetch(d.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = atestado.arquivo_url?.split('.').pop() || 'pdf'
      a.href = url
      a.download = `atestado_${nomeColab.replace(/\s+/g,'_')}_${atestado.data_inicio}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setErroUrl('Erro ao baixar arquivo.')
    } finally { setLoadingUrl(false) }
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
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              {loadingUrl ? 'Abrindo…' : 'Abrir arquivo'}
            </button>
            <button onClick={baixarArquivo} disabled={loadingUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
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
          <button onClick={onExcluir} className="py-2 px-4 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 text-sm border border-red-800/50 transition-colors">
            Remover atestado
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

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
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [motivo, setMotivo] = useState('')
  const [dataAtestado, setDataAtestado] = useState(() => new Date().toISOString().slice(0, 10))
  const [qtdDias, setQtdDias] = useState(1)
  const [arquivo, setArquivo] = useState(null)
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

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
      onSalvo()
      onClose()
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
            {TIPOS.slice(1).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
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

export default function Registros() {
  const [registros, setRegistros] = useState([])
  const [atestados, setAtestados] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', tipo: '', data: '' })
  const [loading, setLoading] = useState(false)
  const [fotoReg, setFotoReg] = useState(null)
  const [ajusteReg, setAjusteReg] = useState(null)
  const [atestadoVer, setAtestadoVer] = useState(null)
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
    const mesAtestado = filtros.data ? filtros.data.slice(0, 7) : new Date().toISOString().slice(0, 7)
    const ateParams = {}
    if (filtros.colaborador_id) ateParams.colaborador_id = filtros.colaborador_id
    ateParams.mes = mesAtestado
    try {
      const [regs, ates] = await Promise.all([
        getRegistros(params),
        filtros.tipo && filtros.tipo !== '' ? Promise.resolve([]) : getAtestados(ateParams),
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
                {/* Linhas de atestado */}
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

                {/* Linhas de registros normais */}
                {registros.map(r => (
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
