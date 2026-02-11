# Setup AI Services for SignApps Platform
# Usage: .\scripts\setup-ai.ps1

Write-Host "SignApps AI Setup" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan

# Check if Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

Write-Host "`n1. Starting base services (PostgreSQL, Redis, Qdrant, MinIO)..." -ForegroundColor Yellow
docker-compose up -d postgres redis qdrant minio

Write-Host "`n2. Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`n3. Starting Ollama (LLM service)..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.ai.yml up -d ollama

Write-Host "`n4. Waiting for Ollama to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n5. Pulling AI models (this may take a few minutes)..." -ForegroundColor Yellow
Write-Host "   - llama3.2:3b (chat model ~2GB)" -ForegroundColor Gray
docker exec signapps-ollama ollama pull llama3.2:3b

Write-Host "   - nomic-embed-text (embeddings model ~275MB)" -ForegroundColor Gray
docker exec signapps-ollama ollama pull nomic-embed-text

Write-Host "`n6. Starting SignApps AI service..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.ai.yml up -d signapps-ai

Write-Host "`n7. Starting other SignApps services..." -ForegroundColor Yellow
docker-compose up -d signapps-identity signapps-storage

Write-Host "`n" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "===============" -ForegroundColor Green
Write-Host "`nServices running:" -ForegroundColor Cyan
Write-Host "  - Ollama:          http://localhost:11434" -ForegroundColor White
Write-Host "  - Qdrant:          http://localhost:6333" -ForegroundColor White
Write-Host "  - MinIO:           http://localhost:9001" -ForegroundColor White
Write-Host "  - SignApps AI:     http://localhost:3005" -ForegroundColor White
Write-Host "  - SignApps Auth:   http://localhost:3001" -ForegroundColor White
Write-Host "  - SignApps Storage: http://localhost:3004" -ForegroundColor White

Write-Host "`nTo check logs:" -ForegroundColor Yellow
Write-Host "  docker logs signapps-ai -f" -ForegroundColor Gray

Write-Host "`nTo test Ollama:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:11434/api/tags" -ForegroundColor Gray

Write-Host "`nTo stop all services:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.yml -f docker-compose.ai.yml down" -ForegroundColor Gray
