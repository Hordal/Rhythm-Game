#!/usr/bin/env node
// ElevenLabs TTS template: request TTS and save WAV to assets/songs
// Usage: node scripts/generate_elevenlabs.js --text "lyrics" --voice "alloy" --out vocal.wav

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const args = require('minimist')(process.argv.slice(2));

const text = args.text || args.t || 'la la la';
const voice = args.voice || args.v || 'alloy';
const outName = args.out || args.o || `vocal_${Date.now()}.wav`;

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_KEY;
const API_URL_BASE = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1';

if (!API_KEY) {
    console.error('Please set ELEVENLABS_API_KEY environment variable');
    process.exit(1);
}

(async function main(){
    try {
        console.log('Requesting ElevenLabs TTS', { voice, outName });
        const url = `${API_URL_BASE}/text-to-speech/${encodeURIComponent(voice)}`;
        const payload = { text };

        const res = await axios.post(url, payload, {
            responseType: 'arraybuffer',
            headers: {
                'xi-api-key': API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!res || !res.data) throw new Error('Empty response from ElevenLabs');

        const outDir = path.join(__dirname, '..', 'assets', 'songs');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, outName);
        fs.writeFileSync(outPath, Buffer.from(res.data));
        console.log('Saved ElevenLabs vocal to', outPath);
        updateManifest({ id: path.basename(outName, path.extname(outName)), name: 'Vocal - ' + voice, audio: path.join('assets','songs', outName).replace(/\\/g,'/'), bpm: null, durationSec: null });
    } catch (err) {
        console.error('TTS generation failed:', err && err.message ? err.message : err);
        if (err && err.response) console.error('Status:', err.response.status, 'Data:', err.response.data && err.response.data.toString());
        process.exit(1);
    }
})();

function updateManifest(entry) {
    try {
        const outDir = path.join(__dirname, '..', 'assets', 'songs'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const manifestPath = path.join(outDir, 'manifest.json');
        let manifest = [];
        if (fs.existsSync(manifestPath)) { try { manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8')||'[]'); } catch(e) { manifest = []; } }
        const exists = manifest.some(m => m.id === entry.id || m.audio === entry.audio);
        if (!exists) { manifest.push(Object.assign({ generatedAt: new Date().toISOString() }, entry)); fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8'); console.log('Updated manifest at', manifestPath); }
    } catch(e) { console.warn('Failed to update manifest', e); }
}
