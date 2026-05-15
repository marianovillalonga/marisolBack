# Smoke tests

Script: `npm run smoke`

## Requisitos
- Backend levantado y accesible.
- Base con migraciones/aperturas ejecutadas.
- Usuario admin valido.

## Variables
- `SMOKE_BASE_URL`
- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`

## Cobertura
- health check
- login / sesion / logout
- alta, bloqueo y desbloqueo de usuarios
- alta de producto
- alta de cliente
- paginacion de productos, clientes, ventas y pedidos
- venta con impacto en stock
- pedido proveedor con impacto en stock
- pedido cliente con entrega y venta asociada

## Uso
```bash
SMOKE_BASE_URL=http://127.0.0.1:4000 \
SMOKE_ADMIN_EMAIL=admin@tudominio.com \
SMOKE_ADMIN_PASSWORD=tu-password \
npm run smoke
```
