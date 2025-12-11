AI song generation helper (Suno + ElevenLabs)

Overview
- This folder contains templates to generate instrumentals (Suno-style) and vocals (ElevenLabs TTS), then mix them with FFmpeg.

Prerequisites
- Node.js installed.
- `ffmpeg` installed and available on PATH for mixing (or skip mix step).
- Set API keys as environment variables:
  - `SUNO_API_KEY` for your music provider (or adjust `generate_suno.js` to match your provider)
  - `ELEVENLABS_API_KEY` for ElevenLabs TTS

Quick example (Windows cmd.EXE):

```
set ELEVENLABS_API_KEY=your_key_here
set SUNO_API_KEY=your_key_here
node scripts/generate_all.js --prompt "upbeat electronic" --lyrics "la la la" --voice "alloy" --out demo_track --bpm 140 --duration 24
```

What the orchestrator does
- `generate_all.js` performs three steps:
  1) Calls `generate_suno.js` to create an instrumental WAV (needs provider wiring).
  2) Calls `generate_elevenlabs.js` to create a vocal WAV via ElevenLabs TTS.
  3) Calls `mix_tracks.js` to mix instrument + vocal into a merged WAV using ffmpeg.

Manifest
- The scripts write entries into `assets/songs/manifest.json` so the game auto-discovers generated files.

Notes
- The templates are provider-agnostic but require you to fill in provider-specific endpoints/parameters for best quality.
- ElevenLabs returns high-quality TTS; choose a voice ID available in your ElevenLabs account.
