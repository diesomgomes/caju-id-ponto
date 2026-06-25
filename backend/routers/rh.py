from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import date, timedelta, datetime, timezone
from typing import Optional
import calendar as cal_module
import csv
import io
import httpx
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
    res = sb.table("colaboradores").select("*").in_("empresa_id", filtro).order("nome").execute()
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
    sb.table("colaboradores").update({"ativo": False}).eq("id", colab_id).in_("empresa_id", ids).execute()
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

    return [{
        **r,
        "colaborador_nome": nomes.get(r["colaborador_id"], "—"),
        "local_nome": (r.get("locais_permitidos") or {}).get("nome") or r.get("local_nome"),
    } for r in regs]


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
            "origem": "manual",
            "status": "valido",
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

    return res.data[0]


@router.delete("/registros/{registro_id}")
async def excluir_registro(registro_id: str, rh=Depends(get_usuario_rh_atual)):
    if rh.get("papel") != "admin":
        raise HTTPException(403, "Apenas administradores podem excluir registros")
    ids = _empresa_ids(rh)
    res = sb.table("registros_ponto").select("empresa_id").eq("id", registro_id).single().execute()
    if not res.data or res.data["empresa_id"] not in ids:
        raise HTTPException(404, "Registro não encontrado")
    try:
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
        "valor_anterior": res.data.get("tipo"),
        "valor_novo": body.get("tipo") or body.get("registrado_em"),
        "justificativa": body.get("motivo", ""),
    }
    sb.table("ajustes_ponto").insert(ajuste).execute()

    update = {}
    if body.get("tipo"): update["tipo"] = body["tipo"]
    if body.get("registrado_em"): update["registrado_em"] = body["registrado_em"]
    sb.table("registros_ponto").update(update).eq("id", registro_id).execute()
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
            dt = r["registrado_em"][:10]
            key = (r["colaborador_id"], dt, r["tipo"])
            regs_idx[key] = r["registrado_em"][11:19]

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
        "id, nome, empresa_id, modelo_jornada_id"
    ).eq("id", colaborador_id).in_("empresa_id", ids).single().execute()
    if not colab_res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    colab = colab_res.data

    # Modelo de jornada → dias de trabalho e horários esperados
    dias_trabalho = {0, 1, 2, 3, 4}  # seg-sex por padrão
    hora_entrada_esp = None
    hora_saida_esp   = None
    tolerancia_entrada = 5
    tolerancia_saida   = 5

    if colab.get("modelo_jornada_id"):
        mj = sb.table("modelos_jornada").select("*").eq("id", colab["modelo_jornada_id"]).single().execute().data
        if mj:
            dt_str = mj.get("dias_trabalho", "seg,ter,qua,qui,sex")
            dias_trabalho = {DIAS_SEMANA_MAP[d.strip()] for d in dt_str.split(",") if d.strip() in DIAS_SEMANA_MAP}
            hora_entrada_esp = mj.get("hora_entrada")
            hora_saida_esp   = mj.get("hora_saida")
            tolerancia_entrada = mj.get("tolerancia_entrada_minutos", 5)
            tolerancia_saida   = mj.get("tolerancia_saida_minutos", 5)

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

    # Jornadas do período
    jornadas_res = sb.table("jornadas_diarias").select("*") \
        .eq("colaborador_id", colaborador_id) \
        .gte("data", inicio).lte("data", fim).execute().data or []
    jornadas_idx = {j["data"]: j for j in jornadas_res}

    # Registros do período
    regs_res = sb.table("registros_ponto").select("tipo, status, foto_url, registrado_em") \
        .eq("colaborador_id", colaborador_id) \
        .gte("registrado_em", inicio + "T00:00:00") \
        .lte("registrado_em", fim + "T23:59:59").execute().data or []

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

    dias = []
    for dia_num in range(1, total_dias + 1):
        d = date(ano, mes_num, dia_num)
        d_iso = d.isoformat()

        # Fim de semana / folga
        if d.weekday() not in dias_trabalho:
            dias.append({"data": d_iso, "status": "folga"})
            continue

        # Feriado
        if d_iso in feriados_set:
            dias.append({"data": d_iso, "status": "feriado"})
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

        # Avalia divergências
        divergencias = []

        tipos_presentes = {r["tipo"] for r in regs}
        if "entrada" not in tipos_presentes:
            divergencias.append("sem_entrada")
        if "saida" not in tipos_presentes:
            divergencias.append("sem_saida")

        for r in regs:
            if r.get("status") != "valido":
                divergencias.append("local_invalido")
                break

        for r in regs:
            if not r.get("foto_url"):
                divergencias.append("sem_foto")
                break

        if hora_entrada_esp and regs:
            entrada_reg = next((r for r in regs if r["tipo"] == "entrada"), None)
            if entrada_reg:
                h_reg = minutos(entrada_reg["registrado_em"][11:16])
                h_esp = minutos(hora_entrada_esp[:5])
                if h_reg and h_esp and (h_reg - h_esp) > tolerancia_entrada:
                    divergencias.append("atraso_entrada")

        if hora_saida_esp and regs:
            saida_reg = next((r for r in regs if r["tipo"] == "saida"), None)
            if saida_reg:
                h_reg = minutos(saida_reg["registrado_em"][11:16])
                h_esp = minutos(hora_saida_esp[:5])
                if h_reg and h_esp and (h_esp - h_reg) > tolerancia_saida:
                    divergencias.append("saida_antecipada")

        status = "divergencia" if divergencias else "ok"
        dias.append({"data": d_iso, "status": status, "divergencias": divergencias})

    return {"colaborador": colab, "mes": mes, "dias": dias}


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
    minutos_val = int(body.get("minutos", 0))
    descricao = str(body.get("descricao", "")).strip()
    if not descricao:
        raise HTTPException(400, "Descrição obrigatória.")
    if minutos_val == 0:
        raise HTTPException(400, "Informe uma quantidade de horas/minutos diferente de zero.")
    sb.table("ajustes_banco_horas").insert({
        "colaborador_id": colab_id,
        "minutos": minutos_val,
        "descricao": descricao,
        "criado_por": rh["id"],
    }).execute()
    return {"ok": True}


@router.delete("/ajuste-banco/{ajuste_id}")
async def excluir_ajuste_banco(ajuste_id: str, rh=Depends(get_usuario_rh_atual)):
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
    res = sb.table("dispositivos_ponto").insert(payload).execute()
    return res.data[0]


@router.delete("/dispositivos/{disp_id}")
async def excluir_dispositivo(disp_id: str, rh=Depends(get_usuario_rh_atual)):
    sb.table("dispositivos_ponto").update({"ativo": False}).eq("id", disp_id).execute()
    return {"ok": True}
