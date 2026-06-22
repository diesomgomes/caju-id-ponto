import base64
import logging
import traceback
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from db.supabase_client import supabase as sb

logger = logging.getLogger(__name__)
from services.hash_chain import calcular_hash
from services.sequencia import proxima_batida_esperada
from services.storage import upload_selfie

router = APIRouter(prefix="/kiosk", tags=["kiosk"])

TZ_BR = ZoneInfo("America/Sao_Paulo")

TIPO_LABEL = {
    "entrada": "Entrada",
    "saida_almoco": "Saída Almoço",
    "retorno_almoco": "Retorno Almoço",
    "saida": "Saída",
}


def _get_device(token: str) -> dict:
    res = (
        sb.table("dispositivos_ponto")
        .select("*")
        .eq("token", token)
        .eq("ativo", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Dispositivo não encontrado ou inativo.")
    return res.data[0]


@router.get("/{token}/branding")
async def kiosk_branding(token: str):
    """Retorna apenas branding público para a tela de PIN."""
    device = _get_device(token)
    emp = sb.table("empresas").select("nome, logo_url, login_config").eq("id", device["empresa_id"]).limit(1).execute()
    empresa = emp.data[0] if emp.data else {}
    return {
        "dispositivo_nome": device["nome"],
        "empresa_nome": empresa.get("nome", ""),
        "empresa_logo": empresa.get("logo_url", ""),
        "cor_fundo": (empresa.get("login_config") or {}).get("cor_fundo", "#059669"),
        "tem_senha": bool(device.get("senha")),
    }


@router.post("/{token}/auth")
async def kiosk_auth(token: str, body: dict):
    """Valida senha e retorna dados completos do dispositivo."""
    device = _get_device(token)
    senha_informada = str(body.get("senha", "")).strip()

    if device.get("senha") and device["senha"] != senha_informada:
        raise HTTPException(401, "Senha incorreta.")

    empresa_id = device["empresa_id"]
    emp = sb.table("empresas").select("id, nome, logo_url, login_config").eq("id", empresa_id).limit(1).execute()
    empresa = emp.data[0] if emp.data else {}

    colabs = (
        sb.table("colaboradores")
        .select("id, nome, cpf, cargo, departamento")
        .eq("empresa_id", empresa_id)
        .eq("ativo", True)
        .order("nome")
        .execute()
    ).data or []

    return {
        "dispositivo": {"id": device["id"], "nome": device["nome"]},
        "empresa": empresa,
        "colaboradores": colabs,
    }


@router.post("/{token}/ponto")
async def kiosk_ponto(token: str, body: dict):
    device = _get_device(token)
    empresa_id = device["empresa_id"]

    colaborador_id = body.get("colaborador_id")
    cpf = body.get("cpf")
    foto_b64: str | None = body.get("foto")

    # Localizar colaborador — tenta com e sem formatação
    if colaborador_id:
        res = (
            sb.table("colaboradores")
            .select("*")
            .eq("id", colaborador_id)
            .eq("empresa_id", empresa_id)
            .limit(1)
            .execute()
        )
    elif cpf:
        cpf_limpo = "".join(c for c in cpf if c.isdigit())
        # Busca todos e filtra em Python (CPF pode estar formatado ou não no banco)
        todos = (
            sb.table("colaboradores")
            .select("*")
            .eq("empresa_id", empresa_id)
            .eq("ativo", True)
            .execute()
        ).data or []
        encontrado = next(
            (c for c in todos if "".join(d for d in (c.get("cpf") or "") if d.isdigit()) == cpf_limpo),
            None,
        )
        if not encontrado:
            raise HTTPException(404, "CPF não encontrado nesta empresa.")
        res = type("R", (), {"data": [encontrado]})()
    else:
        raise HTTPException(400, "Informe colaborador_id ou cpf.")

    if not res.data:
        raise HTTPException(404, "Colaborador não encontrado nesta empresa.")

    colaborador = res.data[0]
    colaborador_id = colaborador["id"]

    agora_utc = datetime.now(timezone.utc)
    hoje_br = agora_utc.astimezone(TZ_BR).date()

    ultimo = (
        sb.table("registros_ponto")
        .select("tipo")
        .eq("colaborador_id", colaborador_id)
        .gte("registrado_em", f"{hoje_br}T00:00:00+00:00")
        .order("registrado_em", desc=True)
        .limit(1)
        .execute()
    )
    ultimo_tipo = ultimo.data[0]["tipo"] if ultimo.data else None
    proximos = proxima_batida_esperada(ultimo_tipo)

    if not proximos:
        raise HTTPException(400, "Jornada do dia já encerrada para este colaborador.")

    tipo = proximos[0]

    # Upload foto — falha silenciosa (não bloqueia o registro)
    foto_url = None
    if foto_b64:
        try:
            conteudo = base64.b64decode(foto_b64.split(",")[-1])
            foto_url = upload_selfie(empresa_id, colaborador_id, conteudo)
        except Exception as e:
            logger.warning(f"kiosk_ponto: upload foto falhou (sem foto): {e}")

    try:
        ult_hash = (
            sb.table("registros_ponto")
            .select("hash_integridade")
            .eq("colaborador_id", colaborador_id)
            .order("registrado_em", desc=True)
            .limit(1)
            .execute()
        )
        hash_anterior = ult_hash.data[0]["hash_integridade"] if ult_hash.data else None
        registrado_em_str = agora_utc.isoformat()

        hash_atual = calcular_hash(
            {"colaborador_id": colaborador_id, "tipo": tipo, "lat_registro": None,
             "lng_registro": None, "foto_url": foto_url, "registrado_em": registrado_em_str},
            hash_anterior,
        )

        sb.table("registros_ponto").insert({
            "colaborador_id": colaborador_id,
            "empresa_id": empresa_id,
            "tipo": tipo,
            "lat_registro": None,
            "lng_registro": None,
            "distancia_metros": None,
            "local_permitido_id": None,
            "foto_url": foto_url,
            "ip_dispositivo": None,
            "user_agent": f"kiosk/{device['id']}",
            "hash_integridade": hash_atual,
            "hash_anterior": hash_anterior,
            "status": "valido",
            "motivo_rejeicao": None,
            "registrado_em": registrado_em_str,
        }).execute()
    except Exception as e:
        logger.error(f"kiosk_ponto INSERT error: {traceback.format_exc()}")
        raise HTTPException(500, f"Erro ao registrar ponto: {str(e)}")

    return {
        "ok": True,
        "tipo": tipo,
        "tipo_label": TIPO_LABEL.get(tipo, tipo),
        "colaborador": colaborador["nome"],
        "horario": agora_utc.astimezone(TZ_BR).strftime("%H:%M"),
    }
