# CAJU ID — Ponto Eletrônico

Sistema completo de controle de ponto eletrônico com:
- **Painel RH** — gestão de colaboradores, jornadas, registros e relatórios
- **PWA Colaborador** — app de ponto no celular com GPS e selfie
- **Kiosk** — dispositivo fixo de ponto com QR Code ou CPF
- **Backend FastAPI** — API REST com Supabase como banco de dados

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar projeto no Supabase](#2-criar-projeto-no-supabase)
3. [Rodar as migrations](#3-rodar-as-migrations)
4. [Configurar o Storage](#4-configurar-o-storage)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Rodar localmente](#6-rodar-localmente)
7. [Deploy em VPS com Docker](#7-deploy-em-vps-com-docker)
8. [Configurar domínio e SSL](#8-configurar-domínio-e-ssl)
9. [Criar o primeiro acesso (admin)](#9-criar-o-primeiro-acesso-admin)
10. [Atualizar o sistema](#10-atualizar-o-sistema)

---

## 1. Pré-requisitos

### Para rodar localmente
- [Node.js](https://nodejs.org) 18+
- [Python](https://python.org) 3.11+
- [Git](https://git-scm.com)

### Para deploy em VPS
- VPS com Ubuntu 22.04+
- [Docker](https://docs.docker.com/engine/install/ubuntu/) + [Docker Compose](https://docs.docker.com/compose/install/)
- Domínio com acesso ao painel DNS

---

## 2. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New Project** e preencha:
   - Nome do projeto
   - Senha do banco (guarde — não será necessária depois)
   - Região: **South America (São Paulo)**
3. Aguarde o projeto inicializar (~2 min)
4. Vá em **Project Settings → API** e copie:
   - `Project URL` → será seu `SUPABASE_URL`
   - `anon public` → será seu `SUPABASE_ANON_KEY`
   - `service_role secret` → será seu `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca exponha publicamente

---

## 3. Rodar as migrations

As migrations ficam na pasta `migrations/`. Devem ser executadas **em ordem** no **SQL Editor** do Supabase (`SQL Editor → New query`).

Execute uma por vez, na sequência:

| Arquivo | Descrição |
|---|---|
| `001_initial.sql` | Tabelas principais, índices, RLS e bucket de storage |
| `002_seed_test.sql` | Dados de exemplo (empresa e usuário admin de teste) |
| `003_jornada_config.sql` | Configuração de jornada de trabalho |
| `004_modelos_jornada_locais_colab.sql` | Modelos de jornada e locais permitidos |
| `005_empresa_endereco_colaborador_pis.sql` | Endereço da empresa e PIS do colaborador |
| `006_empresa_logo.sql` | Logo da empresa |
| `007_tolerancia_jornada.sql` | Tolerância em minutos por jornada |
| `008_feriados.sql` | Tabela de feriados nacionais e sincronização |
| `009_ajustes_banco_horas.sql` | Ajustes manuais de banco de horas |
| `010_login_config.sql` | Configuração visual da tela de login do painel RH |
| `011_dispositivos_ponto.sql` | Dispositivos kiosk com token único |
| `012_dispositivo_senha.sql` | PIN de acesso ao dispositivo kiosk |
| `013_lat_lng_nullable.sql` | Torna lat/lng opcionais no registro de ponto |
| `014_colaborador_modo_ponto.sql` | Modo de ponto por colaborador (app/kiosk/ambos) |
| `015_dispositivo_localizacao.sql` | Endereço e coordenadas do dispositivo físico |

> **Dica:** copie o conteúdo de cada arquivo e cole no SQL Editor, clique em **Run**.

---

## 4. Configurar o Storage

A migration `001` já cria o bucket `fotos-ponto`. Verifique em **Storage** no painel do Supabase se ele aparece. Caso não apareça, crie manualmente:

1. Vá em **Storage → New bucket**
2. Nome: `fotos-ponto`
3. Marque **Public bucket**: ❌ (deixe privado)
4. Clique em **Save**

---

## 5. Variáveis de ambiente

### Backend — `backend/.env`

Crie o arquivo copiando o exemplo:
```bash
cp backend/.env.example backend/.env
```

Preencha:
```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
TZ_DEFAULT=America/Sao_Paulo
```

### Raiz do projeto — `.env` (somente para deploy com Docker)

Crie o arquivo copiando o exemplo:
```bash
cp .env.example .env
```

Preencha:
```env
HOST_RH=cajuid.seudominio.com.br
HOST_APP=cajuidapp.seudominio.com.br
HOST_API=cajuidapi.seudominio.com.br
SSL_EMAIL=seu@email.com
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Frontend local — `painel-rh/public/config.js`

Para rodar o painel RH localmente, edite:
```js
window.__API_URL__ = 'http://localhost:8000';
```

---

## 6. Rodar localmente

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

A API ficará disponível em: `http://localhost:8000`
Documentação interativa: `http://localhost:8000/docs`

### Painel RH

```bash
cd painel-rh
npm install
npm run dev
```

Acesse: `http://localhost:5173`

### PWA Colaborador

```bash
cd pwa-colaborador
npm install
npm run dev
```

Acesse: `http://localhost:5174`

> **Atenção:** a câmera e o GPS do PWA exigem HTTPS em produção. Localmente funcionam apenas em `localhost`.

---

## 7. Deploy em VPS com Docker

### 7.1 Instalar Docker na VPS

```bash
curl -fsSL https://get.docker.com | sh
```

### 7.2 Clonar o repositório

```bash
git clone https://github.com/seu-usuario/caju-id.git ~/caju-id
cd ~/caju-id
```

### 7.3 Criar os arquivos de ambiente

```bash
cp .env.example .env
nano .env                    # preencha com seus dados

cp backend/.env.example backend/.env
nano backend/.env            # preencha com URL e SERVICE_ROLE do Supabase
```

### 7.4 Subir os containers

```bash
docker compose up -d --build
```

Isso irá subir:
- `nginx-proxy` — reverse proxy automático
- `acme-companion` — SSL automático via Let's Encrypt
- `backend` — API FastAPI
- `pwa` — PWA do colaborador
- `painel-rh` — painel de gestão

### 7.5 Verificar se está rodando

```bash
docker compose ps
```

Todos os containers devem aparecer como `running`.

### 7.6 Ver logs

```bash
# Todos os serviços
docker compose logs -f

# Apenas o backend
docker compose logs backend --tail=50

# Apenas o nginx (para diagnosticar SSL)
docker compose logs acme-companion --tail=30
```

---

## 8. Configurar domínio e SSL

### 8.1 Apontar DNS

No painel do seu registrador de domínio, crie 3 registros tipo **A** apontando para o IP da VPS:

```
cajuid.seudominio.com.br     →  IP_DA_VPS
cajuidapp.seudominio.com.br  →  IP_DA_VPS
cajuidapi.seudominio.com.br  →  IP_DA_VPS
```

> A propagação do DNS pode levar de 5 minutos a 24 horas.

### 8.2 SSL automático

O SSL é gerado automaticamente pelo `acme-companion` assim que o DNS propagar. Não há configuração adicional. Verifique com:

```bash
docker compose logs acme-companion --tail=50
```

Procure por linhas `Installing cert to:` — indicam que o certificado foi gerado com sucesso.

---

## 9. Criar o primeiro acesso (admin)

A migration `002_seed_test.sql` cria uma empresa e usuário de demonstração. Para usar em produção:

1. Acesse o **painel RH** → Login com as credenciais do seed
2. Vá em **Configurações → Empresa** e atualize os dados reais
3. Crie novos usuários RH em **Configurações → Usuários**
4. Desative ou remova o usuário de demonstração

Alternativamente, crie um usuário diretamente no Supabase:
1. Vá em **Authentication → Users → Add user**
2. Preencha email e senha
3. No **SQL Editor**, vincule o usuário à empresa:
```sql
INSERT INTO usuarios_rh (id, nome, email, empresa_id, perfil)
VALUES (
  '<UUID_DO_USUARIO_NO_AUTH>',
  'Administrador',
  'admin@suaempresa.com.br',
  '<UUID_DA_EMPRESA>',
  'admin'
);
```

---

## 10. Atualizar o sistema

Para aplicar novas atualizações na VPS:

```bash
cd ~/caju-id
git pull origin main
docker compose up -d --build
```

Se houver novas migrations (novos arquivos em `migrations/`), execute-as no SQL Editor do Supabase antes ou após o deploy.

---

## Estrutura do projeto

```
caju-id/
├── backend/              # API FastAPI (Python)
│   ├── routers/          # Endpoints: ponto, rh, kiosk
│   ├── services/         # Lógica: hash, storage, jornada
│   ├── db/               # Cliente Supabase
│   └── main.py
├── painel-rh/            # Painel RH (React + Vite + Tailwind)
│   └── src/pages/        # Dashboard, Colaboradores, Dispositivos...
├── pwa-colaborador/      # PWA do colaborador (React + Vite)
├── migrations/           # SQLs do banco (executar em ordem)
├── docker-compose.yml    # Orquestração dos containers
├── .env.example          # Modelo de variáveis de ambiente
└── README.md
```

---

## Suporte

Dúvidas ou problemas: abra uma issue no repositório ou entre em contato com o desenvolvedor.
