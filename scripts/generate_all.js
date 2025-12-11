#!/usr/bin/env node
// Orchestrator: generate instrumental (Suno), generate vocal (Uberduck), mix with ffmpeg
// Usage example:
// node scripts/generate_all.js --prompt "upbeat trance" --lyrics "la la la" --voice ryan --out base_name --bpm 140 --duration 24

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(2));

const prompt = args.prompt || args.p || 'Upbeat electronic demo for rhythm game';
const lyrics = args.lyrics || args.l || 'la la la';
const voice = args.voice || args.v || 'ryan';
const outBase = args.out || args.o || ('ai_' + Date.now());
const bpm = args.bpm || 120;
const duration = args.duration || 20;

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'songs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const instName = `${outBase}_inst.wav`;
const vocalName = `${outBase}_vocal.wav`;
const mergedName = `${outBase}_merged.wav`;

function runNodeScript(scriptPath, argv) {
    console.log('> node', scriptPath, argv.join(' '));
    const res = spawnSync(process.execPath, [scriptPath].concat(argv), { stdio: 'inherit', cwd: root, env: process.env, windowsHide: false });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(`Script ${scriptPath} exited ${res.status}`);
}

try {
    // 1) Generate instrumental via Suno template
    // Use clean Suno generator copy to avoid corrupted file issues
    try {
        runNodeScript(path.join('scripts', 'generate_suno_clean.js'), ['--prompt', prompt, '--bpm', String(bpm), '--duration', String(duration), '--out', instName]);
    } catch (err) {
        console.warn('Instrumental generation failed; falling back to local placeholder generator.', err && err.message ? err.message : err);
        // Call local placeholder generator to produce a simple WAV
        runNodeScript(path.join('scripts', 'make_placeholder_songs.js'), ['--count', '1', '--duration', String(duration), '--outPrefix', 'fallback_inst']);
        // make_placeholder_songs writes fallback_inst_1.wav — rename/copy to requested instName
        const generatedPath = path.join(outDir, 'fallback_inst_1.wav');
        const desiredPath = path.join(outDir, instName);
        if (fs.existsSync(generatedPath)) {
            fs.copyFileSync(generatedPath, desiredPath);
            console.log('Copied placeholder instrumental to', desiredPath);
        } else {
            console.warn('Expected placeholder instrumental not found at', generatedPath);
        }
    }

    // 2) Generate vocal via ElevenLabs template
    try {
        runNodeScript(path.join('scripts', 'generate_elevenlabs.js'), ['--text', lyrics, '--voice', voice, '--out', vocalName]);
    } catch (err) {
        console.warn('Vocal generation failed (ElevenLabs). Falling back to local placeholder TTS.', err && err.message ? err.message : err);
        runNodeScript(path.join('scripts', 'generate_local_tts_fallback.js'), ['--out', vocalName, '--duration', '4']);
    }

    // 3) Mix with ffmpeg using mix_tracks.js
    runNodeScript(path.join('scripts', 'mix_tracks.js'), ['--inst', path.join('assets','songs',instName), '--vocal', path.join('assets','songs',vocalName), '--out', path.join('assets','songs',mergedName)]);

    console.log('Generation pipeline complete. Merged file:', path.join('assets','songs',mergedName));
    process.exit(0);
} catch (e) {
    console.error('Pipeline failed:', e && e.message ? e.message : e);
    process.exit(1);
}
