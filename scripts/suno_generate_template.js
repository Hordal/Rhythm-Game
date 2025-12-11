/**
 * Suno API 호출 템플릿
 * - 안전: API 키는 `SUNO_API_KEY` 환경변수에서 읽습니다 (절대 코드에 직접 쓰지 마세요)
 * - 사용 방법: Windows cmd에서
 *     set SUNO_API_KEY=여기에_키
 *     node scripts\suno_generate_template.js --out assets/songs/suno_song.wav --duration 30 --style "J-pop"
 * - 주의: Suno의 실제 엔드포인트와 요청 형식은 공식 문서를 따르세요. 아래 요청 본문과 URL은 예시(템플릿)입니다.
 */

const fs = require('fs');
const path = require('path');

const argv = require('process').argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    const v = argv[i+1] && !argv[i+1].startsWith('--') ? argv[i+1] : true;
    args[k] = v;
  }
}

const outFile = args.out || args.o || 'assets/songs/suno_song.wav';
const duration = Number(args.duration || 30);
const style = String(args.style || 'J-pop');
const bpm = args.bpm ? Number(args.bpm) : undefined;
const withVocal = typeof args.vocal === 'undefined' ? false : (String(args.vocal) === 'true');

const API_KEY = process.env.SUNO_API_KEY || '';
if (!API_KEY) {
  console.error('SUNO_API_KEY environment variable is not set. Set it before running.');
  process.exit(2);
}

// Replace the URL below with the correct Suno Text->Audio endpoint per their docs.
// This is a placeholder URL and request body structure — adapt to the Suno API specification.
const SUNO_API_URL = 'https://api.suno.ai/v1/generate'; // <-- 확인/교체 필요

async function generate() {
  console.log('Suno template generate:');
  console.log({ outFile, duration, style, bpm, withVocal });

  // Example prompt - customize as desired
  const prompt = `Generate a ${duration}-second ${style} instrumental track` + (withVocal ? ' with light vocal' : '') + (bpm ? ` at ${bpm} BPM` : '');

  // Example request body (VERY LIKELY you must change according to Suno docs)
  const requestBody = {
    // model or engine name may be required, check Suno docs
    model: 'suno-music-v1',
    prompt: prompt,
    length_seconds: duration,
    // optional hints
    style: style,
    bpm: bpm,
    voice: withVocal ? 'female' : 'none',
    format: 'wav'
  };

  try {
    const res = await fetch(SUNO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Suno API returned error', res.status, txt);
      process.exit(3);
    }

    // If API returns binary audio data directly
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('audio') || contentType.includes('wav') || contentType.includes('octet-stream')) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const p = path.resolve(outFile);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, buffer);
      console.log('Saved audio to', p);
      process.exit(0);
    }

    // Otherwise if API returns JSON with a URL or base64 payload
    const json = await res.json();
    // Example: { audio_url: 'https://...' } or { audio_base64: '...' }
    if (json.audio_url) {
      console.log('audio_url provided. Downloading...');
      const r2 = await fetch(json.audio_url);
      const arr = await r2.arrayBuffer();
      const buf = Buffer.from(arr);
      const p = path.resolve(outFile);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, buf);
      console.log('Saved audio to', p);
      process.exit(0);
    }
    if (json.audio_base64) {
      const buf = Buffer.from(json.audio_base64, 'base64');
      const p = path.resolve(outFile);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, buf);
      console.log('Saved audio to', p);
      process.exit(0);
    }

    console.error('Unknown response format from Suno. Inspect response:', JSON.stringify(json).slice(0,400));
    process.exit(4);
  } catch (err) {
    console.error('Request failed', err);
    process.exit(5);
  }
}

// Node v18+ has fetch available globally. If not, instruct user to run with node >=18 or install node-fetch.
if (typeof fetch === 'undefined') {
  console.error('Global fetch is not available in this Node runtime. Use Node 18+ or install a fetch polyfill.');
  process.exit(1);
}

generate();
