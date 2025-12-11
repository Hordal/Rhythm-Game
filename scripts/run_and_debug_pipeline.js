#!/usr/bin/env node
// Helper to run the generate_all pipeline and collect logs + environment checks
// Usage:
//  node scripts/run_and_debug_pipeline.js --dry-run
//  node scripts/run_and_debug_pipeline.js --prompt "upbeat" --lyrics "la la" --voice alloy --out demo_track --bpm 140 --duration 24

const fs = require('fs');
const path = require('path');
const { spawnSync, spawn, execSync } = require('child_process');
const args = require('minimist')(process.argv.slice(2), { boolean: ['dry-run','help'] });

const root = path.join(__dirname, '..');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function checkTool(cmd) {
  try {
    const out = execSync(cmd, { stdio: ['ignore','pipe','ignore'] }).toString().trim();
    return out;
  } catch (e) {
    return null;
  }
}

function nowLabel() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g,'-');
}

function usage() {
  console.log('Run and debug AI-gen pipeline');
  console.log('Options: --dry-run, --prompt, --lyrics, --voice, --out, --bpm, --duration');
}

if (args.help) { usage(); process.exit(0); }

console.log('Environment checks:');
console.log(' Node:', checkTool('node -v') || 'NOT FOUND');
console.log(' NPM :', checkTool('npm -v') || 'NOT FOUND');
const ffmpegCmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
console.log(' FFmpeg:', checkTool(ffmpegCmd) ? 'FOUND' : 'NOT FOUND (mix step will fail without ffmpeg)');

if (args['dry-run']) {
  console.log('\nDry run complete. No network calls or installs performed.');
  console.log('If env looks good, run without --dry-run to execute the pipeline.');
  process.exit(0);
}

// 1) npm install
console.log('\nRunning `npm install` to ensure dependencies...');
const npmRes = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit' });
if (npmRes.error || npmRes.status !== 0) {
  console.error('npm install failed — check network/permissions and retry.');
  process.exit(1);
}

// 2) Build generate_all args from this script's args (pass-through)
const passArgs = [];
['prompt','lyrics','voice','out','bpm','duration'].forEach(k => { if (typeof args[k] !== 'undefined') { passArgs.push(`--${k}`); passArgs.push(String(args[k])); } });
if (passArgs.length === 0) {
  console.log('No generation args provided; using defaults in generate_all.js');
}

const timestamp = nowLabel();
const stdoutLog = path.join(logsDir, `gen_stdout_${timestamp}.log`);
const stderrLog = path.join(logsDir, `gen_stderr_${timestamp}.log`);
console.log('Logs will be written to:', stdoutLog, stderrLog);

// 3) Execute generate_all.js via node
const scriptPath = path.join(root, 'scripts', 'generate_all.js');
const nodeArgs = [scriptPath].concat(passArgs);
console.log('Spawning: node', nodeArgs.join(' '));

const outStream = fs.createWriteStream(stdoutLog, { flags: 'a' });
const errStream = fs.createWriteStream(stderrLog, { flags: 'a' });

const child = spawn(process.execPath, nodeArgs, { cwd: root, env: process.env, windowsHide: false });
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.stdout.pipe(outStream);
child.stderr.pipe(errStream);

child.on('close', code => {
  outStream.end(); errStream.end();
  console.log('\ngenerate_all.js exited with code', code);
  console.log('Saved stdout ->', stdoutLog);
  console.log('Saved stderr ->', stderrLog);
  if (code === 0) {
    console.log('Pipeline finished successfully. Check `assets/songs/` and `assets/songs/manifest.json`.');
  } else {
    console.log('Pipeline failed. Please paste the contents of the stderr log here for help.');
  }
  process.exit(code);
});
