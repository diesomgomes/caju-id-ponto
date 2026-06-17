import { useEffect, useState } from 'react'
import { getJornadas, getColaboradores, exportarJornadas, excluirJornada, getMe } from '../api'

function fmtHoras(interval) {
  if (!interval) return '—'
  const m = interval.match(/(\d+):(\d+)/)
  if (!m) return interval
  return `${m[1]}h ${m[2]}min`
}

export default function Jornada() {
  const [jornadas, setJornadas] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filtros, setFiltros] = useState({ colaborador_id: '', mes: new Date().toISOString().slice(0, 7) })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [me, setMe] = useState(null)

  useEffect(() => {
    getColaboradores().then(setColaboradores).catch(() => {})
    getMe().then(setMe).catch(() => {})
  }, [])

  async function buscar() {
    setLoading(true)
    const params = { mes: filtros.mes }
    if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
    try { setJornadas(await getJornadas(params)) } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { buscar() }, [])

  async function exportar(formato) {
    setExporting(true)
    try {
      const params = { mes: filtros.mes, formato }
      if (filtros.colaborador_id) params.colaborador_id = filtros.colaborador_id
      const blob = await exportarJornadas(params)
      const ext = formato === 'pdf' ? 'pdf' : formato === 'excel' ? 'xlsx' : 'csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jornada_${filtros.mes}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) } finally { setExporting(false) }
  }

  const totalHoras = jornadas.reduce((acc, j) => {
    if (!j.total_trabalhado) return acc
    const m = j.total_trabalhado.match(/(\d+):(\d+)/)
    return acc + (m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0)
  }, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Jornada de Trabalho</h1>

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
        <button onClick={buscar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Filtrar
        </button>
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
                  <td className="px-4 py-3">{j.hora_entrada ? j.hora_entrada.slice(0,5) : '—'}</td>
                  <td className="px-4 py-3">{j.hora_saida_almoco ? j.hora_saida_almoco.slice(0,5) : '—'}</td>
                  <td className="px-4 py-3">{j.hora_retorno_almoco ? j.hora_retorno_almoco.slice(0,5) : '—'}</td>
                  <td className="px-4 py-3">{j.hora_saida ? j.hora_saida.slice(0,5) : '—'}</td>
                  <td className="px-4 py-3">{fmtHoras(j.total_trabalhado)}</td>
                  <td className={`px-4 py-3 font-medium ${saldoPositivo ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtHoras(j.saldo_dia)}
                  </td>
                  {me?.papel === 'admin' && (
                    <td className="px-4 py-3">
                      <button onClick={async () => {
                        if (!confirm(`Excluir jornada de ${j.colaborador_nome} em ${new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')}? Esta ação não pode ser desfeita.`)) return
                        try { await excluirJornada(j.id); buscar() } catch (e) { alert(e.message) }
                      }} className="text-red-400 hover:text-red-300 text-xs underline">Excluir</button>
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
