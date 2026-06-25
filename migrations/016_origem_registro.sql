-- Migration 016: adiciona coluna origem em registros_ponto
-- Valores: 'app' (padrão), 'kiosk', 'manual'

ALTER TABLE registros_ponto
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app', 'kiosk', 'manual'));
