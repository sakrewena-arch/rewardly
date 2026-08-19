# ============================================================
# Android - Help: add GitHub Actions secrets for release signing.
# Prints the base64 keystore + the 4 required secret values.
# Usage : powershell -ExecutionPolicy Bypass -File scripts/android-signing-secrets.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$keystorePath = Join-Path $root "android/keystore/rewardly-release.jks"
$propsPath = Join-Path $root "android/keystore.properties"

if (-not (Test-Path $keystorePath)) {
  Write-Error "Keystore introuvable : $keystorePath"
  exit 1
}

Write-Output "== 1. Valeur ANDROID_KEYSTORE_BASE64 (a coller dans le secret GitHub) =="
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $keystorePath))
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Output $base64

Write-Output ""
Write-Output "== 2. Les 3 autres secrets =="
$props = @{}
Get-Content $propsPath | ForEach-Object {
    if ($_ -match "^\s*([^=]+?)\s*=\s*(.+?)\s*$") { $props[$matches[1]] = $matches[2] }
}

Write-Output ("ANDROID_KEYSTORE_PASSWORD = " + $props['storePassword'])
Write-Output ("ANDROID_KEY_ALIAS         = " + $props['keyAlias'])
Write-Output ("ANDROID_KEY_PASSWORD     = " + $props['keyPassword'])

Write-Output ""
Write-Output "== 3. Secrets GitHub a creer (Settings > Secrets and variables > Actions) =="
Write-Output "| Nom du secret | Valeur |"
Write-Output "|---|---|"
Write-Output "| ANDROID_KEYSTORE_BASE64 | (valeur de l etape 1) |"
Write-Output ("| ANDROID_KEYSTORE_PASSWORD | " + $props['storePassword'] + " |")
Write-Output ("| ANDROID_KEY_ALIAS          | " + $props['keyAlias'] + " |")
Write-Output ("| ANDROID_KEY_PASSWORD         | " + $props['keyPassword'] + " |")

Write-Output ""
Write-Output "== 4. Ces 4 secrets sont deja branches dans les workflows (android-build.yml + release.yml) =="