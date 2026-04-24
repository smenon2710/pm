$ErrorActionPreference = "Stop"

$imageName = "pm-mvp"
$containerName = "pm-mvp-app"

docker build -t $imageName .
docker rm -f $containerName 2>$null | Out-Null
docker run -d --name $containerName -p 8000:8000 $imageName | Out-Null

Write-Host "App started: http://localhost:8000"
