import { useEffect, useState } from 'react'
import { getEmpresas, criarEmpresa, atualizarEmpresa, excluirEmpresa } from '../api'

const VAZIO = { nome: '', cnpj: '' }

function ModalEmpresa({ titulo, dados, onChange, onSalvar, onFechar, loading, erro }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">{titulo}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        {[
          { key: 'nome', label: 'Razão Social', type: 'text', required: true },
          { key: 'cnpj', label: 'CNPJ', type: 'text', required: true },
        ].map(({ key, label, type, required }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1">{label}{required && ' *'}</label>
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

export default function Empresas() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => getEmpresas().then(setLista).catch(console.error)
  useEffect(() => { carregar() }, [])

  function abrirCriar() { setForm(VAZIO); setErro(''); setModal('criar') }
  function abrirEditar(e) { setForm(e); setErro(''); setModal(e) }
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function salvar() {
    if (!form.nome?.trim() || !form.cnpj?.trim()) {
      setErro('Razão Social e CNPJ são obrigatórios.'); return
    }
    setErro(''); setLoading(true)
    try {
      if (modal === 'criar') await criarEmpresa(form)
      else await atualizarEmpresa(modal.id, form)
      setModal(null)
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function excluir(id) {
    if (!confirm('Confirma desativação da empresa? Colaboradores vinculados não serão afetados.')) return
    try { await excluirEmpresa(id); carregar() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Empresas</h1>
        <button onClick={abrirCriar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Nova Empresa
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Razão Social</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhuma empresa cadastrada.</td></tr>
            ) : lista.map(e => (
              <tr key={e.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium">{e.nome}</td>
                <td className="px-4 py-3 text-gray-400">{e.cnpj}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.ativo ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                    {e.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => abrirEditar(e)} className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                    <button onClick={() => excluir(e.id)} className="text-red-400 hover:text-red-300 text-xs underline">Desativar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalEmpresa
          titulo={modal === 'criar' ? 'Nova Empresa' : 'Editar Empresa'}
          dados={form}
          onChange={setField}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
          loading={loading}
          erro={erro}
        />
      )}
    </div>
  )
}
