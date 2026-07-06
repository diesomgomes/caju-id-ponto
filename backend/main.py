import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from routers import ponto, rh, kiosk
from services.cleanup import limpar_fotos_antigas
from db.supabase_client import supabase as sb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _ping_supabase():
    """Mantém o projeto Supabase ativo — evita pausa por inatividade."""
    try:
        sb.table("empresas").select("id").limit(1).execute()
        logger.info("Supabase ping OK")
    except Exception as e:
        logger.warning(f"Supabase ping falhou: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(limpar_fotos_antigas, "cron", hour=3, minute=0, id="limpar_fotos_antigas")
    # Ping a cada 2 dias para evitar pausa do plano gratuito do Supabase
    scheduler.add_job(_ping_supabase, "interval", days=2, id="ping_supabase")
    scheduler.start()
    _ping_supabase()  # executa imediatamente ao iniciar
    yield
    scheduler.shutdown()


app = FastAPI(title="Ponto Eletrônico API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ponto.router)
app.include_router(rh.router)
app.include_router(kiosk.router)


@app.get("/health")
def health():
    return {"ok": True}
