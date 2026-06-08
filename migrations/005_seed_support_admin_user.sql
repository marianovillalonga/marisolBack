INSERT INTO roles (nombre, descripcion)
SELECT 'admin', 'Acceso total al sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(nombre) = 'admin'
);

INSERT INTO usuarios (
  nombre,
  email,
  password,
  activo,
  fecha_creacion,
  fecha_actualizacion,
  password_actualizada_en
)
VALUES (
  'Soporte',
  'soporte@mariano.com',
  '$2b$10$2j2qWlkcy4c2cAfCWhWPYO3CrLjnmXNyDTcQ3hNan0A7HmwAmA4Q6',
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  password = EXCLUDED.password,
  activo = true,
  fecha_actualizacion = NOW(),
  password_actualizada_en = NOW();

INSERT INTO usuario_roles (usuario_id, rol_id)
SELECT usuarios.id, roles.id
FROM usuarios
CROSS JOIN roles
WHERE LOWER(usuarios.email) = 'soporte@mariano.com'
  AND LOWER(roles.nombre) = 'admin'
ON CONFLICT (usuario_id, rol_id) DO NOTHING;
