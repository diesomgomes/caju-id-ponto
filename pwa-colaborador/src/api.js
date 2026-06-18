const SUPABASE_URL = window.__SUPABASE_URL__ || "https://kgrpynemusujedajtsas.supabase.co";
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtncnB5bmVtdXN1amVkYWp0c2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDIyOTcsImV4cCI6MjA5NzE3ODI5N30.Pobruun9mqxyl5hD51v6_eeyzts0NQYkFjraNsGP0HU";
const API_URL = window.__API_URL__ || "https://caju-id-ponto-production.up.railway.app";

// ---------- Auth ----------

export async function loginColaborador(email, senha) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Falha no login");
  return data;
}

export async function logoutColaborador() {
  const token = getToken();
  if (!token) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
  });
  localStorage.removeItem("ponto_session");
}

export function salvarSessao(session) {
  localStorage.setItem("ponto_session", JSON.stringify(session));
}

export function getSessao() {
  try { return JSON.parse(localStorage.getItem("ponto_session")); } catch { return null; }
}

export function getToken() {
  return getSessao()?.access_token || null;
}

export function limparSessao() {
  localStorage.removeItem("ponto_session");
}

async function refreshSession() {
  const sessao = getSessao();
  if (!sessao?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: sessao.refresh_token }),
    });
    if (!res.ok) return false;
    const nova = await res.json();
    salvarSessao({ ...sessao, ...nova });
    return true;
  } catch { return false; }
}

async function pontoApi(path, opts = {}, _retry = false) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
  });
  if (res.status === 401 && !_retry) {
    const renovado = await refreshSession();
    if (renovado) return pontoApi(path, opts, true);
    limparSessao();
    location.reload();
    return;
  }
  return res;
}

// ---------- Ponto ----------

export async function getStatus() {
  const res = await pontoApi("/ponto/status");
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`403: ${data.detail || "Colaborador não vinculado"}`);
  }
  if (!res.ok) throw new Error("Erro ao buscar status");
  return res.json();
}

export async function registrarPonto({ tipo, lat, lng, fotoBlob }) {
  const form = new FormData();
  form.append("tipo", tipo);
  form.append("lat", lat);
  form.append("lng", lng);
  form.append("foto", fotoBlob, "selfie.jpg");
  const res = await pontoApi("/ponto/registrar", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao registrar ponto");
  return data;
}

export async function getHistorico(mes) {
  const res = await pontoApi(`/ponto/historico?mes=${mes}`);
  if (!res.ok) throw new Error("Erro ao buscar histórico");
  return res.json();
}

export async function getSaldo() {
  const res = await pontoApi("/ponto/saldo");
  if (!res.ok) throw new Error("Erro ao buscar saldo");
  return res.json();
}

export async function getPerfil() {
  const res = await pontoApi("/ponto/perfil");
  if (!res.ok) throw new Error("Erro ao buscar perfil");
  return res.json();
}
