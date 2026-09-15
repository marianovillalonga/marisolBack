INSERT INTO roles (nombre, descripcion)
SELECT 'admin', 'Acceso total al sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(nombre) = 'admin'
);
