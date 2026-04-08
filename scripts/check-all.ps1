#Requires -Version 5.1
<#
.SYNOPSIS
    E2E health check for all SignApps services.

.DESCRIPTION
    Checks PostgreSQL, pings /health on every service, reports colour-coded
    status, and optionally runs one API smoke test per major service.

.PARAMETER Api
    Also run one API smoke test per major service (GET with JWT token).

.PARAMETER Timeout
    HTTP request timeout in seconds (default: 5).

.PARAMETER Token
    Bearer token for API smoke tests. Falls back to $env:SIGNAPPS_TOKEN,
    then a dev placeholder.

.EXAMPLE
    .\scripts\check-all.ps1
    .\scripts\check-all.ps1 -Api
    .\scripts\check-all.ps1 -Api -Timeout 10 -Token "eyJ..."
#>
[CmdletBinding()]
param(
    [switch]$Api,
    [int]$Timeout = 5,
    [string]$Token = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Service registry ──────────────────────────────────────────────────────────
# Each entry: @{ Name; Port; Desc }
$Services = @(
    @{ Name = "identity";       Port = 3001; Desc = "Auth, LDAP/AD, MFA, RBAC" }
    @{ Name = "containers";     Port = 3002; Desc = "Docker container lifecycle" }
    @{ Name = "proxy";          Port = 3003; Desc = "Reverse proxy, TLS/ACME" }
    @{ Name = "storage";        Port = 3004; Desc = "File storage (OpenDAL)" }
    @{ Name = "ai";             Port = 3005; Desc = "AI Gateway (RAG, LLM, Vision)" }
    @{ Name = "securelink";     Port = 3006; Desc = "Web tunnels, DNS" }
    @{ Name = "scheduler";      Port = 3007; Desc = "CRON job management" }
    @{ Name = "metrics";        Port = 3008; Desc = "System monitoring, Prometheus" }
    @{ Name = "media";          Port = 3009; Desc = "STT/TTS/OCR processing" }
    @{ Name = "docs";           Port = 3010; Desc = "Document editing" }
    @{ Name = "calendar";       Port = 3011; Desc = "Calendar & scheduling" }
    @{ Name = "mail";           Port = 3012; Desc = "Email service" }
    @{ Name = "meet";           Port = 3014; Desc = "Video conferencing" }
    @{ Name = "forms";          Port = 3015; Desc = "Form builder & submissions" }
    @{ Name = "pxe";            Port = 3016; Desc = "PXE network boot" }
    @{ Name = "social";         Port = 3019; Desc = "Social media management" }
    @{ Name = "chat";           Port = 3020; Desc = "Team messaging & channels" }
    @{ Name = "contacts";       Port = 3021; Desc = "Contact management" }
    @{ Name = "it-assets";      Port = 3022; Desc = "IT asset management" }
    @{ Name = "workforce";      Port = 3024; Desc = "HR & workforce" }
    @{ Name = "vault";          Port = 3025; Desc = "Password vault & credential store" }
    @{ Name = "org";            Port = 3026; Desc = "Organizational structure" }
    @{ Name = "webhooks";       Port = 3027; Desc = "Outbound webhook management" }
    @{ Name = "signatures";     Port = 3028; Desc = "Electronic signature workflow" }
    @{ Name = "tenant-config";  Port = 3029; Desc = "Tenant branding & CSS" }
    @{ Name = "integrations";   Port = 3030; Desc = "External integrations" }
    @{ Name = "backup";         Port = 3031; Desc = "Database & file backups" }
    @{ Name = "compliance";     Port = 3032; Desc = "Compliance, RGPD, retention" }
    @{ Name = "notifications";  Port = 8095; Desc = "Push notifications" }
    @{ Name = "billing";        Port = 8096; Desc = "Billing & invoicing" }
    @{ Name = "gateway";        Port = 3099; Desc = "API gateway aggregator" }
)

# ── API smoke tests ───────────────────────────────────────────────────────────
# Each entry: @{ Port; Method; Path; Desc }
$ApiTests = @(
    @{ Port = 3001; Method = "GET"; Path = "/api/v1/users";                Desc = "List users" }
    @{ Port = 3002; Method = "GET"; Path = "/api/v1/containers";           Desc = "List containers" }
    @{ Port = 3004; Method = "GET"; Path = "/api/v1/storage/buckets";      Desc = "List buckets" }
    @{ Port = 3005; Method = "GET"; Path = "/api/v1/ai/models";            Desc = "List AI models" }
    @{ Port = 3011; Method = "GET"; Path = "/api/v1/calendars";            Desc = "List calendars" }
    @{ Port = 3012; Method = "GET"; Path = "/api/v1/mail/accounts";        Desc = "List mail accounts" }
    @{ Port = 3015; Method = "GET"; Path = "/api/v1/forms";                Desc = "List forms" }
    @{ Port = 3020; Method = "GET"; Path = "/api/v1/channels";             Desc = "List chat channels" }
    @{ Port = 3021; Method = "GET"; Path = "/api/v1/contacts";             Desc = "List contacts" }
    @{ Port = 3022; Method = "GET"; Path = "/api/v1/assets";               Desc = "List IT assets" }
    @{ Port = 3024; Method = "GET"; Path = "/api/v1/employees";            Desc = "List employees" }
    @{ Port = 3025; Method = "GET"; Path = "/api/v1/vault/entries";        Desc = "List vault entries" }
    @{ Port = 3026; Method = "GET"; Path = "/api/v1/org/trees";            Desc = "List org trees" }
    @{ Port = 3027; Method = "GET"; Path = "/api/v1/webhooks";             Desc = "List webhooks" }
    @{ Port = 3028; Method = "GET"; Path = "/api/v1/signatures";           Desc = "List signatures" }
    @{ Port = 3032; Method = "GET"; Path = "/api/v1/compliance/policies";  Desc = "List compliance policies" }
    @{ Port = 8096; Method = "GET"; Path = "/api/v1/invoices";             Desc = "List invoices" }
    @{ Port = 3099; Method = "GET"; Path = "/api/v1/status";               Desc = "Gateway status" }
)

# ── Colour helpers ────────────────────────────────────────────────────────────
function Write-Ok   { param([string]$Msg) Write-Host "  [OK]    $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "  [FAIL]  $Msg" -ForegroundColor Red }
function Write-Skip { param([string]$Msg) Write-Host "  [SKIP]  $Msg" -ForegroundColor Yellow }
function Write-Auth { param([string]$Msg) Write-Host "  [AUTH]  $Msg" -ForegroundColor Blue }
function Write-Info { param([string]$Msg) Write-Host "  [..]    $Msg" -ForegroundColor Cyan }
function Write-Sep  { Write-Host "  -----------------------------------------" -ForegroundColor DarkGray }
function Write-Hdr  { param([string]$Title)
    Write-Host ""
    Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
    Write-Host ("  | {0,-42} |" -f $Title) -ForegroundColor Cyan
    Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

# ── Utilities ─────────────────────────────────────────────────────────────────
function Test-TcpPort {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $connect = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
        if ($wait) {
            try { $tcp.EndConnect($connect) } catch { }
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

function Invoke-HealthCheck {
    param([int]$Port)
    try {
        $uri = "http://localhost:$Port/health"
        $resp = Invoke-WebRequest -Uri $uri -Method GET -TimeoutSec $Timeout `
                    -UseBasicParsing -ErrorAction Stop
        return $resp.StatusCode
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        if ($webEx.Response) {
            return [int]$webEx.Response.StatusCode
        }
        return 0
    } catch {
        return 0
    }
}

function Invoke-ApiSmokeTest {
    param([int]$Port, [string]$Method, [string]$Path, [string]$BearerToken)
    try {
        $uri = "http://localhost:$Port$Path"
        $headers = @{ Authorization = "Bearer $BearerToken"; Accept = "application/json" }
        $resp = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers `
                    -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        return $resp.StatusCode
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        if ($webEx.Response) {
            return [int]$webEx.Response.StatusCode
        }
        return 0
    } catch {
        return 0
    }
}

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |    SignApps Platform -- Health Check     |" -ForegroundColor Magenta
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host ""

# ── Step 1: PostgreSQL ────────────────────────────────────────────────────────
Write-Host "  Checking PostgreSQL..." -ForegroundColor Cyan
Write-Sep
if (Test-TcpPort 5432) {
    Write-Ok "PostgreSQL is running on port 5432"
} else {
    Write-Fail "PostgreSQL is NOT running on port 5432"
    Write-Host ""
    Write-Host "  Fatal: database not available. Services will report unhealthy." -ForegroundColor Red
    Write-Host ""
}

# ── Step 2: Frontend ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Checking frontend (Next.js)..." -ForegroundColor Cyan
Write-Sep
$frontendOk = $true
if (Test-TcpPort 3000) {
    $fStatus = Invoke-HealthCheck 3000
    # Next.js returns 200 on root; /health may 404 — check root instead
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET `
                    -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        $fStatus = $resp.StatusCode
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        if ($webEx.Response) { $fStatus = [int]$webEx.Response.StatusCode }
    } catch { $fStatus = 0 }

    if ($fStatus -in 200,301,302,307,308) {
        Write-Ok ("{0,-22} {1,-8} Next.js dev server" -f "frontend", ":3000")
    } else {
        Write-Fail ("{0,-22} {1,-8} HTTP $fStatus" -f "frontend", ":3000")
        $frontendOk = $false
    }
} else {
    Write-Skip ("{0,-22} {1,-8} not running" -f "frontend", ":3000")
    $frontendOk = $false
}

# ── Step 3: Backend services ──────────────────────────────────────────────────
Write-Host ""
Write-Host "  Checking backend services (/health)..." -ForegroundColor Cyan
Write-Sep

$okCount     = 0
$failCount   = 0
$skipCount   = 0
$failedSvcs  = [System.Collections.Generic.List[string]]::new()

foreach ($svc in $Services) {
    $label = "signapps-{0}" -f $svc.Name

    if (-not (Test-TcpPort $svc.Port)) {
        Write-Skip ("{0,-22} {1,-8} not running" -f $label, ":$($svc.Port)")
        $skipCount++
        continue
    }

    $httpStatus = Invoke-HealthCheck $svc.Port

    if ($httpStatus -ge 200 -and $httpStatus -lt 300) {
        Write-Ok ("{0,-22} {1,-8} HTTP {2,-6} {3}" -f $label, ":$($svc.Port)", $httpStatus, $svc.Desc)
        $okCount++
    } else {
        Write-Fail ("{0,-22} {1,-8} HTTP {2,-6} {3}" -f $label, ":$($svc.Port)", $httpStatus, $svc.Desc)
        $failCount++
        $failedSvcs.Add("$($svc.Name):$($svc.Port)")
    }
}

# ── Step 4: API smoke tests (optional) ───────────────────────────────────────
$apiOkCount   = 0
$apiFailCount = 0

if ($Api) {
    Write-Host ""
    Write-Host "  Running API smoke tests..." -ForegroundColor Cyan
    Write-Sep

    # Resolve bearer token
    $bearerToken = $Token
    if ([string]::IsNullOrEmpty($bearerToken)) {
        $bearerToken = $env:SIGNAPPS_TOKEN
    }
    if ([string]::IsNullOrEmpty($bearerToken)) {
        $bearerToken = "dev-admin-token"
        Write-Host "  [!!]    SIGNAPPS_TOKEN not set -- using dev token (may 401)" -ForegroundColor Yellow
    }

    foreach ($test in $ApiTests) {
        if (-not (Test-TcpPort $test.Port)) {
            Write-Skip ("{0,-30} {1,-8} service not running" -f $test.Desc, ":$($test.Port)")
            continue
        }

        $httpStatus = Invoke-ApiSmokeTest $test.Port $test.Method $test.Path $bearerToken

        if ($httpStatus -in 200,201,401,403) {
            if ($httpStatus -in 200,201) {
                Write-Ok ("{0,-30} {1,-8} HTTP $httpStatus" -f $test.Desc, ":$($test.Port)")
            } else {
                Write-Auth ("{0,-30} {1,-8} HTTP $httpStatus (auth required)" -f $test.Desc, ":$($test.Port)")
            }
            $apiOkCount++
        } else {
            Write-Fail ("{0,-30} {1,-8} HTTP $httpStatus" -f $test.Desc, ":$($test.Port)")
            $apiFailCount++
        }
    }
}

# ── Step 5: Summary ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |              Summary                     |" -ForegroundColor Cyan
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

$total = $okCount + $failCount + $skipCount
Write-Host ("  Services checked : {0}" -f $total) -ForegroundColor DarkGray

if ($okCount -gt 0)   { Write-Host ("  Healthy          : {0}" -f $okCount)   -ForegroundColor Green }
if ($failCount -gt 0) { Write-Host ("  Unhealthy        : {0}" -f $failCount) -ForegroundColor Red }
if ($skipCount -gt 0) { Write-Host ("  Not running      : {0}" -f $skipCount) -ForegroundColor Yellow }

if ($Api) {
    Write-Host ""
    Write-Host ("  API smoke tests  : {0}" -f ($apiOkCount + $apiFailCount)) -ForegroundColor DarkGray
    if ($apiOkCount -gt 0)   { Write-Host ("  Passed           : {0}" -f $apiOkCount)   -ForegroundColor Green }
    if ($apiFailCount -gt 0) { Write-Host ("  Failed           : {0}" -f $apiFailCount) -ForegroundColor Red }
}

if ($failedSvcs.Count -gt 0) {
    Write-Host ""
    Write-Host "  Failed services:" -ForegroundColor Red
    foreach ($entry in $failedSvcs) {
        $parts = $entry -split ":"
        Write-Host ("    * signapps-{0} (port {1})" -f $parts[0], $parts[1]) -ForegroundColor Red
    }
}

Write-Host ""
Write-Sep
Write-Host ""

# ── Exit code ─────────────────────────────────────────────────────────────────
if ($failCount -gt 0 -or $apiFailCount -gt 0) {
    Write-Host "  Result: UNHEALTHY" -ForegroundColor Red
    Write-Host ""
    exit 1
} elseif ($okCount -eq 0 -and $skipCount -gt 0) {
    Write-Host "  Result: NO SERVICES RUNNING" -ForegroundColor Yellow
    Write-Host ""
    exit 1
} else {
    Write-Host "  Result: ALL HEALTHY" -ForegroundColor Green
    Write-Host ""
    exit 0
}
