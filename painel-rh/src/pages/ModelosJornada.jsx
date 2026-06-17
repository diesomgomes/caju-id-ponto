import { useEffect, useState } from 'react'
import { getModelosJornada, criarModeloJornada, atualizarModeloJornada, excluirModeloJornada, getEmpresas } from '../api'

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

const VAZIO = {
  nome: '', empresa_id: '',
  hora_entrada: '08:00', hora_saida: '17:00',
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00',
  dias_trabalho: 'seg,ter,qua,qui,sex',
  almoco_ativo: true,
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
  const ordemLabel = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }
  return (dias || '').split(',').map(d => ordemLabel[d] || d).join(', ')
}

function ModalModelo({ titulo, dados, onChange, onSalvar, onFechar, loading, erro, empresas }) {
  const dias = (dados.dias_trabalho || '').split(',').filter(Boolean)

  function toggleDia(dia) {
    const atual = dados.dias_trabalho.split(',').filter(Boolean)
    const novo = atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia]
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
    onChange('dias_trabalho', novo.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).join(','))
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

        <div>
          <label className="text-xs text-gray-400 block mb-2">Dias de trabalho</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => toggleDia(key)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                  dias.includes(key) ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">Horário de trabalho</label>
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
        </div>

        <div className="border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 font-medium">Intervalo de almoço</label>
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
            <p className="text-xs text-gray-500">Duração: <span className="text-yellow-400">{duracaoAlmoco}</span></p>
          )}
        </div>

        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 text-xs text-gray-400">
          <span className="text-emerald-400 font-medium">Resumo: </span>
          {fmtDias(dados.dias_trabalho)}
          {' · '}{dados.hora_entrada}–{dados.hora_saida}
          {dados.almoco_ativo && duracaoAlmoco && ` · almoço ${dados.hora_inicio_almoco}–${dados.hora_fim_almoco}`}
          {' · '}<span className="text-emerald-400">{carga}h líquidas/dia</span>
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
    </div>
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
      hora_entrada: m.hora_entrada?.slice(0, 5) || '08:00',
      hora_saida: m.hora_saida?.slice(0, 5) || '17:00',
      hora_inicio_almoco: m.hora_inicio_almoco?.slice(0, 5) || '12:00',
      hora_fim_almoco: m.hora_fim_almoco?.slice(0, 5) || '13:00',
      almoco_ativo: !!m.hora_inicio_almoco,
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
              <th className="px-4 py-3">Horário</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Carga</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhuma jornada cadastrada.</td></tr>
            ) : lista.map(m => (
              <tr key={m.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium">{m.nome}</td>
                {empresas.length > 1 && <td className="px-4 py-3 text-xs text-gray-400">{nomeEmpresa(m.empresa_id)}</td>}
                <td className="px-4 py-3 text-xs">
                  {m.hora_entrada?.slice(0, 5)}–{m.hora_saida?.slice(0, 5)}
                  {m.hora_inicio_almoco && <span className="text-gray-500"> · alm {m.hora_inicio_almoco?.slice(0, 5)}–{m.hora_fim_almoco?.slice(0, 5)}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{fmtDias(m.dias_trabalho)}</td>
                <td className="px-4 py-3 text-xs text-emerald-400">{m.carga_horaria_diaria?.slice(0, 5)}h/dia</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => abrirEditar(m)} className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                    <button onClick={() => excluir(m.id)} className="text-red-400 hover:text-red-300 text-xs underline">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
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
