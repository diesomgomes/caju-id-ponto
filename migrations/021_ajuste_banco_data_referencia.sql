-- Migration 021: data de referência no ajuste manual de banco de horas
ALTER TABLE ajustes_banco_horas
  ADD COLUMN IF NOT EXISTS data_referencia DATE;
