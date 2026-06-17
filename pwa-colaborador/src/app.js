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
    await carregarHome();
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
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

  // Carrega nome da empresa via perfil
  getPerfil().then(p => {
    const empresa = p?.empresa?.nome;
    if (empresa) document.getElementById("nome-empresa").textContent = empresa;
  }).catch(() => {});

  try {
    const status = await getStatus();
    atualizarBotaoPonto(status.proxima_batida);
    atualizarUltimaBatida(status.ultima_batida);
  } catch {
    atualizarBotaoPonto(["entrada"]);
  }
}

function atualizarBotaoPonto(proximos) {
  const btn = document.getElementById("btn-ponto");
  if (!proximos || proximos.length === 0) {
    btn.textContent = "✅  Jornada encerrada";
    btn.className = "w-full py-5 rounded-2xl text-lg font-bold text-white bg-slate-600 cursor-not-allowed";
    btn.disabled = true;
    tipoAtual = null;
    return;
  }
  tipoAtual = proximos[0];
  const info = TIPO_LABEL[tipoAtual];
  btn.textContent = `${info.emoji}  ${info.label}`;
  btn.className = `w-full py-5 rounded-2xl text-lg font-bold text-white transition ${info.cor}`;
  btn.disabled = false;
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
        <p class="font-bold text-lg text-red-400">Erro</p>
        <p class="mt-2 text-sm text-slate-400">${erroMsg}</p>
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
      <div class="mt-4 rounded-xl p-3 text-sm text-left space-y-1" style="background:rgba(255,255,255,0.05)">
        <p class="text-slate-400">⏱ Trabalhado: <span class="font-bold text-white">${j.horas_trabalhadas}</span></p>
        <p class="text-slate-400">🎯 Esperado: <span class="font-bold text-white">${j.horas_esperadas}</span></p>
        <p class="text-slate-400">📊 Saldo: <span class="font-bold ${positivo ? "text-emerald-400" : "text-red-400"}">${positivo ? "+" : ""}${j.saldo_dia}</span></p>
      </div>`;
  }
  box.innerHTML = `
    <div class="text-center">
      <p class="text-5xl mb-3">${valido ? "✅" : "⚠️"}</p>
      <p class="font-bold text-xl">${valido ? "Ponto registrado!" : "Registro salvo (fora da área)"}</p>
      <p class="text-slate-400 mt-1">${info?.emoji || ""} ${info?.label || resp.tipo}</p>
      <p class="text-3xl font-mono font-bold mt-3">${hora}</p>
      ${resp.local_nome ? `<p class="text-sm text-emerald-400 mt-2">📍 ${resp.local_nome} (${resp.distancia_metros?.toFixed(0)}m)</p>` : ""}
      ${resp.motivo_rejeicao ? `<p class="text-sm text-yellow-400 mt-2">⚠️ ${resp.motivo_rejeicao}</p>` : ""}
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
