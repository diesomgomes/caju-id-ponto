ALTER TABLE empresas ADD COLUMN IF NOT EXISTS login_config JSONB DEFAULT '{}'::jsonb;
