CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  codigo VARCHAR(4) UNIQUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE categorias
ADD COLUMN IF NOT EXISTS codigo VARCHAR(4);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_nombre_lower_unique
ON categorias (LOWER(nombre));

CREATE TABLE IF NOT EXISTS subcategorias (
  id SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(4) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (categoria_id, codigo)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategorias_categoria_nombre_unique
ON subcategorias (categoria_id, LOWER(nombre));
