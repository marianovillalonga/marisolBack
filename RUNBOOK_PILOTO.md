# Runbook de Piloto Comercial

## Antes de deploy
- Confirmar `npm test` en backend.
- Confirmar `npm run build` y `npm run test:run` en frontend.
- Ejecutar `npm run migrate`.
- Confirmar backup reciente antes del deploy.
- Verificar `GET /api/health` con `checks.config=ok` y `checks.database=ok`.

## Smoke minimo post deploy
- Login admin.
- Login invalido.
- Crear producto.
- Crear cliente.
- Crear venta.
- Crear pedido.
- Confirmar entrega de pedido.
- Verificar stock antes y despues.
- Solicitar reset password.
- Validar impresion de venta/presupuesto desde frontend.
- Revisar logs de error y `requestId`.

## Restore / rollback
- Restaurar release anterior si falla `health`, `login`, `sales`, `orders` o `stock`.
- Repetir smoke basico despues del rollback.
- Si hay corrupcion de datos, restaurar backup en entorno seguro antes de volver a produccion.

## Incidente de caida
- Verificar `GET /api/health`.
- Verificar conectividad a base.
- Revisar `logs/error.log`.
- Confirmar espacio en disco.
- Confirmar que el proceso backend siga vivo.

## Incidente de perdida de datos
- Congelar cambios operativos.
- Tomar backup actual antes de cualquier restore.
- Restaurar en entorno aislado para validar integridad.
- Comparar ultimo backup sano contra produccion.
- Definir restore parcial o total segun alcance.

## Alertas minimas recomendadas
- Backend caido.
- `health` en `503`.
- Base no disponible.
- Error rate alto.
- Disco lleno.
- Backup fallido o backup sin ejecucion diaria.
