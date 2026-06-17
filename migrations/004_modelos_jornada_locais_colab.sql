-- =============================================================================
-- Migration 004: Modelos de Jornada + Locais por Colaborador
-- Execute no SQL Editor do Supabase.
-- =============================================================================

-- Tabela de modelos de jornada (templates reutilizáveis)
CREATE TABLE IF NOT EXISTS modelos_jornada (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                 TEXT NOT NULL,
  hora_entrada         TIME NOT NULL,
  hora_saida           TIME NOT NULL,
  hora_inicio_almoco   TIME,
  hora_fim_almoco      TIME,
  dias_trabalho        TEXT NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
  carga_horaria_diaria INTERVAL,
  ativo                BOOLEAN DEFAULT TRUE,
  criado_em            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modelos_jornada_empresa ON modelos_jornada(empresa_id);

-- Vínculo do colaborador com seu modelo de jornada
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS modelo_jornada_id UUID REFERENCES modelos_jornada(id);

-- Tabela de vínculo colaborador ↔ locais permitidos (many-to-many)
CREATE TABLE IF NOT EXISTS colaborador_locais (
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  local_id       UUID NOT NULL REFERENCES locais_permitidos(id) ON DELETE CASCADE,
  PRIMARY KEY (colaborador_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_colab_locais_colab ON colaborador_locais(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colab_locais_local ON colaborador_locais(local_id);

-- RLS: modelos_jornada
ALTER TABLE modelos_jornada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_gerencia_modelos_jornada" ON modelos_jornada;
CREATE POLICY "rh_gerencia_modelos_jornada"
ON modelos_jornada FOR ALL
USING (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "colaborador_ve_modelo_jornada" ON modelos_jornada;
CREATE POLICY "colaborador_ve_modelo_jornada"
ON modelos_jornada FOR SELECT
USING (
  empresa_id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid())
);

-- RLS: colaborador_locais
ALTER TABLE colaborador_locais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_gerencia_colab_locais" ON colaborador_locais;
CREATE POLICY "rh_gerencia_colab_locais"
ON colaborador_locais FOR ALL
USING (
  colaborador_id IN (
    SELECT id FROM colaboradores
    WHERE empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
  )
)
WITH CHECK (
  colaborador_id IN (
    SELECT id FROM colaboradores
    WHERE empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "colaborador_ve_proprios_locais" ON colaborador_locais;
CREATE POLICY "colaborador_ve_proprios_locais"
ON colaborador_locais FOR SELECT
USING (
  colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid())
);
