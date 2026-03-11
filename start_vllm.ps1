<#
.SYNOPSIS
Starts the SignApps vLLM microservice with Dual AMD GPU support.
#>

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   SignApps vLLM Service (Dual AMD R9700)   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Model: qwen3.5-35b-a3b | Tensor Parallelism: 2" -ForegroundColor Gray

# Create models directory if it doesn't exist
$ModelDir = ".\data\models"
if (-not (Test-Path $ModelDir)) {
    Write-Host "Creating local models directory at $ModelDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null
}

Write-Host "`nPulling and starting vLLM container via Docker Compose..."
docker compose -f docker-compose.vllm.yml up -d

Write-Host "`n[+] vLLM container is booting in the background." -ForegroundColor Green
Write-Host "=> Follow the model loading logs using: docker logs -f signapps-vllm"
Write-Host "=> The API will be available at: http://localhost:8000/v1"
Write-Host "=> SignApps AI will automatically connect once the server is ready."
