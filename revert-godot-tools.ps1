# revert-godot-tools.ps1 — one-click removal of the godot-tools plugin.
# Restores cordis.patch.yml and deletes the plugin file.
$ErrorActionPreference = 'Stop'
$web = 'C:\Users\JG\.dsh\profiles\web'
$patch = Join-Path $web 'cordis.patch.yml'
$bak = Join-Path $web 'cordis.patch.yml.bak'
$pluginFile = Join-Path $web 'plugins\godot-tools.js'

if (Test-Path $bak) {
  Copy-Item $bak $patch -Force
  Remove-Item $bak -Force
  Write-Host '[1/3] cordis.patch.yml restored from backup.'
} else {
  Set-Content -Path $patch -Value '[]' -Encoding utf8
  Write-Host '[1/3] No backup found; cordis.patch.yml reset to empty list.'
}

if (Test-Path $pluginFile) {
  Remove-Item $pluginFile -Force
  Write-Host '[2/3] Plugin file removed.'
} else {
  Write-Host '[2/3] Plugin file already gone.'
}

$pluginDir = Join-Path $web 'plugins'
if ((Test-Path $pluginDir) -and -not (Get-ChildItem $pluginDir -Force)) {
  Remove-Item $pluginDir -Force
  Write-Host '[3/3] Empty plugins folder removed.'
} else {
  Write-Host '[3/3] plugins folder kept (not empty or missing).'
}

Write-Host ''
Write-Host 'Done. Reload the DSH config (HMR) or restart dsh web for the change to take effect.'
Write-Host 'Godot side: if you installed any editor addon, remove it from your project addons/ folder.'
