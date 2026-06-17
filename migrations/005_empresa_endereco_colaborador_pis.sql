-- =============================================================================
-- Migration 005: Endereço completo na empresa + PIS no colaborador
-- Execute no SQL Editor do Supabase.
-- =============================================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cep         TEXT,
  ADD COLUMN IF NOT EXISTS logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS numero      TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS bairro      TEXT,
  ADD COLUMN IF NOT EXISTS cidade      TEXT,
  ADD COLUMN IF NOT EXISTS estado      TEXT;

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS pis TEXT;
