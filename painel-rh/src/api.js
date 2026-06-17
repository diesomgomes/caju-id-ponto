const API_URL = window.__API_URL__ || 'https://caju-id-ponto-production.up.railway.app'
const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://kgrpynemusujedajtsas.supabase.co'
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtncnB5bmVtdXN1amVkYWp0c2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDIyOTcsImV4cCI6MjA5NzE3ODI5N30.Pobruun9mqxyl5hD51v6_eeyzts0NQYkFjraNsGP0HU'

export async function loginRH(email, senha) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password: senha }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao fazer login')
  return data
}

export function salvarSessao(data) {
  localStorage.setItem('rh_session', JSON.stringify(data))
}

export function getSessao() {
  try { return JSON.parse(localStorage.getItem('rh_session')) } catch { return null }
}

export function getToken() {
  return getSessao()?.access_token || null
}

export function limparSessao() {
  localStorage.removeItem('rh_session')
}

async function api(path, opts = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.detail || 'Erro na requisição'), { status: res.status })
  }
  return res.json()
}

export const getDashboard = () => api('/rh/dashboard')
export const getColaboradores = () => api('/rh/colaboradores')
export const getColaborador = (id) => api(`/rh/colaboradores/${id}`)
export const criarColaborador = (body) => api('/rh/colaboradores', { method: 'POST', body: JSON.stringify(body) })
export const atualizarColaborador = (id, body) => api(`/rh/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirColaborador = (id) => api(`/rh/colaboradores/${id}`, { method: 'DELETE' })

export const getRegistros = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/registros${qs ? '?' + qs : ''}`)
}
export const getFotoUrl = (registroId) => api(`/rh/registros/${registroId}/foto`)
export const ajustarRegistro = (id, body) => api(`/rh/registros/${id}/ajuste`, { method: 'POST', body: JSON.stringify(body) })

export const getJornadas = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/jornadas${qs ? '?' + qs : ''}`)
}
export const exportarJornadas = async (params = {}) => {
  const token = getToken()
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${API_URL}/rh/jornadas/exportar${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Erro ao exportar')
  return res.blob()
}

export const getLocais = () => api('/rh/locais')
export const criarLocal = (body) => api('/rh/locais', { method: 'POST', body: JSON.stringify(body) })
export const atualizarLocal = (id, body) => api(`/rh/locais/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirLocal = (id) => api(`/rh/locais/${id}`, { method: 'DELETE' })
