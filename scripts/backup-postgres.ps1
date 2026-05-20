param(
  [string]$OutputDirectory,
  [string]$Label = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'postgres-common.ps1')

$target = Get-DatabaseTarget
$pgDumpExecutable = Resolve-PostgresCommand -CommandName 'pg_dump'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$safeLabel = ($Label -replace '[^A-Za-z0-9_-]', '-').Trim('-')
$backupDirectory = if ($OutputDirectory) { $OutputDirectory } else { Get-DefaultBackupDirectory }
$fileName = if ($safeLabel) { "backup_${timestamp}_${safeLabel}.sql" } else { "backup_${timestamp}.sql" }
$backupFile = Join-Path $backupDirectory $fileName

Ensure-Directory -Path $backupDirectory

Write-Host "Generando backup en: $backupFile"
Write-Host "Destino: $($target.MaskedTarget)"

Invoke-PostgresCommand `
  -Executable $pgDumpExecutable `
  -Target $target `
  -Arguments @(
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
    '--file', $backupFile
  )

Test-BackupFile -BackupFile $backupFile
$metadataPath = New-BackupMetadata -BackupFile $backupFile -Target $target -Operation 'backup'

Write-Host "Backup generado correctamente: $backupFile"
Write-Host "Metadata: $metadataPath"
