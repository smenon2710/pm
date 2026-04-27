$ErrorActionPreference = "Stop"

$imageName = "pm-mvp"
$containerName = "pm-mvp-app"

docker build -t $imageName .
docker rm -f $containerName 2>$null | Out-Null
if (Test-Path ".env") {
  docker run -d --name $containerName --env-file ".env" -p 8000:8000 $imageName | Out-Null
} else {
  docker run -d --name $containerName -p 8000:8000 $imageName | Out-Null
  Write-Host "Warning: .env file not found. OPENROUTER_API_KEY may be missing."
}

Write-Host "App started: http://localhost:8000"
