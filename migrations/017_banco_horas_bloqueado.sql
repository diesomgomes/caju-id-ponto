ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS banco_horas_bloqueado BOOLEAN NOT NULL DEFAULT false;
