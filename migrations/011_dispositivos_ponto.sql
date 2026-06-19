CREATE TABLE IF NOT EXISTS dispositivos_ponto (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispositivos_ponto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_gerencia_dispositivos" ON dispositivos_ponto;
CREATE POLICY "rh_gerencia_dispositivos"
ON dispositivos_ponto FOR ALL
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios_rh WHERE id = auth.uid()
    UNION
    SELECT id FROM empresas WHERE auth.uid() IN (
      SELECT id FROM usuarios_rh WHERE papel = 'admin'
    )
  )
);
