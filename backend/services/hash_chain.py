import hashlib
import json


def calcular_hash(registro: dict, hash_anterior: str | None) -> str:
    payload = json.dumps(
        {
            "colaborador_id": str(registro["colaborador_id"]),
            "tipo": registro["tipo"],
            "lat": str(registro["lat_registro"]),
            "lng": str(registro["lng_registro"]),
            "foto_url": registro["foto_url"],
            "registrado_em": registro["registrado_em"],
            "hash_anterior": hash_anterior or "",
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
