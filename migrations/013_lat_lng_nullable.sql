ALTER TABLE registros_ponto
  ALTER COLUMN lat_registro DROP NOT NULL,
  ALTER COLUMN lng_registro DROP NOT NULL,
  ALTER COLUMN distancia_metros DROP NOT NULL;
