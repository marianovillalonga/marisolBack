# Marisol Back

Backend en Node.js + Express + PostgreSQL para operaciones comerciales: auth, usuarios, productos, clientes, ventas, pedidos, presupuestos y observabilidad minima operativa.

## Stack real
- Node.js
- Express
- PostgreSQL
- JWT en cookie HttpOnly
- SQL directo con `pg`
- PowerShell para operaciones locales de backup/restore

## Comandos
- `npm install`
- `npm test`
- `npm run migrate`
- `npm run smoke`
- `npm start`

## Endpoints operativos
- `GET /api/livez`
- `GET /api/readyz`
- `GET /api/health`

## Requisitos operativos reales
- Mail provider configurado en produccion:
  - `RESEND_API_KEY` + `MAIL_FROM`, o
  - `SMTP_HOST` + `SMTP_PORT` + `SMTP_USER` + `SMTP_PASS` + `MAIL_FROM`
- `FRONTEND_URLS` correcto para CORS/CSRF
- `pg_dump` y `psql` disponibles para backup/restore, o `PG_BIN_DIR`

## Documentacion de salida
- [DEPLOY_CHECKLIST.md](/C:/Users/Mariano/OneDrive/Desktop/Nueva%20carpeta/marisolBack/DEPLOY_CHECKLIST.md)
- [RUNBOOK_PILOTO.md](/C:/Users/Mariano/OneDrive/Desktop/Nueva%20carpeta/marisolBack/RUNBOOK_PILOTO.md)
- [RELEASE_CHECKLIST.md](/C:/Users/Mariano/OneDrive/Desktop/Nueva%20carpeta/marisolBack/RELEASE_CHECKLIST.md)
- [scripts/README-backups.md](/C:/Users/Mariano/OneDrive/Desktop/Nueva%20carpeta/marisolBack/scripts/README-backups.md)

## Limite honesto
El backend queda apto para piloto y venta inicial controlada si pasan smoke, E2E, health, backup y restore. No esta presentado como backend listo para escalado fuerte o operacion enterprise sin una fase posterior.
