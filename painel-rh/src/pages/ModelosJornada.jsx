import { useEffect, useState } from 'react'
import { getModelosJornada, criarModeloJornada, atualizarModeloJornada, excluirModeloJornada, getEmpresas } from '../api'
import Portal from '../components/Portal'
import { IconEditar, IconExcluir } from '../components/IconBtn'

const DIAS_SEMANA = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça' }, { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' }, { key: 'sex', label: 'Sexta' }, { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]
const DIAS_LABEL = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }

const VAZIO = {
  nome: '', empresa_id: '',
  hora_entrada: '07:30', hora_saida: '17:30',
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00',
  dias_trabalho: 'seg,ter,qua,qui,sex',
  almoco_ativo: true,
  tolerancia_entrada_minutos: 5,
  tolerancia_saida_minutos: 5,
  horarios_por_dia: {},
}

function toMins(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minsToInterval(mins) {
  if (mins <= 0) return '00:00:00'
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`
}

function calcCarga(entrada, saida, inicioAlm, fimAlm, almAtivo) {
  const eM = toMins(entrada), sM = toMins(saida)
  if (eM === null || sM === null || sM <= eM) return null
  let trabalho = sM - eM
  if (almAtivo) {
    const iA = toMins(inicioAlm), fA = toMins(fimAlm)
    if (iA !== null && fA !== null && fA > iA) trabalho -= (fA - iA)
  }
  return minsToInterval(trabalho)
}

function fmtDias(dias) {
  return (dias || '').split(',').map(d => DIAS_LABEL[d] || d).join(', ')
}

function InputHora({ value, onChange, placeholder }) {
  return (
    <input type="time" value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-100 text-xs text-center" />
  )
}

function ModalModelo({ titulo, dados, onChange, onSalvar, onFechar, loading, erro, empresas }) {
  const diasAtivos = (dados.dias_trabalho || '').split(',').filter(Boolean)
  const horariosPorDia = dados.horarios_por_dia || {}

  function toggleDia(dia) {
    const atual = dados.dias_trabalho.split(',').filter(Boolean)
    const novo = atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia]
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
    onChange('dias_trabalho', novo.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).join(','))
  }

  function setHorarioDia(diaKey, campo, valor) {
    const atual = { ...(dados.horarios_por_dia || {}) }
    if (!atual[diaKey]) atual[diaKey] = {}
    if (valor) {
      atual[diaKey] = { ...atual[diaKey], [campo]: valor }
    } else {
      delete atual[diaKey][campo]
      if (Object.keys(atual[diaKey]).length === 0) delete atual[diaKey]
    }
    onChange('horarios_por_dia', atual)
  }

  function setHora(key, val) {
    const patch = { ...dados, [key]: val }
    const carga = calcCarga(patch.hora_entrada, patch.hora_saida, patch.hora_inicio_almoco, patch.hora_fim_almoco, patch.almoco_ativo)
    onChange(key, val)
    if (carga) onChange('carga_horaria_diaria', carga)
  }

  function toggleAlmoco() {
    const prox = !dados.almoco_ativo
    const carga = calcCarga(dados.hora_entrada, dados.hora_saida, dados.hora_inicio_almoco, dados.hora_fim_almoco, prox)
    onChange('almoco_ativo', prox)
    if (carga) onChange('carga_horaria_diaria', carga)
  }

  const duracaoAlmoco = (() => {
    if (!dados.almoco_ativo) return null
    const iA = toMins(dados.hora_inicio_almoco), fA = toMins(dados.hora_fim_almoco)
    if (iA === null || fA === null || fA <= iA) return null
    const m = fA - iA
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}min` : ''}`
  })()

  const carga = dados.carga_horaria_diaria?.slice(0, 5) || '—'

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">{titulo}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Nome da Jornada *</label>
          <input type="text" value={dados.nome || ''} onChange={e => onChange('nome', e.target.value)}
            placeholder="Ex: Jornada Padrão Comercial"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
        </div>

        {empresas.length > 1 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Empresa *</label>
            <select value={dados.empresa_id || ''} onChange={e => onChange('empresa_id', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
              <option value="">Selecione a empresa</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}

        {/* Dias de trabalho */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Dias de trabalho</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => toggleDia(key)}
                className={`px-3 h-9 rounded-lg text-sm font-semibold transition-colors ${
                  diasAtivos.includes(key) ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {DIAS_LABEL[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Horário padrão */}
        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-300 font-medium">Horário padrão <span className="text-xs text-gray-500 font-normal">(aplicado a todos os dias)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entrada</label>
              <input type="time" value={dados.hora_entrada || ''} onChange={e => setHora('hora_entrada', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Saída</label>
              <input type="time" value={dados.hora_saida || ''} onChange={e => setHora('hora_saida', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Intervalo de almoço</label>
              <button type="button" onClick={toggleAlmoco}
                className={`relative w-11 h-6 rounded-full transition-colors ${dados.almoco_ativo ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${dados.almoco_ativo ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {dados.almoco_ativo && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Início</label>
                  <input type="time" value={dados.hora_inicio_almoco || ''} onChange={e => setHora('hora_inicio_almoco', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fim</label>
                  <input type="time" value={dados.hora_fim_almoco || ''} onChange={e => setHora('hora_fim_almoco', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
                </div>
              </div>
            )}
            {dados.almoco_ativo && duracaoAlmoco && (
              <p className="text-xs text-gray-500 mt-1">Duração: <span className="text-yellow-400">{duracaoAlmoco}</span></p>
            )}
          </div>
        </div>

        {/* Horário por dia */}
        {diasAtivos.length > 0 && (
          <div className="border border-gray-800 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-300 font-medium">Horário personalizado por dia</p>
              <p className="text-xs text-gray-500 mt-0.5">Deixe em branco para usar o horário padrão. Preencha apenas os dias que diferem.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-3 font-medium">Dia</th>
                    <th className="py-2 px-1 font-medium">Entrada</th>
                    <th className="py-2 px-1 font-medium">Saída Almoço</th>
                    <th className="py-2 px-1 font-medium">Volta Almoço</th>
                    <th className="py-2 px-1 font-medium">Saída</th>
                    <th className="py-2 pl-1 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS_SEMANA.filter(d => diasAtivos.includes(d.key)).map(({ key, label }) => {
                    const h = horariosPorDia[key] || {}
                    const temCustom = Object.keys(h).length > 0
                    return (
                      <tr key={key} className={`border-b border-gray-800/40 ${temCustom ? 'bg-emerald-900/10' : ''}`}>
                        <td className="py-2 pr-3 font-semibold text-gray-300 whitespace-nowrap">{label}</td>
                        <td className="py-1.5 px-1 w-24">
                          <InputHora value={h.hora_entrada || ''} onChange={v => setHorarioDia(key, 'hora_entrada', v)}
                            placeholder={dados.hora_entrada} />
                        </td>
                        <td className="py-1.5 px-1 w-24">
                          <InputHora value={h.hora_inicio_almoco || ''} onChange={v => setHorarioDia(key, 'hora_inicio_almoco', v)}
                            placeholder={dados.hora_inicio_almoco} />
                        </td>
                        <td className="py-1.5 px-1 w-24">
                          <InputHora value={h.hora_fim_almoco || ''} onChange={v => setHorarioDia(key, 'hora_fim_almoco', v)}
                            placeholder={dados.hora_fim_almoco} />
                        </td>
                        <td className="py-1.5 px-1 w-24">
                          <InputHora value={h.hora_saida || ''} onChange={v => setHorarioDia(key, 'hora_saida', v)}
                            placeholder={dados.hora_saida} />
                        </td>
                        <td className="py-1.5 pl-1 w-8 text-center">
                          {temCustom && (
                            <button type="button" title="Limpar dia"
                              onClick={() => {
                                const atual = { ...(dados.horarios_por_dia || {}) }
                                delete atual[key]
                                onChange('horarios_por_dia', atual)
                              }}
                              className="text-gray-600 hover:text-red-400 text-base leading-none">×</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tolerância */}
        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-300 font-medium">Tolerância de ponto</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entrada (min)</label>
              <input type="number" min="0" max="60" value={dados.tolerancia_entrada_minutos ?? 5}
                onChange={e => onChange('tolerancia_entrada_minutos', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              <p className="text-xs text-gray-600 mt-1">Atraso tolerado na entrada</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Saída (min)</label>
              <input type="number" min="0" max="60" value={dados.tolerancia_saida_minutos ?? 5}
                onChange={e => onChange('tolerancia_saida_minutos', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
              <p className="text-xs text-gray-600 mt-1">Saída antecipada tolerada</p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 text-xs text-gray-400">
          <span className="text-emerald-400 font-medium">Resumo: </span>
          {fmtDias(dados.dias_trabalho)}
          {' · '}{dados.hora_entrada}–{dados.hora_saida}
          {dados.almoco_ativo && duracaoAlmoco && ` · almoço ${dados.hora_inicio_almoco}–${dados.hora_fim_almoco}`}
          {' · '}<span className="text-emerald-400">{carga}h líquidas/dia (padrão)</span>
          {Object.keys(horariosPorDia).length > 0 && (
            <span className="text-yellow-400"> · {Object.keys(horariosPorDia).length} dia(s) com horário diferente</span>
          )}
        </div>

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

export default function ModelosJornada() {
  const [lista, setLista] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getEmpresas().then(emps => {
      setEmpresas(emps)
      if (emps.length === 1) setForm(f => ({ ...f, empresa_id: emps[0].id }))
    }).catch(console.error)
    getModelosJornada().then(setLista).catch(console.error)
  }, [])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function abrirCriar() {
    const base = { ...VAZIO }
    if (empresas.length === 1) base.empresa_id = empresas[0].id
    const carga = calcCarga(base.hora_entrada, base.hora_saida, base.hora_inicio_almoco, base.hora_fim_almoco, base.almoco_ativo)
    setForm({ ...base, carga_horaria_diaria: carga || '08:00:00' })
    setErro(''); setModal('criar')
  }

  function abrirEditar(m) {
    setForm({
      ...m,
      hora_entrada: m.hora_entrada?.slice(0, 5) || '07:30',
      hora_saida: m.hora_saida?.slice(0, 5) || '17:30',
      hora_inicio_almoco: m.hora_inicio_almoco?.slice(0, 5) || '12:00',
      hora_fim_almoco: m.hora_fim_almoco?.slice(0, 5) || '13:00',
      almoco_ativo: !!m.hora_inicio_almoco,
      horarios_por_dia: m.horarios_por_dia || {},
    })
    setErro(''); setModal(m)
  }

  async function salvar() {
    if (!form.nome?.trim()) { setErro('Informe o nome da jornada.'); return }
    if (!form.empresa_id) { setErro('Selecione a empresa.'); return }
    setErro(''); setLoading(true)
    try {
      const payload = {
        nome: form.nome,
        empresa_id: form.empresa_id,
        hora_entrada: form.hora_entrada + ':00',
        hora_saida: form.hora_saida + ':00',
        hora_inicio_almoco: form.almoco_ativo ? form.hora_inicio_almoco + ':00' : null,
        hora_fim_almoco: form.almoco_ativo ? form.hora_fim_almoco + ':00' : null,
        dias_trabalho: form.dias_trabalho,
        carga_horaria_diaria: form.carga_horaria_diaria,
        tolerancia_entrada_minutos: form.tolerancia_entrada_minutos ?? 5,
        tolerancia_saida_minutos: form.tolerancia_saida_minutos ?? 5,
        horarios_por_dia: form.horarios_por_dia || {},
      }
      if (modal === 'criar') await criarModeloJornada(payload)
      else await atualizarModeloJornada(modal.id, payload)
      setModal(null)
      getModelosJornada().then(setLista)
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function excluir(id) {
    if (!confirm('Desativar esta jornada? Colaboradores vinculados não serão afetados.')) return
    try { await excluirModeloJornada(id); getModelosJornada().then(setLista) } catch (e) { alert(e.message) }
  }

  const nomeEmpresa = id => empresas.find(e => e.id === id)?.nome || '—'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Modelos de Jornada</h1>
        <button onClick={abrirCriar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Nova Jornada
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Nome</th>
              {empresas.length > 1 && <th className="px-4 py-3">Empresa</th>}
              <th className="px-4 py-3">Horário padrão</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Carga</th>
              <th className="px-4 py-3">Tolerância</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhuma jornada cadastrada.</td></tr>
            ) : lista.map(m => {
              const nDias = Object.keys(m.horarios_por_dia || {}).length
              return (
                <tr key={m.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">
                    {m.nome}
                    {nDias > 0 && <span className="ml-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded px-1.5 py-0.5">{nDias} dia(s) diferente(s)</span>}
                  </td>
                  {empresas.length > 1 && <td className="px-4 py-3 text-xs text-gray-400">{nomeEmpresa(m.empresa_id)}</td>}
                  <td className="px-4 py-3 text-xs">
                    {m.hora_entrada?.slice(0, 5)}–{m.hora_saida?.slice(0, 5)}
                    {m.hora_inicio_almoco && <span className="text-gray-500"> · alm {m.hora_inicio_almoco?.slice(0, 5)}–{m.hora_fim_almoco?.slice(0, 5)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDias(m.dias_trabalho)}</td>
                  <td className="px-4 py-3 text-xs text-emerald-400">{m.carga_horaria_diaria?.slice(0, 5)}h/dia</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    +{m.tolerancia_entrada_minutos ?? 5}min / -{m.tolerancia_saida_minutos ?? 5}min
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <IconEditar onClick={() => abrirEditar(m)} />
                      <IconExcluir onClick={() => excluir(m.id)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalModelo
          titulo={modal === 'criar' ? 'Nova Jornada' : 'Editar Jornada'}
          dados={form}
          onChange={setField}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
          loading={loading}
          erro={erro}
          empresas={empresas}
        />
      )}
    </div>
  )
}
