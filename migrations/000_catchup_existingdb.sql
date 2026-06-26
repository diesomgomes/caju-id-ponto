-- =============================================================================
-- CATCHUP: atualiza banco existente para o estado completo das migrations 001-016
-- Execute UMA VEZ no SQL Editor do Supabase.
-- Todas as operações usam IF NOT EXISTS / IF EXISTS para ser idempotente.
-- =============================================================================

-- Extensão
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- COLUNAS FALTANTES EM TABELAS JÁ EXISTENTES
-- =============================================================================

-- empresas (001 + 005 + 006 + 010)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS lat_sede             NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng_sede             NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS raio_metros          INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS carga_horaria_diaria INTERVAL DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS ativo                BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cep                  TEXT,
  ADD COLUMN IF NOT EXISTS logradouro           TEXT,
  ADD COLUMN IF NOT EXISTS numero               TEXT,
  ADD COLUMN IF NOT EXISTS complemento          TEXT,
  ADD COLUMN IF NOT EXISTS bairro               TEXT,
  ADD COLUMN IF NOT EXISTS cidade               TEXT,
  ADD COLUMN IF NOT EXISTS estado               TEXT,
  ADD COLUMN IF NOT EXISTS logo_url             TEXT,
  ADD COLUMN IF NOT EXISTS login_config         JSONB DEFAULT '{}'::jsonb;

-- colaboradores (001 + 003 + 004 + 005 + 014)
CREATE TABLE IF NOT EXISTS colaboradores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  auth_user_id         UUID UNIQUE,
  nome                 TEXT NOT NULL,
  cpf                  TEXT UNIQUE NOT NULL,
  email                TEXT UNIQUE,
  cargo                TEXT,
  carga_horaria_diaria INTERVAL,
  foto_perfil_url      TEXT,
  ativo                BOOLEAN DEFAULT TRUE,
  criado_em            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS hora_entrada_esperada  TIME,
  ADD COLUMN IF NOT EXISTS hora_saida_esperada    TIME,
  ADD COLUMN IF NOT EXISTS hora_inicio_almoco     TIME,
  ADD COLUMN IF NOT EXISTS hora_fim_almoco        TIME,
  ADD COLUMN IF NOT EXISTS dias_trabalho          TEXT DEFAULT 'seg,ter,qua,qui,sex',
  ADD COLUMN IF NOT EXISTS departamento           TEXT,
  ADD COLUMN IF NOT EXISTS pis                    TEXT,
  ADD COLUMN IF NOT EXISTS modo_ponto             TEXT NOT NULL DEFAULT 'ambos'
    CHECK (modo_ponto IN ('app', 'kiosk', 'ambos'));

-- =============================================================================
-- TABELAS NOVAS (criadas pelas migrations 001-015 que podem não existir)
-- =============================================================================

-- locais_permitidos (001)
CREATE TABLE IF NOT EXISTS locais_permitidos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  lat         NUMERIC(10, 7) NOT NULL,
  lng         NUMERIC(10, 7) NOT NULL,
  raio_metros INTEGER DEFAULT 100,
  ativo       BOOLEAN DEFAULT TRUE
);

-- registros_ponto (001 + 013 + 016)
CREATE TABLE IF NOT EXISTS registros_ponto (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID NOT NULL REFERENCES colaboradores(id),
  empresa_id        UUID NOT NULL REFERENCES empresas(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('entrada','saida_almoco','retorno_almoco','saida')),
  lat_registro      NUMERIC(10, 7),
  lng_registro      NUMERIC(10, 7),
  distancia_metros  NUMERIC(8, 2),
  local_permitido_id UUID REFERENCES locais_permitidos(id),
  foto_url          TEXT,
  ip_dispositivo    TEXT,
  user_agent        TEXT,
  hash_integridade  TEXT,
  hash_anterior     TEXT,
  status            TEXT DEFAULT 'valido' CHECK (status IN ('valido','rejeitado','pendente')),
  motivo_rejeicao   TEXT,
  registrado_em     TIMESTAMPTZ DEFAULT NOW(),
  origem            TEXT NOT NULL DEFAULT 'app' CHECK (origem IN ('app','kiosk','manual'))
);

-- Se a tabela já existia, adiciona as colunas novas individualmente
ALTER TABLE registros_ponto
  ALTER COLUMN lat_registro    DROP NOT NULL,
  ALTER COLUMN lng_registro    DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE registros_ponto ALTER COLUMN distancia_metros DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE registros_ponto
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app','kiosk','manual'));

-- jornadas_diarias (001)
CREATE TABLE IF NOT EXISTS jornadas_diarias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id   UUID NOT NULL REFERENCES colaboradores(id),
  empresa_id       UUID NOT NULL REFERENCES empresas(id),
  data             DATE NOT NULL,
  horas_trabalhadas INTERVAL,
  horas_esperadas  INTERVAL,
  saldo_dia        INTERVAL,
  saldo_acumulado  INTERVAL,
  UNIQUE(colaborador_id, data)
);

-- usuarios_rh (001)
CREATE TABLE IF NOT EXISTS usuarios_rh (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL,
  papel       TEXT DEFAULT 'rh' CHECK (papel IN ('admin','rh','gestor'))
);

-- ajustes_ponto (001)
CREATE TABLE IF NOT EXISTS ajustes_ponto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id    UUID NOT NULL REFERENCES registros_ponto(id),
  usuario_rh_id  UUID NOT NULL REFERENCES usuarios_rh(id),
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo     TEXT,
  justificativa  TEXT NOT NULL,
  ajustado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- consentimentos_lgpd (001)
CREATE TABLE IF NOT EXISTS consentimentos_lgpd (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL UNIQUE REFERENCES colaboradores(id) ON DELETE CASCADE,
  aceito_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  versao_termo   TEXT NOT NULL DEFAULT 'v1',
  ip_aceite      TEXT
);

-- modelos_jornada (004 + 007)
CREATE TABLE IF NOT EXISTS modelos_jornada (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                        TEXT NOT NULL,
  hora_entrada                TIME NOT NULL,
  hora_saida                  TIME NOT NULL,
  hora_inicio_almoco          TIME,
  hora_fim_almoco             TIME,
  dias_trabalho               TEXT NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
  carga_horaria_diaria        INTERVAL,
  ativo                       BOOLEAN DEFAULT TRUE,
  criado_em                   TIMESTAMPTZ DEFAULT NOW(),
  tolerancia_entrada_minutos  INTEGER NOT NULL DEFAULT 5,
  tolerancia_saida_minutos    INTEGER NOT NULL DEFAULT 5
);

ALTER TABLE modelos_jornada
  ADD COLUMN IF NOT EXISTS tolerancia_entrada_minutos INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tolerancia_saida_minutos   INTEGER NOT NULL DEFAULT 5;

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS modelo_jornada_id UUID REFERENCES modelos_jornada(id);

-- colaborador_locais (004)
CREATE TABLE IF NOT EXISTS colaborador_locais (
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  local_id       UUID NOT NULL REFERENCES locais_permitidos(id) ON DELETE CASCADE,
  PRIMARY KEY (colaborador_id, local_id)
);

-- feriados (008)
CREATE TABLE IF NOT EXISTS feriados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  data       DATE NOT NULL,
  descricao  TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'nacional',
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feriados_unico
  ON feriados (COALESCE(empresa_id::text, 'nacional'), data);

-- ajustes_banco_horas (009)
CREATE TABLE IF NOT EXISTS ajustes_banco_horas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  minutos        INTEGER NOT NULL,
  descricao      TEXT NOT NULL,
  criado_por     UUID REFERENCES usuarios_rh(id),
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

-- dispositivos_ponto (011 + 012 + 015)
CREATE TABLE IF NOT EXISTS dispositivos_ponto (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  senha      TEXT,
  endereco   TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION
);

ALTER TABLE dispositivos_ponto
  ADD COLUMN IF NOT EXISTS senha    TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng      DOUBLE PRECISION;

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa    ON colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_auth_user  ON colaboradores(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_locais_empresa           ON locais_permitidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_registros_colaborador_data ON registros_ponto(colaborador_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registros_empresa_data   ON registros_ponto(empresa_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registros_status         ON registros_ponto(status);
CREATE INDEX IF NOT EXISTS idx_jornadas_colaborador_data ON jornadas_diarias(colaborador_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_jornadas_empresa_data    ON jornadas_diarias(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_rh_empresa      ON usuarios_rh(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rh_auth_user    ON usuarios_rh(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_registro         ON ajustes_ponto(registro_id);
CREATE INDEX IF NOT EXISTS idx_modelos_jornada_empresa  ON modelos_jornada(empresa_id);
CREATE INDEX IF NOT EXISTS idx_colab_locais_colab       ON colaborador_locais(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colab_locais_local       ON colaborador_locais(local_id);
CREATE INDEX IF NOT EXISTS idx_feriados_empresa         ON feriados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_feriados_data            ON feriados(data);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE empresas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais_permitidos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas_diarias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_rh        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_ponto      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos_lgpd ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_jornada    ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_banco_horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_ponto ENABLE ROW LEVEL SECURITY;

-- Policies (DROP + CREATE para garantir estado correto)

DROP POLICY IF EXISTS "rh_ve_propria_empresa" ON empresas;
CREATE POLICY "rh_ve_propria_empresa" ON empresas FOR SELECT
USING (id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_propria_empresa" ON empresas;
CREATE POLICY "colaborador_ve_propria_empresa" ON empresas FOR SELECT
USING (id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_proprio_perfil" ON colaboradores;
CREATE POLICY "colaborador_ve_proprio_perfil" ON colaboradores FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "rh_gerencia_colaboradores_empresa" ON colaboradores;
CREATE POLICY "rh_gerencia_colaboradores_empresa" ON colaboradores FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_locais_empresa" ON locais_permitidos;
CREATE POLICY "colaborador_ve_locais_empresa" ON locais_permitidos FOR SELECT
USING (empresa_id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_gerencia_locais_empresa" ON locais_permitidos;
CREATE POLICY "rh_gerencia_locais_empresa" ON locais_permitidos FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_proprios_registros" ON registros_ponto;
CREATE POLICY "colaborador_ve_proprios_registros" ON registros_ponto FOR SELECT
USING (colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_ve_registros_empresa" ON registros_ponto;
CREATE POLICY "rh_ve_registros_empresa" ON registros_ponto FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_propria_jornada" ON jornadas_diarias;
CREATE POLICY "colaborador_ve_propria_jornada" ON jornadas_diarias FOR SELECT
USING (colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_ve_jornadas_empresa" ON jornadas_diarias;
CREATE POLICY "rh_ve_jornadas_empresa" ON jornadas_diarias FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_ve_proprio_perfil" ON usuarios_rh;
CREATE POLICY "rh_ve_proprio_perfil" ON usuarios_rh FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_gerencia_rh_empresa" ON usuarios_rh;
CREATE POLICY "admin_gerencia_rh_empresa" ON usuarios_rh FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid() AND papel = 'admin'))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid() AND papel = 'admin'));

DROP POLICY IF EXISTS "rh_ve_ajustes_empresa" ON ajustes_ponto;
CREATE POLICY "rh_ve_ajustes_empresa" ON ajustes_ponto FOR ALL
USING (registro_id IN (
  SELECT r.id FROM registros_ponto r
  WHERE r.empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
));

DROP POLICY IF EXISTS "colaborador_gerencia_proprio_consentimento" ON consentimentos_lgpd;
CREATE POLICY "colaborador_gerencia_proprio_consentimento" ON consentimentos_lgpd FOR ALL
USING (colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()))
WITH CHECK (colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_gerencia_modelos_jornada" ON modelos_jornada;
CREATE POLICY "rh_gerencia_modelos_jornada" ON modelos_jornada FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "colaborador_ve_modelo_jornada" ON modelos_jornada;
CREATE POLICY "colaborador_ve_modelo_jornada" ON modelos_jornada FOR SELECT
USING (empresa_id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_gerencia_colab_locais" ON colaborador_locais;
CREATE POLICY "rh_gerencia_colab_locais" ON colaborador_locais FOR ALL
USING (colaborador_id IN (
  SELECT id FROM colaboradores
  WHERE empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
))
WITH CHECK (colaborador_id IN (
  SELECT id FROM colaboradores
  WHERE empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
));

DROP POLICY IF EXISTS "colaborador_ve_proprios_locais" ON colaborador_locais;
CREATE POLICY "colaborador_ve_proprios_locais" ON colaborador_locais FOR SELECT
USING (colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_gerencia_feriados" ON feriados;
CREATE POLICY "rh_gerencia_feriados" ON feriados FOR ALL
USING (empresa_id IS NULL OR empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "rh_gerencia_ajustes_banco" ON ajustes_banco_horas;
CREATE POLICY "rh_gerencia_ajustes_banco" ON ajustes_banco_horas FOR ALL
USING (colaborador_id IN (
  SELECT c.id FROM colaboradores c
  WHERE c.empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
));

DROP POLICY IF EXISTS "rh_gerencia_dispositivos" ON dispositivos_ponto;
CREATE POLICY "rh_gerencia_dispositivos" ON dispositivos_ponto FOR ALL
USING (empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()));

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-ponto', 'fotos-ponto', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "colaborador_upload_propria_foto" ON storage.objects;
CREATE POLICY "colaborador_upload_propria_foto" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "colaborador_ve_proprias_fotos" ON storage.objects;
CREATE POLICY "colaborador_ve_proprias_fotos" ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "rh_ve_fotos_empresa" ON storage.objects;
CREATE POLICY "rh_ve_fotos_empresa" ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()
  )
);
