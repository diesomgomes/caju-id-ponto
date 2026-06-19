import { useEffect, useState } from 'react'
import { getFeriados, criarFeriado, excluirFeriado, sincronizarFeriados } from '../api'
import { IconExcluir } from '../components/IconBtn'

const TIPO_LABEL = { nacional: 'Nacional', municipal: 'Municipal', empresa: 'Empresa' }
const TIPO_COR   = {
  nacional:  'text-blue-400 bg-blue-900/30 border-blue-800/50',
  municipal: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50',
  empresa:   'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
}

export default function Feriados() {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [feriados, setFeriados] = useState([])
  const [loading, setLoading] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [form, setForm] = useState({ data: '', descricao: '', tipo: 'empresa' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setLoading(true)
    try { setFeriados(await getFeriados(ano)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [ano])

  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await sincronizarFeriados(ano)
      alert(`${r.sincronizados} feriados nacionais sincronizados para ${ano}.`)
      carregar()
    } catch (e) { alert(e.message) }
    finally { setSincronizando(false) }
  }

  async function adicionar() {
    if (!form.data || !form.descricao.trim()) return setErro('Preencha data e descrição.')
    setErro(''); setSalvando(true)
    try {
      await criarFeriado(form)
      setForm({ data: '', descricao: '', tipo: 'empresa' })
      carregar()
    } catch (e) { setErro(e.message) }
    finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Remover este feriado?')) return
    try { await excluirFeriado(id); carregar() }
    catch (e) { alert(e.message) }
  }

  const nacionais  = feriados.filter(f => f.tipo === 'nacional')
  const customizados = feriados.filter(f => f.tipo !== 'nacional')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Cadastro de Feriados</h1>
        <div className="flex items-center gap-3">
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
            {[anoAtual - 1, anoAtual, anoAtual + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={sincronizar} disabled={sincronizando}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {sincronizando ? 'Sincronizando…' : '↻ Sincronizar feriados nacionais'}
          </button>
        </div>
      </div>

      {/* Formulário para adicionar */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
        <p className="text-sm font-semibold text-gray-300">Adicionar dia não útil / feriado municipal</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-400 block mb-1">Descrição</label>
            <input type="text" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Aniversário da cidade"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm">
              <option value="empresa">Empresa / Ponto facultativo</option>
              <option value="municipal">Municipal</option>
            </select>
          </div>
          <button onClick={adicionar} disabled={salvando}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {salvando ? 'Salvando…' : '+ Adicionar'}
          </button>
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
      </div>

      {/* Feriados customizados */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-gray-300">Feriados municipais e dias da empresa</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Carregando…</td></tr>
            ) : customizados.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhum feriado customizado cadastrado.</td></tr>
            ) : customizados.map(f => (
              <tr key={f.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-mono">{new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">{f.descricao}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIPO_COR[f.tipo] || ''}`}>
                    {TIPO_LABEL[f.tipo] || f.tipo}
                  </span>
                </td>
                <td className="px-4 py-3"><IconExcluir onClick={() => excluir(f.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feriados nacionais (somente leitura) */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <div className="px-5 py-3 border-b border-gray-800 flex justify-between items-center">
          <p className="text-sm font-semibold text-gray-300">Feriados nacionais {ano}</p>
          <span className="text-xs text-gray-500">{nacionais.length} feriados — sincronizados da BrasilAPI</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {nacionais.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                Nenhum feriado nacional. Clique em "Sincronizar feriados nacionais" para importar.
              </td></tr>
            ) : nacionais.map(f => (
              <tr key={f.id} className="border-b border-gray-800/50 text-gray-300">
                <td className="px-4 py-2.5 font-mono">{new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2.5">{f.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
