from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
import calendar as cal_module
from services.jornada import atualizar_jornada_dia, parse_interval

TZ_BR = ZoneInfo("America/Sao_Paulo")
import csv
import io
import httpx
import logging

logger = logging.getLogger(__name__)
from db.supabase_client import supabase as sb
from auth.deps import get_usuario_rh_atual

router = APIRouter(prefix="/rh", tags=["rh"])


def _empresa_ids(rh: dict) -> list[str]:
    if rh.get("papel") == "admin":
        res = sb.table("empresas").select("id").eq("ativo", True).execute()
        return [e["id"] for e in (res.data or [])]
    return [rh["empresa_id"]]


# ─── Empresas ────────────────────────────────────────────────────────────────

@router.get("/empresas")
async def listar_empresas(rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    res = sb.table("empresas").select("*").in_("id", ids).order("nome").execute()
    return res.data or []


@router.post("/empresas")
async def criar_empresa(body: dict, rh=Depends(get_usuario_rh_atual)):
    if rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem criar empresas")
    payload = {k: v for k, v in body.items() if k not in ("id", "criado_em")}
    payload.setdefault("ativo", True)
    try:
        res = sb.table("empresas").insert(payload).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao criar empresa: {e}")
    if not res.data:
        raise HTTPException(400, "Erro ao criar empresa")
    return res.data[0]


@router.put("/empresas/{empresa_id}")
async def atualizar_empresa(empresa_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    if empresa_id not in _empresa_ids(rh):
        raise HTTPException(403, "Sem acesso a esta empresa")
    body.pop("id", None); body.pop("criado_em", None)
    try:
        res = sb.table("empresas").update(body).eq("id", empresa_id).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao atualizar empresa: {e}")
    if not res.data:
        raise HTTPException(404, "Empresa não encontrada")
    return res.data[0]


@router.delete("/empresas/{empresa_id}")
async def excluir_empresa(empresa_id: str, rh=Depends(get_usuario_rh_atual)):
    if rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem excluir empresas")
    if empresa_id not in _empresa_ids(rh):
        raise HTTPException(403, "Sem acesso a esta empresa")
    sb.table("empresas").update({"ativo": False}).eq("id", empresa_id).execute()
    return {"ok": True}


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard(rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    hoje = date.today().isoformat()

    if not ids:
        return {
            "total_colaboradores": 0, "registros_hoje": 0,
            "atrasos_hoje": 0, "sem_registro_hoje": 0,
            "registros_7dias": [], "ultimos_registros": [],
        }

    total_colab = sb.table("colaboradores").select("id", count="exact").in_("empresa_id", ids).eq("ativo", True).execute()
    regs_hoje = sb.table("registros_ponto").select("id, tipo, registrado_em, colaborador_id", count="exact") \
        .in_("empresa_id", ids).gte("registrado_em", hoje + "T00:00:00").lte("registrado_em", hoje + "T23:59:59").execute()

    sete_dias = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        r = sb.table("registros_ponto").select("id", count="exact") \
            .in_("empresa_id", ids).gte("registrado_em", d + "T00:00:00").lte("registrado_em", d + "T23:59:59").execute()
        sete_dias.append({"data": d, "total": r.count or 0})

    ultimos_raw = sb.table("registros_ponto").select("id, tipo, registrado_em, foto_url, colaborador_id") \
        .in_("empresa_id", ids).order("registrado_em", desc=True).limit(10).execute()
    ids_colab = list({r["colaborador_id"] for r in (ultimos_raw.data or [])})
    nomes = {}
    if ids_colab:
        cn = sb.table("colaboradores").select("id, nome").in_("id", ids_colab).execute()
        nomes = {c["id"]: c["nome"] for c in (cn.data or [])}

    ultimos = [{**r, "colaborador_nome": nomes.get(r["colaborador_id"], "—"), "local_nome": None}
               for r in (ultimos_raw.data or [])]

    return {
        "total_colaboradores": total_colab.count or 0,
        "registros_hoje": regs_hoje.count or 0,
        "atrasos_hoje": 0,
        "sem_registro_hoje": max(0, (total_colab.count or 0) - len({r["colaborador_id"] for r in (regs_hoje.data or [])})),
        "registros_7dias": sete_dias,
        "ultimos_registros": ultimos,
    }


# ─── Colaboradores ───────────────────────────────────────────────────────────

@router.get("/colaboradores")
async def listar_colaboradores(
    empresa_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    filtro = [empresa_id] if empresa_id and empresa_id in ids else ids
    res = sb.table("colaboradores").select("*").in_("empresa_id", filtro).eq("ativo", True).order("nome").execute()
    return res.data or []


@router.get("/colaboradores/{colab_id}")
async def get_colaborador(colab_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = sb.table("colaboradores").select("*").eq("id", colab_id).in_("empresa_id", ids).single().execute()
    if not res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    return res.data


@router.post("/colaboradores")
async def criar_colaborador(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    empresa = body.get("empresa_id") or rh["empresa_id"]
    if empresa not in ids:
        raise HTTPException(403, "Sem acesso a esta empresa")

    senha = body.pop("senha", "").strip()
    email = body.get("email", "").strip()
    nome  = body.get("nome", "").strip()

    auth_user_id = None
    if email and senha:
        try:
            auth_res = sb.auth.admin.create_user({
                "email": email,
                "password": senha,
                "email_confirm": True,
                "user_metadata": {"nome": nome},
            })
            auth_user_id = auth_res.user.id
        except Exception as e:
            raise HTTPException(400, f"Erro ao criar acesso: {e}")

    payload = {**body, "empresa_id": empresa, "ativo": True}
    if auth_user_id:
        payload["auth_user_id"] = auth_user_id

    try:
        res = sb.table("colaboradores").insert(payload).execute()
    except Exception as e:
        if auth_user_id:
            try: sb.auth.admin.delete_user(auth_user_id)
            except: pass
        raise HTTPException(400, f"Erro ao criar colaborador: {e}")
    if not res.data:
        raise HTTPException(400, "Erro ao criar colaborador")
    return res.data[0]


@router.patch("/colaboradores/{colab_id}/senha")
async def alterar_senha_colaborador(colab_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    senha = body.get("senha", "").strip()
    if not senha or len(senha) < 6:
        raise HTTPException(400, "A senha deve ter ao menos 6 caracteres.")
    res = sb.table("colaboradores").select("auth_user_id, empresa_id").eq("id", colab_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Colaborador não encontrado")
    auth_user_id = res.data.get("auth_user_id")
    if not auth_user_id:
        # Colaborador ainda não tem usuário Auth — criar agora
        email = sb.table("colaboradores").select("email, nome").eq("id", colab_id).single().execute().data
        if not email or not email.get("email"):
            raise HTTPException(400, "Colaborador sem e-mail cadastrado.")
        try:
            auth_res = sb.auth.admin.create_user({
                "email": email["email"],
                "password": senha,
                "email_confirm": True,
                "user_metadata": {"nome": email.get("nome", "")},
            })
            sb.table("colaboradores").update({"auth_user_id": auth_res.user.id}).eq("id", colab_id).execute()
        except Exception as e:
            raise HTTPException(400, f"Erro ao criar acesso: {e}")
    else:
        try:
            sb.auth.admin.update_user_by_id(auth_user_id, {"password": senha})
        except Exception as e:
            raise HTTPException(400, f"Erro ao alterar senha: {e}")
    return {"ok": True}


@router.put("/colaboradores/{colab_id}")
async def atualizar_colaborador(colab_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    body.pop("id", None); body.pop("empresa_id", None)
    try:
        res = sb.table("colaboradores").update(body).eq("id", colab_id).in_("empresa_id", ids).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao atualizar colaborador: {e}")
    if not res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    return res.data[0]


@router.delete("/colaboradores/{colab_id}")
async def excluir_colaborador(colab_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    # Busca o auth_user_id antes de desativar
    res = sb.table("colaboradores").select("auth_user_id").eq("id", colab_id).in_("empresa_id", ids).limit(1).execute()
    # Desativa e limpa email/auth_user_id para liberar o e-mail para reutilização
    sb.table("colaboradores").update({"ativo": False, "email": None, "auth_user_id": None}).eq("id", colab_id).in_("empresa_id", ids).execute()
    # Remove o login do Supabase Auth
    if res.data and res.data[0].get("auth_user_id"):
        try:
            sb.auth.admin.delete_user(res.data[0]["auth_user_id"])
        except Exception as e:
            logger.warning(f"excluir_colaborador: falha ao remover auth user: {e}")
    return {"ok": True}


# ─── Registros ───────────────────────────────────────────────────────────────

@router.get("/registros")
async def listar_registros(
    colaborador_id: Optional[str] = None,
    tipo: Optional[str] = None,
    data: Optional[str] = None,
    empresa_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    filtro = [empresa_id] if empresa_id and empresa_id in ids else ids
    q = sb.table("registros_ponto").select("*, locais_permitidos(nome)").in_("empresa_id", filtro)
    if colaborador_id:
        q = q.eq("colaborador_id", colaborador_id)
    if tipo:
        q = q.eq("tipo", tipo)
    if data:
        q = q.gte("registrado_em", data + "T00:00:00").lte("registrado_em", data + "T23:59:59")
    res = q.order("registrado_em", desc=True).limit(200).execute()
    regs = res.data or []

    ids_colab = list({r["colaborador_id"] for r in regs})
    nomes = {}
    if ids_colab:
        cn = sb.table("colaboradores").select("id, nome").in_("id", ids_colab).execute()
        nomes = {c["id"]: c["nome"] for c in (cn.data or [])}

    # Identifica registros manuais via ajustes_ponto (inclui motivo e quem lançou)
    ids_regs = [r["id"] for r in regs]
    manuais = {}
    nomes_rh = {}
    if ids_regs:
        aj = sb.table("ajustes_ponto").select("registro_id, justificativa, usuario_rh_id") \
            .in_("registro_id", ids_regs) \
            .eq("campo_alterado", "criação manual").execute()
        manuais = {a["registro_id"]: a for a in (aj.data or [])}
        ids_rh = list({a["usuario_rh_id"] for a in (aj.data or []) if a.get("usuario_rh_id")})
        if ids_rh:
            rh_res = sb.table("usuarios_rh").select("id, nome").in_("id", ids_rh).execute()
            nomes_rh = {u["id"]: u["nome"] for u in (rh_res.data or [])}

    # Identifica registros com ajuste de horário (não criação manual)
    ajustes_tempo = {}
    nomes_rh_aj = {}
    if ids_regs:
        aj2 = sb.table("ajustes_ponto").select("registro_id, valor_anterior, justificativa, usuario_rh_id") \
            .in_("registro_id", ids_regs) \
            .neq("campo_alterado", "criação manual").execute()
        ajustes_tempo = {a["registro_id"]: a for a in (aj2.data or []) if a.get("valor_anterior")}
        ids_rh2 = list({a["usuario_rh_id"] for a in (aj2.data or []) if a.get("usuario_rh_id")})
        if ids_rh2:
            rh_res2 = sb.table("usuarios_rh").select("id, nome").in_("id", ids_rh2).execute()
            nomes_rh_aj = {u["id"]: u["nome"] for u in (rh_res2.data or [])}

    result = []
    for r in regs:
        aj_info = manuais.get(r["id"])
        aj_tempo = ajustes_tempo.get(r["id"])
        result.append({
            **r,
            "colaborador_nome": nomes.get(r["colaborador_id"], "—"),
            "local_nome": (r.get("locais_permitidos") or {}).get("nome") or r.get("local_nome"),
            "origem": "manual" if aj_info else (r.get("origem") or "app"),
            "motivo": aj_info["justificativa"] if aj_info else None,
            "lancado_por": nomes_rh.get(aj_info["usuario_rh_id"], "") if aj_info else None,
            "ajustado": bool(aj_tempo),
            "horario_original": aj_tempo["valor_anterior"] if aj_tempo else None,
            "ajuste_por": nomes_rh_aj.get(aj_tempo["usuario_rh_id"], "") if aj_tempo else None,
            "ajuste_motivo": aj_tempo["justificativa"] if aj_tempo else None,
        })
    return result


@router.get("/registros/{registro_id}/foto")
async def get_foto_url(registro_id: str, rh=Depends(get_usuario_rh_atual)):
    from services.storage import gerar_url_assinada
    ids = _empresa_ids(rh)
    res = sb.table("registros_ponto").select("foto_url, empresa_id").eq("id", registro_id).single().execute()
    if not res.data or res.data.get("empresa_id") not in ids:
        raise HTTPException(404, "Registro não encontrado")
    foto_url = res.data.get("foto_url")
    if not foto_url:
        raise HTTPException(404, "Sem foto")
    path = foto_url.split("/fotos-ponto/")[-1] if "/fotos-ponto/" in foto_url else foto_url
    url = gerar_url_assinada(path)
    return {"url": url}


@router.post("/registros")
async def criar_registro_manual(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    colaborador_id = body.get("colaborador_id", "").strip()
    tipo = body.get("tipo", "").strip()
    registrado_em = body.get("registrado_em", "").strip()
    motivo = body.get("motivo", "").strip()

    if not colaborador_id or not tipo or not registrado_em:
        raise HTTPException(400, "colaborador_id, tipo e registrado_em são obrigatórios")

    TIPOS_VALIDOS = {"entrada", "saida_almoco", "retorno_almoco", "saida"}
    if tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"Tipo inválido. Use: {sorted(TIPOS_VALIDOS)}")

    colab = sb.table("colaboradores").select("id, empresa_id").eq("id", colaborador_id).single().execute()
    if not colab.data or colab.data["empresa_id"] not in ids:
        raise HTTPException(404, "Colaborador não encontrado")

    empresa_id = colab.data["empresa_id"]

    try:
        res = sb.table("registros_ponto").insert({
            "colaborador_id": colaborador_id,
            "empresa_id": empresa_id,
            "tipo": tipo,
            "registrado_em": registrado_em,
            "status": "valido",
            "foto_url": "",
            "lat_registro": None,
            "lng_registro": None,
        }).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao criar registro: {e}")

    registro_id = res.data[0]["id"]

    sb.table("ajustes_ponto").insert({
        "registro_id": registro_id,
        "usuario_rh_id": rh["id"],
        "campo_alterado": "criação manual",
        "valor_anterior": None,
        "valor_novo": tipo,
        "justificativa": motivo or "Registro inserido manualmente pelo RH",
    }).execute()

    # Recalcula jornada do dia afetado (qualquer tipo pode alterar o total)
    try:
        dia_reg = date.fromisoformat(registrado_em[:10])
        emp = sb.table("empresas").select("carga_horaria_diaria").eq("id", empresa_id).single().execute()
        colab_full = sb.table("colaboradores").select("carga_horaria_diaria").eq("id", colaborador_id).single().execute()
        carga = parse_interval(
            (colab_full.data or {}).get("carga_horaria_diaria")
            or (emp.data or {}).get("carga_horaria_diaria")
            or "08:00:00"
        )
        atualizar_jornada_dia(colaborador_id, empresa_id, dia_reg, carga)
    except Exception as e:
        logger.warning(f"criar_registro_manual: falha ao atualizar jornada: {e}")

    return {"ok": True, "id": registro_id}


@router.delete("/registros/{registro_id}")
async def excluir_registro(registro_id: str, rh=Depends(get_usuario_rh_atual)):
    if rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem excluir registros")
    ids = _empresa_ids(rh)
    res = sb.table("registros_ponto").select("empresa_id").eq("id", registro_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Registro não encontrado")
    try:
        sb.table("ajustes_ponto").delete().eq("registro_id", registro_id).execute()
        sb.table("registros_ponto").delete().eq("id", registro_id).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao excluir registro: {e}")
    return {"ok": True}


@router.post("/registros/{registro_id}/ajuste")
async def ajustar_registro(registro_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = sb.table("registros_ponto").select("empresa_id, tipo, registrado_em").eq("id", registro_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Registro não encontrado")

    campos = []
    if body.get("tipo"): campos.append(f"tipo: {res.data['tipo']} → {body['tipo']}")
    if body.get("registrado_em"): campos.append(f"horario: {res.data['registrado_em']} → {body['registrado_em']}")

    ajuste = {
        "registro_id": registro_id,
        "usuario_rh_id": rh["id"],
        "campo_alterado": ", ".join(campos) or "manual",
        "valor_anterior": res.data.get("registrado_em") if body.get("registrado_em") else res.data.get("tipo"),
        "valor_novo": body.get("registrado_em") or body.get("tipo"),
        "justificativa": body.get("motivo", ""),
    }
    sb.table("ajustes_ponto").insert(ajuste).execute()

    update = {}
    if body.get("tipo"): update["tipo"] = body["tipo"]
    if body.get("registrado_em"): update["registrado_em"] = body["registrado_em"]
    sb.table("registros_ponto").update(update).eq("id", registro_id).execute()

    # Recalcula jornada do dia afetado
    try:
        reg_em = body.get("registrado_em") or res.data["registrado_em"]
        dia_reg = date.fromisoformat(reg_em[:10])
        emp = sb.table("empresas").select("carga_horaria_diaria").eq("id", res.data["empresa_id"]).single().execute()
        reg_colab = sb.table("registros_ponto").select("colaborador_id").eq("id", registro_id).single().execute()
        colab_id = reg_colab.data["colaborador_id"]
        colab_full = sb.table("colaboradores").select("carga_horaria_diaria").eq("id", colab_id).single().execute()
        carga = parse_interval(
            (colab_full.data or {}).get("carga_horaria_diaria")
            or (emp.data or {}).get("carga_horaria_diaria")
            or "08:00:00"
        )
        atualizar_jornada_dia(colab_id, res.data["empresa_id"], dia_reg, carga)
    except Exception as e:
        logger.warning(f"ajustar_registro: falha ao atualizar jornada: {e}")

    return {"ok": True}


# ─── Jornadas ────────────────────────────────────────────────────────────────

@router.get("/jornadas")
async def listar_jornadas(
    mes: str = Query(..., description="YYYY-MM"),
    colaborador_id: Optional[str] = None,
    empresa_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    filtro = [empresa_id] if empresa_id and empresa_id in ids else ids

    inicio = mes + "-01"
    ano, m = int(mes.split("-")[0]), int(mes.split("-")[1])
    fim_m = m + 1 if m < 12 else 1
    fim_a = ano if m < 12 else ano + 1
    fim = f"{fim_a}-{fim_m:02d}-01"

    q = sb.table("jornadas_diarias").select("*").in_("empresa_id", filtro).gte("data", inicio).lt("data", fim)
    if colaborador_id:
        q = q.eq("colaborador_id", colaborador_id)
    res = q.order("data", desc=True).execute()
    jornadas = res.data or []

    ids_colab = list({j["colaborador_id"] for j in jornadas})
    nomes = {}
    if ids_colab:
        cn = sb.table("colaboradores").select("id, nome").in_("id", ids_colab).execute()
        nomes = {c["id"]: c["nome"] for c in (cn.data or [])}

    regs_idx = {}
    if ids_colab:
        rq = sb.table("registros_ponto").select("colaborador_id, tipo, registrado_em") \
            .in_("empresa_id", filtro) \
            .gte("registrado_em", inicio + "T00:00:00") \
            .lt("registrado_em", fim + "T00:00:00") \
            .in_("colaborador_id", ids_colab).execute()
        for r in (rq.data or []):
            try:
                dt_utc = datetime.fromisoformat(r["registrado_em"].replace("Z", "+00:00"))
                dt_br = dt_utc.astimezone(TZ_BR)
                dt_key = dt_br.date().isoformat()
                hora_local = dt_br.strftime("%H:%M:%S")
            except Exception:
                dt_key = r["registrado_em"][:10]
                hora_local = r["registrado_em"][11:19]
            key = (r["colaborador_id"], dt_key, r["tipo"])
            regs_idx[key] = hora_local

    result = []
    for j in jornadas:
        cid = j["colaborador_id"]
        d = j["data"]
        result.append({
            **j,
            "colaborador_nome": nomes.get(cid, "—"),
            "hora_entrada": regs_idx.get((cid, d, "entrada")),
            "hora_saida_almoco": regs_idx.get((cid, d, "saida_almoco")),
            "hora_retorno_almoco": regs_idx.get((cid, d, "retorno_almoco")),
            "hora_saida": regs_idx.get((cid, d, "saida")),
            "total_trabalhado": j.get("horas_trabalhadas"),
        })
    return result


@router.delete("/jornadas/{jornada_id}")
async def excluir_jornada(jornada_id: str, rh=Depends(get_usuario_rh_atual)):
    if rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem excluir jornadas")
    ids = _empresa_ids(rh)
    res = sb.table("jornadas_diarias").select("empresa_id").eq("id", jornada_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Jornada não encontrada")
    try:
        sb.table("jornadas_diarias").delete().eq("id", jornada_id).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao excluir jornada: {e}")
    return {"ok": True}


@router.get("/jornadas/exportar")
async def exportar_jornadas(
    mes: str = Query(...),
    formato: str = Query("csv"),
    colaborador_id: Optional[str] = None,
    empresa_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    dados = await listar_jornadas(mes=mes, colaborador_id=colaborador_id, empresa_id=empresa_id, rh=rh)

    if formato == "csv":
        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(["Colaborador", "Data", "Entrada", "Saída Almoço", "Retorno", "Saída", "Trabalhado", "Saldo"])
        for j in dados:
            w.writerow([
                j.get("colaborador_nome"), j.get("data"),
                j.get("hora_entrada", ""), j.get("hora_saida_almoco", ""),
                j.get("hora_retorno_almoco", ""), j.get("hora_saida", ""),
                j.get("total_trabalhado", ""), j.get("saldo_dia", ""),
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=jornada_{mes}.csv"},
        )

    raise HTTPException(400, "Formato não suportado. Use: csv")


# ─── Perfil do usuário logado ────────────────────────────────────────────────

@router.get("/me")
async def get_me(rh=Depends(get_usuario_rh_atual)):
    empresa = sb.table("empresas").select("nome").eq("id", rh["empresa_id"]).single().execute()
    return {
        "id": rh["id"],
        "nome": rh["nome"],
        "email": rh["email"],
        "papel": rh["papel"],
        "empresa_id": rh["empresa_id"],
        "empresa_nome": empresa.data["nome"] if empresa.data else "—",
    }


# ─── Usuários RH ─────────────────────────────────────────────────────────────

@router.get("/usuarios")
async def listar_usuarios(rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    res = sb.table("usuarios_rh").select("id, nome, email, papel, empresa_id, auth_user_id").in_("empresa_id", ids).order("nome").execute()
    return res.data or []


@router.post("/usuarios")
async def criar_usuario(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    empresa = body.get("empresa_id") or rh["empresa_id"]
    if empresa not in ids:
        raise HTTPException(403, "Sem acesso a esta empresa")

    email = body.get("email", "").strip()
    senha = body.get("senha", "").strip()
    nome = body.get("nome", "").strip()
    papel = body.get("papel", "rh")
    if papel == "admin" and rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem criar outros administradores")

    if not email or not senha or not nome:
        raise HTTPException(400, "Nome, email e senha são obrigatórios")

    try:
        auth_res = sb.auth.admin.create_user({
            "email": email,
            "password": senha,
            "email_confirm": True,
        })
        auth_user_id = auth_res.user.id
    except Exception as e:
        raise HTTPException(400, f"Erro ao criar usuário: {e}")

    res = sb.table("usuarios_rh").insert({
        "empresa_id": empresa,
        "auth_user_id": auth_user_id,
        "nome": nome,
        "email": email,
        "papel": papel,
    }).execute()

    if not res.data:
        sb.auth.admin.delete_user(auth_user_id)
        raise HTTPException(400, "Erro ao vincular usuário RH")

    return res.data[0]


@router.put("/usuarios/{usuario_id}")
async def atualizar_usuario(usuario_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = sb.table("usuarios_rh").select("auth_user_id, empresa_id, papel").eq("id", usuario_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Usuário não encontrado")
    if res.data.get("papel") == "admin" and rh.get("papel") != "admin":
        raise HTTPException(403, "Sem permissão para editar um administrador")

    auth_user_id = res.data["auth_user_id"]
    auth_patch = {}
    if body.get("email"):
        auth_patch["email"] = body["email"]
    if body.get("senha"):
        auth_patch["password"] = body["senha"]
    if auth_patch and auth_user_id:
        try:
            sb.auth.admin.update_user_by_id(auth_user_id, auth_patch)
        except Exception as e:
            raise HTTPException(400, f"Erro ao atualizar auth: {e}")

    db_patch = {}
    for campo in ("nome", "email", "papel"):
        if body.get(campo):
            db_patch[campo] = body[campo]
    if db_patch:
        sb.table("usuarios_rh").update(db_patch).eq("id", usuario_id).execute()

    return {"ok": True}


@router.delete("/usuarios/{usuario_id}")
async def excluir_usuario(usuario_id: str, rh=Depends(get_usuario_rh_atual)):
    if rh["id"] == usuario_id:
        raise HTTPException(400, "Não é possível excluir o próprio usuário")
    ids = _empresa_ids(rh)
    res = sb.table("usuarios_rh").select("auth_user_id, empresa_id, papel").eq("id", usuario_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Usuário não encontrado")
    if res.data.get("papel") == "admin" and rh.get("papel") != "admin":
        raise HTTPException(403, "Sem permissão para excluir um administrador")

    auth_user_id = res.data.get("auth_user_id")
    sb.table("usuarios_rh").delete().eq("id", usuario_id).execute()
    if auth_user_id:
        try:
            sb.auth.admin.delete_user(auth_user_id)
        except Exception:
            pass
    return {"ok": True}


# ─── Modelos de Jornada ──────────────────────────────────────────────────────

@router.get("/modelos-jornada")
async def listar_modelos_jornada(empresa_id: Optional[str] = None, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    filtro = [empresa_id] if empresa_id and empresa_id in ids else ids
    res = sb.table("modelos_jornada").select("*").in_("empresa_id", filtro).eq("ativo", True).order("nome").execute()
    return res.data or []


@router.post("/modelos-jornada")
async def criar_modelo_jornada(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    empresa = body.get("empresa_id") or rh["empresa_id"]
    if empresa not in ids:
        raise HTTPException(403, "Sem acesso a esta empresa")
    payload = {**body, "empresa_id": empresa, "ativo": True}
    payload.pop("id", None); payload.pop("criado_em", None)
    try:
        res = sb.table("modelos_jornada").insert(payload).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao salvar: {e}")
    if not res.data:
        raise HTTPException(400, "Erro ao criar modelo de jornada")
    return res.data[0]


@router.put("/modelos-jornada/{modelo_id}")
async def atualizar_modelo_jornada(modelo_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    body.pop("id", None); body.pop("empresa_id", None); body.pop("criado_em", None)
    try:
        res = sb.table("modelos_jornada").update(body).eq("id", modelo_id).in_("empresa_id", ids).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao salvar: {e}")
    if not res.data:
        raise HTTPException(404, "Modelo de jornada não encontrado")
    return res.data[0]


@router.delete("/modelos-jornada/{modelo_id}")
async def excluir_modelo_jornada(modelo_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    sb.table("modelos_jornada").update({"ativo": False}).eq("id", modelo_id).in_("empresa_id", ids).execute()
    return {"ok": True}


# ─── Locais por colaborador ───────────────────────────────────────────────────

@router.get("/colaboradores/{colab_id}/locais")
async def get_locais_colaborador(colab_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    colab = sb.table("colaboradores").select("id").eq("id", colab_id).in_("empresa_id", ids).execute()
    if not colab.data:
        raise HTTPException(404, "Colaborador não encontrado")
    res = sb.table("colaborador_locais").select("local_id").eq("colaborador_id", colab_id).execute()
    return [r["local_id"] for r in (res.data or [])]


@router.put("/colaboradores/{colab_id}/locais")
async def set_locais_colaborador(colab_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    colab = sb.table("colaboradores").select("id").eq("id", colab_id).in_("empresa_id", ids).execute()
    if not colab.data:
        raise HTTPException(404, "Colaborador não encontrado")
    local_ids: list = body.get("local_ids", [])
    sb.table("colaborador_locais").delete().eq("colaborador_id", colab_id).execute()
    if local_ids:
        rows = [{"colaborador_id": colab_id, "local_id": lid} for lid in local_ids]
        sb.table("colaborador_locais").insert(rows).execute()
    return {"ok": True}


# ─── Locais ──────────────────────────────────────────────────────────────────

@router.get("/locais")
async def listar_locais(empresa_id: Optional[str] = None, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    if not ids:
        return []
    filtro = [empresa_id] if empresa_id and empresa_id in ids else ids
    res = sb.table("locais_permitidos").select("*").in_("empresa_id", filtro).order("nome").execute()
    return res.data or []


@router.post("/locais")
async def criar_local(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    empresa = body.get("empresa_id") or rh["empresa_id"]
    if empresa not in ids:
        raise HTTPException(403, "Sem acesso a esta empresa")
    payload = {**body, "empresa_id": empresa}
    try:
        res = sb.table("locais_permitidos").insert(payload).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao criar local: {e}")
    if not res.data:
        raise HTTPException(400, "Erro ao criar local")
    return res.data[0]


@router.put("/locais/{local_id}")
async def atualizar_local(local_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    body.pop("id", None); body.pop("empresa_id", None)
    try:
        res = sb.table("locais_permitidos").update(body).eq("id", local_id).in_("empresa_id", ids).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao atualizar local: {e}")
    if not res.data:
        raise HTTPException(404, "Local não encontrado")
    return res.data[0]


@router.delete("/locais/{local_id}")
async def excluir_local(local_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    sb.table("locais_permitidos").delete().eq("id", local_id).in_("empresa_id", ids).execute()
    return {"ok": True}


# ─── Feriados ─────────────────────────────────────────────────────────────────

@router.get("/feriados")
async def listar_feriados(ano: int = Query(default=None), rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    ano = ano or date.today().year
    inicio = f"{ano}-01-01"
    fim    = f"{ano}-12-31"
    # Nacionais (empresa_id IS NULL)
    nacionais = sb.table("feriados").select("*").is_("empresa_id", "null") \
        .gte("data", inicio).lte("data", fim).order("data").execute().data or []
    # Da empresa
    empresa_res = sb.table("feriados").select("*").in_("empresa_id", ids) \
        .gte("data", inicio).lte("data", fim).order("data").execute().data or []
    return nacionais + empresa_res


@router.post("/feriados")
async def criar_feriado(body: dict, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    empresa = body.get("empresa_id") or rh.get("empresa_id")
    if empresa not in ids:
        raise HTTPException(403, "Sem acesso")
    payload = {
        "empresa_id": empresa,
        "data": body["data"],
        "descricao": body["descricao"],
        "tipo": body.get("tipo", "empresa"),
    }
    try:
        res = sb.table("feriados").insert(payload).execute()
    except Exception as e:
        raise HTTPException(400, f"Erro ao criar feriado: {e}")
    return res.data[0]


@router.delete("/feriados/{feriado_id}")
async def excluir_feriado(feriado_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = sb.table("feriados").select("empresa_id, tipo").eq("id", feriado_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Não encontrado")
    if res.data["tipo"] == "nacional":
        raise HTTPException(403, "Feriados nacionais não podem ser excluídos manualmente.")
    if res.data["empresa_id"] not in ids:
        raise HTTPException(403, "Sem acesso")
    sb.table("feriados").delete().eq("id", feriado_id).execute()
    return {"ok": True}


@router.post("/feriados/sincronizar")
async def sincronizar_feriados_nacionais(ano: int = Query(default=None), rh=Depends(get_usuario_rh_atual)):
    ano = ano or date.today().year
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"https://brasilapi.com.br/api/feriados/v1/{ano}")
        if r.status_code != 200:
            raise HTTPException(502, "Erro ao buscar feriados da BrasilAPI")
        feriados = r.json()

    # Remove nacionais do ano e reinseride (NULL não funciona em ON CONFLICT)
    sb.table("feriados").delete().is_("empresa_id", "null") \
        .gte("data", f"{ano}-01-01").lte("data", f"{ano}-12-31").execute()

    rows = [{"empresa_id": None, "data": f["date"], "descricao": f["name"], "tipo": "nacional"} for f in feriados]
    if rows:
        sb.table("feriados").insert(rows).execute()

    return {"sincronizados": len(rows), "ano": ano}


# ─── Calendário por colaborador ───────────────────────────────────────────────

DIAS_SEMANA_MAP = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}


@router.get("/calendario")
async def get_calendario(
    colaborador_id: str,
    mes: str = Query(..., description="AAAA-MM"),
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)

    # Valida acesso ao colaborador
    colab_res = sb.table("colaboradores").select(
        "id, nome, empresa_id, modelo_jornada_id, data_inicio_ponto"
    ).eq("id", colaborador_id).in_("empresa_id", ids).single().execute()
    if not colab_res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    colab = colab_res.data

    # Mapeamento inverso: número do weekday → chave de dia
    DIA_KEY = {v: k for k, v in DIAS_SEMANA_MAP.items()}

    # Modelo de jornada → dias de trabalho e horários esperados
    dias_trabalho = {0, 1, 2, 3, 4}  # seg-sex por padrão
    hora_entrada_esp = None
    hora_saida_esp   = None
    hora_entrada_almoco_esp = None
    hora_saida_almoco_esp   = None
    tolerancia_entrada = 5
    tolerancia_saida   = 5
    horarios_por_dia: dict = {}

    if colab.get("modelo_jornada_id"):
        mj = sb.table("modelos_jornada").select("*").eq("id", colab["modelo_jornada_id"]).single().execute().data
        if mj:
            dt_str = mj.get("dias_trabalho", "seg,ter,qua,qui,sex")
            dias_trabalho = {DIAS_SEMANA_MAP[d.strip()] for d in dt_str.split(",") if d.strip() in DIAS_SEMANA_MAP}
            hora_entrada_esp = mj.get("hora_entrada")
            hora_saida_esp   = mj.get("hora_saida")
            hora_entrada_almoco_esp = mj.get("hora_inicio_almoco")
            hora_saida_almoco_esp   = mj.get("hora_fim_almoco")
            tolerancia_entrada = mj.get("tolerancia_entrada_minutos", 5)
            tolerancia_saida   = mj.get("tolerancia_saida_minutos", 5)
            horarios_por_dia   = mj.get("horarios_por_dia") or {}

    ano, mes_num = int(mes.split("-")[0]), int(mes.split("-")[1])
    _, total_dias = cal_module.monthrange(ano, mes_num)
    inicio = f"{mes}-01"
    fim    = f"{mes}-{total_dias:02d}"
    hoje   = date.today()

    # Feriados do período
    nacionais = sb.table("feriados").select("data").is_("empresa_id", "null") \
        .gte("data", inicio).lte("data", fim).execute().data or []
    empresa_fer = sb.table("feriados").select("data").eq("empresa_id", colab["empresa_id"]) \
        .gte("data", inicio).lte("data", fim).execute().data or []
    feriados_set = {r["data"] for r in nacionais + empresa_fer}

    # Atestados do período
    atestados_res = sb.table("atestados").select("id, data_inicio, data_fim, qtd_dias, observacao, arquivo_url") \
        .eq("colaborador_id", colaborador_id) \
        .lte("data_inicio", fim).gte("data_fim", inicio).execute().data or []
    atestados_dias: dict = {}
    for a in atestados_res:
        cur = date.fromisoformat(a["data_inicio"])
        fim_at = date.fromisoformat(a["data_fim"])
        while cur <= fim_at:
            atestados_dias[cur.isoformat()] = a
            cur += timedelta(days=1)

    # Jornadas do período
    jornadas_res = sb.table("jornadas_diarias").select("*") \
        .eq("colaborador_id", colaborador_id) \
        .gte("data", inicio).lte("data", fim).execute().data or []
    jornadas_idx = {j["data"]: j for j in jornadas_res}

    # Registros do período
    regs_res = sb.table("registros_ponto").select("id, tipo, status, foto_url, registrado_em") \
        .eq("colaborador_id", colaborador_id) \
        .gte("registrado_em", inicio + "T00:00:00") \
        .lte("registrado_em", fim + "T23:59:59").execute().data or []

    # Registros com ajuste de horário (não contam como atraso/saída antecipada)
    ids_regs_cal = [r["id"] for r in regs_res]
    ajustados_cal = set()
    if ids_regs_cal:
        aj_cal = sb.table("ajustes_ponto").select("registro_id") \
            .in_("registro_id", ids_regs_cal) \
            .neq("campo_alterado", "criação manual").execute()
        ajustados_cal = {a["registro_id"] for a in (aj_cal.data or [])}

    # Agrupa registros por data
    regs_por_dia: dict[str, list] = {}
    for r in regs_res:
        d_key = r["registrado_em"][:10]
        regs_por_dia.setdefault(d_key, []).append(r)

    def minutos(time_str):
        if not time_str:
            return None
        partes = time_str.split(":")
        return int(partes[0]) * 60 + int(partes[1])

    # Data de início do acompanhamento (dias anteriores não contam como falta)
    data_inicio_raw = colab.get("data_inicio_ponto")
    data_inicio = date.fromisoformat(data_inicio_raw) if data_inicio_raw else None

    dias = []
    for dia_num in range(1, total_dias + 1):
        d = date(ano, mes_num, dia_num)
        d_iso = d.isoformat()

        # Antes do início do acompanhamento → ignora
        if data_inicio and d < data_inicio:
            dias.append({"data": d_iso, "status": "sem_acompanhamento"})
            continue

        # Fim de semana / folga
        if d.weekday() not in dias_trabalho:
            dias.append({"data": d_iso, "status": "folga"})
            continue

        # Feriado
        if d_iso in feriados_set:
            dias.append({"data": d_iso, "status": "feriado"})
            continue

        # Atestado
        if d_iso in atestados_dias:
            dias.append({"data": d_iso, "status": "atestado", "atestado": atestados_dias[d_iso]})
            continue

        # Dia futuro
        if d > hoje:
            dias.append({"data": d_iso, "status": "futuro"})
            continue

        regs = regs_por_dia.get(d_iso, [])
        jornada = jornadas_idx.get(d_iso)

        # Sem nenhum registro → falta
        if not regs and not jornada:
            dias.append({"data": d_iso, "status": "falta"})
            continue

        # Horário específico do dia (sobrescreve o padrão se configurado)
        dia_key = DIA_KEY.get(d.weekday(), "")
        h_dia = horarios_por_dia.get(dia_key, {})
        entrada_esp = h_dia.get("hora_entrada") or hora_entrada_esp
        saida_esp   = h_dia.get("hora_saida")   or hora_saida_esp

        # Avalia divergências
        divergencias = []
        eh_hoje = (d == hoje)
        agora_br = datetime.now(TZ_BR)
        agora_min = agora_br.hour * 60 + agora_br.minute

        def reg_minutos_local(registrado_em_str: str) -> int | None:
            """Converte registrado_em (UTC ISO) para minutos no fuso BR."""
            try:
                dt = datetime.fromisoformat(registrado_em_str.replace("Z", "+00:00"))
                dt_br = dt.astimezone(TZ_BR)
                return dt_br.hour * 60 + dt_br.minute
            except Exception:
                return None

        tipos_presentes = {r["tipo"] for r in regs}
        if "entrada" not in tipos_presentes:
            divergencias.append("sem_entrada")

        # sem_saida: só marca se dia já encerrou (ontem ou anterior),
        # ou se hoje já passou do horário esperado de saída
        if "saida" not in tipos_presentes:
            if not eh_hoje:
                divergencias.append("sem_saida")
            elif saida_esp:
                h_saida = minutos(saida_esp[:5])
                if h_saida and agora_min > (h_saida + tolerancia_saida):
                    divergencias.append("sem_saida")

        for r in regs:
            if r.get("status") != "valido":
                divergencias.append("local_invalido")
                break

        for r in regs:
            if not r.get("foto_url"):
                divergencias.append("sem_foto")
                break

        if entrada_esp and regs:
            entrada_reg = next((r for r in regs if r["tipo"] == "entrada"), None)
            if entrada_reg and entrada_reg.get("id") not in ajustados_cal:
                h_reg = reg_minutos_local(entrada_reg["registrado_em"])
                h_esp = minutos(entrada_esp[:5])
                if h_reg is not None and h_esp and (h_reg - h_esp) > tolerancia_entrada:
                    divergencias.append("atraso_entrada")

        if saida_esp and regs:
            saida_reg = next((r for r in regs if r["tipo"] == "saida"), None)
            if saida_reg and saida_reg.get("id") not in ajustados_cal:
                h_reg = reg_minutos_local(saida_reg["registrado_em"])
                h_esp = minutos(saida_esp[:5])
                if h_reg is not None and h_esp and (h_esp - h_reg) > tolerancia_saida:
                    divergencias.append("saida_antecipada")

        status = "divergencia" if divergencias else "ok"
        dias.append({"data": d_iso, "status": status, "divergencias": divergencias})

    return {"colaborador": colab, "mes": mes, "dias": dias}


# ── Relatório mensal ──────────────────────────────────────────────────────────

@router.get("/relatorio")
async def get_relatorio(
    mes: str = Query(..., description="AAAA-MM"),
    colaborador_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    """Retorna dados tabulados por dia/colaborador para exportação (XLSX/PDF)."""
    ids = _empresa_ids(rh)
    if not ids:
        return []

    try:
        ano, m = int(mes[:4]), int(mes[5:7])
    except Exception:
        raise HTTPException(400, "Parâmetro mes inválido. Use AAAA-MM.")

    primeiro = date(ano, m, 1)
    ultimo   = date(ano, m, cal_module.monthrange(ano, m)[1])

    # Busca colaboradores
    q_colabs = sb.table("colaboradores").select("id, nome").in_("empresa_id", ids).eq("ativo", True).order("nome")
    if colaborador_id:
        q_colabs = q_colabs.eq("id", colaborador_id)
    colabs = q_colabs.execute().data or []
    if not colabs:
        return []
    colab_nomes = {c["id"]: c["nome"] for c in colabs}
    colab_ids   = [c["id"] for c in colabs]

    # Busca todos os registros do mês
    ini = f"{primeiro.isoformat()}T00:00:00+00:00"
    fim = f"{ultimo.isoformat()}T23:59:59+00:00"
    regs_res = sb.table("registros_ponto") \
        .select("colaborador_id, tipo, registrado_em") \
        .in_("colaborador_id", colab_ids) \
        .gte("registrado_em", ini) \
        .lte("registrado_em", fim) \
        .order("registrado_em") \
        .execute()
    regs = regs_res.data or []

    # Agrupa: { (colab_id, data_br): { tipo: "HH:MM" } }
    from collections import defaultdict
    agrup: dict = defaultdict(dict)
    for r in regs:
        try:
            dt_utc = datetime.fromisoformat(r["registrado_em"].replace("Z", "+00:00"))
            dt_br  = dt_utc.astimezone(TZ_BR)
            chave  = (r["colaborador_id"], dt_br.date().isoformat())
            tipo   = r["tipo"]
            if tipo not in agrup[chave]:
                agrup[chave][tipo] = dt_br.strftime("%H:%M")
        except Exception:
            pass

    hoje_br = datetime.now(TZ_BR).date()
    DIAS_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    TIPO_ORDER = ["entrada", "saida_almoco", "retorno_almoco", "saida"]

    rows = []
    num = 1
    for c in colabs:
        cid = c["id"]
        # Apenas dias com pelo menos um registro
        datas_com_registro = sorted(
            d_iso for (c_id, d_iso) in agrup if c_id == cid
        )
        for d_iso in datas_com_registro:
            try:
                d = date.fromisoformat(d_iso)
            except Exception:
                continue
            dia_semana = DIAS_PT[d.weekday()]
            batidas = agrup[(cid, d_iso)]

            divergencias = []
            if "entrada" not in batidas:
                divergencias.append("Sem entrada")
            if d < hoje_br and "saida" not in batidas:
                divergencias.append("Sem saída")

            rows.append({
                "num":             num,
                "data":            d.strftime("%d/%m/%Y"),
                "dia_semana":      dia_semana,
                "colaborador":     c["nome"],
                "entrada":         batidas.get("entrada", "—"),
                "saida_almoco":    batidas.get("saida_almoco", "—"),
                "retorno_almoco":  batidas.get("retorno_almoco", "—"),
                "saida":           batidas.get("saida", "—"),
                "divergencias":    ", ".join(divergencias) if divergencias else "OK",
            })
            num += 1
            d += timedelta(days=1)

    return rows


# ── Configuração visual da tela de login ──────────────────────────────────────

@router.get("/login-config")
async def get_login_config():
    """Endpoint público — não requer autenticação."""
    res = sb.table("empresas").select("id, nome, logo_url, login_config").eq("ativo", True).limit(1).execute()
    if not res.data:
        return {}
    emp = res.data[0]
    config = emp.get("login_config") or {}
    config.setdefault("empresa_nome", emp.get("nome", ""))
    config.setdefault("empresa_logo", emp.get("logo_url", ""))
    return config


@router.patch("/login-config")
async def salvar_login_config(body: dict, rh=Depends(get_usuario_rh_atual)):
    empresa_id = rh.get("empresa_id")
    if not empresa_id:
        ids = _empresa_ids(rh)
        empresa_id = ids[0] if ids else None
    if not empresa_id:
        raise HTTPException(400, "Empresa não encontrada.")
    sb.table("empresas").update({"login_config": body}).eq("id", empresa_id).execute()
    return {"ok": True}


# ── Ajuste manual do banco de horas ──────────────────────────────────────────

@router.get("/colaboradores/{colab_id}/ajuste-banco")
async def listar_ajustes_banco(colab_id: str, rh=Depends(get_usuario_rh_atual)):
    res = (
        sb.table("ajustes_banco_horas")
        .select("*")
        .eq("colaborador_id", colab_id)
        .order("criado_em", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/colaboradores/{colab_id}/ajuste-banco")
async def criar_ajuste_banco(colab_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):
    colab = sb.table("colaboradores").select("banco_horas_bloqueado").eq("id", colab_id).limit(1).execute()
    if colab.data and colab.data[0].get("banco_horas_bloqueado"):
        raise HTTPException(403, "Banco de horas bloqueado para este colaborador.")
    minutos_val = int(body.get("minutos", 0))
    descricao = str(body.get("descricao", "")).strip()
    if not descricao:
        raise HTTPException(400, "Descrição obrigatória.")
    if minutos_val == 0:
        raise HTTPException(400, "Informe uma quantidade de horas/minutos diferente de zero.")
    payload = {
        "colaborador_id": colab_id,
        "minutos": minutos_val,
        "descricao": descricao,
        "criado_por": rh["id"],
    }
    if body.get("data_referencia"):
        payload["data_referencia"] = str(body["data_referencia"])
    sb.table("ajustes_banco_horas").insert(payload).execute()
    return {"ok": True}


@router.delete("/ajuste-banco/{ajuste_id}")
async def excluir_ajuste_banco(ajuste_id: str, rh=Depends(get_usuario_rh_atual)):
    ajuste = sb.table("ajustes_banco_horas").select("colaborador_id").eq("id", ajuste_id).limit(1).execute()
    if ajuste.data:
        colab = sb.table("colaboradores").select("banco_horas_bloqueado").eq("id", ajuste.data[0]["colaborador_id"]).limit(1).execute()
        if colab.data and colab.data[0].get("banco_horas_bloqueado"):
            raise HTTPException(403, "Banco de horas bloqueado para este colaborador.")
    sb.table("ajustes_banco_horas").delete().eq("id", ajuste_id).execute()
    return {"ok": True}


# ── Dispositivos de ponto fixo ────────────────────────────────────────────────

@router.get("/dispositivos")
async def listar_dispositivos(rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = (
        sb.table("dispositivos_ponto")
        .select("*")
        .in_("empresa_id", ids)
        .eq("ativo", True)
        .order("criado_em", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/dispositivos")
async def criar_dispositivo(body: dict, rh=Depends(get_usuario_rh_atual)):
    import random, string
    empresa_id = rh.get("empresa_id")
    if not empresa_id:
        ids = _empresa_ids(rh)
        empresa_id = ids[0] if ids else None
    if not empresa_id:
        raise HTTPException(400, "Empresa não encontrada.")
    nome = str(body.get("nome", "")).strip()
    if not nome:
        raise HTTPException(400, "Nome obrigatório.")
    senha = "".join(random.choices(string.digits, k=6))
    payload = {"empresa_id": empresa_id, "nome": nome, "senha": senha}
    if body.get("endereco"):
        payload["endereco"] = str(body["endereco"]).strip()
    if body.get("lat") is not None:
        payload["lat"] = float(body["lat"])
    if body.get("lng") is not None:
        payload["lng"] = float(body["lng"])
    if body.get("intervalo_refresh") is not None:
        mins = int(body["intervalo_refresh"])
        if mins > 0:
            payload["intervalo_refresh"] = mins
    res = sb.table("dispositivos_ponto").insert(payload).execute()
    return res.data[0]


@router.delete("/dispositivos/{disp_id}")
async def excluir_dispositivo(disp_id: str, rh=Depends(get_usuario_rh_atual)):
    sb.table("dispositivos_ponto").update({"ativo": False}).eq("id", disp_id).execute()
    return {"ok": True}


# ── Download / Upload do APK do Kiosk ─────────────────────────────────────────

import os, zipfile, tempfile
from fastapi import File, UploadFile

APK_PATH = os.environ.get("KIOSK_APK_PATH", "/app/downloads/caju-kiosk.apk")


@router.get("/kiosk-apk/info")
async def kiosk_apk_info(rh=Depends(get_usuario_rh_atual)):
    """Retorna metadados do APK disponível para download."""
    if not os.path.exists(APK_PATH):
        return {"disponivel": False}
    stat = os.stat(APK_PATH)
    return {
        "disponivel": True,
        "tamanho_mb": round(stat.st_size / 1024 / 1024, 1),
        "atualizado_em": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }


@router.get("/kiosk-apk/download")
async def download_kiosk_apk(rh=Depends(get_usuario_rh_atual)):
    """Serve o APK do kiosk compactado em zip."""
    if not os.path.exists(APK_PATH):
        raise HTTPException(404, "APK não disponível. Faça upload de uma versão primeiro.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(APK_PATH, "caju-kiosk.apk")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="caju-kiosk.zip"'},
    )


# ── Atestados ─────────────────────────────────────────────────────────────────

from fastapi import Form as FormParam

@router.post("/atestados")
async def criar_atestado(
    colaborador_id: str = FormParam(...),
    data_inicio: str = FormParam(...),
    qtd_dias: int = FormParam(...),
    observacao: str = FormParam(""),
    arquivo: UploadFile = File(None),
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)
    colab = sb.table("colaboradores").select("id, empresa_id").eq("id", colaborador_id).in_("empresa_id", ids).single().execute()
    if not colab.data:
        raise HTTPException(404, "Colaborador não encontrado")
    empresa_id = colab.data["empresa_id"]

    try:
        d_inicio = date.fromisoformat(data_inicio)
    except ValueError:
        raise HTTPException(400, "data_inicio inválida. Use AAAA-MM-DD.")
    if qtd_dias < 1:
        raise HTTPException(400, "qtd_dias deve ser >= 1")
    d_fim = d_inicio + timedelta(days=qtd_dias - 1)

    arquivo_url = None
    if arquivo and arquivo.filename:
        try:
            conteudo = await arquivo.read()
            from services.storage import upload_atestado
            arquivo_url = upload_atestado(empresa_id, colaborador_id, conteudo, arquivo.filename)
        except Exception:
            pass  # continua sem arquivo se upload falhar

    payload = {
        "colaborador_id": colaborador_id,
        "empresa_id": empresa_id,
        "data_inicio": d_inicio.isoformat(),
        "qtd_dias": qtd_dias,
        "data_fim": d_fim.isoformat(),
        "observacao": observacao.strip() or None,
        "arquivo_url": arquivo_url,
        "criado_por": rh["id"],
    }
    res = sb.table("atestados").insert(payload).execute()
    return res.data[0]


@router.get("/atestados")
async def listar_atestados(
    colaborador_id: Optional[str] = None,
    mes: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    ids = _empresa_ids(rh)
    q = sb.table("atestados").select("*").in_("empresa_id", ids)
    if colaborador_id:
        q = q.eq("colaborador_id", colaborador_id)
    if mes:
        try:
            ano, m = mes.split("-")
            inicio_mes = f"{mes}-01"
            _, total = cal_module.monthrange(int(ano), int(m))
            fim_mes = f"{mes}-{total:02d}"
            q = q.lte("data_inicio", fim_mes).gte("data_fim", inicio_mes)
        except Exception:
            pass
    res = q.order("data_inicio", desc=True).execute()
    return res.data or []


@router.delete("/atestados/{atestado_id}")
async def excluir_atestado(atestado_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    # Busca arquivo_url antes de deletar o registro
    res = sb.table("atestados").select("arquivo_url").eq("id", atestado_id).in_("empresa_id", ids).limit(1).execute()
    if res.data and res.data[0].get("arquivo_url"):
        try:
            from services.storage import BUCKET_ATESTADOS
            sb.storage.from_(BUCKET_ATESTADOS).remove([res.data[0]["arquivo_url"]])
        except Exception:
            pass  # não bloqueia a exclusão se falhar
    sb.table("atestados").delete().eq("id", atestado_id).in_("empresa_id", ids).execute()
    return {"ok": True}


@router.get("/atestados/{atestado_id}/arquivo")
async def url_arquivo_atestado(atestado_id: str, rh=Depends(get_usuario_rh_atual)):
    ids = _empresa_ids(rh)
    res = sb.table("atestados").select("arquivo_url").eq("id", atestado_id).in_("empresa_id", ids).single().execute()
    if not res.data or not res.data.get("arquivo_url"):
        raise HTTPException(404, "Arquivo não encontrado")
    from services.storage import gerar_url_assinada_atestado
    return {"url": gerar_url_assinada_atestado(res.data["arquivo_url"])}


@router.post("/kiosk-apk/upload")
async def upload_kiosk_apk(file: UploadFile, rh=Depends(get_usuario_rh_atual)):
    """Recebe e armazena nova versão do APK do kiosk."""
    if not file.filename.endswith(".apk"):
        raise HTTPException(400, "Envie um arquivo .apk")
    os.makedirs(os.path.dirname(APK_PATH), exist_ok=True)
    conteudo = await file.read()
    with open(APK_PATH, "wb") as f:
        f.write(conteudo)
    stat = os.stat(APK_PATH)
    return {
        "ok": True,
        "tamanho_mb": round(stat.st_size / 1024 / 1024, 1),
        "atualizado_em": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }
