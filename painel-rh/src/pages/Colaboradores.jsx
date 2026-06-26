import { useEffect, useState } from 'react'
import {
  getColaboradores, criarColaborador, atualizarColaborador, excluirColaborador,
  getEmpresas, getModelosJornada, getLocais, getLocaisColaborador, setLocaisColaborador,
  alterarSenhaColaborador, getAjustesBanco, criarAjusteBanco, excluirAjusteBanco,
} from '../api'
import Portal from '../components/Portal'
import { IconEditar, IconExcluir, IconJornada, IconLocais, IconSenha, IconBanco, IconQR } from '../components/IconBtn'

const CAMPOS_VAZIO = { nome: '', cpf: '', pis: '', email: '', cargo: '', departamento: '', empresa_id: '', carga_horaria_diaria: '08:00:00', senha: '', modo_ponto: 'ambos' }

function ModalColaborador({ titulo, criando, dados, onChange, onSalvar, onFechar, loading, erro, empresas, modelos }) {
  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
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

        <div>
          <label className="text-xs text-gray-400 block mb-1">Modo de registro de ponto</label>
          <select value={dados.modo_ponto || 'ambos'} onChange={e => onChange('modo_ponto', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="ambos">App e Dispositivo (kiosk)</option>
            <option value="app">Somente App</option>
            <option value="kiosk">Somente Dispositivo (kiosk)</option>
          </select>
          <p className="text-xs text-gray-600 mt-1">Define como este colaborador registra o ponto.</p>
        </div>

        {criando && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Senha de acesso ao app *</label>
            <input type="password" value={dados.senha || ''} onChange={e => onChange('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            <p className="text-xs text-gray-600 mt-1">Senha que o colaborador usará para entrar no app de ponto.</p>
          </div>
        )}

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

function ModalSenha({ colaborador, onFechar }) {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  async function salvar() {
    if (senha.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.')
    if (senha !== confirmar) return setErro('As senhas não coincidem.')
    setErro(''); setLoading(true)
    try {
      await alterarSenhaColaborador(colaborador.id, senha)
      setOk(true)
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Alterar senha</h3>
            <p className="text-xs text-gray-500 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {ok ? (
          <div className="text-center py-4">
            <p className="text-emerald-400 font-semibold">Senha alterada com sucesso!</p>
            <button onClick={onFechar} className="mt-4 w-full py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Fechar</button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nova senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirmar senha</label>
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
            </div>
            {erro && <p className="text-red-400 text-sm">{erro}</p>}
            <div className="flex gap-3">
              <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
              <button onClick={salvar} disabled={loading}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
                {loading ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
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
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
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


function ModalJornada({ colaborador, onFechar, onSalvo, modelos = [] }) {
  const modelosFiltrados = modelos.filter(m => !colaborador.empresa_id || m.empresa_id === colaborador.empresa_id)
  const [modeloId, setModeloId] = useState(colaborador.modelo_jornada_id || '')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const modeloSelecionado = modelosFiltrados.find(m => m.id === modeloId)

  async function salvar() {
    setErro(''); setLoading(true)
    try {
      await atualizarColaborador(colaborador.id, { modelo_jornada_id: modeloId || null })
      onSalvo()
      onFechar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Jornada de Trabalho</h3>
            <p className="text-xs text-gray-500 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Selecionar jornada</label>
          <select value={modeloId} onChange={e => setModeloId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            <option value="">— Sem jornada definida —</option>
            {modelosFiltrados.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        {modeloSelecionado && (
          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-4 space-y-1.5 text-xs text-gray-400">
            <p><span className="text-emerald-400 font-medium">Horário: </span>
              {modeloSelecionado.hora_entrada?.slice(0,5)}–{modeloSelecionado.hora_saida?.slice(0,5)}
              {modeloSelecionado.hora_inicio_almoco && ` · almoço ${modeloSelecionado.hora_inicio_almoco?.slice(0,5)}–${modeloSelecionado.hora_fim_almoco?.slice(0,5)}`}
            </p>
            <p><span className="text-emerald-400 font-medium">Carga: </span>
              {modeloSelecionado.carga_horaria_diaria?.slice(0,5)}h/dia
            </p>
            <p><span className="text-emerald-400 font-medium">Tolerância: </span>
              entrada +{modeloSelecionado.tolerancia_entrada_minutos ?? 5}min · saída -{modeloSelecionado.tolerancia_saida_minutos ?? 5}min
            </p>
          </div>
        )}

        {modelosFiltrados.length === 0 && (
          <p className="text-xs text-yellow-500">Nenhuma jornada cadastrada para esta empresa. Crie uma em <strong>Cadastro de Jornadas</strong>.</p>
        )}

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

function qrUrl(id, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(id)}&margin=10&bgcolor=ffffff&color=18181b`
}

function ModalQRColaborador({ colaborador, onFechar }) {
  const url = qrUrl(colaborador.id, 260)

  function baixar() {
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${colaborador.nome.replace(/\s+/g, '-')}.png`
    a.target = '_blank'
    a.click()
  }

  function compartilhar() {
    if (navigator.share) {
      navigator.share({ title: colaborador.nome, url })
    } else {
      navigator.clipboard.writeText(url)
      alert('URL do QR Code copiada!')
    }
  }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div className="text-left">
            <p className="font-bold text-gray-900">{colaborador.nome}</p>
            {colaborador.cargo && <p className="text-xs text-gray-400">{colaborador.cargo}</p>}
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2">×</button>
        </div>

        <img src={url} alt="QR" className="mx-auto rounded-xl mb-5" width={220} height={220} />

        <div className="grid grid-cols-3 gap-2">
          <button onClick={baixar}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar
          </button>
          <button onClick={compartilhar}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartilhar
          </button>
          <button onClick={() => window.print()}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

function fmtMinutos(min) {
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sinal = min < 0 ? '−' : '+'
  return `${sinal}${h}h${m > 0 ? ` ${m}min` : ''}`
}

function ModalAjusteBanco({ colaborador, onFechar }) {
  const [ajustes, setAjustes] = useState([])
  const [sinal, setSinal] = useState('+')
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('0')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getAjustesBanco(colaborador.id).then(setAjustes).catch(console.error)
  }, [colaborador.id])

  async function salvar() {
    const h = parseInt(horas) || 0
    const m = parseInt(minutos) || 0
    const total = (h * 60 + m) * (sinal === '-' ? -1 : 1)
    if (total === 0) return setErro('Informe pelo menos 1 minuto.')
    if (!descricao.trim()) return setErro('Informe uma descrição.')
    setErro(''); setSalvando(true)
    try {
      await criarAjusteBanco(colaborador.id, { minutos: total, descricao: descricao.trim() })
      setHoras(''); setMinutos('0'); setDescricao('')
      const lista = await getAjustesBanco(colaborador.id)
      setAjustes(lista)
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function remover(id) {
    if (!confirm('Remover este ajuste?')) return
    try {
      await excluirAjusteBanco(id)
      setAjustes(a => a.filter(x => x.id !== id))
    } catch (e) { alert(e.message) }
  }

  const totalGeral = ajustes.reduce((s, a) => s + a.minutos, 0)

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-100">Banco de Horas</h3>
            <p className="text-xs text-gray-400 mt-0.5">{colaborador.nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {/* Total */}
        <div className={`rounded-lg px-4 py-3 text-center ${totalGeral >= 0 ? 'bg-emerald-900/30 border border-emerald-800/40' : 'bg-red-900/30 border border-red-800/40'}`}>
          <p className="text-xs text-gray-400 mb-0.5">Saldo de ajustes manuais</p>
          <p className={`text-2xl font-bold ${totalGeral >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMinutos(totalGeral)}</p>
        </div>

        {/* Formulário */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Novo ajuste</p>
          <div className="flex gap-2">
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
          <input type="text" placeholder="Motivo / descrição *" value={descricao} onChange={e => setDescricao(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          {erro && <p className="text-red-400 text-xs">{erro}</p>}
          <button onClick={salvar} disabled={salvando}
            className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold">
            {salvando ? 'Salvando…' : 'Registrar ajuste'}
          </button>
        </div>

        {/* Histórico */}
        {ajustes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Histórico de ajustes</p>
            {ajustes.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{a.descricao}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{new Date(a.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${a.minutos >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMinutos(a.minutos)}</span>
                <button onClick={() => remover(a.id)} className="text-gray-600 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
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
  const [modalSenha, setModalSenha] = useState(null)
  const [modalBanco, setModalBanco] = useState(null)
  const [modalQR, setModalQR] = useState(null)
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
    const modelo = modelos.find(m => m.id === c.modelo_jornada_id)
    if (!modelo) return '—'
    const entrada = modelo.hora_entrada?.slice(0, 5) || ''
    const saida = modelo.hora_saida?.slice(0, 5) || ''
    const dias = (modelo.dias_trabalho || '').split(',').length
    return `${entrada}–${saida} · ${dias}d/sem`
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
                    <IconEditar onClick={() => abrirEditar(c)} />
                    <IconSenha onClick={() => setModalSenha(c)} />
                    <IconBanco onClick={() => setModalBanco(c)} />
                    <IconQR onClick={() => setModalQR(c)} />
                    <IconJornada onClick={() => setModalJornada(c)} />
                    <IconLocais onClick={() => setModalLocais(c)} />
                    <IconExcluir onClick={() => excluir(c.id)} />
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
          criando={modal === 'criar'}
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

      {modalSenha && (
        <ModalSenha colaborador={modalSenha} onFechar={() => setModalSenha(null)} />
      )}

      {modalBanco && (
        <ModalAjusteBanco colaborador={modalBanco} onFechar={() => setModalBanco(null)} />
      )}

      {modalQR && (
        <ModalQRColaborador colaborador={modalQR} onFechar={() => setModalQR(null)} />
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
