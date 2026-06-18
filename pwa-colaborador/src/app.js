import { loginColaborador, logoutColaborador, salvarSessao, getSessao, getToken, limparSessao, getStatus, registrarPonto, getPerfil } from "./api.js";
import { abrirCamera, pararCamera, capturarFoto } from "./camera.js";
import { obterLocalizacao } from "./geolocation.js";

let locAtual = null;
let fotoBlob = null;
let tipoAtual = null;

const TIPO_LABEL = {
  entrada:        { label: "ENTRADA",        emoji: "🟢", cor: "bg-emerald-500 hover:bg-emerald-400" },
  saida_almoco:   { label: "SAÍDA ALMOÇO",   emoji: "🟡", cor: "bg-yellow-500 hover:bg-yellow-400"  },
  retorno_almoco: { label: "RETORNO ALMOÇO", emoji: "🔵", cor: "bg-blue-500 hover:bg-blue-400"      },
  saida:          { label: "SAÍDA",          emoji: "🔴", cor: "bg-red-500 hover:bg-red-400"         },
};

function mostrar(id) {
  ["tela-login", "tela-home", "tela-camera", "tela-resultado"].forEach(t => {
    document.getElementById(t).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

function iniciarRelogio() {
  const el = document.getElementById("relogio");
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString("pt-BR"); };
  tick();
  setInterval(tick, 1000);
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const btn   = document.getElementById("btn-login");
  const erro  = document.getElementById("login-erro");
  erro.textContent = "";
  btn.disabled = true;
  btn.textContent = "Entrando...";
  try {
    const session = await loginColaborador(email, senha);
    salvarSessao(session);
    try {
      await getStatus();
    } catch (err) {
      if (err.message?.startsWith("403")) {
        limparSessao();
        throw new Error("Este acesso é exclusivo para colaboradores.");
      }
    }
    // Mostra logo da empresa já na tela de login durante transição
    getPerfil().then(p => aplicarBrandingEmpresa(p?.empresa)).catch(() => {});
    await carregarHome();
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

// ── Branding da empresa ───────────────────────────────────────────────────────
function aplicarBrandingEmpresa(emp) {
  if (!emp) return;
  // Nome na home e no login
  if (emp.nome) {
    const elHome = document.getElementById("nome-empresa");
    if (elHome) elHome.textContent = emp.nome;
    const elLogin = document.getElementById("login-empresa-nome");
    if (elLogin) elLogin.textContent = emp.nome;
  }
  if (emp.logo_url) {
    // Logo no bloco de login
    const wrap = document.getElementById("login-logo-wrap");
    if (wrap) {
      wrap.innerHTML = `<img src="${emp.logo_url}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:1rem;" />`;
      wrap.style.background = "rgba(255,255,255,0.08)";
    }
    // Favicon
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = emp.logo_url;
  }
}

// ── Home ──────────────────────────────────────────────────────────────────────
async function carregarHome() {
  mostrar("tela-home");
  iniciarRelogio();

  const agora = new Date();
  document.getElementById("data-hoje").textContent =
    agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  const sessao = getSessao();
  document.getElementById("nome-colaborador").textContent =
    sessao?.user?.user_metadata?.nome || sessao?.user?.email || "Colaborador";

  // Carrega nome e logo da empresa via perfil
  getPerfil().then(p => aplicarBrandingEmpresa(p?.empresa)).catch(() => {});

  try {
    const status = await getStatus();
    atualizarBotaoPonto(status.proxima_batida);
    atualizarUltimaBatida(status.ultima_batida);
  } catch {
    atualizarBotaoPonto(["entrada"]);
  }
}

const TIPO_COR_BADGE = {
  entrada:        { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.35)',  cor: '#059669' },
  saida_almoco:   { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.35)',   cor: '#a16207' },
  retorno_almoco: { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.35)',  cor: '#1d4ed8' },
  saida:          { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)',   cor: '#dc2626' },
};

function atualizarBotaoPonto(proximos) {
  const btn = document.getElementById("btn-ponto");
  const badge = document.getElementById("tipo-ponto");
  if (!proximos || proximos.length === 0) {
    btn.textContent = "Jornada encerrada";
    btn.className = "w-full py-5 rounded-2xl text-lg font-bold cursor-not-allowed";
    btn.style.cssText = "background:#e4e4e7;color:#a1a1aa";
    btn.disabled = true;
    tipoAtual = null;
    if (badge) badge.innerHTML = '';
    return;
  }
  tipoAtual = proximos[0];
  const info = TIPO_LABEL[tipoAtual];
  const c = TIPO_COR_BADGE[tipoAtual] || TIPO_COR_BADGE.entrada;
  btn.textContent = "Registrar Ponto";
  btn.style.cssText = "";
  btn.className = "w-full py-5 rounded-2xl text-lg font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition shadow-sm";
  btn.disabled = false;
  if (badge) {
    badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px;padding:6px 20px;border-radius:999px;background:${c.bg};border:1px solid ${c.border};font-size:13px;font-weight:600;color:${c.cor}">${info.emoji} ${info.label}</span>`;
  }
}

function atualizarUltimaBatida(batida) {
  const el = document.getElementById("ultima-batida");
  if (!batida) { el.textContent = "Nenhum registro hoje"; return; }
  const info = TIPO_LABEL[batida.tipo];
  const hora = new Date(batida.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  el.textContent = `${info?.emoji || ""} ${info?.label || batida.tipo} às ${hora}`;
}

// ── Fluxo de bater ponto ──────────────────────────────────────────────────────
async function iniciarFluxoPonto() {
  if (!tipoAtual) return;

  // Verificar LGPD
  const lgpdAceito = localStorage.getItem("lgpd_aceito");
  if (!lgpdAceito) {
    document.getElementById("aviso-lgpd").classList.remove("hidden");
    return;
  }

  const status = document.getElementById("status-gps");
  status.textContent = "📍 Obtendo localização...";
  mostrar("tela-camera");
  document.getElementById("camera-tipo").textContent =
    `${TIPO_LABEL[tipoAtual].emoji} ${TIPO_LABEL[tipoAtual].label}`;
  fotoBlob = null;
  locAtual = null;

  try {
    locAtual = await obterLocalizacao();
    status.textContent = `📍 GPS OK (${locAtual.lat.toFixed(5)}, ${locAtual.lng.toFixed(5)})`;
  } catch (err) {
    status.textContent = `❌ ${err.message}`;
    document.getElementById("btn-capturar").disabled = true;
    return;
  }

  const video = document.getElementById("video-camera");
  try {
    await abrirCamera(video);
    document.getElementById("btn-capturar").disabled = false;
    document.getElementById("preview-foto").classList.add("hidden");
    video.classList.remove("hidden");
  } catch (err) {
    status.textContent = `❌ Câmera: ${err.message}`;
  }
}

async function capturar() {
  const video  = document.getElementById("video-camera");
  const canvas = document.getElementById("canvas-foto");
  const prev   = document.getElementById("preview-foto");
  fotoBlob = await capturarFoto(video, canvas);
  prev.src = URL.createObjectURL(fotoBlob);
  prev.classList.remove("hidden");
  video.classList.add("hidden");
  pararCamera();
  document.getElementById("btn-capturar").classList.add("hidden");
  document.getElementById("acoes-foto").classList.remove("hidden");
}

function tirarNovamente() {
  fotoBlob = null;
  document.getElementById("preview-foto").classList.add("hidden");
  document.getElementById("acoes-foto").classList.add("hidden");
  document.getElementById("btn-capturar").classList.remove("hidden");
  const video = document.getElementById("video-camera");
  video.classList.remove("hidden");
  abrirCamera(video);
}

async function confirmarPonto() {
  if (!fotoBlob || !locAtual || !tipoAtual) return;
  const btn = document.getElementById("btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    const resp = await registrarPonto({ tipo: tipoAtual, lat: locAtual.lat, lng: locAtual.lng, fotoBlob });
    mostrarResultado(resp);
  } catch (err) {
    mostrarResultado(null, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Confirmar";
  }
}

function mostrarResultado(resp, erroMsg) {
  mostrar("tela-resultado");
  const box = document.getElementById("resultado-box");
  if (erroMsg) {
    box.innerHTML = `
      <div class="text-center">
        <p class="text-5xl mb-3">❌</p>
        <p class="font-bold text-lg" style="color:#dc2626">Erro</p>
        <p class="mt-2 text-sm" style="color:#71717a">${erroMsg}</p>
      </div>`;
    return;
  }
  const valido = resp.status === "valido";
  const hora   = new Date(resp.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const info   = TIPO_LABEL[resp.tipo];
  let jornadaHtml = "";
  if (resp.jornada_hoje) {
    const j = resp.jornada_hoje;
    const positivo = !j.saldo_dia.startsWith("-");
    jornadaHtml = `
      <div class="mt-4 rounded-xl p-3 text-sm text-left space-y-1.5" style="background:#f4f4f5;border:1px solid #e4e4e7">
        <p style="color:#71717a">⏱ Trabalhado: <span class="font-bold" style="color:#18181b">${j.horas_trabalhadas}</span></p>
        <p style="color:#71717a">🎯 Esperado: <span class="font-bold" style="color:#18181b">${j.horas_esperadas}</span></p>
        <p style="color:#71717a">📊 Saldo: <span class="font-bold" style="color:${positivo ? "#059669" : "#dc2626"}">${positivo ? "+" : ""}${j.saldo_dia}</span></p>
      </div>`;
  }
  box.innerHTML = `
    <div class="text-center">
      <p class="text-5xl mb-3">${valido ? "✅" : "⚠️"}</p>
      <p class="font-bold text-xl" style="color:#18181b">${valido ? "Ponto registrado!" : "Registro salvo (fora da área)"}</p>
      <p class="mt-1" style="color:#71717a">${info?.emoji || ""} ${info?.label || resp.tipo}</p>
      <p class="text-3xl font-mono font-bold mt-3" style="color:#18181b">${hora}</p>
      ${resp.local_nome ? `<p class="text-sm mt-2" style="color:#059669">📍 ${resp.local_nome} (${resp.distancia_metros?.toFixed(0)}m)</p>` : ""}
      ${resp.motivo_rejeicao ? `<p class="text-sm mt-2" style="color:#d97706">⚠️ ${resp.motivo_rejeicao}</p>` : ""}
      ${jornadaHtml}
    </div>`;
}

function cancelarCamera() {
  pararCamera();
  carregarHome();
}

async function handleLogout() {
  await logoutColaborador();
  limparSessao();
  mostrar("tela-login");
}

function navegarAba(destino) {
  location.href = destino;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  if (getToken()) {
    carregarHome();
  } else {
    mostrar("tela-login");
  }

  document.getElementById("form-login")?.addEventListener("submit", handleLogin);
  document.getElementById("btn-ponto")?.addEventListener("click", iniciarFluxoPonto);
  document.getElementById("btn-capturar")?.addEventListener("click", capturar);
  document.getElementById("btn-confirmar")?.addEventListener("click", confirmarPonto);
  document.getElementById("btn-novamente")?.addEventListener("click", tirarNovamente);
  document.getElementById("btn-cancelar")?.addEventListener("click", cancelarCamera);
  document.getElementById("btn-voltar-home")?.addEventListener("click", () => carregarHome());
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-aceitar-lgpd")?.addEventListener("click", () => {
    localStorage.setItem("lgpd_aceito", "1");
    document.getElementById("aviso-lgpd").classList.add("hidden");
    iniciarFluxoPonto();
  });

  document.getElementById("aba-historico")?.addEventListener("click",   () => navegarAba("historico.html"));
  document.getElementById("aba-saldo")?.addEventListener("click",        () => navegarAba("saldo.html"));
  document.getElementById("aba-comprovante")?.addEventListener("click",  () => navegarAba("comprovante.html"));
});
