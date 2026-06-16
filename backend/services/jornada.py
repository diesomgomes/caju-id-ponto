from datetime import datetime, timedelta, date, timezone
from db.supabase_client import supabase


def parse_interval(valor) -> timedelta:
    """Aceita timedelta, string HH:MM:SS ou None."""
    if isinstance(valor, timedelta):
        return valor
    if not valor:
        return timedelta()
    sinal = 1
    s = str(valor).strip()
    if s.startswith("-"):
        sinal = -1
        s = s[1:]
    partes = s.split(":")
    if len(partes) == 3:
        h, m, sec = partes
        return sinal * timedelta(hours=int(h), minutes=int(m), seconds=float(sec))
    return timedelta()


def timedelta_para_interval(td: timedelta) -> str:
    total = int(td.total_seconds())
    sinal = "-" if total < 0 else ""
    total = abs(total)
    h, resto = divmod(total, 3600)
    m, s = divmod(resto, 60)
    return f"{sinal}{h:02d}:{m:02d}:{s:02d}"


def _parse_ts(ts) -> datetime:
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))


def calcular_jornada(registros_do_dia: list[dict], carga_esperada: timedelta) -> dict:
    horas = timedelta()
    entrada: datetime | None = None
    retorno: datetime | None = None
    for r in sorted(registros_do_dia, key=lambda x: x["registrado_em"]):
        ts = _parse_ts(r["registrado_em"])
        tipo = r["tipo"]
        if tipo == "entrada":
            entrada = ts
        elif tipo == "saida_almoco":
            if entrada:
                horas += ts - entrada
        elif tipo == "retorno_almoco":
            retorno = ts
        elif tipo == "saida":
            base = retorno or entrada
            if base:
                horas += ts - base
    return {
        "horas_trabalhadas": horas,
        "horas_esperadas": carga_esperada,
        "saldo_dia": horas - carga_esperada,
    }


def atualizar_jornada_dia(
    colaborador_id: str,
    empresa_id: str,
    dia: date,
    carga_esperada: timedelta,
) -> dict:
    inicio = datetime.combine(dia, datetime.min.time(), tzinfo=timezone.utc).isoformat()
    fim = datetime.combine(dia, datetime.max.time(), tzinfo=timezone.utc).isoformat()

    regs = (
        supabase.table("registros_ponto")
        .select("tipo, registrado_em")
        .eq("colaborador_id", colaborador_id)
        .eq("status", "valido")
        .gte("registrado_em", inicio)
        .lte("registrado_em", fim)
        .order("registrado_em")
        .execute()
    )

    j = calcular_jornada(regs.data or [], carga_esperada)

    prev = (
        supabase.table("jornadas_diarias")
        .select("saldo_acumulado")
        .eq("colaborador_id", colaborador_id)
        .lt("data", dia.isoformat())
        .order("data", desc=True)
        .limit(1)
        .execute()
    )
    saldo_anterior = parse_interval(prev.data[0]["saldo_acumulado"]) if prev.data else timedelta()
    saldo_acumulado = saldo_anterior + j["saldo_dia"]

    supabase.table("jornadas_diarias").upsert(
        {
            "colaborador_id": colaborador_id,
            "empresa_id": empresa_id,
            "data": dia.isoformat(),
            "horas_trabalhadas": timedelta_para_interval(j["horas_trabalhadas"]),
            "horas_esperadas": timedelta_para_interval(j["horas_esperadas"]),
            "saldo_dia": timedelta_para_interval(j["saldo_dia"]),
            "saldo_acumulado": timedelta_para_interval(saldo_acumulado),
        },
        on_conflict="colaborador_id,data",
    ).execute()

    return j
