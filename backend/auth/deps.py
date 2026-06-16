from fastapi import Header, HTTPException, status
from db.supabase_client import supabase


async def get_colaborador_atual(authorization: str = Header(...)) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    user = getattr(user_resp, "user", None)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")

    resp = supabase.table("colaboradores").select("*").eq("auth_user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Colaborador não vinculado")
    colab = resp.data[0]
    if not colab.get("ativo", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Colaborador inativo")
    return colab


async def get_usuario_rh_atual(authorization: str = Header(...)) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    user = getattr(user_resp, "user", None)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")

    resp = supabase.table("usuarios_rh").select("*").eq("auth_user_id", user.id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuário RH não vinculado")
    return resp.data[0]
