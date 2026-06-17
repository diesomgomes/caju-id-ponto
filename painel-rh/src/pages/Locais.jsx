import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { getLocais, criarLocal, atualizarLocal, excluirLocal } from '../api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const VAZIO = { nome: '', lat: '', lng: '', raio_metros: 100 }

function ClickMap({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function Modal({ titulo, dados, onChange, onSalvar, onFechar, loading, erro }) {
  const lat = parseFloat(dados.lat)
  const lng = parseFloat(dados.lng)
  const posValida = !isNaN(lat) && !isNaN(lng)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-100">{titulo}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Nome do local</label>
          <input value={dados.nome} onChange={e => onChange('nome', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Latitude</label>
            <input type="number" step="any" value={dados.lat} onChange={e => onChange('lat', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Longitude</label>
            <input type="number" step="any" value={dados.lng} onChange={e => onChange('lng', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Raio (m)</label>
            <input type="number" value={dados.raio_metros} onChange={e => onChange('raio_metros', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm" />
          </div>
        </div>
        <p className="text-xs text-gray-500">Clique no mapa para definir a localização</p>
        <div className="h-48 rounded-lg overflow-hidden">
          <MapContainer
            center={posValida ? [lat, lng] : [-15.77, -47.93]}
            zoom={posValida ? 16 : 4}
            style={{ height: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickMap onPick={(la, lo) => { onChange('lat', la); onChange('lng', lo) }} />
            {posValida && (
              <>
                <Marker position={[lat, lng]} />
                <Circle center={[lat, lng]} radius={parseFloat(dados.raio_metros) || 100} color="#10b981" fillOpacity={0.2} />
              </>
            )}
          </MapContainer>
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

export default function Locais() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => getLocais().then(setLista).catch(console.error)
  useEffect(() => { carregar() }, [])

  function abrirCriar() { setForm(VAZIO); setErro(''); setModal('criar') }
  function abrirEditar(l) { setForm({ ...l, lat: String(l.lat), lng: String(l.lng) }); setErro(''); setModal(l) }
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function salvar() {
    setErro(''); setLoading(true)
    const body = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), raio_metros: parseInt(form.raio_metros) }
    try {
      if (modal === 'criar') await criarLocal(body)
      else await atualizarLocal(modal.id, body)
      setModal(null)
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function excluir(id) {
    if (!confirm('Confirma exclusão do local?')) return
    try { await excluirLocal(id); carregar() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Locais Permitidos</h1>
        <button onClick={abrirCriar} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Novo Local
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Latitude</th>
              <th className="px-4 py-3">Longitude</th>
              <th className="px-4 py-3">Raio</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum local cadastrado.</td></tr>
            ) : lista.map(l => (
              <tr key={l.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium">{l.nome}</td>
                <td className="px-4 py-3 text-gray-500">{Number(l.lat).toFixed(6)}</td>
                <td className="px-4 py-3 text-gray-500">{Number(l.lng).toFixed(6)}</td>
                <td className="px-4 py-3">{l.raio_metros}m</td>
                <td className="px-4 py-3 flex gap-3">
                  <button onClick={() => abrirEditar(l)} className="text-blue-400 hover:text-blue-300 text-xs underline">Editar</button>
                  <button onClick={() => excluir(l.id)} className="text-red-400 hover:text-red-300 text-xs underline">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          titulo={modal === 'criar' ? 'Novo Local' : 'Editar Local'}
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
