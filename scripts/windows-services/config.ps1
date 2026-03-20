# SignApps Services Configuration
# This file defines all SignApps services and their configuration

# Base path for the project (auto-detect from script location)
$script:BaseDir = (Get-Item $PSScriptRoot).Parent.Parent.FullName

# Path to release binaries
$script:BinDir = Join-Path $BaseDir "target\release"

# Path to .env file
$script:EnvFile = Join-Path $BaseDir ".env"

# Service definitions
# Format: Name, DisplayName, Description, Port, Dependencies
$script:Services = @(
    @{
        Name = "SignAppsIdentity"
        Binary = "signapps-identity.exe"
        DisplayName = "SignApps Identity"
        Description = "SignApps Authentication and User Management Service"
        Port = 3001
        Dependencies = @("postgresql-x64-16")
    },
    @{
        Name = "SignAppsContainers"
        Binary = "signapps-containers.exe"
        DisplayName = "SignApps Containers"
        Description = "SignApps Docker Container Management Service"
        Port = 3002
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsProxy"
        Binary = "signapps-proxy.exe"
        DisplayName = "SignApps Proxy"
        Description = "SignApps Reverse Proxy and TLS/ACME Service"
        Port = 3003
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsStorage"
        Binary = "signapps-storage.exe"
        DisplayName = "SignApps Storage"
        Description = "SignApps File Storage and Drive Service"
        Port = 3004
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsAI"
        Binary = "signapps-ai.exe"
        DisplayName = "SignApps AI"
        Description = "SignApps AI/LLM and RAG Service"
        Port = 3005
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsSecurelink"
        Binary = "signapps-securelink.exe"
        DisplayName = "SignApps SecureLink"
        Description = "SignApps Web Tunnels and DNS Service"
        Port = 3006
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsScheduler"
        Binary = "signapps-scheduler.exe"
        DisplayName = "SignApps Scheduler"
        Description = "SignApps CRON Job Management Service"
        Port = 3007
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsMetrics"
        Binary = "signapps-metrics.exe"
        DisplayName = "SignApps Metrics"
        Description = "SignApps System Monitoring and Metrics Service"
        Port = 3008
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsMedia"
        Binary = "signapps-media.exe"
        DisplayName = "SignApps Media"
        Description = "SignApps STT/TTS/OCR Media Processing Service"
        Port = 3009
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsDocs"
        Binary = "signapps-docs.exe"
        DisplayName = "SignApps Docs"
        Description = "SignApps Document Editing Service"
        Port = 3010
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsCalendar"
        Binary = "signapps-calendar.exe"
        DisplayName = "SignApps Calendar"
        Description = "SignApps Calendar and Scheduling Service"
        Port = 3011
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsCollab"
        Binary = "signapps-collab.exe"
        DisplayName = "SignApps Collab"
        Description = "SignApps Real-time Collaboration Service"
        Port = 3012
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsMail"
        Binary = "signapps-mail.exe"
        DisplayName = "SignApps Mail"
        Description = "SignApps Email Service"
        Port = 3015
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsPXE"
        Binary = "signapps-pxe.exe"
        DisplayName = "SignApps PXE"
        Description = "SignApps PXE Boot Service"
        Port = 3016
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsITAssets"
        Binary = "signapps-it-assets.exe"
        DisplayName = "SignApps IT Assets"
        Description = "SignApps IT Asset Management Service"
        Port = 3017
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsRemote"
        Binary = "signapps-remote.exe"
        DisplayName = "SignApps Remote"
        Description = "SignApps Remote Desktop Service"
        Port = 3018
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsMeet"
        Binary = "signapps-meet.exe"
        DisplayName = "SignApps Meet"
        Description = "SignApps Video Conferencing Service"
        Port = 3019
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsOffice"
        Binary = "signapps-office.exe"
        DisplayName = "SignApps Office"
        Description = "SignApps Office Suite Service"
        Port = 3020
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    },
    @{
        Name = "SignAppsWorkforce"
        Binary = "signapps-workforce.exe"
        DisplayName = "SignApps Workforce"
        Description = "SignApps HR and Workforce Management Service"
        Port = 3021
        Dependencies = @("postgresql-x64-16", "SignAppsIdentity")
    }
)

# Frontend service (requires NSSM)
$script:FrontendService = @{
    Name = "SignAppsFrontend"
    DisplayName = "SignApps Frontend"
    Description = "SignApps Next.js Frontend Application"
    Port = 3000
    Directory = Join-Path $BaseDir "client"
    Dependencies = @("SignAppsIdentity")
}

# Helper function to get service by name
function Get-SignAppsService {
    param([string]$Name)
    return $script:Services | Where-Object { $_.Name -eq $Name }
}

# Helper function to get all service names
function Get-SignAppsServiceNames {
    return $script:Services | ForEach-Object { $_.Name }
}

# Export variables
Export-ModuleMember -Variable BaseDir, BinDir, EnvFile, Services, FrontendService
Export-ModuleMember -Function Get-SignAppsService, Get-SignAppsServiceNames
