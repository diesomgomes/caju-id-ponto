-- =============================================================================
-- Migration 007 — Tolerância de entrada/saída nos modelos de jornada
-- Execute no SQL Editor do Supabase
-- =============================================================================

ALTER TABLE modelos_jornada
  ADD COLUMN IF NOT EXISTS tolerancia_entrada_minutos INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tolerancia_saida_minutos   INTEGER NOT NULL DEFAULT 5;
