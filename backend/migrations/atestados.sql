-- Executar no SQL Editor do Supabase
CREATE TABLE IF NOT EXISTS atestados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  data_inicio DATE NOT NULL,
  qtd_dias INTEGER NOT NULL DEFAULT 1,
  data_fim DATE NOT NULL,
  arquivo_url TEXT,
  observacao TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS atestados_colaborador_idx ON atestados(colaborador_id);
CREATE INDEX IF NOT EXISTS atestados_periodo_idx ON atestados(data_inicio, data_fim);

-- Habilitar RLS (segurança via service_role key no backend)
ALTER TABLE atestados ENABLE ROW LEVEL SECURITY;
