import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { getDashboard } from '../api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const CARDS = [
  { key: 'total_colaboradores', label: 'Colaboradores',   accent: '#059669' },
  { key: 'registros_hoje',      label: 'Registros Hoje',  accent: '#2563eb' },
  { key: 'atrasos_hoje',        label: 'Em Atraso',       accent: '#d97706', sub: 'entradas atrasadas hoje' },
  { key: 'sem_registro_hoje',   label: 'Sem Registro',    accent: '#dc2626', sub: 'sem batida hoje' },
]

function MetricCard({ label, value, sub, accent }) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-1"
      style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a1a1aa' }}>{label}</p>
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: accent + '18' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
        </div>
      </div>
      <p className="text-3xl font-semibold" style={{ color: accent }}>{value ?? '—'}</p>
      {sub && <p className="text-xs" style={{ color: '#a1a1aa' }}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getDashboard().then(setDados).catch(e => setErro(e.message))
  }, [])

  if (erro) return <p className="text-red-500 text-sm">{erro}</p>
  if (!dados) return <p className="text-sm" style={{ color: '#a1a1aa' }}>Carregando…</p>

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
      x: { ticks: { color: '#a1a1aa', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      y: { ticks: { color: '#a1a1aa', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true },
    },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#18181b' }}>Visão geral</h1>
        <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>Resumo de hoje</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map(c => (
          <MetricCard
            key={c.key}
            label={c.label}
            value={dados[c.key]}
            sub={c.sub}
            accent={c.accent}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08)' }}>
        <div style={{ borderBottom: '0.5px solid rgba(0,0,0,0.07)', paddingBottom: 12, marginBottom: 16 }}>
          <p className="text-sm font-medium" style={{ color: '#18181b' }}>Registros — últimos 7 dias</p>
        </div>
        <Bar data={chartData} options={chartOpts} />
      </div>

      {dados.ultimos_registros?.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-sm font-medium" style={{ color: '#18181b' }}>Últimos registros</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
                {['Colaborador', 'Tipo', 'Horário', 'Local'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.ultimos_registros.map((r, i) => (
                <tr key={i} className="transition-colors" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td className="px-5 py-3 font-medium" style={{ color: '#18181b' }}>{r.colaborador_nome}</td>
                  <td className="px-5 py-3 capitalize" style={{ color: '#3f3f46' }}>{r.tipo.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3" style={{ color: '#71717a' }}>{new Date(r.registrado_em).toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-3" style={{ color: '#a1a1aa' }}>{r.local_nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
