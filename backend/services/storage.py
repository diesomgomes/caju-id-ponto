import io
from datetime import datetime, timezone
from PIL import Image
from db.supabase_client import supabase

BUCKET = "fotos-ponto"
MAX_BYTES = 2 * 1024 * 1024


class FotoInvalida(Exception):
    pass


def _normalizar_para_jpeg(conteudo: bytes) -> bytes:
    if len(conteudo) > MAX_BYTES:
        raise FotoInvalida("Foto excede 2MB")
    try:
        Image.open(io.BytesIO(conteudo)).verify()
    except Exception:
        raise FotoInvalida("Arquivo não é uma imagem válida")
    img = Image.open(io.BytesIO(conteudo))
    if img.format not in ("JPEG", "PNG"):
        raise FotoInvalida("Use JPEG ou PNG")
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def upload_selfie(empresa_id: str, colaborador_id: str, conteudo: bytes) -> str:
    """Faz upload da selfie e retorna o path interno do bucket (não a URL pública)."""
    bytes_jpeg = _normalizar_para_jpeg(conteudo)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    path = f"{empresa_id}/{colaborador_id}/{timestamp}.jpg"
    supabase.storage.from_(BUCKET).upload(
        path=path,
        file=bytes_jpeg,
        file_options={"content-type": "image/jpeg", "upsert": "false"},
    )
    return path


def gerar_url_assinada(path: str, expires_in: int = 3600) -> str:
    resp = supabase.storage.from_(BUCKET).create_signed_url(path, expires_in)
    return resp.get("signedURL") or resp.get("signed_url") or ""
