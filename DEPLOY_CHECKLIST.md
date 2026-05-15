# Deploy Checklist

## Antes de deploy
- Confirmar `AUTH_SECRET`, `DATABASE_URL` o `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
- Confirmar `FRONTEND_URLS`, `DB_SSL`, `LOG_LEVEL`
- Ejecutar `npm test`
- Verificar `/api/health`
- Tener backup reciente de la base
- Tener release anterior identificada para rollback

## Deploy
- Deploy backend
- Verificar logs de arranque
- Verificar `GET /api/health`
- Ejecutar `npm run smoke`

## Rollback
- Si falla `health`, `login`, `auth/me`, `sales`, `orders` o `stock`, volver a la release anterior
- Repetir smoke despues del rollback
