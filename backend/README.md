# Backend — Ponto Eletrônico

## Setup local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# edite .env com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
uvicorn main:app --reload --port 8000
```

Health check: http://localhost:8000/health
Docs interativas (Swagger): http://localhost:8000/docs

## Endpoint principal — POST /ponto/registrar

Headers:
- `Authorization: Bearer <jwt_supabase_do_colaborador>`

Body (multipart/form-data):
- `tipo` — `entrada` | `saida_almoco` | `retorno_almoco` | `saida`
- `lat` — float
- `lng` — float
- `foto` — arquivo JPEG ou PNG, até 2MB

O endpoint:
1. Valida o JWT contra o Supabase Auth e localiza o colaborador.
2. Calcula a distância (Haversine) para todos os `locais_permitidos` da empresa
   (ou usa `lat_sede`/`lng_sede` como fallback).
3. Valida a sequência de batidas do dia (timezone `America/Sao_Paulo`).
4. Faz upload da selfie para `fotos-ponto/{empresa_id}/{colaborador_id}/{ts}.jpg`.
5. Calcula hash SHA-256 encadeado com o registro anterior do mesmo colaborador.
6. Insere o registro (`valido` ou `rejeitado` — registros fora da área ou
   fora de sequência são salvos para auditoria).
7. Se for `saida` válida, recalcula a jornada do dia em `jornadas_diarias`.

## Pré-requisitos no Supabase

- Migration `001_initial.sql` aplicada.
- Bucket `fotos-ponto` criado (a migration cria).
- Pelo menos uma `empresa` cadastrada com `lat_sede`/`lng_sede` ou um
  `locais_permitidos` ativo.
- Colaborador com `auth_user_id` vinculado a um usuário no Supabase Auth.
