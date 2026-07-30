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


def dia_util_para_colaborador(colaborador: dict, dia) -> bool:
    """
    Retorna True se o dia faz parte da jornada regular do colaborador.
    Consulta o modelo_jornada no banco. Padrão: seg-sex.
    """
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
