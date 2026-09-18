from db.supabase_client import supabase

DIAS_SEMANA_MAP = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}


def proxima_batida_esperada(ultimo_tipo_hoje: "str | None") -> list[str]:
    if ultimo_tipo_hoje is None:
        return ["entrada"]
    if ultimo_tipo_hoje == "entrada":
        return ["saida_almoco", "saida"]
    if ultimo_tipo_hoje == "saida_almoco":
        return ["retorno_almoco"]
    if ultimo_tipo_hoje == "retorno_almoco":
        return ["saida"]
    return []


def proxima_batida_fora_jornada(ultimo_tipo_hoje: "str | None") -> list[str]:
    """Sequência simplificada para dias fora da jornada: entrada → saída direto."""
    if ultimo_tipo_hoje is None:
        return ["entrada"]
    if ultimo_tipo_hoje == "entrada":
        return ["saida"]
    return []


def validar_sequencia(ultimo_tipo_hoje: "str | None", tipo_novo: str) -> tuple[bool, "str | None"]:
    permitidos = proxima_batida_esperada(ultimo_tipo_hoje)
    if not permitidos:
        return False, "Jornada do dia já encerrada"
    if tipo_novo not in permitidos:
        return False, f"Próxima batida esperada: {' ou '.join(permitidos)}"
    return True, None


def validar_sequencia_fora_jornada(ultimo_tipo_hoje: "str | None", tipo_novo: str) -> tuple[bool, "str | None"]:
    permitidos = proxima_batida_fora_jornada(ultimo_tipo_hoje)
    if not permitidos:
        return False, "Jornada extra do dia já encerrada"
    if tipo_novo not in permitidos:
        return False, f"Dia fora da jornada — apenas entrada e saída são permitidos"
    return True, None


MSG_HORA_EXTRA_BLOQUEADA = "Batida impossibilitada - Hora extra bloqueada"


def hora_extra_bloqueada(colaborador: dict, agora_br) -> bool:
    """
    True se o colaborador NÃO pode fazer banco de horas (banco_horas_bloqueado)
    e a batida ocorre depois do fim do expediente (hora_saida + tolerância de saída)
    em um dia de jornada. Respeita o horário personalizado por dia da semana.
    """
    if not colaborador.get("banco_horas_bloqueado") or colaborador.get("hora_extra_liberada"):
        return False
    modelo_id = colaborador.get("modelo_jornada_id")
    if not modelo_id:
        return False
    dia = agora_br.date()
    try:
        lib = (
            supabase.table("liberacoes_hora_extra").select("id")
            .eq("colaborador_id", colaborador["id"])
            .eq("data_liberada", dia.isoformat())
            .limit(1).execute()
        )
        if lib.data:
            return False
    except Exception:
        pass  # tabela ausente (migration 023 não aplicada): segue com o bloqueio
    if not dia_util_para_colaborador(colaborador, dia):
        return False
    try:
        mj = (
            supabase.table("modelos_jornada")
            .select("hora_saida, tolerancia_saida_minutos, horarios_por_dia")
            .eq("id", modelo_id)
            .single()
            .execute()
            .data
        )
        if not mj:
            return False
        dia_key = {v: k for k, v in DIAS_SEMANA_MAP.items()}[dia.weekday()]
        h_dia = (mj.get("horarios_por_dia") or {}).get(dia_key) or {}
        hora_saida = h_dia.get("hora_saida") or mj.get("hora_saida")
        if not hora_saida:
            return False
        h, m, *_ = hora_saida.split(":")
        limite = int(h) * 60 + int(m) + int(mj.get("tolerancia_saida_minutos") or 5)
        return agora_br.hour * 60 + agora_br.minute > limite
    except Exception:
        return False


def eh_feriado(empresa_id, dia) -> bool:
    """True se a data é feriado nacional (empresa_id nulo) ou da empresa."""
    try:
        q = supabase.table("feriados").select("id").eq("data", dia.isoformat())
        if empresa_id:
            q = q.or_(f"empresa_id.is.null,empresa_id.eq.{empresa_id}")
        else:
            q = q.is_("empresa_id", "null")
        return bool(q.limit(1).execute().data)
    except Exception:
        return False


def dia_util_para_colaborador(colaborador: dict, dia) -> bool:
    """
    Retorna True se o dia faz parte da jornada regular do colaborador (feriado não é dia útil).
    Consulta o modelo_jornada no banco. Padrão: seg-sex.
    """
    if eh_feriado(colaborador.get("empresa_id"), dia):
        return False
    modelo_id = colaborador.get("modelo_jornada_id")
    if not modelo_id:
        return dia.weekday() < 5
    try:
        mj = (
            supabase.table("modelos_jornada")
            .select("dias_trabalho")
            .eq("id", modelo_id)
            .single()
            .execute()
            .data
        )
        if not mj:
            return dia.weekday() < 5
        dt_str = mj.get("dias_trabalho", "seg,ter,qua,qui,sex")
        dias = {DIAS_SEMANA_MAP[d.strip()] for d in dt_str.split(",") if d.strip() in DIAS_SEMANA_MAP}
        return dia.weekday() in dias
    except Exception:
        return dia.weekday() < 5
