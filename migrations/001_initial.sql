-- =============================================================================
-- Ponto Eletrônico — Migration inicial
-- Tabelas, índices, bucket de storage e Row Level Security
-- Execute no SQL Editor do Supabase (uma vez).
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABELAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  lat_sede NUMERIC(10, 7),
  lng_sede NUMERIC(10, 7),
  raio_metros INTEGER DEFAULT 100,
  carga_horaria_diaria INTERVAL DEFAULT '08:00:00',
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  cargo TEXT,
  carga_horaria_diaria INTERVAL,
  foto_perfil_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_auth_user ON colaboradores(auth_user_id);

CREATE TABLE IF NOT EXISTS locais_permitidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  raio_metros INTEGER DEFAULT 100,
  ativo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_locais_empresa ON locais_permitidos(empresa_id);

CREATE TABLE IF NOT EXISTS registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida_almoco','retorno_almoco','saida')),
  lat_registro NUMERIC(10, 7) NOT NULL,
  lng_registro NUMERIC(10, 7) NOT NULL,
  distancia_metros NUMERIC(8, 2),
  local_permitido_id UUID REFERENCES locais_permitidos(id),
  foto_url TEXT NOT NULL,
  ip_dispositivo TEXT,
  user_agent TEXT,
  hash_integridade TEXT,
  hash_anterior TEXT,
  status TEXT DEFAULT 'valido' CHECK (status IN ('valido','rejeitado','pendente')),
  motivo_rejeicao TEXT,
  registrado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registros_colaborador_data
  ON registros_ponto(colaborador_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registros_empresa_data
  ON registros_ponto(empresa_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registros_status ON registros_ponto(status);

CREATE TABLE IF NOT EXISTS jornadas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  data DATE NOT NULL,
  horas_trabalhadas INTERVAL,
  horas_esperadas INTERVAL,
  saldo_dia INTERVAL,
  saldo_acumulado INTERVAL,
  UNIQUE(colaborador_id, data)
);

CREATE INDEX IF NOT EXISTS idx_jornadas_colaborador_data
  ON jornadas_diarias(colaborador_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_jornadas_empresa_data
  ON jornadas_diarias(empresa_id, data DESC);

CREATE TABLE IF NOT EXISTS usuarios_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  papel TEXT DEFAULT 'rh' CHECK (papel IN ('admin','rh','gestor'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rh_empresa ON usuarios_rh(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rh_auth_user ON usuarios_rh(auth_user_id);

-- Log de auditoria para alterações manuais (exigência Portaria MTP 671/2021)
CREATE TABLE IF NOT EXISTS ajustes_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id UUID NOT NULL REFERENCES registros_ponto(id),
  usuario_rh_id UUID NOT NULL REFERENCES usuarios_rh(id),
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  justificativa TEXT NOT NULL,
  ajustado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_registro ON ajustes_ponto(registro_id);

-- Consentimento LGPD (foto biométrica — art. 11)
CREATE TABLE IF NOT EXISTS consentimentos_lgpd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL UNIQUE REFERENCES colaboradores(id) ON DELETE CASCADE,
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  versao_termo TEXT NOT NULL DEFAULT 'v1',
  ip_aceite TEXT
);

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-ponto', 'fotos-ponto', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais_permitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_rh ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos_lgpd ENABLE ROW LEVEL SECURITY;

-- ---------- empresas ----------
DROP POLICY IF EXISTS "rh_ve_propria_empresa" ON empresas;
CREATE POLICY "rh_ve_propria_empresa"
ON empresas FOR SELECT
USING (
  id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "colaborador_ve_propria_empresa" ON empresas;
CREATE POLICY "colaborador_ve_propria_empresa"
ON empresas FOR SELECT
USING (
  id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid())
);

-- ---------- colaboradores ----------
DROP POLICY IF EXISTS "colaborador_ve_proprio_perfil" ON colaboradores;
CREATE POLICY "colaborador_ve_proprio_perfil"
ON colaboradores FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "rh_gerencia_colaboradores_empresa" ON colaboradores;
CREATE POLICY "rh_gerencia_colaboradores_empresa"
ON colaboradores FOR ALL
USING (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

-- ---------- locais_permitidos ----------
DROP POLICY IF EXISTS "colaborador_ve_locais_empresa" ON locais_permitidos;
CREATE POLICY "colaborador_ve_locais_empresa"
ON locais_permitidos FOR SELECT
USING (
  empresa_id IN (SELECT empresa_id FROM colaboradores WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "rh_gerencia_locais_empresa" ON locais_permitidos;
CREATE POLICY "rh_gerencia_locais_empresa"
ON locais_permitidos FOR ALL
USING (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

-- ---------- registros_ponto ----------
DROP POLICY IF EXISTS "colaborador_ve_proprios_registros" ON registros_ponto;
CREATE POLICY "colaborador_ve_proprios_registros"
ON registros_ponto FOR SELECT
USING (
  colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "rh_ve_registros_empresa" ON registros_ponto;
CREATE POLICY "rh_ve_registros_empresa"
ON registros_ponto FOR ALL
USING (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

-- ---------- jornadas_diarias ----------
DROP POLICY IF EXISTS "colaborador_ve_propria_jornada" ON jornadas_diarias;
CREATE POLICY "colaborador_ve_propria_jornada"
ON jornadas_diarias FOR SELECT
USING (
  colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "rh_ve_jornadas_empresa" ON jornadas_diarias;
CREATE POLICY "rh_ve_jornadas_empresa"
ON jornadas_diarias FOR ALL
USING (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid())
);

-- ---------- usuarios_rh ----------
DROP POLICY IF EXISTS "rh_ve_proprio_perfil" ON usuarios_rh;
CREATE POLICY "rh_ve_proprio_perfil"
ON usuarios_rh FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_gerencia_rh_empresa" ON usuarios_rh;
CREATE POLICY "admin_gerencia_rh_empresa"
ON usuarios_rh FOR ALL
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios_rh
    WHERE auth_user_id = auth.uid() AND papel = 'admin'
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM usuarios_rh
    WHERE auth_user_id = auth.uid() AND papel = 'admin'
  )
);

-- ---------- ajustes_ponto ----------
DROP POLICY IF EXISTS "rh_ve_ajustes_empresa" ON ajustes_ponto;
CREATE POLICY "rh_ve_ajustes_empresa"
ON ajustes_ponto FOR ALL
USING (
  registro_id IN (
    SELECT r.id FROM registros_ponto r
    WHERE r.empresa_id IN (
      SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()
    )
  )
);

-- ---------- consentimentos_lgpd ----------
DROP POLICY IF EXISTS "colaborador_gerencia_proprio_consentimento" ON consentimentos_lgpd;
CREATE POLICY "colaborador_gerencia_proprio_consentimento"
ON consentimentos_lgpd FOR ALL
USING (
  colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  colaborador_id IN (SELECT id FROM colaboradores WHERE auth_user_id = auth.uid())
);

-- =============================================================================
-- STORAGE POLICIES — bucket fotos-ponto
-- =============================================================================
-- Convenção de path: {empresa_id}/{colaborador_id}/{timestamp}.jpg
-- storage.foldername(name) retorna array com os segmentos do path.

DROP POLICY IF EXISTS "colaborador_upload_propria_foto" ON storage.objects;
CREATE POLICY "colaborador_upload_propria_foto"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "colaborador_ve_proprias_fotos" ON storage.objects;
CREATE POLICY "colaborador_ve_proprias_fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT id FROM colaboradores WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "rh_ve_fotos_empresa" ON storage.objects;
CREATE POLICY "rh_ve_fotos_empresa"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-ponto'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT empresa_id FROM usuarios_rh WHERE auth_user_id = auth.uid()
  )
);
