import logging
import os
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from db.supabase_client import supabase

logger = logging.getLogger(__name__)

TZ_BR = ZoneInfo(os.environ.get("TZ_DEFAULT", "America/Sao_Paulo"))
_DIAS_KEY = {0: "seg", 1: "ter", 2: "qua", 3: "qui", 4: "sex", 5: "sab", 6: "dom"}


def _fmt_duracao(minutos: int) -> str:
    h, m = divmod(abs(minutos), 60)
    return f"{h}h {m}min" if m else f"{h}h"


def _limites_dia_utc(dia: date) -> tuple[str, str]:
    inicio = datetime.combine(dia, datetime.min.time(), tzinfo=TZ_BR).astimezone(timezone.utc)
    fim = datetime.combine(dia, datetime.max.time(), tzinfo=TZ_BR).astimezone(timezone.utc)
    return inicio.isoformat(), fim.isoformat()


def _ja_existe_ajuste(colaborador_id: str, hoje_br: date, tipo: str) -> bool:
    res = (
        supabase.table("ajustes_banco_horas").select("id")
        .eq("colaborador_id", colaborador_id)
        .eq("data_referencia", hoje_br.isoformat())
        .eq("tipo_referencia", tipo)
        .eq("origem", "automatico")
        .limit(1).execute()
    )
    return bool(res.data)


def _ajuste_dia_fora_jornada(colaborador: dict, empresa_id: str, agora_utc: datetime, hoje_br: date) -> None:
    """
    Dia fora da jornada (ex.: sábado/domingo para jornada seg-sex): todo o tempo entre a
    primeira entrada e a saída vira banco de horas positivo, sem tolerância.
    """
    ini, fim = _limites_dia_utc(hoje_br)
    entrada = (
        supabase.table("registros_ponto").select("registrado_em")
        .eq("colaborador_id", colaborador["id"])
        .eq("status", "valido").eq("tipo", "entrada")
        .gte("registrado_em", ini).lte("registrado_em", fim)
        .order("registrado_em").limit(1).execute()
    )
    if not entrada.data:
        return
    ts_entrada = datetime.fromisoformat(entrada.data[0]["registrado_em"].replace("Z", "+00:00")).astimezone(TZ_BR)
    ts_saida = agora_utc.astimezone(TZ_BR)
    minutos = round(
        (ts_saida.replace(second=0, microsecond=0) - ts_entrada.replace(second=0, microsecond=0)).total_seconds() / 60
    )
    if minutos <= 0 or _ja_existe_ajuste(colaborador["id"], hoje_br, "saida"):
        return
    supabase.table("ajustes_banco_horas").insert({
        "colaborador_id": colaborador["id"],
        "empresa_id": empresa_id,
        "minutos": minutos,
        "descricao": (
            f"Dia fora da jornada: {ts_entrada.strftime('%H:%M')}–{ts_saida.strftime('%H:%M')} "
            f"({_fmt_duracao(minutos)})"
        ),
        "data_referencia": hoje_br.isoformat(),
        "tipo_referencia": "saida",
        "origem": "automatico",
    }).execute()


def criar_ajuste_automatico_banco(
    colaborador: dict,
    empresa_id: str,
    tipo: str,  # "entrada" ou "saida"
    agora_utc: datetime,
    hoje_br: date,
    dia_util: bool = True,
) -> None:
    """
    Dia de jornada: compara a batida com o horário previsto e, fora da tolerância,
    cria ajuste automático (entrada atrasada desconta; saída além do previsto soma).
    Dia fora da jornada: só a saída gera ajuste, com o tempo total trabalhado (positivo).
    Ignora colaborador sem modelo_jornada. Não duplica ajuste do mesmo tipo no mesmo dia.
    """
    try:
        modelo_id = colaborador.get("modelo_jornada_id")
        if not modelo_id:
            return

        if not dia_util:
            if tipo == "saida":
                _ajuste_dia_fora_jornada(colaborador, empresa_id, agora_utc, hoje_br)
            return

        mj = supabase.table("modelos_jornada").select(
            "hora_entrada, hora_saida, tolerancia_entrada_minutos, tolerancia_saida_minutos, horarios_por_dia"
        ).eq("id", modelo_id).single().execute().data
        if not mj:
            return

        # Horário personalizado por dia sobrescreve o padrão
        h_dia = (mj.get("horarios_por_dia") or {}).get(_DIAS_KEY.get(hoje_br.weekday(), ""), {}) or {}

        if tipo == "entrada":
            hora_esp_str = h_dia.get("hora_entrada") or mj.get("hora_entrada")
            tolerancia = int(mj.get("tolerancia_entrada_minutos") or 5)
        else:  # saida
            hora_esp_str = h_dia.get("hora_saida") or mj.get("hora_saida")
            tolerancia = int(mj.get("tolerancia_saida_minutos") or 5)

        if not hora_esp_str:
            return

        h, m, *_ = hora_esp_str.split(":")
        hora_esp = datetime.combine(hoje_br, time(int(h), int(m)), tzinfo=TZ_BR)

        agora_br_sem_seg = agora_utc.astimezone(TZ_BR).replace(second=0, microsecond=0)
        diff_minutos = round((agora_br_sem_seg - hora_esp).total_seconds() / 60)

        if abs(diff_minutos) <= tolerancia:
            return  # dentro da tolerância, sem ajuste

        if _ja_existe_ajuste(colaborador["id"], hoje_br, tipo):
            return

        # entrada atrasada → diff > 0 → saldo negativo; entrada antecipada → saldo positivo
        # saída atrasada → diff > 0 → saldo positivo; saída antecipada → saldo negativo
        hora_real = agora_br_sem_seg.strftime("%H:%M")

        if tipo == "entrada":
            minutos_ajuste = -diff_minutos
            if diff_minutos > 0:
                descricao = f"Entrada atrasada {hora_real} (previsto {hora_esp_str[:5]})"
            else:
                descricao = f"Entrada antecipada {hora_real} (previsto {hora_esp_str[:5]})"
        else:
            minutos_ajuste = diff_minutos
            if diff_minutos > 0:
                descricao = f"Saída {hora_real} além do previsto (previsto {hora_esp_str[:5]})"
            else:
                descricao = f"Saída antecipada {hora_real} (previsto {hora_esp_str[:5]})"

        supabase.table("ajustes_banco_horas").insert({
            "colaborador_id": colaborador["id"],
            "empresa_id": empresa_id,
            "minutos": minutos_ajuste,
            "descricao": descricao,
            "data_referencia": hoje_br.isoformat(),
            "tipo_referencia": tipo,
            "origem": "automatico",
        }).execute()

    except Exception as e:
        logger.warning("Falha ao criar ajuste automático banco de horas: %s", e)
