$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:JARVIS_NO_PAID_API = '1'
$jarvisRemoteOrigin = Read-Host 'URL HTTPS privada de Tailscale (por ejemplo https://tu-pc.tu-red.ts.net)'
$jarvisSecureCode = Read-Host 'Codigo privado de acceso (al menos 12 caracteres)' -AsSecureString
$jarvisCodePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($jarvisSecureCode)
try {
    $env:JARVIS_PUBLIC_ORIGIN = $jarvisRemoteOrigin.TrimEnd('/')
    $env:JARVIS_ACCESS_CODE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($jarvisCodePointer)
    Write-Host 'Iniciando JARVIS para el tunel privado. Configura Tailscale Serve segun LEEME.md.'
    node server.mjs
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($jarvisCodePointer)
    Remove-Item Env:JARVIS_ACCESS_CODE -ErrorAction SilentlyContinue
    Remove-Item Env:JARVIS_PUBLIC_ORIGIN -ErrorAction SilentlyContinue
}
