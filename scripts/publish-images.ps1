param(
  [Parameter(Mandatory = $true)]
  [string]$Registry,

  [string]$Tag = "latest",

  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,

  [switch]$Push
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendImage = "$Registry/easyerp-backend:$Tag"
$frontendImage = "$Registry/easyerp-frontend:$Tag"

Write-Host "Building backend image: $backendImage"
docker build `
  -f "$root/backend/Dockerfile" `
  -t $backendImage `
  "$root/backend"

Write-Host "Building frontend image: $frontendImage"
docker build `
  -f "$root/frontend/Dockerfile" `
  --build-arg "VITE_API_URL=$ApiUrl" `
  -t $frontendImage `
  "$root/frontend"

if ($Push) {
  Write-Host "Pushing backend image: $backendImage"
  docker push $backendImage

  Write-Host "Pushing frontend image: $frontendImage"
  docker push $frontendImage
}

Write-Host ""
Write-Host "Done."
Write-Host "Backend image : $backendImage"
Write-Host "Frontend image: $frontendImage"
Write-Host "Frontend API URL baked at build time: $ApiUrl"
Write-Host ""
Write-Host "Update .env.prod with:"
Write-Host "EASYERP_BACKEND_IMAGE=$backendImage"
Write-Host "EASYERP_FRONTEND_IMAGE=$frontendImage"
