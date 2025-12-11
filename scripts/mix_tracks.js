#!/usr/bin/env node
// Mix an instrumental track and a vocal track using ffmpeg (must be installed and in PATH)
// Usage: node mix_tracks.js --inst assets/songs/inst.wav --vocal assets/songs/vocal.wav --out assets/songs/merged.wav

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const args = require('minimist')(process.argv.slice(2));

const inst = args.inst || args.i;
const vocal = args.vocal || args.v;
const out = args.out || args.o || `assets/songs/merged_${Date.now()}.wav`;

if (!inst || !vocal) {
    console.error('Usage: --inst <instrumental> --vocal <vocal> [--out output.wav]');
    process.exit(1);
}

if (!fs.existsSync(inst)) { console.error('Instrumental not found:', inst); process.exit(1); }
if (!fs.existsSync(vocal)) { console.error('Vocal not found:', vocal); process.exit(1); }

// ffmpeg mixing command: set volumes and amix
// make sure output directory exists
const outDir = path.dirname(out);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const cmd = `ffmpeg -y -i "${inst}" -i "${vocal}" -filter_complex "[0:a]volume=0.9[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.0" -c:a pcm_s16le "${out}"`;

console.log('Running ffmpeg mix...');
exec(cmd, (err, stdout, stderr) => {
    if (err) {
        console.error('ffmpeg failed:', err);
        console.error(stderr);
        process.exit(1);
    }
    console.log('Mix complete. Saved to', out);
    // update manifest
    try {
        const manifestPath = path.join(__dirname, '..', 'assets', 'songs', 'manifest.json');
        let manifest = [];
        if (fs.existsSync(manifestPath)) { manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8')||'[]'); }
        const id = path.basename(out, path.extname(out));
        const rel = path.relative(path.join(__dirname,'..'), out).replace(/\\/g,'/');
        const exists = manifest.some(m => m.audio === rel || m.id === id);
        if (!exists) {
            manifest.push({ id, name: id, audio: rel, bpm: null, durationSec: null, generatedAt: new Date().toISOString() });
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            console.log('Manifest updated with', rel);
        } else console.log('Manifest already contains entry for', rel);
    } catch(e) { console.warn('Failed to update manifest after mix', e); }
});
