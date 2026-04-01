$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $projectRoot 'backups'
$backupFile = Join-Path $backupDir "backup_$timestamp.sql"

if (-not (Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

if ($env:DATABASE_URL) {
  & pg_dump $env:DATABASE_URL --no-owner --no-privileges --file $backupFile
} else {
  $dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
  $dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
  $dbUser = if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }
  $dbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'postgres' }

  & pg_dump --host $dbHost --port $dbPort --username $dbUser --dbname $dbName --no-owner --no-privileges --file $backupFile
}

Write-Host "Backup generado en: $backupFile"
