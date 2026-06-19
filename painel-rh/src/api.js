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
  _meCache = null // invalida cache ao trocar sessão
}

export function getSessao() {
  try { return JSON.parse(localStorage.getItem('rh_session')) } catch { return null }
}

export function getToken() {
  return getSessao()?.access_token || null
}

export function limparSessao() {
  localStorage.removeItem('rh_session')
  _meCache = null
}

async function refreshSession() {
  const sessao = getSessao()
  if (!sessao?.refresh_token) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: sessao.refresh_token }),
    })
    if (!res.ok) return false
    const nova = await res.json()
    salvarSessao({ ...sessao, ...nova })
    return true
  } catch { return false }
}

async function api(path, opts = {}, _retry = false) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401 && !_retry) {
    const renovado = await refreshSession()
    if (renovado) return api(path, opts, true)
    limparSessao()
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.detail || 'Erro na requisição'), { status: res.status })
  }
  return res.json()
}

// Cache em memória para getMe — evita chamadas duplicadas entre Layout e páginas
let _meCache = null
export async function getMe() {
  if (_meCache) return _meCache
  _meCache = await api('/rh/me')
  return _meCache
}

export const getDashboard = () => api('/rh/dashboard')

export const getUsuarios = () => api('/rh/usuarios')
export const criarUsuario = (body) => api('/rh/usuarios', { method: 'POST', body: JSON.stringify(body) })
export const atualizarUsuario = (id, body) => api(`/rh/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirUsuario = (id) => api(`/rh/usuarios/${id}`, { method: 'DELETE' })

export const getEmpresas = () => api('/rh/empresas')
export const criarEmpresa = (body) => api('/rh/empresas', { method: 'POST', body: JSON.stringify(body) })
export const atualizarEmpresa = (id, body) => api(`/rh/empresas/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirEmpresa = (id) => api(`/rh/empresas/${id}`, { method: 'DELETE' })

export const getColaboradores = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/colaboradores${qs ? '?' + qs : ''}`)
}
export const getColaborador = (id) => api(`/rh/colaboradores/${id}`)
export const criarColaborador = (body) => api('/rh/colaboradores', { method: 'POST', body: JSON.stringify(body) })
export const atualizarColaborador = (id, body) => api(`/rh/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirColaborador = (id) => api(`/rh/colaboradores/${id}`, { method: 'DELETE' })
export const alterarSenhaColaborador = (id, senha) => api(`/rh/colaboradores/${id}/senha`, { method: 'PATCH', body: JSON.stringify({ senha }) })
export const getAjustesBanco = (id) => api(`/rh/colaboradores/${id}/ajuste-banco`)
export const criarAjusteBanco = (id, body) => api(`/rh/colaboradores/${id}/ajuste-banco`, { method: 'POST', body: JSON.stringify(body) })
export const excluirAjusteBanco = (ajusteId) => api(`/rh/ajuste-banco/${ajusteId}`, { method: 'DELETE' })

export const getRegistros = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/registros${qs ? '?' + qs : ''}`)
}
export const getFotoUrl = (registroId) => api(`/rh/registros/${registroId}/foto`)
export const ajustarRegistro = (id, body) => api(`/rh/registros/${id}/ajuste`, { method: 'POST', body: JSON.stringify(body) })
export const excluirRegistro = (id) => api(`/rh/registros/${id}`, { method: 'DELETE' })

export const excluirJornada = (id) => api(`/rh/jornadas/${id}`, { method: 'DELETE' })

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

export const getModelosJornada = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/modelos-jornada${qs ? '?' + qs : ''}`)
}
export const criarModeloJornada = (body) => api('/rh/modelos-jornada', { method: 'POST', body: JSON.stringify(body) })
export const atualizarModeloJornada = (id, body) => api(`/rh/modelos-jornada/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirModeloJornada = (id) => api(`/rh/modelos-jornada/${id}`, { method: 'DELETE' })

export const getLocaisColaborador = (colaboradorId) => api(`/rh/colaboradores/${colaboradorId}/locais`)
export const setLocaisColaborador = (colaboradorId, local_ids) =>
  api(`/rh/colaboradores/${colaboradorId}/locais`, { method: 'PUT', body: JSON.stringify({ local_ids }) })

export const getLocais = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return api(`/rh/locais${qs ? '?' + qs : ''}`)
}
export const criarLocal = (body) => api('/rh/locais', { method: 'POST', body: JSON.stringify(body) })
export const atualizarLocal = (id, body) => api(`/rh/locais/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const excluirLocal = (id) => api(`/rh/locais/${id}`, { method: 'DELETE' })

export const getFeriados = (ano) => api(`/rh/feriados${ano ? '?ano=' + ano : ''}`)
export const criarFeriado = (body) => api('/rh/feriados', { method: 'POST', body: JSON.stringify(body) })
export const excluirFeriado = (id) => api(`/rh/feriados/${id}`, { method: 'DELETE' })
export const sincronizarFeriados = (ano) => api(`/rh/feriados/sincronizar?ano=${ano}`, { method: 'POST' })
export const getCalendario = (colaborador_id, mes) => api(`/rh/calendario?colaborador_id=${colaborador_id}&mes=${mes}`)

export const getLoginConfig = () => fetch(`${window.__API_URL__ || 'https://caju-id-ponto-production.up.railway.app'}/rh/login-config`).then(r => r.json()).catch(() => ({}))
export const salvarLoginConfig = (body) => api('/rh/login-config', { method: 'PATCH', body: JSON.stringify(body) })
