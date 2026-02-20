try {
    $body = Get-Content -Raw "c:\prog\signapps-platform\body.json"
    $response = Invoke-RestMethod -Uri "http://localhost:3010/api/v1/docs/chat" -Method Post -ContentType "application/json" -Body $body
    Write-Host "Success!"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            Write-Host "Response Body: $content"
        }
    }
}
