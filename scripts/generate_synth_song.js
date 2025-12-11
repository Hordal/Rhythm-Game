// Simple Node.js script to synthesize a short melody and write as WAV
// Usage: node scripts\generate_synth_song.js [output.wav] [durationSec]
// Example: node scripts\generate_synth_song.js synth_song.wav 20

const fs = require('fs');
const path = require('path');

function writeWav(filePath, samples, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  function writeString(s) { buffer.write(s, offset); offset += s.length; }
  function writeUInt32(v) { buffer.writeUInt32LE(v, offset); offset += 4; }
  function writeUInt16(v) { buffer.writeUInt16LE(v, offset); offset += 2; }

  writeString('RIFF');
  writeUInt32(36 + dataSize);
  writeString('WAVE');
  writeString('fmt ');
  writeUInt32(16); // PCM
  writeUInt16(1); // audio format PCM
  writeUInt16(numChannels);
  writeUInt32(sampleRate);
  writeUInt32(byteRate);
  writeUInt16(blockAlign);
  writeUInt16(8 * bytesPerSample);
  writeString('data');
  writeUInt32(dataSize);

  // write samples (clamp to int16)
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.round(s * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// simple melody (MIDI notes) and durations (beats)
const melody = [
  [60, 1], [62, 1], [64, 1], [65, 1],
  [67, 2], [65, 1], [64, 1], [62, 2],
  [60, 2], [0, 1], [67, 2]
];

function synthSong(output = 'synth_song.wav', durationSec = 20) {
  const sampleRate = 44100;
  const bpm = 100;
  const secPerBeat = 60 / bpm;
  const totalSamples = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Compose sequence by repeating melody until duration
  let t = 0; // seconds
  let i = 0;
  while (t < durationSec) {
    const [note, beats] = melody[i % melody.length];
    const dur = beats * secPerBeat;
    const f = note === 0 ? 0 : midiToFreq(note);
    const startSample = Math.floor(t * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((t + dur) * sampleRate));
    for (let s = startSample; s < endSample; s++) {
      const tt = (s - startSample) / sampleRate;
      // envelope
      const env = Math.min(1, tt * 8); // quick attack
      const decay = 1 - Math.pow((tt / dur), 1.2);
      let v = 0;
      if (f > 0) {
        // add two partials for a richer tone
        v += 0.6 * Math.sin(2 * Math.PI * f * tt);
        v += 0.25 * Math.sin(2 * Math.PI * f * 2 * tt);
      }
      v *= env * decay * 0.7; // global gain
      samples[s] += v;
    }
    t += dur;
    i++;
    if (i > 10000) break; // safety
  }

  // simple limiter/normalize
  let max = 0;
  for (let k = 0; k < samples.length; k++) max = Math.max(max, Math.abs(samples[k]));
  if (max > 0.95) {
    const scale = 0.95 / max;
    for (let k = 0; k < samples.length; k++) samples[k] *= scale;
  }

  const outPath = path.resolve(output);
  writeWav(outPath, samples, sampleRate);
  console.log('WAV written to', outPath);
}

// CLI
const argv = process.argv.slice(2);
const out = argv[0] || 'synth_song.wav';
const dur = Number(argv[1]) || 20;
synthSong(out, dur);

// End
