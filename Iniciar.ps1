$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if ($taskNode) {
    $taskNodePath = $taskNode.Source
} else {
    $taskNodePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (-not (Test-Path -LiteralPath $taskNodePath)) {
        Write-Host 'Instala Node.js 20 o posterior y vuelve a iniciar la aplicacion.' -ForegroundColor Yellow
        Read-Host 'Presiona Enter para salir'
        exit 1
    }
}
Write-Host 'INDESACO - Estudio de cortes' -ForegroundColor Cyan
Write-Host 'Abre http://127.0.0.1:4173 en tu navegador.'
Write-Host 'Mantén esta ventana abierta. Ctrl+C detiene el servidor.'
& $taskNodePath (Join-Path $PSScriptRoot 'server.mjs')
