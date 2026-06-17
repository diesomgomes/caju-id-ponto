import logging
from datetime import datetime, timezone, timedelta
from db.supabase_client import supabase

logger = logging.getLogger(__name__)


def limpar_fotos_antigas():
    """Remove fotos do Storage com mais de 2 meses e anula o campo foto_url no banco."""
    corte = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    logger.info(f"[cleanup] Buscando registros com foto anterior a {corte[:10]}")

    try:
        res = supabase.table("registros_ponto") \
            .select("id, foto_url") \
            .lt("registrado_em", corte) \
            .neq("foto_url", "null") \
            .not_.is_("foto_url", "null") \
            .execute()

        registros = res.data or []
        logger.info(f"[cleanup] {len(registros)} foto(s) para excluir")

        paths = []
        for r in registros:
            url = r.get("foto_url", "")
            if "/fotos-ponto/" in url:
                paths.append(url.split("/fotos-ponto/")[-1])

        if paths:
            supabase.storage.from_("fotos-ponto").remove(paths)
            ids = [r["id"] for r in registros]
            supabase.table("registros_ponto") \
                .update({"foto_url": None}) \
                .in_("id", ids) \
                .execute()
            logger.info(f"[cleanup] {len(paths)} foto(s) removida(s) do Storage")

    except Exception as e:
        logger.error(f"[cleanup] Erro na limpeza de fotos: {e}")
