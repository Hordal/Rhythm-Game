# Download 15 anime-style images from waifu.pics (SFW) and save to assets/chars/
# Usage (PowerShell):
#   .\download_waifus.ps1
# Notes:
# - This calls https://api.waifu.pics to obtain random anime images. Check service terms before use.
# - If you need commercial/redistributable art, purchase/licensed art instead.
# - This script is intended for prototyping only.

$targetDir = Join-Path $PSScriptRoot "..\assets\chars"
if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }

$count = 15
for ($i = 1; $i -le $count; $i++) {
    $outFile = Join-Path $targetDir ("c{0}.png" -f $i)
    if (Test-Path $outFile) {
        Write-Host "Skipping existing: $outFile"
        continue
    }

    try {
        Write-Host "Fetching image $i..."
        # Get JSON with URL
        $resp = Invoke-RestMethod -Uri "https://api.waifu.pics/sfw/waifu" -Method Get -UseBasicParsing -ErrorAction Stop
        $imgUrl = $resp.url
        if (-not $imgUrl) { throw "No URL returned" }

        # Download image
        Invoke-WebRequest -Uri $imgUrl -OutFile $outFile -UseBasicParsing -ErrorAction Stop
        Write-Host "Saved $outFile"
    } catch {
        Write-Warning ("Failed to download image {0}: {1}" -f $i, $_)
    }

    Start-Sleep -Milliseconds (Get-Random -Minimum 700 -Maximum 1800)
}

Write-Host "Done. Check folder: $targetDir"
