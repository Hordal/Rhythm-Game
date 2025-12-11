const fs = require('fs');
const path = require('path');
const pkg = {
  name: 'bangdream-local',
  version: '0.1.0',
  description: 'Local rhythm game workspace with AI song generation helpers',
  main: 'game.js',
  scripts: {
    'install-deps': 'npm install',
    'generate-all': 'node scripts/generate_all.js'
  },
  author: '',
  license: 'MIT',
  dependencies: {
    axios: '^1.4.0',
    minimist: '^1.2.8'
  }
};
const outPath = path.join(__dirname, '..', 'package.json');
fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('Wrote', outPath);
