-- Executar no SQL Editor do Supabase
ALTER TABLE ajustes_banco_horas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id),
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_referencia TEXT;
