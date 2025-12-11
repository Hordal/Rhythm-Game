#!/usr/bin/env node
// Template to call a vocal-synthesis API (Uberduck-like) and save result to assets/songs
// Usage: node generate_uberduck.js --text "lyrics here" --voice 'ryan' --out vocal1.wav

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const args = require('minimist')(process.argv.slice(2));

const text = args.text || args.t || 'la la la';
const voice = args.voice || args.v || 'ryan';
const outName = args.out || args.o || `vocal_${Date.now()}.wav`;

// Set these environment variables before running: UBERDUCK_API_KEY, UBERDUCK_API_SECRET
const API_KEY = process.env.UBERDUCK_API_KEY;
const API_SECRET = process.env.UBERDUCK_API_SECRET;
// Example endpoint placeholder - replace with actual provider endpoint
const API_URL = process.env.UBERDUCK_API_URL || 'https://api.uberduck.ai/speak-online';

if (!API_KEY || !API_SECRET) {
    console.error('Please set UBERDUCK_API_KEY and UBERDUCK_API_SECRET environment variables');
    process.exit(1);
}

(async function main(){
    try {
        console.log('Requesting vocal generation', { voice, outName });
        // The request shape depends on provider. This template posts JSON and expects either audio_base64 or audio_url.
        const payload = { voice, speech: text, format: 'wav' };

        const res = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Basic ${Buffer.from(API_KEY + ':' + API_SECRET).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!res || !res.data) throw new Error('Empty response from API');

        if (res.data.audio_base64) {
            const bin = Buffer.from(res.data.audio_base64, 'base64');
            const outDir = path.join(__dirname, '..', 'assets', 'songs'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName); fs.writeFileSync(outPath, bin);
            console.log('Saved vocal to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: 'Vocal - ' + voice, audio: path.join('assets','songs', outName).replace(/\\/g,'/'), bpm: null, durationSec: null });
            return;
        }

        if (res.data.audio_url) {
            const audioRes = await axios.get(res.data.audio_url, { responseType: 'arraybuffer' });
            const outDir = path.join(__dirname, '..', 'assets', 'songs'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName); fs.writeFileSync(outPath, Buffer.from(audioRes.data));
            console.log('Downloaded vocal to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: 'Vocal - ' + voice, audio: path.join('assets','songs', outName).replace(/\\/g,'/'), bpm: null, durationSec: null });
            return;
        }

        console.error('API did not return audio. Response keys:', Object.keys(res.data));
    } catch (err) {
        console.error('Vocal generation failed:', err && err.message ? err.message : err);
        if (err && err.response) console.error('Status:', err.response.status, 'Data:', err.response.data);
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
#!/usr/bin/env node
// Template to call a vocal-synthesis API (Uberduck-like) and save result to assets/songs
// Usage: node generate_uberduck.js --text "lyrics here" --voice 'ryan' --out vocal1.wav

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const args = require('minimist')(process.argv.slice(2));

const text = args.text || args.t || 'la la la';
const voice = args.voice || args.v || 'ryan';
const outName = args.out || args.o || `vocal_${Date.now()}.wav`;

// Set these environment variables before running: UBERDUCK_API_KEY, UBERDUCK_API_SECRET
const API_KEY = process.env.UBERDUCK_API_KEY;
const API_SECRET = process.env.UBERDUCK_API_SECRET;
// Example endpoint placeholder - replace with actual provider endpoint
const API_URL = process.env.UBERDUCK_API_URL || 'https://api.uberduck.ai/speak-online';

if (!API_KEY || !API_SECRET) {
    console.error('Please set UBERDUCK_API_KEY and UBERDUCK_API_SECRET environment variables');
    process.exit(1);
}

(async function main(){
    try {
        console.log('Requesting vocal generation', { voice, outName });
        // The request shape depends on provider. This template posts JSON and expects either audio_base64 or audio_url.
        const payload = { voice, speech: text, format: 'wav' };

        const res = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Basic ${Buffer.from(API_KEY + ':' + API_SECRET).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        if (!res || !res.data) throw new Error('Empty response from API');

        if (res.data.audio_base64) {
            const bin = Buffer.from(res.data.audio_base64, 'base64');
            const outDir = path.join(__dirname, '..', 'assets', 'songs'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName); fs.writeFileSync(outPath, bin);
            console.log('Saved vocal to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: 'Vocal - ' + voice, audio: path.join('assets','songs', outName).replace(/\\/g,'/'), bpm: null, durationSec: null });
            return;
        }

        if (res.data.audio_url) {
            const audioRes = await axios.get(res.data.audio_url, { responseType: 'arraybuffer' });
            const outDir = path.join(__dirname, '..', 'assets', 'songs'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, outName); fs.writeFileSync(outPath, Buffer.from(audioRes.data));
            console.log('Downloaded vocal to', outPath);
            updateManifest({ id: path.basename(outName, path.extname(outName)), name: 'Vocal - ' + voice, audio: path.join('assets','songs', outName).replace(/\\/g,'/'), bpm: null, durationSec: null });
            return;
        }

        console.error('API did not return audio. Response keys:', Object.keys(res.data));
    } catch (err) {
        console.error('Vocal generation failed:', err && err.message ? err.message : err);
        if (err && err.response) console.error('Status:', err.response.status, 'Data:', err.response.data);
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
