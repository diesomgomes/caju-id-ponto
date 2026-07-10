-- Migration 020: horários personalizados por dia da semana no modelo de jornada
-- Estrutura: {"seg": {"hora_entrada": "07:30", "hora_saida": "17:30", "hora_inicio_almoco": "11:00", "hora_fim_almoco": "12:00"}, "sex": {...}}
-- Dias ausentes usam os horários padrão do modelo
ALTER TABLE modelos_jornada
  ADD COLUMN IF NOT EXISTS horarios_por_dia JSONB DEFAULT '{}'::jsonb;
