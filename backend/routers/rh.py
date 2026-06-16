from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import date, timedelta, datetime, timezone
from typing import Optional
import csv
import io
from db.supabase_client import supabase as sb
from auth.deps import get_usuario_rh_atual

router = APIRouter(prefix="/rh", tags=["rh"])


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard(rh=Depends(get_usuario_rh_atual)):

    empresa_id = rh["empresa_id"]
    hoje = date.today().isoformat()

    total_colab = sb.table("colaboradores").select("id", count="exact").eq("empresa_id", empresa_id).eq("ativo", True).execute()
    regs_hoje = sb.table("registros_ponto").select("id, tipo, registrado_em, colaborador_id, latitude, longitude", count="exact").eq("empresa_id", empresa_id).gte("registrado_em", hoje + "T00:00:00").lte("registrado_em", hoje + "T23:59:59").execute()

    # Últimos 7 dias
    sete_dias = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        r = sb.table("registros_ponto").select("id", count="exact").eq("empresa_id", empresa_id).gte("registrado_em", d + "T00:00:00").lte("registrado_em", d + "T23:59:59").execute()
        sete_dias.append({"data": d, "total": r.count or 0})

    # Ultimos 10 registros com nome
    ultimos_raw = sb.table("registros_ponto").select("id, tipo, registrado_em, latitude, longitude, foto_url, colaborador_id").eq("empresa_id", empresa_id).order("registrado_em", desc=True).limit(10).execute()
    ids_colab = list({r["colaborador_id"] for r in (ultimos_raw.data or [])})
    nomes = {}
    if ids_colab:
        cn = sb.table("colaboradores").select("id, nome").in_("id", ids_colab).execute()
        nomes = {c["id"]: c["nome"] for c in (cn.data or [])}

    ultimos = []
    for r in (ultimos_raw.data or []):
        ultimos.append({**r, "colaborador_nome": nomes.get(r["colaborador_id"], "—"), "local_nome": None})

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
async def listar_colaboradores(rh=Depends(get_usuario_rh_atual)):

    res = sb.table("colaboradores").select("*").eq("empresa_id", rh["empresa_id"]).order("nome").execute()
    return res.data or []


@router.get("/colaboradores/{colab_id}")
async def get_colaborador(colab_id: str, rh=Depends(get_usuario_rh_atual)):

    res = sb.table("colaboradores").select("*").eq("id", colab_id).eq("empresa_id", rh["empresa_id"]).single().execute()
    if not res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    return res.data


@router.post("/colaboradores")
async def criar_colaborador(body: dict, rh=Depends(get_usuario_rh_atual)):

    payload = {**body, "empresa_id": rh["empresa_id"], "ativo": True}
    res = sb.table("colaboradores").insert(payload).execute()
    if not res.data:
        raise HTTPException(400, "Erro ao criar colaborador")
    return res.data[0]


@router.put("/colaboradores/{colab_id}")
async def atualizar_colaborador(colab_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):

    body.pop("id", None); body.pop("empresa_id", None)
    res = sb.table("colaboradores").update(body).eq("id", colab_id).eq("empresa_id", rh["empresa_id"]).execute()
    if not res.data:
        raise HTTPException(404, "Colaborador não encontrado")
    return res.data[0]


@router.delete("/colaboradores/{colab_id}")
async def excluir_colaborador(colab_id: str, rh=Depends(get_usuario_rh_atual)):

    sb.table("colaboradores").update({"ativo": False}).eq("id", colab_id).eq("empresa_id", rh["empresa_id"]).execute()
    return {"ok": True}


# ─── Registros ───────────────────────────────────────────────────────────────

@router.get("/registros")
async def listar_registros(
    colaborador_id: Optional[str] = None,
    tipo: Optional[str] = None,
    data: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):

    q = sb.table("registros_ponto").select("*").eq("empresa_id", rh["empresa_id"])
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

    return [{**r, "colaborador_nome": nomes.get(r["colaborador_id"], "—")} for r in regs]


@router.get("/registros/{registro_id}/foto")
async def get_foto_url(registro_id: str, rh=Depends(get_usuario_rh_atual)):
    from services.storage import gerar_url_assinada

    res = sb.table("registros_ponto").select("foto_url, empresa_id").eq("id", registro_id).single().execute()
    if not res.data or res.data.get("empresa_id") != rh["empresa_id"]:
        raise HTTPException(404, "Registro não encontrado")
    foto_url = res.data.get("foto_url")
    if not foto_url:
        raise HTTPException(404, "Sem foto")
    path = foto_url.split("/fotos-ponto/")[-1] if "/fotos-ponto/" in foto_url else foto_url
    url = gerar_url_assinada(path)
    return {"url": url}


@router.post("/registros/{registro_id}/ajuste")
async def ajustar_registro(registro_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):

    res = sb.table("registros_ponto").select("empresa_id").eq("id", registro_id).single().execute()
    if not res.data or res.data["empresa_id"] != rh["empresa_id"]:
        raise HTTPException(404, "Registro não encontrado")

    ajuste = {
        "registro_id": registro_id,
        "rh_id": rh["id"],
        "tipo_anterior": None,
        "tipo_novo": body.get("tipo"),
        "horario_anterior": None,
        "horario_novo": body.get("registrado_em"),
        "motivo": body.get("motivo"),
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
    rh=Depends(get_usuario_rh_atual),
):

    inicio = mes + "-01"
    ano, m = int(mes.split("-")[0]), int(mes.split("-")[1])
    fim_m = m + 1 if m < 12 else 1
    fim_a = ano if m < 12 else ano + 1
    fim = f"{fim_a}-{fim_m:02d}-01"

    q = sb.table("jornadas_diarias").select("*").eq("empresa_id", rh["empresa_id"]).gte("data", inicio).lt("data", fim)
    if colaborador_id:
        q = q.eq("colaborador_id", colaborador_id)
    res = q.order("data", desc=True).execute()
    jornadas = res.data or []

    ids_colab = list({j["colaborador_id"] for j in jornadas})
    nomes = {}
    if ids_colab:
        cn = sb.table("colaboradores").select("id, nome").in_("id", ids_colab).execute()
        nomes = {c["id"]: c["nome"] for c in (cn.data or [])}

    return [{**j, "colaborador_nome": nomes.get(j["colaborador_id"], "—")} for j in jornadas]


@router.get("/jornadas/exportar")
async def exportar_jornadas(
    mes: str = Query(...),
    formato: str = Query("csv"),
    colaborador_id: Optional[str] = None,
    rh=Depends(get_usuario_rh_atual),
):
    dados = await listar_jornadas(mes=mes, colaborador_id=colaborador_id, rh=rh)

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


# ─── Locais ──────────────────────────────────────────────────────────────────

@router.get("/locais")
async def listar_locais(rh=Depends(get_usuario_rh_atual)):

    res = sb.table("locais_permitidos").select("*").eq("empresa_id", rh["empresa_id"]).order("nome").execute()
    return res.data or []


@router.post("/locais")
async def criar_local(body: dict, rh=Depends(get_usuario_rh_atual)):

    payload = {**body, "empresa_id": rh["empresa_id"]}
    res = sb.table("locais_permitidos").insert(payload).execute()
    if not res.data:
        raise HTTPException(400, "Erro ao criar local")
    return res.data[0]


@router.put("/locais/{local_id}")
async def atualizar_local(local_id: str, body: dict, rh=Depends(get_usuario_rh_atual)):

    body.pop("id", None); body.pop("empresa_id", None)
    res = sb.table("locais_permitidos").update(body).eq("id", local_id).eq("empresa_id", rh["empresa_id"]).execute()
    if not res.data:
        raise HTTPException(404, "Local não encontrado")
    return res.data[0]


@router.delete("/locais/{local_id}")
async def excluir_local(local_id: str, rh=Depends(get_usuario_rh_atual)):

    sb.table("locais_permitidos").delete().eq("id", local_id).eq("empresa_id", rh["empresa_id"]).execute()
    return {"ok": True}
