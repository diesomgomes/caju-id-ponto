-- Liberação de hora extra para colaboradores com banco de horas bloqueado.
-- 1) hora_extra_liberada: liberação permanente (pode bater ponto após o expediente sempre)
-- 2) liberacoes_hora_extra: liberação pontual por data, com registro de quem autorizou e quando

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS hora_extra_liberada BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS liberacoes_hora_extra (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_liberada       DATE NOT NULL,
  motivo              TEXT,
  autorizado_por      UUID REFERENCES usuarios_rh(id),
  autorizado_por_nome TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, data_liberada)
);

CREATE INDEX IF NOT EXISTS idx_liberacoes_he_colab_data
  ON liberacoes_hora_extra(colaborador_id, data_liberada);
