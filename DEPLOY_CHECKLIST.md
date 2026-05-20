# Deploy Checklist

## Antes de deploy
- Confirmar `AUTH_SECRET`, `DATABASE_URL` o `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
- Confirmar `FRONTEND_URLS`, `DB_SSL`, `LOG_LEVEL`, `RESEND_API_KEY`, `MAIL_FROM`
- Ejecutar `npm run migrate`
- Ejecutar `npm test`
- Verificar `GET /api/health` y que responda `200` con `checks.database=ok` y `checks.config=ok`
- Verificar `GET /api/livez` para liveness y `GET /api/readyz` para readiness
- Tener backup reciente de la base
- Confirmar que `pg_dump` y `psql` existan en el entorno, o configurar `PG_BIN_DIR`
- Probar restore en entorno no productivo con `scripts/restore-postgres.ps1`
- Tener release anterior identificada para rollback

## Deploy
- Deploy backend
- Verificar logs de arranque
- Verificar `GET /api/health`
- Verificar `GET /api/livez`
- Verificar `GET /api/readyz`
- Verificar login admin
- Verificar `GET /api/auth/me` con sesion valida
- Ejecutar `npm run smoke`

## Rollback
- Si falla `health`, `login`, `auth/me`, `sales`, `orders` o `stock`, volver a la release anterior
- Repetir smoke despues del rollback

## Alertas minimas esperadas
- Backend sin respuesta
- `GET /api/livez` sin respuesta
- `GET /api/health` con `503`
- `GET /api/readyz` con `503`
- Base de datos inaccesible
- Pico anormal de `request_failed`
- Latencia anormal en `checks.database.latencyMs`
- Disco lleno
- Backup ausente o backup fallido
