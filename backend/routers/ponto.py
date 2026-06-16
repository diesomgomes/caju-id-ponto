import os
import logging
import traceback
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

logger = logging.getLogger(__name__)

from auth.deps import get_colaborador_atual
from db.supabase_client import supabase
from models.schemas import PontoRegistrarResponse
from services.geofencing import encontrar_local_mais_proximo
from services.hash_chain import calcular_hash
from services.jornada import atualizar_jornada_dia, parse_interval, timedelta_para_interval
from services.sequencia import proxima_batida_esperada, validar_sequencia
from services.storage import FotoInvalida, gerar_url_assinada, upload_selfie

router = APIRouter(prefix="/ponto", tags=["ponto"])

TZ_BR = ZoneInfo(os.environ.get("TZ_DEFAULT", "America/Sao_Paulo"))
TIPOS_VALIDOS = {"entrada", "saida_almoco", "retorno_almoco", "saida"}


def _limites_dia_utc(dia) -> tuple[str, str]:
    inicio = datetime.combine(dia, datetime.min.time(), tzinfo=TZ_BR).astimezone(timezone.utc)
    fim = datetime.combine(dia, datetime.max.time(), tzinfo=TZ_BR).astimezone(timezone.utc)
    return inicio.isoformat(), fim.isoformat()


@router.post("/registrar")
async def registrar_ponto(
    request: Request,
    tipo: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    foto: UploadFile = File(...),
    colaborador: dict = Depends(get_colaborador_atual),
):
    try:
        return await _registrar_ponto_impl(request, tipo, lat, lng, foto, colaborador)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro inesperado em /ponto/registrar:\n%s", traceback.format_exc())
        raise HTTPException(500, f"Erro interno: {type(e).__name__}: {e}")


async def _registrar_ponto_impl(request, tipo, lat, lng, foto, colaborador):
    if tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"Tipo inválido. Use: {sorted(TIPOS_VALIDOS)}")

    empresa_id = colaborador["empresa_id"]
    colaborador_id = colaborador["id"]

    empresa = (
        supabase.table("empresas").select("*").eq("id", empresa_id).execute().data
    )
    if not empresa:
        raise HTTPException(500, "Empresa do colaborador não encontrada")
    empresa = empresa[0]

    locais = (
        supabase.table("locais_permitidos")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("ativo", True)
        .execute()
        .data
        or []
    )
    if not locais and empresa.get("lat_sede") and empresa.get("lng_sede"):
        locais = [
            {
                "id": None,
                "nome": "Sede",
                "lat": empresa["lat_sede"],
                "lng": empresa["lng_sede"],
                "raio_metros": empresa.get("raio_metros", 100),
            }
        ]
    if not locais:
        raise HTTPException(400, "Empresa não possui locais permitidos configurados")

    local, distancia, dentro = encontrar_local_mais_proximo(lat, lng, locais)

    agora_utc = datetime.now(timezone.utc)
    hoje_br = agora_utc.astimezone(TZ_BR).date()
    inicio_dia, fim_dia = _limites_dia_utc(hoje_br)

    ultimo = (
        supabase.table("registros_ponto")
        .select("tipo")
        .eq("colaborador_id", colaborador_id)
        .eq("status", "valido")
        .gte("registrado_em", inicio_dia)
        .lte("registrado_em", fim_dia)
        .order("registrado_em", desc=True)
        .limit(1)
        .execute()
    )
    ultimo_tipo = ultimo.data[0]["tipo"] if ultimo.data else None
    seq_ok, motivo_seq = validar_sequencia(ultimo_tipo, tipo)

    status_registro = "valido"
    motivo_rejeicao: str | None = None
    if not dentro:
        status_registro = "rejeitado"
        motivo_rejeicao = (
            f"Fora da área permitida (distância: {distancia:.1f}m do {local['nome']})"
        )
    elif not seq_ok:
        status_registro = "rejeitado"
        motivo_rejeicao = motivo_seq

    conteudo = await foto.read()
    try:
        foto_path = upload_selfie(empresa_id, colaborador_id, conteudo)
    except FotoInvalida as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Falha no upload da foto: {e}")

    ult_hash = (
        supabase.table("registros_ponto")
        .select("hash_integridade")
        .eq("colaborador_id", colaborador_id)
        .order("registrado_em", desc=True)
        .limit(1)
        .execute()
    )
    hash_anterior = ult_hash.data[0]["hash_integridade"] if ult_hash.data else None

    registrado_em_str = agora_utc.isoformat()
    hash_atual = calcular_hash(
        {
            "colaborador_id": colaborador_id,
            "tipo": tipo,
            "lat_registro": lat,
            "lng_registro": lng,
            "foto_url": foto_path,
            "registrado_em": registrado_em_str,
        },
        hash_anterior,
    )

    ip = request.client.host if request.client else None
    novo = {
        "colaborador_id": colaborador_id,
        "empresa_id": empresa_id,
        "tipo": tipo,
        "lat_registro": lat,
        "lng_registro": lng,
        "distancia_metros": round(distancia, 2) if distancia is not None else None,
        "local_permitido_id": local["id"] if local and dentro and local.get("id") else None,
        "foto_url": foto_path,
        "ip_dispositivo": ip,
        "user_agent": request.headers.get("user-agent"),
        "hash_integridade": hash_atual,
        "hash_anterior": hash_anterior,
        "status": status_registro,
        "motivo_rejeicao": motivo_rejeicao,
        "registrado_em": registrado_em_str,
    }
    inserido = supabase.table("registros_ponto").insert(novo).execute().data[0]

    jornada_hoje = None
    if status_registro == "valido" and tipo == "saida":
        carga = parse_interval(
            colaborador.get("carga_horaria_diaria")
            or empresa.get("carga_horaria_diaria")
            or "08:00:00"
        )
        j = atualizar_jornada_dia(colaborador_id, empresa_id, hoje_br, carga)
        jornada_hoje = {
            "horas_trabalhadas": timedelta_para_interval(j["horas_trabalhadas"]),
            "horas_esperadas": timedelta_para_interval(j["horas_esperadas"]),
            "saldo_dia": timedelta_para_interval(j["saldo_dia"]),
        }

    return {
        "id": inserido["id"],
        "status": status_registro,
        "tipo": tipo,
        "distancia_metros": round(distancia, 2) if distancia is not None else None,
        "local_nome": local["nome"] if local and dentro else None,
        "foto_url": gerar_url_assinada(foto_path),
        "registrado_em": registrado_em_str,
        "hash_integridade": hash_atual,
        "motivo_rejeicao": motivo_rejeicao,
        "jornada_hoje": jornada_hoje,
    }


@router.get("/status")
async def status_ponto(colaborador: dict = Depends(get_colaborador_atual)):
    colaborador_id = colaborador["id"]
    agora_utc = datetime.now(timezone.utc)
    hoje_br = agora_utc.astimezone(TZ_BR).date()
    inicio_dia, fim_dia = _limites_dia_utc(hoje_br)

    ultimo = (
        supabase.table("registros_ponto")
        .select("id, tipo, registrado_em, status")
        .eq("colaborador_id", colaborador_id)
        .eq("status", "valido")
        .gte("registrado_em", inicio_dia)
        .lte("registrado_em", fim_dia)
        .order("registrado_em", desc=True)
        .limit(1)
        .execute()
    )
    ultimo_tipo = ultimo.data[0]["tipo"] if ultimo.data else None
    return {
        "ultima_batida": ultimo.data[0] if ultimo.data else None,
        "proxima_batida": proxima_batida_esperada(ultimo_tipo),
        "data_hoje_br": hoje_br.isoformat(),
    }


@router.get("/historico")
async def historico_ponto(mes: str, colaborador: dict = Depends(get_colaborador_atual)):
    """Histórico mensal. mes = 'YYYY-MM'"""
    try:
        ano, m = mes.split("-")
        ano, m = int(ano), int(m)
    except Exception:
        raise HTTPException(400, "Parâmetro mes deve ser YYYY-MM")

    colaborador_id = colaborador["id"]
    inicio = datetime(ano, m, 1, tzinfo=timezone.utc).isoformat()
    _, ultimo_dia = monthrange(ano, m)
    fim = datetime(ano, m, ultimo_dia, 23, 59, 59, tzinfo=timezone.utc).isoformat()

    regs = (
        supabase.table("registros_ponto")
        .select("id, tipo, registrado_em, status, distancia_metros, local_permitido_id")
        .eq("colaborador_id", colaborador_id)
        .gte("registrado_em", inicio)
        .lte("registrado_em", fim)
        .order("registrado_em")
        .execute()
    ).data or []

    jornadas = (
        supabase.table("jornadas_diarias")
        .select("data, horas_trabalhadas, horas_esperadas, saldo_dia")
        .eq("colaborador_id", colaborador_id)
        .gte("data", f"{ano}-{m:02d}-01")
        .lte("data", f"{ano}-{m:02d}-{ultimo_dia:02d}")
        .execute()
    ).data or []
    jornada_por_data = {j["data"]: j for j in jornadas}

    # Agrupar registros por data local (BR)
    dias: dict[str, list] = {}
    for r in regs:
        data_br = datetime.fromisoformat(r["registrado_em"].replace("Z", "+00:00")) \
                          .astimezone(TZ_BR).date().isoformat()
        dias.setdefault(data_br, []).append(r)

    resultado = []
    for data_iso in sorted(dias.keys()):
        j = jornada_por_data.get(data_iso, {})
        d_obj = date.fromisoformat(data_iso)
        resultado.append({
            "data": data_iso,
            "data_br": d_obj.strftime("%A, %d/%m").capitalize(),
            "registros": dias[data_iso],
            "horas_trabalhadas": j.get("horas_trabalhadas"),
            "horas_esperadas": j.get("horas_esperadas"),
            "saldo_dia": j.get("saldo_dia"),
        })

    return {"mes": mes, "dias": resultado}


@router.get("/saldo")
async def saldo_horas(colaborador: dict = Depends(get_colaborador_atual)):
    colaborador_id = colaborador["id"]
    agora_utc = datetime.now(timezone.utc)
    hoje_br = agora_utc.astimezone(TZ_BR).date()

    inicio_semana = hoje_br - timedelta(days=hoje_br.weekday())
    inicio_mes = hoje_br.replace(day=1)

    jornadas = (
        supabase.table("jornadas_diarias")
        .select("data, saldo_dia, saldo_acumulado")
        .eq("colaborador_id", colaborador_id)
        .order("data", desc=True)
        .limit(60)
        .execute()
    ).data or []

    def soma(registros):
        total = timedelta()
        for j in registros:
            total += parse_interval(j.get("saldo_dia"))
        return timedelta_para_interval(total)

    hoje_regs   = [j for j in jornadas if j["data"] == hoje_br.isoformat()]
    semana_regs = [j for j in jornadas if j["data"] >= inicio_semana.isoformat()]
    mes_regs    = [j for j in jornadas if j["data"] >= inicio_mes.isoformat()]
    acumulado   = jornadas[0].get("saldo_acumulado") if jornadas else None

    ultimos_7 = []
    for i in range(6, -1, -1):
        d = hoje_br - timedelta(days=i)
        j = next((x for x in jornadas if x["data"] == d.isoformat()), None)
        ultimos_7.append({
            "data": d.isoformat(),
            "data_br": d.strftime("%d/%m"),
            "saldo_dia": j.get("saldo_dia") if j else None,
        })

    return {
        "hoje":     soma(hoje_regs) if hoje_regs else "—",
        "semana":   soma(semana_regs) if semana_regs else "—",
        "mes":      soma(mes_regs) if mes_regs else "—",
        "acumulado": acumulado or "—",
        "ultimos_7_dias": ultimos_7,
    }
