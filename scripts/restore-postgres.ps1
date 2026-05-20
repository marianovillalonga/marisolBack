param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$SkipSafetyBackup,
  [switch]$SkipPostRestoreValidation
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'postgres-common.ps1')

$resolvedBackupFile = Resolve-Path -LiteralPath $BackupFile
$target = Get-DatabaseTarget
$psqlExecutable = Resolve-PostgresCommand -CommandName 'psql'

if (-not $SkipSafetyBackup) {
  Write-Host 'Generando backup de seguridad previo al restore...'
  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-postgres.ps1') -Label 'pre-restore'

  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo generar el backup previo al restore.'
  }
}

Write-Host "Restaurando backup desde: $resolvedBackupFile"
Write-Host "Destino: $($target.MaskedTarget)"

Invoke-PostgresCommand `
  -Executable $psqlExecutable `
  -Target $target `
  -Arguments @(
    '--set', 'ON_ERROR_STOP=1',
    '--single-transaction',
    '--file', $resolvedBackupFile
  )

if (-not $SkipPostRestoreValidation) {
  Write-Host 'Validando restore...'
  Invoke-PostgresCommand `
    -Executable $psqlExecutable `
    -Target $target `
    -Arguments @(
      '--tuples-only',
      '--no-align',
      '--command', "SELECT CASE WHEN to_regclass('public.usuarios') IS NOT NULL AND to_regclass('public.productos') IS NOT NULL AND to_regclass('public.pedidos') IS NOT NULL AND to_regclass('public.ventas') IS NOT NULL THEN 'ok' ELSE 'missing_tables' END;"
    )
}

Write-Host "Restore completado correctamente desde: $resolvedBackupFile"
