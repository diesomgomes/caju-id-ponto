def proxima_batida_esperada(ultimo_tipo_hoje: str | None) -> list[str]:
    if ultimo_tipo_hoje is None:
        return ["entrada"]
    if ultimo_tipo_hoje == "entrada":
        return ["saida_almoco", "saida"]
    if ultimo_tipo_hoje == "saida_almoco":
        return ["retorno_almoco"]
    if ultimo_tipo_hoje == "retorno_almoco":
        return ["saida"]
    return []


def validar_sequencia(ultimo_tipo_hoje: str | None, tipo_novo: str) -> tuple[bool, str | None]:
    permitidos = proxima_batida_esperada(ultimo_tipo_hoje)
    if not permitidos:
        return False, "Jornada do dia já encerrada"
    if tipo_novo not in permitidos:
        return False, f"Próxima batida esperada: {' ou '.join(permitidos)}"
    return True, None
