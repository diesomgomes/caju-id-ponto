import { useEffect, useState } from 'react'
import {
  getColaboradores, criarColaborador, atualizarColaborador, excluirColaborador,
  getEmpresas, getModelosJornada, getLocais, getLocaisColaborador, setLocaisColaborador,
} from '../api'
import Portal from '../components/Portal'

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

const CAMPOS_VAZIO = { nome: '', cpf: '', pis: '', email: '', cargo: '', departamento: '', empresa_id: '', carga_horaria_diaria: '08:00:00' }

const JORNADA_VAZIO = {
  hora_entrada_esperada: '08:00',
  hora_saida_esperada: '17:00',
  carga_horaria_diaria: '08:00:00',
  dias_trabalho: 'seg,ter,qua,qui,sex',
}

function ModalColaborador({ titulo, dados, onChange, onSalvar, onFechar, loading, erro, empresas, modelos }) {
  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">{titulo}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Empresa *</label>
          <select value={dados.empresa_id || ''} onChange={e => onChange('empresa_id', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="">Selecione a empresa</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Jornada de trabalho</label>
          <select value={dados.modelo_jornada_id || ''} onChange={e => onChange('modelo_jornada_id', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="">Sem jornada definida</option>
            {(modelos || []).filter(m => !dados.empresa_id || m.empresa_id === dados.empresa_id).map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        {[
          { key: 'nome', label: 'Nome completo', type: 'text' },
          { key: 'cpf', label: 'CPF', type: 'text' },
          { key: 'pis', label: 'PIS/PASEP', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'cargo', label: 'Cargo', type: 'text' },
          { key: 'departamento', label: 'Departamento', type: 'text' },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input type={type} value={dados[key] || ''} onChange={e => onChange(key, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
        ))}
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={onSalvar} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

function ModalLocais({ colaborador, todosLocais, onFechar, onSalvo }) {
  const [selecionados, setSelecionados] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLocaisColaborador(colaborador.id)
      .then(ids => setSelecionados(ids))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [colaborador.id])

  function toggle(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function salvar() {
    setSaving(true)
    try {
      await setLocaisColaborador(colaborador.id, selecionados)
      onSalvo()
      onFechar()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Locais Permitidos</h3>
            <p className="text-xs text-gray-500 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-4">Carregando...</p>
        ) : todosLocais.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nenhum local cadastrado para esta empresa.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todosLocais.map(l => (
              <label key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" checked={selecionados.includes(l.id)} onChange={() => toggle(l.id)}
                  className="w-4 h-4 accent-emerald-500" />
                <div>
                  <p className="text-sm text-gray-100">{l.nome}</p>
                  <p className="text-xs text-gray-500">Raio: {l.raio_metros}m</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          {selecionados.length === 0
            ? 'Sem locais selecionados: colaborador poderá registrar ponto em qualquer local da empresa.'
            : `${selecionados.length} local(is) selecionado(s).`}
        </p>

        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

function toMins(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minsToInterval(mins) {
  if (mins <= 0) return '00:00:00'
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}:00`
}

function calcularCargaLiquida(entrada, saida, inicioAlmoco, fimAlmoco) {
  const eM = toMins(entrada)
  const sM = toMins(saida)
  if (eM === null || sM === null || sM <= eM) return null
  let trabalho = sM - eM
  const iA = toMins(inicioAlmoco)
  const fA = toMins(fimAlmoco)
  if (iA !== null && fA !== null && fA > iA) trabalho -= (fA - iA)
  return minsToInterval(trabalho)
}

function ModalJornada({ colaborador, onFechar, onSalvo, modelos = [] }) {
  const diasAtivos = (colaborador.dias_trabalho || 'seg,ter,qua,qui,sex').split(',')
  const [form, setForm] = useState({
    hora_entrada_esperada:  colaborador.hora_entrada_esperada?.slice(0, 5)  || '08:00',
    hora_saida_esperada:    colaborador.hora_saida_esperada?.slice(0, 5)    || '17:00',
    hora_inicio_almoco:     colaborador.hora_inicio_almoco?.slice(0, 5)     || '12:00',
    hora_fim_almoco:        colaborador.hora_fim_almoco?.slice(0, 5)        || '13:00',
    carga_horaria_diaria:   colaborador.carga_horaria_diaria                || '08:00:00',
    dias: diasAtivos,
    almoco_ativo: !!(colaborador.hora_inicio_almoco),
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias: f.dias.includes(dia) ? f.dias.filter(d => d !== dia) : [...f.dias, dia],
    }))
  }

  function recalcular(patch) {
    const next = { ...form, ...patch }
    const carga = calcularCargaLiquida(
      next.hora_entrada_esperada,
      next.hora_saida_esperada,
      next.almoco_ativo ? next.hora_inicio_almoco : null,
      next.almoco_ativo ? next.hora_fim_almoco : null,
    )
    return { ...next, carga_horaria_diaria: carga || next.carga_horaria_diaria }
  }

  function set(key, val) { setForm(f => recalcular({ [key]: val })) }

  function aplicarModelo(modeloId) {
    const m = modelos.find(x => x.id === modeloId)
    if (!m) return
    setForm({
      hora_entrada_esperada:  m.hora_entrada?.slice(0, 5)       || '08:00',
      hora_saida_esperada:    m.hora_saida?.slice(0, 5)         || '17:00',
      hora_inicio_almoco:     m.hora_inicio_almoco?.slice(0, 5) || '12:00',
      hora_fim_almoco:        m.hora_fim_almoco?.slice(0, 5)    || '13:00',
      almoco_ativo:           !!m.hora_inicio_almoco,
      dias:                   (m.dias_trabalho || 'seg,ter,qua,qui,sex').split(','),
      carga_horaria_diaria:   m.carga_horaria_diaria            || '08:00:00',
    })
  }

  const duracaoAlmoco = (() => {
    if (!form.almoco_ativo) return null
    const iA = toMins(form.hora_inicio_almoco)
    const fA = toMins(form.hora_fim_almoco)
    if (iA === null || fA === null || fA <= iA) return null
    const mins = fA - iA
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ''}`
  })()

  async function salvar() {
    setErro(''); setLoading(true)
    try {
      await atualizarColaborador(colaborador.id, {
        hora_entrada_esperada: form.hora_entrada_esperada + ':00',
        hora_saida_esperada:   form.hora_saida_esperada + ':00',
        hora_inicio_almoco:    form.almoco_ativo ? form.hora_inicio_almoco + ':00' : null,
        hora_fim_almoco:       form.almoco_ativo ? form.hora_fim_almoco + ':00'    : null,
        carga_horaria_diaria:  form.carga_horaria_diaria,
        dias_trabalho:         form.dias.join(','),
      })
      onSalvo()
      onFechar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  const ordemDias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
  const diasOrdenados = [...form.dias].sort((a, b) => ordemDias.indexOf(a) - ordemDias.indexOf(b))

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Configurar Jornada</h3>
            <p className="text-xs text-gray-500 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {/* Aplicar modelo existente */}
        {modelos.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Aplicar jornada existente</label>
            <select onChange={e => aplicarModelo(e.target.value)} defaultValue=""
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
              <option value="">Selecionar modelo para pré-preencher...</option>
              {modelos.filter(m => !colaborador.empresa_id || m.empresa_id === colaborador.empresa_id).map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">Selecione para pré-preencher os campos abaixo, ou configure manualmente.</p>
          </div>
        )}

        {/* Dias da semana */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Dias de trabalho</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(({ key, label }) => (
              <button key={key} onClick={() => toggleDia(key)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                  form.dias.includes(key) ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Horários entrada/saída */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Horário de trabalho</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entrada</label>
              <input type="time" value={form.hora_entrada_esperada}
                onChange={e => set('hora_entrada_esperada', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Saída</label>
              <input type="time" value={form.hora_saida_esperada}
                onChange={e => set('hora_saida_esperada', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
          </div>
        </div>

        {/* Almoço */}
        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 font-medium">Intervalo de almoço</label>
            <button onClick={() => setForm(f => recalcular({ almoco_ativo: !f.almoco_ativo }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.almoco_ativo ? 'bg-emerald-600' : 'bg-gray-700'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.almoco_ativo ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          {form.almoco_ativo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Início</label>
                <input type="time" value={form.hora_inicio_almoco}
                  onChange={e => set('hora_inicio_almoco', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fim</label>
                <input type="time" value={form.hora_fim_almoco}
                  onChange={e => set('hora_fim_almoco', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              </div>
            </div>
          )}
          {form.almoco_ativo && duracaoAlmoco && (
            <p className="text-xs text-gray-500">Duração: <span className="text-yellow-400">{duracaoAlmoco}</span></p>
          )}
        </div>

        {/* Carga horária líquida */}
        <div className="bg-gray-800/60 rounded-lg p-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Carga horária líquida</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {form.almoco_ativo && duracaoAlmoco ? `(descontando ${duracaoAlmoco} de almoço)` : '(sem desconto de almoço)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xl">{form.carga_horaria_diaria.slice(0, 5)}</span>
            <input type="text" value={form.carga_horaria_diaria}
              onChange={e => setForm(f => ({ ...f, carga_horaria_diaria: e.target.value }))}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-xs text-center"
              placeholder="08:00:00" />
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 text-xs text-gray-400">
          <span className="text-emerald-400 font-medium">Resumo: </span>
          {diasOrdenados.map(d => DIAS_SEMANA.find(x => x.key === d)?.label).join(', ')}
          {' · '}{form.hora_entrada_esperada}–{form.hora_saida_esperada}
          {form.almoco_ativo && duracaoAlmoco && ` · almoço ${form.hora_inicio_almoco}–${form.hora_fim_almoco}`}
          {' · '}<span className="text-emerald-400">{form.carga_horaria_diaria.slice(0, 5)}h líquidas/dia</span>
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Salvar Jornada'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

export default function Colaboradores() {
  const [lista, setLista] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modelos, setModelos] = useState([])
  const [todosLocais, setTodosLocais] = useState([])
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [modal, setModal] = useState(null)
  const [modalJornada, setModalJornada] = useState(null)
  const [modalLocais, setModalLocais] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getEmpresas().then(setEmpresas).catch(console.error)
    getModelosJornada().then(setModelos).catch(console.error)
    getLocais().then(setTodosLocais).catch(console.error)
  }, [])

  const carregar = (emp = filtroEmpresa) =>
    getColaboradores(emp ? { empresa_id: emp } : {}).then(setLista).catch(console.error)

  useEffect(() => { carregar() }, [filtroEmpresa])

  function abrirCriar() {
    const empId = filtroEmpresa || (empresas.length === 1 ? empresas[0].id : '')
    setForm({ ...CAMPOS_VAZIO, empresa_id: empId })
    setErro(''); setModal('criar')
  }
  function abrirEditar(c) { setForm(c); setErro(''); setModal(c) }
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function salvar() {
    if (!form.empresa_id) { setErro('Selecione a empresa.'); return }
    setErro(''); setLoading(true)
    try {
      if (modal === 'criar') await criarColaborador(form)
      else await atualizarColaborador(modal.id, form)
      setModal(null)
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function excluir(id) {
    if (!confirm('Confirma exclusão do colaborador?')) return
    try { await excluirColaborador(id); carregar() } catch (e) { alert(e.message) }
  }

  function fmtJornada(c) {
    if (!c.hora_entrada_esperada) return '—'
    const entrada = c.hora_entrada_esperada.slice(0, 5)
    const saida = c.hora_saida_esperada?.slice(0, 5) || '?'
    const dias = c.dias_trabalho || 'seg-sex'
    return `${entrada}–${saida} · ${dias.split(',').length}d/sem`
  }

  const nomeEmpresa = (id) => empresas.find(e => e.id === id)?.nome || '—'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Colaboradores</h1>
        <button onClick={abrirCriar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Novo Colaborador
        </button>
      </div>

      {empresas.length > 1 && (
        <div className="flex gap-3 items-center">
          <label className="text-sm text-gray-400">Filtrar por empresa:</label>
          <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100">
            <option value="">Todas as empresas</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Jornada</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum colaborador cadastrado.</td></tr>
            ) : lista.map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-gray-500">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{nomeEmpresa(c.empresa_id)}</td>
                <td className="px-4 py-3">{c.cargo || '—'}</td>
                <td className="px-4 py-3">{c.departamento || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{fmtJornada(c)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => abrirEditar(c)} className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                    <button onClick={() => setModalJornada(c)} className="text-emerald-400 hover:text-emerald-300 text-xs underline">Jornada</button>
                    <button onClick={() => setModalLocais(c)} className="text-yellow-400 hover:text-yellow-300 text-xs underline">Locais</button>
                    <button onClick={() => excluir(c.id)} className="text-red-400 hover:text-red-300 text-xs underline">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalColaborador
          titulo={modal === 'criar' ? 'Novo Colaborador' : 'Editar Colaborador'}
          dados={form}
          onChange={setField}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
          loading={loading}
          erro={erro}
          empresas={empresas}
          modelos={modelos}
        />
      )}

      {modalLocais && (
        <ModalLocais
          colaborador={modalLocais}
          todosLocais={todosLocais.filter(l => l.empresa_id === modalLocais.empresa_id)}
          onFechar={() => setModalLocais(null)}
          onSalvo={carregar}
        />
      )}

      {modalJornada && (
        <ModalJornada
          colaborador={modalJornada}
          onFechar={() => setModalJornada(null)}
          onSalvo={carregar}
          modelos={modelos}
        />
      )}
    </div>
  )
}
