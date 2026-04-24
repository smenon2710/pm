$ErrorActionPreference = "Stop"

$containerName = "pm-mvp-app"

docker rm -f $containerName 2>$null | Out-Null
Write-Host "App stopped."
