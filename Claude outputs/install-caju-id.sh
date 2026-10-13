#!/bin/bash
# =============================================================================
# install-caju-id.sh
# Instalação inicial do CAJU ID em VPS zerada (Ubuntu 22.04+) — Localweb
#
# Este script SÓ prepara o servidor e sobe os containers em modo "isolado":
#   - Instala Docker + Docker Compose
#   - Configura firewall básico (ufw)
#   - Clona o repositório do CAJU ID
#   - Cria os arquivos .env (você preenche os valores)
#   - Builda as imagens Docker
#
# Ele NÃO aponta domínio/DNS e NÃO deixa o nginx-proxy/acme-companion
# tentando emitir certificado SSL ainda — isso fica para quando você
# decidir "puxar o link" (apontar o DNS para este servidor).
#
# Rode como root: bash install-caju-id.sh
# =============================================================================
set -e

REPO_URL="https://github.com/diesomgomes/caju-id-ponto.git"
APP_DIR="$HOME/caju-id"

echo "=============================================="
echo " CAJU ID — instalação em VPS nova (Localweb)"
echo "=============================================="

# --- 1. Atualizar sistema -----------------------------------------------
echo ""
echo "==> [1/6] Atualizando pacotes do sistema..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw ca-certificates gnupg

# --- 2. Instalar Docker + Docker Compose --------------------------------
echo ""
echo "==> [2/6] Instalando Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker já instalado, pulando."
fi

systemctl enable docker
systemctl start docker

echo "Versões instaladas:"
docker --version
docker compose version

# --- 3. Firewall básico ---------------------------------------------------
echo ""
echo "==> [3/6] Configurando firewall (ufw)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

# --- 4. Clonar o repositório ----------------------------------------------
echo ""
echo "==> [4/6] Clonando o repositório..."
if [ -d "$APP_DIR" ]; then
  echo "Diretório $APP_DIR já existe. Pulando clone (rode 'git pull' manualmente se quiser atualizar)."
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# --- 5. Criar arquivos de ambiente -----------------------------------------
echo ""
echo "==> [5/6] Criando arquivos .env a partir dos exemplos..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  -> Criado .env (raiz). PREENCHA antes de subir os containers:"
  echo "     nano $APP_DIR/.env"
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "  -> Criado backend/.env. PREENCHA com as credenciais do Supabase de produção:"
  echo "     nano $APP_DIR/backend/.env"
fi

# --- 6. Build das imagens (sem subir ainda) --------------------------------
echo ""
echo "==> [6/6] Buildando as imagens Docker (ainda sem subir os containers)..."
docker compose build

echo ""
echo "=============================================="
echo " ✓ Instalação base concluída!"
echo "=============================================="
echo ""
echo "Próximos passos (faça agora, antes de subir):"
echo ""
echo "  1) Preencha $APP_DIR/.env com:"
echo "     - HOST_RH / HOST_APP / HOST_API  -> pode deixar os mesmos domínios"
echo "       de produção por enquanto (não vamos apontar o DNS ainda)"
echo "     - SSL_EMAIL"
echo "     - SUPABASE_URL / SUPABASE_ANON_KEY  (mesmos do Supabase atual)"
echo ""
echo "  2) Preencha $APP_DIR/backend/.env com:"
echo "     - SUPABASE_URL"
echo "     - SUPABASE_SERVICE_ROLE_KEY  (mesmo do Supabase atual)"
echo "     - TZ_DEFAULT=America/Sao_Paulo"
echo ""
echo "  3) Quando quiser só TESTAR local (sem DNS apontado), suba os containers:"
echo "     cd $APP_DIR && docker compose up -d"
echo "     docker compose ps"
echo ""
echo "     Obs: o acme-companion vai tentar emitir certificado SSL e vai"
echo "     falhar/repetir silenciosamente até o DNS apontar pra cá — isso"
echo "     é normal e não trava o resto da stack. Para testar sem SSL,"
echo "     acesse via túnel SSH ou pela porta interna do backend:"
echo "       ssh -L 8000:localhost:8000 root@$(curl -s ifconfig.me 2>/dev/null || echo SEU_IP)"
echo "       depois abra http://localhost:8000/docs no seu navegador"
echo ""
echo "  4) Só quando decidir migrar de vez: aponte os registros DNS"
echo "     (HOST_RH, HOST_APP, HOST_API) para o IP desta VPS e aguarde"
echo "     a propagação — o SSL sai sozinho depois disso."
echo ""
