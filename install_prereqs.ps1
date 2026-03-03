# ==============================================================================
# SignApps Platform - Windows Prerequisites Installer
# ==============================================================================
param([switch]$Elevated)

# Ensure script is running as Administrator
function Test-Admin {
    $currentUser = New-Object Security.Principal.WindowsPrincipal $([Security.Principal.WindowsIdentity]::GetCurrent())
    $currentUser.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Test-Admin)) {
    if ($Elevated) {
        # Already tried to elevate but failed
        Write-Error "Failed to elevate privileges. Please run as Administrator manually."
        exit 1
    }
    Write-Host "Elevating privileges to install prerequisites..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated" -Verb RunAs -Wait
    exit
}

Write-Host "Running as Administrator. Installing Prerequisites..."

# 1. Install Chocolatey if missing
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path += ";$env:ALLUSERSPROFILE\chocolatey\bin"
}
else {
    Write-Host "Chocolatey is already installed."
}

# 2. Install Rust (cargo) if missing
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Rust (cargo) via rustup..."
    choco install rustup.install -y
    
    # Reload Path
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
else {
    Write-Host "Cargo is already installed."
}

# 3. Add Cargo to User Profile Path if missing from current session
$cargoPath = "$env:USERPROFILE\.cargo\bin"
if ($env:PATH -notlike "*$cargoPath*") {
    Write-Host "Adding Cargo to PATH..."
    $env:PATH += ";$cargoPath"
}

Write-Host "======================================================="
Write-Host "Prerequisites installation complete!"
Write-Host "Cargo Version:"
cargo --version
Write-Host "======================================================="
Start-Sleep -Seconds 5
