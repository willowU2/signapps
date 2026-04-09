$ErrorActionPreference = "Stop"

Write-Host "Creating admin user in signapps-identity..."
$headers = @{
    "Content-Type" = "application/json"
}

$registerBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    # 1. Register the admin user
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/register" -Method POST -Headers $headers -Body $registerBody -UseBasicParsing
    Write-Host "User 'admin' registered successfully."
} catch {
    $errResp = $_.Exception.Response
    if ($errResp -and $errResp.StatusCode -eq 409) {
        Write-Host "User 'admin' already exists. Proceeding to bootstrap."
    } else {
        Write-Host "Failed to register user: $($_.Exception.Message)"
        if ($errResp) {
            $stream = $errResp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host $reader.ReadToEnd()
        }
    }
}

try {
    # 2. Call the bootstrap endpoint to promote the first user to role=2 (Admin)
    Write-Host "Calling /api/v1/bootstrap to promote user to Admin..."
    $bootResp = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/bootstrap" -Method POST -Headers $headers -UseBasicParsing
    
    $result = $bootResp.Content | ConvertFrom-Json
    Write-Host "Bootstrap completed! Admin ID: $($result.admin_id), Username: $($result.admin_user)"
} catch {
    $errResp = $_.Exception.Response
    if ($errResp) {
        $stream = $errResp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        
        if ($body -match "Bootstrap already completed - an admin user exists" -or $body -match "Bootstrap déjà exécuté") {
            Write-Host "Bootstrap was already completed. Admin access is ready!"
        } else {
            Write-Host "Failed to bootstrap: $body"
        }
    } else {
        Write-Host "Failed to bootstrap: $($_.Exception.Message)"
    }
}

Write-Host "=============================="
Write-Host "Admin credentials: admin / admin123"
Write-Host "You can now log in."
Write-Host "=============================="
