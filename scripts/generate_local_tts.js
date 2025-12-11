#!/usr/bin/env node
// Generate a short placeholder vocal WAV (simple sine tone) for testing when ElevenLabs key is missing
const fs = require('fs');
const path = require('path');
const args = require('minimist')(process.argv.slice(2));

const outName = args.out || args.o || `local_vocal_${Date.now()}.wav`;
const duration = parseFloat(args.duration || args.d || 3); // seconds
const sampleRate = 22050;
const freq = 440; // A4

const outDir = path.join(__dirname, '..', 'assets', 'songs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, outName);

function writeWav(filePath, samples, sampleRate) {
  #!/usr/bin/env node
  // Generate a short placeholder vocal WAV (simple sine tone) for testing when ElevenLabs key is missing
  const fs = require('fs');
  const path = require('path');
  const args = require('minimist')(process.argv.slice(2));

  const outName = args.out || args.o || `local_vocal_${Date.now()}.wav`;
  const duration = parseFloat(args.duration || args.d || 3); // seconds
  const sampleRate = 22050;
  const freq = 440; // A4

  const outDir = path.join(__dirname, '..', 'assets', 'songs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, outName);

  function writeWav(filePath, samples, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = samples.length * 2;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // subchunk1Size
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const buffer = Buffer.alloc(44 + dataSize);
    header.copy(buffer, 0);
    for (let i = 0; i < samples.length; i++) {
      buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.floor(samples[i] * 32767))), 44 + i*2);
    }
    fs.writeFileSync(filePath, buffer);
  }

  const samples = [];
  const total = Math.floor(sampleRate * duration);
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    // fade in/out
    const env = Math.min(1, t*4, (duration - t)*4);
    const s = Math.sin(2 * Math.PI * freq * t) * 0.2 * env;
    samples.push(s);
  }

  writeWav(outPath, samples, sampleRate);
  console.log('Generated local placeholder vocal at', outPath);
  *** End Patch