-- =============================================================================
-- Migration 003 — Configuração de jornada por colaborador
-- Execute no SQL Editor do Supabase
-- =============================================================================

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS hora_entrada_esperada TIME,
  ADD COLUMN IF NOT EXISTS hora_saida_esperada   TIME,
  ADD COLUMN IF NOT EXISTS dias_trabalho         TEXT DEFAULT 'seg,ter,qua,qui,sex',
  ADD COLUMN IF NOT EXISTS departamento          TEXT;
