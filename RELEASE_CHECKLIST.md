# Release Checklist

## Gate tecnico minimo
- `npm test` en backend
- `npm run build` en frontend
- `npm run test:run` en frontend
- `npm run test:e2e` en frontend
- `npm run smoke` en backend

## Gate operativo minimo
- `GET /api/livez` responde `200`
- `GET /api/readyz` responde `200`
- `GET /api/health` responde `200`
- `checks.config.status=ok`
- `checks.database.status=ok`
- `checks.database.latencyMs` sin degradacion anormal
- `requestId` presente en respuestas y logs

## Gate de seguridad minimo
- `AUTH_SECRET` productivo configurado
- `FRONTEND_URLS` productivos configurados
- `RESEND_API_KEY` configurado en produccion
- `MAIL_FROM` configurado en produccion
- Password reset validado en entorno real
- Cookies y CORS verificados en dominio final

## Gate de datos y recuperacion
- Backup previo al deploy ejecutado
- Restore probado al menos una vez en entorno no productivo
- `pg_dump` y `psql` disponibles o `PG_BIN_DIR` configurado
- Release anterior identificada para rollback

## Smoke comercial minimo
- Login admin
- Login invalido
- Crear venta
- Crear pedido
- Confirmar entrega si aplica
- Verificar stock antes y despues
- Probar impresion
- Solicitar y completar reset password
- Revisar logs sin errores criticos

## Apto para venta inicial controlada si
- Todo el gate anterior esta verde
- Hay soporte cercano del equipo
- Hay monitoreo basico del backend y readiness
- Hay backup y restore operables

## No vender como producto abierto o masivo si
- El restore nunca fue probado
- No hay monitoreo externo real
- No hay mail real en produccion
- El smoke no pasa completo
- La operacion depende de intervencion manual ad-hoc

## Limites conocidos honestos
- El sistema esta preparado para piloto y venta inicial controlada, no para escalado fuerte ni operacion enterprise.
- La observabilidad queda lista a nivel de app, pero la infraestructura externa de alertas sigue siendo responsabilidad del entorno.
- Backup/restore estan resueltos a nivel de scripts, pero requieren `pg_dump`/`psql` en el servidor o runner.
