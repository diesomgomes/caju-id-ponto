import { useEffect, useState } from 'react'
import { getUsuarios, criarUsuario, atualizarUsuario, excluirUsuario, getEmpresas, getMe } from '../api'
import Portal from '../components/Portal'

const PAPEIS_ADMIN = [
  { value: 'admin', label: 'Administrador' },
  { value: 'rh', label: 'Gestão' },
]
const PAPEIS_GESTAO = [
  { value: 'rh', label: 'Gestão' },
]

const VAZIO_CRIAR = { nome: '', email: '', senha: '', papel: 'rh', empresa_id: '' }
const VAZIO_EDITAR = { nome: '', email: '', senha: '', papel: 'rh' }

function ModalCriar({ onSalvar, onFechar, loading, erro, empresas, papeis }) {
  const [form, setForm] = useState(VAZIO_CRIAR)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">Novo Usuário RH</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {empresas.length > 1 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Empresa *</label>
            <select value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
              <option value="">Selecione a empresa</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}

        {[
          { key: 'nome', label: 'Nome completo *', type: 'text' },
          { key: 'email', label: 'E-mail *', type: 'email' },
          { key: 'senha', label: 'Senha provisória *', type: 'password' },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-400 block mb-1">Perfil *</label>
          <select value={form.papel} onChange={e => set('papel', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            {papeis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={() => onSalvar(form)} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Criando…' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

function ModalEditar({ usuario, onSalvar, onFechar, loading, erro, papeis }) {
  const [form, setForm] = useState({
    nome: usuario.nome || '',
    email: usuario.email || '',
    senha: '',
    papel: usuario.papel || 'rh',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Portal><div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">Editar Usuário</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>

        {[
          { key: 'nome', label: 'Nome completo', type: 'text' },
          { key: 'email', label: 'E-mail', type: 'email' },
          { key: 'senha', label: 'Nova senha (deixe em branco para manter)', type: 'password' },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-400 block mb-1">Perfil</label>
          <select value={form.papel} onChange={e => set('papel', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            {papeis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
          <button onClick={() => onSalvar(form)} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div></Portal>
  )
}

const labelPapel = { admin: 'Administrador', rh: 'Gestão', gestor: 'Gestão' }
const corPapel = { admin: 'text-purple-400 bg-purple-900/30', rh: 'text-emerald-400 bg-emerald-900/30', gestor: 'text-emerald-400 bg-emerald-900/30' }

export default function Usuarios() {
  const [lista, setLista] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [me, setMe] = useState(null)
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => getUsuarios().then(setLista).catch(console.error)

  useEffect(() => {
    carregar()
    getEmpresas().then(setEmpresas).catch(console.error)
    getMe().then(setMe).catch(console.error)
  }, [])

  async function salvarCriar(form) {
    setErro(''); setLoading(true)
    try {
      const payload = { ...form }
      if (empresas.length === 1) payload.empresa_id = empresas[0].id
      await criarUsuario(payload)
      setModal(null)
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function salvarEditar(form) {
    setErro(''); setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.senha) delete payload.senha
      await atualizarUsuario(modal.id, payload)
      setModal(null)
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function excluir(u) {
    if (!confirm(`Excluir o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return
    try { await excluirUsuario(u.id); carregar() } catch (e) { alert(e.message) }
  }

  const nomeEmpresa = id => empresas.find(e => e.id === id)?.nome || '—'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Usuários RH</h1>
        <button onClick={() => { setErro(''); setModal('criar') }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Novo Usuário
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Nome</th>
              {empresas.length > 1 && <th className="px-4 py-3">Empresa</th>}
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhum usuário cadastrado.</td></tr>
            ) : lista.map(u => (
              <tr key={u.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.nome}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </td>
                {empresas.length > 1 && <td className="px-4 py-3 text-xs text-gray-400">{nomeEmpresa(u.empresa_id)}</td>}
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${corPapel[u.papel] || ''}`}>
                    {labelPapel[u.papel] || u.papel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {(me?.papel === 'admin' || u.papel !== 'admin') && (
                      <button onClick={() => { setErro(''); setModal(u) }}
                        className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                    )}
                    {u.id !== me?.id && (me?.papel === 'admin' || u.papel !== 'admin') && (
                      <button onClick={() => excluir(u)}
                        className="text-red-400 hover:text-red-300 text-xs underline">Excluir</button>
                    )}
                    {me?.papel !== 'admin' && u.papel === 'admin' && (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === 'criar' && (
        <ModalCriar
          onSalvar={salvarCriar}
          onFechar={() => setModal(null)}
          loading={loading}
          erro={erro}
          empresas={empresas}
          papeis={me?.papel === 'admin' ? PAPEIS_ADMIN : PAPEIS_GESTAO}
        />
      )}

      {modal && modal !== 'criar' && (
        <ModalEditar
          usuario={modal}
          onSalvar={salvarEditar}
          onFechar={() => setModal(null)}
          loading={loading}
          erro={erro}
          papeis={me?.papel === 'admin' ? PAPEIS_ADMIN : PAPEIS_GESTAO}
        />
      )}
    </div>
  )
}
