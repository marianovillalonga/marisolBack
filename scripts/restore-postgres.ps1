param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupFile)) {
  throw "No existe el archivo de backup: $BackupFile"
}

if ($env:DATABASE_URL) {
  & psql $env:DATABASE_URL --file $BackupFile
} else {
  $dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
  $dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
  $dbUser = if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }
  $dbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'postgres' }

  & psql --host $dbHost --port $dbPort --username $dbUser --dbname $dbName --file $BackupFile
}

Write-Host "Restore completado desde: $BackupFile"
