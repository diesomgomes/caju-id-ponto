ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS modo_ponto TEXT NOT NULL DEFAULT 'ambos'
  CHECK (modo_ponto IN ('app', 'kiosk', 'ambos'));
