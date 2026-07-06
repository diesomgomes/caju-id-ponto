-- Migration 018: intervalo de refresh automático da tela do dispositivo (em minutos)
-- null = sem refresh automático
ALTER TABLE dispositivos_ponto
  ADD COLUMN IF NOT EXISTS intervalo_refresh INTEGER DEFAULT 2
    CHECK (intervalo_refresh IS NULL OR intervalo_refresh > 0);
