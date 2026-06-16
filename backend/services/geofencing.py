import math


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def encontrar_local_mais_proximo(lat: float, lng: float, locais: list[dict]):
    """Retorna (local_mais_proximo, distancia_em_metros, dentro_do_raio)."""
    if not locais:
        return None, None, False
    melhor = None
    menor = float("inf")
    for loc in locais:
        d = haversine(lat, lng, float(loc["lat"]), float(loc["lng"]))
        if d < menor:
            menor = d
            melhor = loc
    dentro = menor <= float(melhor.get("raio_metros") or 100)
    return melhor, menor, dentro
