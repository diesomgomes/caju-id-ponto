import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from routers import ponto, rh, kiosk
from services.cleanup import limpar_fotos_antigas

logging.basicConfig(level=logging.INFO)

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(limpar_fotos_antigas, "cron", hour=3, minute=0, id="cleanup_fotos")
    scheduler.start()
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
