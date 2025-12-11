<#
PowerShell convenience wrapper to run the Node.js generation script on Windows.
Usage:
    $env:SUNO_API_KEY = 'your_api_key_here'
    .\run_generate_suno.ps1 -Prompt 'Upbeat EDM' -Bpm 140 -Duration 20 -Out 'ai_demo.wav'
#>
[CmdletBinding()]
param(
    [string]$Prompt = 'Upbeat demo for rhythm game',
    [int]$Bpm = 120,
    [int]$Duration = 20,
    [string]$Out = "ai_song_$(Get-Date -Format yyyyMMddHHmmss).wav"
)

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js is required. Please install Node.js and run again.'; exit 1
}

$script = Join-Path $here 'generate_suno.js'
$envVar = $env:SUNO_API_KEY
if (-not $envVar) {
    Write-Host 'Please set your SUNO_API_KEY environment variable before running.'
    Write-Host "Example (PowerShell): `$env:SUNO_API_KEY = 'your_key_here'"
    exit 1
}

node $script --prompt "$Prompt" --bpm $Bpm --duration $Duration --out $Out
