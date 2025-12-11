param(
    [string]$Prompt = "Upbeat electronic demo for rhythm game",
    [string]$Lyrics = "la la la",
    [string]$Voice = "ryan",
    [string]$OutBase = $("ai_" + [int](Get-Date -UFormat %s)),
    [int]$Bpm = 120,
    [int]$Duration = 20
)

# Usage: .\scripts\generate_all.ps1 -Prompt "happy" -Lyrics "la la la" -Voice ryan -OutBase demo1 -Bpm 140 -Duration 24

Write-Host "Starting AI song pipeline..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found in PATH. Install Node 18+ and rerun."
    exit 1
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning "ffmpeg not found in PATH. mix step will fail without ffmpeg."
}

$root = Resolve-Path ..\
Push-Location $root
try {
    Write-Host "Generating instrumental with Suno template..."
    $env:SUNO_API_KEY = $env:SUNO_API_KEY # ensure env var passed through
    node .\scripts\generate_suno.js --prompt "$Prompt" --bpm $Bpm --duration $Duration --out "${OutBase}_inst.wav"

    Write-Host "Generating vocal with Uberduck template..."
    $env:UBERDUCK_API_KEY = $env:UBERDUCK_API_KEY
    $env:UBERDUCK_API_SECRET = $env:UBERDUCK_API_SECRET
    node .\scripts\generate_uberduck.js --text "$Lyrics" --voice $Voice --out "${OutBase}_vocal.wav"

    Write-Host "Mixing tracks..."
    node .\scripts\mix_tracks.js --inst "assets/songs/${OutBase}_inst.wav" --vocal "assets/songs/${OutBase}_vocal.wav" --out "assets/songs/${OutBase}_merged.wav"

    Write-Host "Done. Merged file: assets/songs/${OutBase}_merged.wav"
} finally { Pop-Location }
