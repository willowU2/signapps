try {
    $response = Invoke-RestMethod -Uri "http://localhost:3010/api/v1/channels" -Method Get
    Write-Host "Success!"
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Error: $($_.Exception.Message)"
}
