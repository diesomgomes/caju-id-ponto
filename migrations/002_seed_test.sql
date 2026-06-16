-- =============================================================================
-- SEED de teste — apagar antes de ir para produção
-- PASSO 1: Crie os usuários no Supabase Auth (Dashboard → Authentication → Users)
--   Usuário colaborador: colaborador@teste.com  senha: Teste@123
--   Usuário RH:          rh@teste.com           senha: Teste@123
-- PASSO 2: Copie os UUIDs gerados e cole nos dois UPDATE abaixo.
-- PASSO 3: Rode este script no SQL Editor do Supabase.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Empresa de teste
-- ----------------------------------------------------------------------------
INSERT INTO empresas (id, nome, cnpj, lat_sede, lng_sede, raio_metros, carga_horaria_diaria)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'CAJU ID Tecnologia Ltda',
  '00.000.000/0001-00',
  -23.5505,    -- São Paulo centro (Praça da Sé)
  -46.6333,
  200,
  '08:00:00'
)
ON CONFLICT (cnpj) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Locais permitidos
-- ----------------------------------------------------------------------------
INSERT INTO locais_permitidos (empresa_id, nome, lat, lng, raio_metros)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sede',          -23.5505, -46.6333, 200),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Filial Norte',  -23.5329, -46.6395, 150),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Home Office',    -23.5606, -46.6560, 500)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Colaborador de teste (auth_user_id preenchido após criar no Auth)
-- ----------------------------------------------------------------------------
INSERT INTO colaboradores (id, empresa_id, auth_user_id, nome, cpf, email, cargo, carga_horaria_diaria)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  NULL,   -- <-- Cole aqui o UUID do usuário "colaborador@teste.com"
  'João Silva (TESTE)',
  '000.000.000-00',
  'colaborador@teste.com',
  'Analista de Sistemas',
  NULL    -- herda carga_horaria_diaria da empresa (8h)
)
ON CONFLICT (cpf) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Usuário RH de teste
-- ----------------------------------------------------------------------------
INSERT INTO usuarios_rh (id, empresa_id, auth_user_id, nome, email, papel)
VALUES (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  NULL,   -- <-- Cole aqui o UUID do usuário "rh@teste.com"
  'Ana RH (TESTE)',
  'rh@teste.com',
  'admin'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- PASSO 2: após criar os usuários no Auth, rode os dois UPDATE abaixo
-- substituindo os UUIDs pelos reais.
-- ----------------------------------------------------------------------------

-- UPDATE colaboradores
--   SET auth_user_id = 'UUID-DO-COLABORADOR-AQUI'
-- WHERE email = 'colaborador@teste.com';

-- UPDATE usuarios_rh
--   SET auth_user_id = 'UUID-DO-RH-AQUI'
-- WHERE email = 'rh@teste.com';

-- ----------------------------------------------------------------------------
-- Consentimento LGPD do colaborador de teste (pula a tela no primeiro acesso)
-- Execute só DEPOIS de vincular auth_user_id acima.
-- ----------------------------------------------------------------------------

-- INSERT INTO consentimentos_lgpd (colaborador_id, versao_termo, ip_aceite)
-- VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'v1', '127.0.0.1')
-- ON CONFLICT DO NOTHING;
