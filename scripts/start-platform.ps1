<#
.SYNOPSIS
    Launch the SignApps single-binary runtime.

.DESCRIPTION
    Ensures Postgres is reachable, loads .env, rebuilds signapps-platform
    in debug mode unless -SkipBuild is supplied, then runs it in the
    foreground. Ctrl+C terminates the process cleanly.

.PARAMETER SkipBuild
    Skip `cargo build -p signapps-platform`.
#>

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$BaseDir = (Get-Item $PSScriptRoot).Parent.FullName

if (-not $SkipBuild) {
    Write-Host "[build] cargo build -p signapps-platform" -ForegroundColor Cyan
    cargo build -p signapps-platform
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$EnvFile = Join-Path $BaseDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$' -and $_ -notmatch '^\s*#') {
            [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        }
    }
    Write-Host "[env] loaded .env" -ForegroundColor Green
}

$Binary = Join-Path $BaseDir "target\debug\signapps-platform.exe"
Write-Host "[run] $Binary" -ForegroundColor Cyan
& $Binary
