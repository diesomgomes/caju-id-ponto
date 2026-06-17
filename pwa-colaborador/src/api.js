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
  return data; // { access_token, refresh_token, user, ... }
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

// ---------- Ponto ----------

export async function getStatus() {
  const res = await fetch(`${API_URL}/ponto/status`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 401) { limparSessao(); location.reload(); }
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
  const res = await fetch(`${API_URL}/ponto/registrar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao registrar ponto");
  return data;
}

export async function getHistorico(mes) {
  const res = await fetch(`${API_URL}/ponto/historico?mes=${mes}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Erro ao buscar histórico");
  return res.json();
}

export async function getSaldo() {
  const res = await fetch(`${API_URL}/ponto/saldo`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Erro ao buscar saldo");
  return res.json();
}
