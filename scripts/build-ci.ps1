Remove-Item Env:\HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:\HTTPS_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:\ALL_PROXY -ErrorAction SilentlyContinue
$configDir = Join-Path (Get-Location) ".wrangler-config"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$env:XDG_CONFIG_HOME = $configDir
npm run build

