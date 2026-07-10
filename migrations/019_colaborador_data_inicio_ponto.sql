-- Migration 019: data de início do acompanhamento de ponto por colaborador
-- Dias anteriores a esta data não contam como falta no calendário
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS data_inicio_ponto DATE;
