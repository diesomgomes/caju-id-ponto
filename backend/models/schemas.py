from pydantic import BaseModel
from typing import Optional


class JornadaResumo(BaseModel):
    horas_trabalhadas: str
    horas_esperadas: str
    saldo_dia: str


class PontoRegistrarResponse(BaseModel):
    id: str
    status: str
    tipo: str
    distancia_metros: Optional[float] = None
    local_nome: Optional[str] = None
    foto_url: str
    registrado_em: str
    hash_integridade: str
    motivo_rejeicao: Optional[str] = None
    jornada_hoje: Optional[JornadaResumo] = None
