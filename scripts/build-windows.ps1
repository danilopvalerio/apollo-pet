$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if ($env:OS -ne 'Windows_NT') { throw 'Execute este script no Windows.' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Instale Rust/Cargo e C++ Build Tools antes de compilar.' }
$env:CARGO_TARGET_DIR = Join-Path (Get-Location) 'src-tauri/target'
$dest = Join-Path (Get-Location) 'production/windows/DesktopPets-Setup.exe'
$bundle = Join-Path $env:CARGO_TARGET_DIR 'release/bundle/nsis'
if (Test-Path $dest) { Remove-Item $dest -Force }
if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force }
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Testes falharam.' }
npm run tauri -- build --bundles nsis
if ($LASTEXITCODE -ne 0) { throw 'Compilação Tauri falhou.' }
$setup = @(Get-ChildItem $bundle -Filter '*-setup.exe' -File)
if ($setup.Count -ne 1) { throw 'Instalador NSIS não encontrado ou ambíguo.' }
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
Copy-Item $setup[0].FullName $dest -Force
Write-Host "Instalador pronto: $dest" -ForegroundColor Green
# Use streaming .NET hashing instead of a PowerShell module cmdlet.
# A checksum is informational; it must not prevent upload of a valid installer.
try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($dest)
        try {
            $hash = [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
        } finally {
            $stream.Dispose()
        }
    } finally {
        $sha.Dispose()
    }
    Write-Host "SHA256: $hash"
} catch {
    Write-Warning "Instalador gerado, mas nao foi possivel calcular SHA256: $($_.Exception.Message)"
}
