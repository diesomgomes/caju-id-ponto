-- Executar no SQL Editor do Supabase
ALTER TABLE ajustes_banco_horas
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_referencia TEXT;

-- tipo_referencia: 'entrada' | 'saida' (preenchido nos registros automáticos)
-- origem: 'manual' | 'automatico'
