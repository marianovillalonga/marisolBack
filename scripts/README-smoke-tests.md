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
```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4000'
$env:SMOKE_ADMIN_EMAIL='admin@tudominio.com'
$env:SMOKE_ADMIN_PASSWORD='tu-password'
npm run smoke
```

## Setup local minimo
1. Levantar Postgres:
```bash
docker compose up -d postgres
```

2. Verificar que el contenedor quede healthy:
```bash
docker compose ps
```

3. Levantar backend:
```bash
npm start
```

4. Validar health:
```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
```

5. Ejecutar smoke:
```powershell
npm run smoke
```
