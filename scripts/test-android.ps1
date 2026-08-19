# ============================================================
# TEST ANDROID - attend la fin du build Gradle, installe l'APK
# sur l'emulateur, le lance et verifie le rendu.
# Usage : powershell -ExecutionPolicy Bypass -File test-android.ps1
# ============================================================
$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$apk = Join-Path $scriptDir "android\app\build\outputs\apk\debug\app-debug.apk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"

"=== 1. ATTENTE FIN DU BUILD GRADLE (APK) ==="
"attente d'un APK recent (max 10 min)..."
$deadline = (Get-Date).AddMinutes(10)
$apkReady = $false
while ((Get-Date) -lt $deadline) {
  if (Test-Path $apk) {
    $m = (Get-Item $apk).LastWriteTime
    if ($m -gt (Get-Date).AddMinutes(-7)) { $apkReady = $true; break }
  }
  Start-Sleep -Seconds 10
}
if (-not $apkReady) { "ERREUR: APK introuvable ou trop ancien."; exit 1 }
$item = Get-Item $apk
"APK OK : $($item.FullName) | $([math]::Round($item.Length/1MB,1)) Mo | $($item.LastWriteTime)"

"=== 2. ATTENTE DE L'EMULATEUR ==="
$deadline = (Get-Date).AddMinutes(4)
$boot = "0"
do {
  $dev = & $adb devices 2>$null | Select-String "emulator-" | Select-Object -First 1
  if ($dev) {
    $boot = (& $adb shell getprop sys.boot_completed 2>$null).Trim()
    if ($boot -eq "1") { break }
  }
  Start-Sleep -Seconds 8
} while ((Get-Date) -lt $deadline)
"boot_completed = $boot"
if ($boot -ne "1") { "ERREUR: l'emulateur ne demarre pas."; exit 1 }

"=== 3. ADB REVERSE (localhost:3000 -> hote) ==="
& $adb reverse tcp:3000 tcp:3000 2>&1 | Out-Null
"reverse ok"

"=== 4. INSTALL DE L'APK ==="
& $adb install -r $apk 2>&1
"install exit = $LASTEXITCODE"

"=== 5. LANCEMENT DE L'APPLICATION ==="
& $adb shell am start -n com.rewardly.app/com.rewardly.app.MainActivity 2>&1
Start-Sleep -Seconds 14

"=== 6. FENETRE ACTIVE ==="
(& $adb shell dumpsys window windows 2>$null) | Select-String 'mCurrentFocus' | Select-Object -First 1 | ForEach-Object { $_.Line }

"=== 7. LOGCAT (erreurs / WebView) ==="
& $adb logcat -d -t 80 2>$null | Select-String -Pattern 'Rewardly|rewardly|AndroidRuntime|chromium' | Select-Object -Last 15 | ForEach-Object { $_.Line }

"=== TERMINE ==="