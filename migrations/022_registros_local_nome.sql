-- Adiciona coluna local_nome em registros_ponto para registros via kiosk
-- (kiosk não tem local_permitido_id, mas pode ter nome do local/dispositivo)
ALTER TABLE registros_ponto
  ADD COLUMN IF NOT EXISTS local_nome TEXT;
