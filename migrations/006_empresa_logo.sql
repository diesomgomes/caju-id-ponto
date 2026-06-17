-- Migration 006: Logo da empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
