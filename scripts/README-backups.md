# Backups y restore

## Requisitos

- Tener `pg_dump` y `psql` disponibles en el `PATH`.
- Configurar `DATABASE_URL` o las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Generar backup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-postgres.ps1
```

El archivo se guarda en `marisolBack/backups/`.

## Restaurar backup

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-postgres.ps1 -BackupFile .\backups\backup_2026-04-01_10-30-00.sql
```

## Recomendacion operativa

- Programar el backup diario en Task Scheduler.
- Conservar varias copias fuera del servidor.
- Probar restore al menos una vez por mes.
