#!/bin/bash
# deploy.sh — rode na VPS após clonar o repositório
set -e

echo "==> Verificando dependências..."
command -v docker >/dev/null 2>&1 || { echo "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Docker Compose não encontrado."; exit 1; }

echo "==> Verificando .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  ATENÇÃO: Arquivo .env criado a partir do exemplo."
  echo "  Edite o arquivo .env com seus dados antes de continuar:"
  echo "    nano .env"
  echo ""
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo ""
  echo "  ATENÇÃO: backend/.env não encontrado."
  echo "  Crie o arquivo com as credenciais do Supabase:"
  echo "    nano backend/.env"
  echo ""
  echo "  Conteúdo necessário:"
  echo "    SUPABASE_URL=https://..."
  echo "    SUPABASE_SERVICE_ROLE_KEY=..."
  echo "    SUPABASE_ANON_KEY=..."
  echo "    TZ_DEFAULT=America/Sao_Paulo"
  echo ""
  exit 1
fi

echo "==> Baixando imagens e buildando..."
docker compose pull nginx-proxy acme-companion
docker compose build

echo "==> Iniciando serviços..."
docker compose up -d

echo ""
echo "✓ Deploy concluído!"
echo ""
source .env 2>/dev/null || true
echo "  PWA Colaborador : https://app.${DOMAIN}"
echo "  Painel RH       : https://rh.${DOMAIN}"
echo "  API             : https://api.${DOMAIN}/health"
echo ""
echo "  Aguarde ~1 minuto para o SSL ser emitido automaticamente."
echo ""
echo "Logs: docker compose logs -f"
