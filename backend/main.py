from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ponto

app = FastAPI(title="Ponto Eletrônico API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ponto.router)


@app.get("/health")
def health():
    return {"ok": True}
