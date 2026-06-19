-- =============================================================================
-- Migration 008: Tabela de feriados (nacionais + municipais/empresa)
-- Execute no SQL Editor do Supabase.
-- =============================================================================

CREATE TABLE IF NOT EXISTS feriados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id) ON DELETE CASCADE, -- NULL = nacional
  data        DATE NOT NULL,
  descricao   TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'nacional', -- nacional | municipal | empresa
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feriados_unico
  ON feriados (COALESCE(empresa_id::text, 'nacional'), data);

CREATE INDEX IF NOT EXISTS idx_feriados_empresa ON feriados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_feriados_data    ON feriados(data);

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_gerencia_feriados" ON feriados;
CREATE POLICY "rh_gerencia_feriados" ON feriados FOR ALL
USING (
  empresa_id IS NULL
  OR empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);
