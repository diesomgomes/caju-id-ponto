import { useEffect, useState } from 'react'
import { getColaboradores, criarColaborador, atualizarColaborador, excluirColaborador } from '../api'

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

const CAMPOS_VAZIO = { nome: '', cpf: '', email: '', cargo: '', departamento: '', carga_horaria_diaria: '08:00:00' }

const JORNADA_VAZIO = {
  hora_entrada_esperada: '08:00',
  hora_saida_esperada: '17:00',
  carga_horaria_diaria: '08:00:00',
  dias_trabalho: 'seg,ter,qua,qui,sex',
}

function ModalColaborador({ titulo, dados, onChange, onSalvar, onFechar, loading, erro }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">{titulo}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        {[
          { key: 'nome', label: 'Nome completo', type: 'text' },
          { key: 'cpf', label: 'CPF', type: 'text' },
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
    </div>
  )
}

function ModalJornada({ colaborador, onFechar, onSalvo }) {
  const diasAtivos = (colaborador.dias_trabalho || 'seg,ter,qua,qui,sex').split(',')
  const [form, setForm] = useState({
    hora_entrada_esperada: colaborador.hora_entrada_esperada?.slice(0, 5) || '08:00',
    hora_saida_esperada: colaborador.hora_saida_esperada?.slice(0, 5) || '17:00',
    carga_horaria_diaria: colaborador.carga_horaria_diaria || '08:00:00',
    dias: diasAtivos,
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias: f.dias.includes(dia) ? f.dias.filter(d => d !== dia) : [...f.dias, dia],
    }))
  }

  // Calcula carga horária automaticamente se entrada e saída estiverem preenchidas
  function calcularCarga(entrada, saida) {
    try {
      const [eh, em] = entrada.split(':').map(Number)
      const [sh, sm] = saida.split(':').map(Number)
      const mins = (sh * 60 + sm) - (eh * 60 + em)
      if (mins > 0) {
        const h = Math.floor(mins / 60).toString().padStart(2, '0')
        const m = (mins % 60).toString().padStart(2, '0')
        return `${h}:${m}:00`
      }
    } catch { }
    return form.carga_horaria_diaria
  }

  function handleEntrada(val) {
    const carga = calcularCarga(val, form.hora_saida_esperada)
    setForm(f => ({ ...f, hora_entrada_esperada: val, carga_horaria_diaria: carga }))
  }

  function handleSaida(val) {
    const carga = calcularCarga(form.hora_entrada_esperada, val)
    setForm(f => ({ ...f, hora_saida_esperada: val, carga_horaria_diaria: carga }))
  }

  async function salvar() {
    setErro(''); setLoading(true)
    try {
      await atualizarColaborador(colaborador.id, {
        hora_entrada_esperada: form.hora_entrada_esperada + ':00',
        hora_saida_esperada: form.hora_saida_esperada + ':00',
        carga_horaria_diaria: form.carga_horaria_diaria,
        dias_trabalho: form.dias.join(','),
      })
      onSalvo()
      onFechar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  const ordemDias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
  const diasOrdenados = [...form.dias].sort((a, b) => ordemDias.indexOf(a) - ordemDias.indexOf(b))

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Configurar Jornada</h3>
            <p className="text-xs text-gray-500 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {/* Dias da semana */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Dias de trabalho</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleDia(key)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                  form.dias.includes(key)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Horários */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Entrada esperada</label>
            <input
              type="time"
              value={form.hora_entrada_esperada}
              onChange={e => handleEntrada(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Saída esperada</label>
            <input
              type="time"
              value={form.hora_saida_esperada}
              onChange={e => handleSaida(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm"
            />
          </div>
        </div>

        {/* Carga horária calculada */}
        <div className="bg-gray-800/60 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-gray-400">Carga horária diária</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-lg">
              {form.carga_horaria_diaria.slice(0, 5)}
            </span>
            <input
              type="text"
              value={form.carga_horaria_diaria}
              onChange={e => setForm(f => ({ ...f, carga_horaria_diaria: e.target.value }))}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-xs text-center"
              placeholder="08:00:00"
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 text-xs text-gray-400">
          <p>
            <span className="text-emerald-400 font-medium">Resumo: </span>
            {diasOrdenados.map(d => DIAS_SEMANA.find(x => x.key === d)?.label).join(', ')}{' '}
            · {form.hora_entrada_esperada} às {form.hora_saida_esperada}
            · {form.carga_horaria_diaria.slice(0, 5)}h/dia
          </p>
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
    </div>
  )
}

export default function Colaboradores() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(null)
  const [modalJornada, setModalJornada] = useState(null)
  const [form, setForm] = useState(CAMPOS_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => getColaboradores().then(setLista).catch(console.error)
  useEffect(() => { carregar() }, [])

  function abrirCriar() { setForm(CAMPOS_VAZIO); setErro(''); setModal('criar') }
  function abrirEditar(c) { setForm(c); setErro(''); setModal(c) }
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function salvar() {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Colaboradores</h1>
        <button onClick={abrirCriar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Novo Colaborador
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Jornada</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum colaborador cadastrado.</td></tr>
            ) : lista.map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-gray-500">{c.email}</p>
                </td>
                <td className="px-4 py-3">{c.cargo || '—'}</td>
                <td className="px-4 py-3">{c.departamento || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{fmtJornada(c)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => abrirEditar(c)} className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                    <button onClick={() => setModalJornada(c)} className="text-emerald-400 hover:text-emerald-300 text-xs underline">Jornada</button>
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
        />
      )}

      {modalJornada && (
        <ModalJornada
          colaborador={modalJornada}
          onFechar={() => setModalJornada(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  )
}
