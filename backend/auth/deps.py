import time
from threading import Lock

from fastapi import Header, HTTPException, status
from db.supabase_client import supabase

# Cache curto token -> usuário. Evita 2 idas ao Supabase (auth + tabela) em toda
# requisição; um token revogado ou usuário desativado vale por até _TTL segundos.
_TTL = 60
_MAX = 500
_cache: dict[tuple[str, str], tuple[float, dict]] = {}
_lock = Lock()


def _cache_get(tipo: str, token: str) -> dict | None:
    with _lock:
        hit = _cache.get((tipo, token))
        if hit and hit[0] > time.monotonic():
            return dict(hit[1])
    return None


def _cache_set(tipo: str, token: str, valor: dict) -> None:
    with _lock:
        if len(_cache) >= _MAX:
            agora = time.monotonic()
            for k in [k for k, (exp, _) in _cache.items() if exp <= agora]:
                del _cache[k]
            if len(_cache) >= _MAX:
                _cache.clear()
        _cache[(tipo, token)] = (time.monotonic() + _TTL, dict(valor))


def _extrair_token(authorization: str) -> str:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    return authorization.split(" ", 1)[1].strip()


def _usuario_auth(token: str):
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    user = getattr(user_resp, "user", None)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    return user


# Dependências síncronas: o FastAPI as executa em thread pool, sem travar o event loop
def get_colaborador_atual(authorization: str = Header(...)) -> dict:
    token = _extrair_token(authorization)
    if (cached := _cache_get("colab", token)) is not None:
        return cached
    user = _usuario_auth(token)

    resp = supabase.table("colaboradores").select("*").eq("auth_user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Colaborador não vinculado")
    colab = resp.data[0]
    if not colab.get("ativo", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Colaborador inativo")
    _cache_set("colab", token, colab)
    return colab


def get_usuario_rh_atual(authorization: str = Header(...)) -> dict:
    token = _extrair_token(authorization)
    if (cached := _cache_get("rh", token)) is not None:
        return cached
    user = _usuario_auth(token)

    resp = supabase.table("usuarios_rh").select("*").eq("auth_user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuário RH não vinculado")
    _cache_set("rh", token, resp.data[0])
    return resp.data[0]
