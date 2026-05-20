$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Get-DefaultBackupDirectory {
  return Join-Path (Get-ProjectRoot) 'backups'
}

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Resolve-PostgresCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  $customBinDirectory = @(
    $env:PG_BIN_DIR,
    $env:POSTGRES_BIN_DIR
  ) | Where-Object { $_ -and $_.Trim() }

  foreach ($directory in $customBinDirectory) {
    $candidate = Join-Path $directory $CommandName
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }

    $candidateExe = "$candidate.exe"
    if (Test-Path -LiteralPath $candidateExe) {
      return $candidateExe
    }
  }

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "No se encontro '$CommandName'. Instala PostgreSQL client tools o configura PG_BIN_DIR/POSTGRES_BIN_DIR."
}

function Get-DatabaseTarget {
  param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $env:DB_PORT,
    [string]$DbUser = $env:DB_USER,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbName = $env:DB_NAME
  )

  if ($DatabaseUrl) {
    return @{
      Mode = 'database_url'
      ConnectionString = $DatabaseUrl
      MaskedTarget = $DatabaseUrl -replace '://([^:]+):([^@]+)@', '://$1:***@'
    }
  }

  $resolvedHost = if ($DbHost) { $DbHost } else { '127.0.0.1' }
  $resolvedPort = if ($DbPort) { $DbPort } else { '5432' }
  $resolvedUser = if ($DbUser) { $DbUser } else { 'postgres' }
  $resolvedName = if ($DbName) { $DbName } else { 'postgres' }

  return @{
    Mode = 'split'
    Host = $resolvedHost
    Port = $resolvedPort
    User = $resolvedUser
    Password = $DbPassword
    Database = $resolvedName
    MaskedTarget = "$resolvedUser@$resolvedHost`:$resolvedPort/$resolvedName"
  }
}

function Get-PsqlArguments {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Target
  )

  if ($Target.Mode -eq 'database_url') {
    return @($Target.ConnectionString)
  }

  return @(
    '--host', $Target.Host,
    '--port', $Target.Port,
    '--username', $Target.User,
    '--dbname', $Target.Database
  )
}

function Invoke-PostgresCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [Parameter(Mandatory = $true)]
    [hashtable]$Target,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $previousPassword = $env:PGPASSWORD

  try {
    if ($Target.Mode -eq 'split' -and $Target.Password) {
      $env:PGPASSWORD = $Target.Password
    }

    & $Executable @((Get-PsqlArguments -Target $Target) + $Arguments)

    if ($LASTEXITCODE -ne 0) {
      throw "El comando '$Executable' termino con codigo de salida $LASTEXITCODE."
    }
  } finally {
    $env:PGPASSWORD = $previousPassword
  }
}

function New-BackupMetadata {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [Parameter(Mandatory = $true)]
    [hashtable]$Target,
    [Parameter(Mandatory = $true)]
    [string]$Operation
  )

  $hash = Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256
  $metadata = @{
    operation = $Operation
    fileName = [System.IO.Path]::GetFileName($BackupFile)
    generatedAt = (Get-Date).ToString('o')
    sizeBytes = (Get-Item -LiteralPath $BackupFile).Length
    sha256 = $hash.Hash
    target = $Target.MaskedTarget
  }

  $metadataPath = "$BackupFile.meta.json"
  $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
  return $metadataPath
}

function Test-BackupFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
  )

  if (-not (Test-Path -LiteralPath $BackupFile)) {
    throw "No se genero el archivo de backup esperado: $BackupFile"
  }

  $fileInfo = Get-Item -LiteralPath $BackupFile
  if ($fileInfo.Length -le 0) {
    throw "El archivo de backup esta vacio: $BackupFile"
  }
}

