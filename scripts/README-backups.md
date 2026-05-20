# Backups y restore

## Requisitos

- Tener `pg_dump` y `psql` disponibles en el `PATH`.
- Si no estan en `PATH`, configurar `PG_BIN_DIR` o `POSTGRES_BIN_DIR`.
- Configurar `DATABASE_URL` o las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Generar backup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-postgres.ps1
```

Opciones utiles:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-postgres.ps1 -Label pre-deploy
powershell -ExecutionPolicy Bypass -File .\scripts\backup-postgres.ps1 -OutputDirectory C:\respaldos\marisol
```

El archivo se guarda en `marisolBack/backups/` salvo que se indique otro directorio.
Cada backup genera un companion file `*.meta.json` con `sha256`, tamano, fecha y destino enmascarado.

## Restaurar backup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-postgres.ps1 -BackupFile .\backups\backup_2026-04-01_10-30-00.sql
```

Comportamiento por defecto:
- Genera un backup previo de seguridad (`pre-restore`).
- Ejecuta restore con `ON_ERROR_STOP`.
- Valida al final que existan tablas criticas (`usuarios`, `productos`, `pedidos`, `ventas`).

Opciones utiles:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-postgres.ps1 -BackupFile .\backups\backup.sql -SkipSafetyBackup
powershell -ExecutionPolicy Bypass -File .\scripts\restore-postgres.ps1 -BackupFile .\backups\backup.sql -SkipPostRestoreValidation
```

## Validacion minima post-restore

- Confirmar que el script termine sin errores.
- Verificar `GET /api/readyz`.
- Ejecutar `npm run smoke`.
- Validar login, venta, pedido y stock.

## Recomendacion operativa

- Programar el backup diario en Task Scheduler.
- Conservar varias copias fuera del servidor.
- Probar restore al menos una vez por mes.
- Registrar fecha del ultimo backup exitoso y fecha del ultimo restore validado.
- Pendiente real: el repo no instala `pg_dump` ni `psql`; eso debe resolverse en el servidor/runner operativo.
