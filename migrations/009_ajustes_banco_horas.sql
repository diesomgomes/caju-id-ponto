CREATE TABLE IF NOT EXISTS ajustes_banco_horas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  minutos     INTEGER NOT NULL,  -- positivo = adicionar, negativo = descontar
  descricao   TEXT NOT NULL,
  criado_por  UUID REFERENCES usuarios_rh(id),
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ajustes_banco_horas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_gerencia_ajustes_banco" ON ajustes_banco_horas;
CREATE POLICY "rh_gerencia_ajustes_banco"
ON ajustes_banco_horas FOR ALL
USING (
  colaborador_id IN (
    SELECT c.id FROM colaboradores c
    JOIN empresas e ON e.id = c.empresa_id
    WHERE e.id IN (
      SELECT empresa_id FROM usuarios_rh WHERE id = auth.uid()
      UNION
      SELECT id FROM empresas WHERE auth.uid() IN (
        SELECT id FROM usuarios_rh WHERE papel = 'admin'
      )
    )
  )
);
