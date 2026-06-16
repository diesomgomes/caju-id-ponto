import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { getDashboard } from '../api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function Card({ label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'border-emerald-500 text-emerald-400',
    blue: 'border-blue-500 text-blue-400',
    yellow: 'border-yellow-500 text-yellow-400',
    red: 'border-red-500 text-red-400',
  }
  return (
    <div className={`bg-gray-900 border-l-4 ${colors[color]} rounded-xl p-5`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color].split(' ')[1]}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getDashboard().then(setDados).catch(e => setErro(e.message))
  }, [])

  if (erro) return <p className="text-red-400">{erro}</p>
  if (!dados) return <p className="text-gray-400">Carregando…</p>

  const chartData = {
    labels: (dados.registros_7dias || []).map(d => d.data),
    datasets: [{
      label: 'Registros',
      data: (dados.registros_7dias || []).map(d => d.total),
      backgroundColor: '#10b981',
      borderRadius: 6,
    }],
  }

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' }, beginAtZero: true },
    },
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Colaboradores" value={dados.total_colaboradores} color="emerald" />
        <Card label="Registros Hoje" value={dados.registros_hoje} color="blue" />
        <Card label="Em Atraso" value={dados.atrasos_hoje} sub="entradas atrasadas hoje" color="yellow" />
        <Card label="Sem Registro" value={dados.sem_registro_hoje} sub="sem batida hoje" color="red" />
      </div>
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Registros — Últimos 7 dias</h2>
        <Bar data={chartData} options={chartOpts} />
      </div>
      {dados.ultimos_registros?.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Últimos Registros</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800 text-left">
                <th className="pb-2">Colaborador</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Horário</th>
                <th className="pb-2">Local</th>
              </tr>
            </thead>
            <tbody>
              {dados.ultimos_registros.map((r, i) => (
                <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                  <td className="py-2">{r.colaborador_nome}</td>
                  <td className="py-2 capitalize">{r.tipo.replace(/_/g, ' ')}</td>
                  <td className="py-2">{new Date(r.registrado_em).toLocaleString('pt-BR')}</td>
                  <td className="py-2 text-gray-500">{r.local_nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
