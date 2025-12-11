#!/usr/bin/env node
// Create pleasant-sounding placeholder WAV files (no external deps)
// Usage: node scripts/make_placeholder_songs.js --count 3 --duration 20 --outPrefix placeholder

const fs = require('fs');
const path = require('path');
const args = require('minimist')(process.argv.slice(2));

const count = parseInt(args.count || args.c || 3, 10);
const duration = parseFloat(args.duration || args.d || 20); // seconds
const outPrefix = args.outPrefix || args.o || 'placeholder';
const sampleRate = 44100;
const channels = 1;

function writeWav(filePath, samples, sampleRate, channels) {
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(36 + dataSize, offset); offset += 4; // file size - 8
    buffer.write('WAVE', offset); offset += 4;
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // subchunk1 size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM
    buffer.writeUInt16LE(channels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    // write samples
    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.round(s * 0x7fff), offset);
        offset += 2;
    }
    fs.writeFileSync(filePath, buffer);
}

function generateMelody(durationSec, sampleRate) {
    const total = Math.floor(durationSec * sampleRate);
    const samples = new Float32Array(total);
    // choose a simple scale and chord progression
    const baseFreq = 220; // A3
    const scale = [0, 2, 4, 5, 7, 9, 11, 12]; // major scale intervals
    const chordRoots = [0, 4, 5, 3];
    for (let i = 0; i < total; i++) {
        const t = i / sampleRate;
        // melody moves every half-second
        const beat = Math.floor(t * 2);
        const note = scale[(beat + 2) % scale.length];
        const freq = baseFreq * Math.pow(2, (note + 12 * ((Math.floor(t/8))%2))/12);
        // carrier
        let s = 0;
        // add a couple harmonics for warmth
        s += 0.6 * Math.sin(2 * Math.PI * freq * t);
        s += 0.25 * Math.sin(2 * Math.PI * freq * 2 * t);
        s += 0.1 * Math.sin(2 * Math.PI * freq * 3 * t);
        // gentle amplitude modulation
        s *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.2 * t);
        // simple ADSR per note
        const notePos = (t % 0.5) / 0.5; // 0..1
        let env = 1.0;
        if (notePos < 0.1) env = notePos / 0.1; // attack
        else if (notePos > 0.85) env = Math.max(0, (1 - (notePos - 0.85)/0.15)); // release
        s *= env;
        samples[i] = s * 0.9;
    }
    // fade out last 0.5s
    const fadeSamples = Math.min(sampleRate * 0.5, total);
    for (let i = 0; i < fadeSamples; i++) {
        const idx = total - 1 - i;
        samples[idx] *= i / fadeSamples;
    }
    return samples;
}

function main() {
    const outDir = path.join(__dirname, '..', 'assets', 'songs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const manifestPath = path.join(outDir, 'manifest.json');
    let manifest = [];
    for (let i = 1; i <= count; i++) {
        const name = `${outPrefix}_${i}.wav`;
        const filePath = path.join(outDir, name);
        console.log('Generating', filePath, 'duration', duration);
        const samples = generateMelody(duration, sampleRate);
        writeWav(filePath, samples, sampleRate, channels);
        manifest.push({ id: outPrefix + '_' + i, name: `Placeholder ${i}`, artist: 'LocalSynth', audio: path.posix.join('assets','songs', name), bpm: 120, durationSec: duration, generatedAt: new Date().toISOString() });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('Wrote manifest with', manifest.length, 'entries to', manifestPath);
}

main();
