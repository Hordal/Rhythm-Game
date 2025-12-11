#!/usr/bin/env node
// Simple remix helper: amplify vocal track and mix with instrumental using ffmpeg
// Usage:
// node scripts/remix_with_gain.js --inst path/to/inst.wav --vocal path/to/vocal.wav --out path/to/out.wav --gain 2.0

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const args = require('minimist')(process.argv.slice(2));

if (!args.inst || !args.vocal || !args.out) {
  console.error('Usage: --inst <instrumental> --vocal <vocal> --out <outfile> [--gain <multiplier>]');
  process.exit(2);
}

const inst = args.inst;
const vocal = args.vocal;
const out = args.out;
const gain = parseFloat(args.gain || '2.0');

if (!fs.existsSync(inst)) {
  console.error('Instrumental not found:', inst);
  process.exit(3);
}
if (!fs.existsSync(vocal)) {
  console.error('Vocal not found:', vocal);
  process.exit(4);
}

console.log('Running ffmpeg mix with vocal gain', gain);
const filter = `[1:a]volume=${gain}[v1];[0:a][v1]amix=inputs=2:duration=longest:dropout_transition=0`;
const cmd = 'ffmpeg';
const argsFfmpeg = ['-y', '-i', inst, '-i', vocal, '-filter_complex', filter, '-c:a', 'pcm_s16le', out];

const res = spawnSync(cmd, argsFfmpeg, { stdio: 'inherit' });
if (res.error) {
  console.error('ffmpeg execution failed:', res.error.message || res.error);
  process.exit(1);
}
if (res.status !== 0) {
  console.error('ffmpeg exited with status', res.status);
  process.exit(res.status);
}

// Update manifest if exists next to songs
try {
  const songsDir = path.join(__dirname, '..', 'assets', 'songs');
  const manifestPath = path.join(songsDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(m.songs)) m.songs = m.songs || [];
    const rel = path.relative(path.join(__dirname, '..'), out).replace(/\\/g, '/');
    if (!m.songs.includes(rel)) {
      m.songs.push(rel);
      fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      console.log('Manifest updated with', rel);
    }
  }
} catch (e) {
  console.warn('Failed to update manifest:', e && e.message ? e.message : e);
}

console.log('Remix complete:', out);
