#!/usr/bin/env node
// Simple template to call a music-generation API (Suno-like) and save result to assets/songs
// Usage: node generate_suno.js --prompt "happy EDM" --bpm 140 --duration 20 --out ai_song_1.wav
#!/usr/bin/env node
// Simple template to call a music-generation API (Suno-like) and save result to assets/songs
// Usage: node generate_suno.js --prompt "happy EDM" --bpm 140 --duration 20 --out ai_song_1.wav

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const args = require('minimist')(process.argv.slice(2));
const prompt = args.prompt || args.p || 'Upbeat electronic demo for rhythm game';
const bpm = parseInt(args.bpm || args.b || 120, 10);
const duration = parseInt(args.duration || args.d || 20, 10); // seconds
const outName = args.out || args.o || `ai_song_${Date.now()}.wav`;

const API_KEY = process.env.SUNO_API_KEY || process.env.AI_SONG_KEY;
const API_URL = process.env.SUNO_API_URL || 'https://api.suno.ai/v1/generate'; // replace if needed

if (!API_KEY) {
    console.error('ERROR: Please set SUNO_API_KEY (or AI_SONG_KEY) in environment.');
    console.error('Example (Windows cmd): set SUNO_API_KEY=your_key_here');
    process.exit(1);
}

(async function main(){
    try {
        console.log('Requesting generation:', { prompt, bpm, duration, outName });

        const payload = {
            prompt,
            bpm,
            durationSeconds: duration,
            // optional parameters that some services may support
            format: 'wav',
            quality: 'standard'
        };

        const res = await axios.post(API_URL, payload, {
            responseType: 'json',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!res || !res.data) throw new Error('Empty response from API');

        // Some APIs return base64, others a URL to download. Try both.
        if (res.data.audio_base64) {
            const bin = Buffer.from(res.data.audio_base64, 'base64');
            const outDir = path.join(__dirname, '..', 'assets', 'songs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName);
            fs.writeFileSync(outPath, bin);
            console.log('Saved generated audio to', outPath);
            // update manifest
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: prompt, audio: path.join('assets', 'songs', outName).replace(/\\/g,'/'), bpm, durationSec: duration });
            return;
        }

        if (res.data.audio_url) {
            // download
            const audioRes = await axios.get(res.data.audio_url, { responseType: 'arraybuffer' });
            const outDir = path.join(__dirname, '..', 'assets', 'songs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName);
            fs.writeFileSync(outPath, Buffer.from(audioRes.data));
            console.log('Downloaded and saved generated audio to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: prompt, audio: path.join('assets', 'songs', outName).replace(/\\/g,'/'), bpm, durationSec: duration });
            return;
        }

        console.error('API response did not contain audio. Response keys:', Object.keys(res.data));
        console.error('Full response:', JSON.stringify(res.data).slice(0,2000));
    } catch (err) {
        console.error('Generation failed:', err && err.message ? err.message : err);
        if (err && err.response) {
            console.error('Status:', err.response.status, 'Data:', err.response.data && JSON.stringify(err.response.data).slice(0,1000));
        }
        process.exit(1);
    }
})();

function updateManifest(entry) {
    try {
        const outDir = path.join(__dirname, '..', 'assets', 'songs');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const manifestPath = path.join(outDir, 'manifest.json');
        let manifest = [];
        if (fs.existsSync(manifestPath)) {
            try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8') || '[]'); } catch(e) { manifest = []; }
        }
        // avoid duplicates by id or audio path
        const exists = manifest.some(m => m.id === entry.id || m.audio === entry.audio);
        if (!exists) {
            manifest.push(Object.assign({ generatedAt: new Date().toISOString() }, entry));
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            console.log('Updated manifest at', manifestPath);
        } else {
            console.log('Entry already exists in manifest, skipping update');
        }
    } catch (e) { console.warn('Failed to update manifest', e); }
}

const path = require('path');
const axios = require('axios');

const args = require('minimist')(process.argv.slice(2));
const prompt = args.prompt || args.p || 'Upbeat electronic demo for rhythm game';
const bpm = parseInt(args.bpm || args.b || 120, 10);
const duration = parseInt(args.duration || args.d || 20, 10); // seconds
const outName = args.out || args.o || `ai_song_${Date.now()}.wav`;

const API_KEY = process.env.SUNO_API_KEY || process.env.AI_SONG_KEY;
const API_URL = process.env.SUNO_API_URL || 'https://api.suno.ai/v1/generate'; // replace if needed

if (!API_KEY) {
    console.error('ERROR: Please set SUNO_API_KEY (or AI_SONG_KEY) in environment.');
    console.error('Example (Windows cmd): set SUNO_API_KEY=your_key_here');
    process.exit(1);
}

(async function main(){
    try {
        console.log('Requesting generation:', { prompt, bpm, duration, outName });

        const payload = {
            prompt,
            bpm,
            durationSeconds: duration,
            // optional parameters that some services may support
            format: 'wav',
            quality: 'standard'
        };

        const res = await axios.post(API_URL, payload, {
            responseType: 'json',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!res || !res.data) throw new Error('Empty response from API');

        // Some APIs return base64, others a URL to download. Try both.
        if (res.data.audio_base64) {
            const bin = Buffer.from(res.data.audio_base64, 'base64');
            const outDir = path.join(__dirname, '..', 'assets', 'songs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName);
            fs.writeFileSync(outPath, bin);
            console.log('Saved generated audio to', outPath);
            // update manifest
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: prompt, audio: path.join('assets', 'songs', outName).replace(/\\/g,'/'), bpm, durationSec: duration });
            return;
        }

        if (res.data.audio_url) {
            // download
            const audioRes = await axios.get(res.data.audio_url, { responseType: 'arraybuffer' });
            const outDir = path.join(__dirname, '..', 'assets', 'songs');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName);
            fs.writeFileSync(outPath, Buffer.from(audioRes.data));
            console.log('Downloaded and saved generated audio to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: prompt, audio: path.join('assets', 'songs', outName).replace(/\\/g,'/'), bpm, durationSec: duration });
            return;
        }

        console.error('API response did not contain audio. Response keys:', Object.keys(res.data));
        console.error('Full response:', JSON.stringify(res.data).slice(0,2000));
    } catch (err) {
        console.error('Generation failed:', err && err.message ? err.message : err);
        if (err && err.response) {
            console.error('Status:', err.response.status, 'Data:', err.response.data && JSON.stringify(err.response.data).slice(0,1000));
        }
        process.exit(1);
    }
})();

function updateManifest(entry) {
    try {
        const outDir = path.join(__dirname, '..', 'assets', 'songs');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const manifestPath = path.join(outDir, 'manifest.json');
        let manifest = [];
        if (fs.existsSync(manifestPath)) {
            try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8') || '[]'); } catch(e) { manifest = []; }
        }
        // avoid duplicates by id or audio path
        const exists = manifest.some(m => m.id === entry.id || m.audio === entry.audio);
        if (!exists) {
            manifest.push(Object.assign({ generatedAt: new Date().toISOString() }, entry));
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            console.log('Updated manifest at', manifestPath);
        } else {
            console.log('Entry already exists in manifest, skipping update');
        }
    } catch (e) { console.warn('Failed to update manifest', e); }
}
