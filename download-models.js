const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models', 'human');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://vladmandic.github.io/human-models/models/';
const files = [
  'blazeface-front.json', 'blazeface-front.bin',
  'blazeface-back.json', 'blazeface-back.bin',
  'faceres.json', 'faceres.bin'
];

async function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const dest = path.join(modelsDir, filename);
    const file = fs.createWriteStream(dest);
    https.get(baseUrl + filename, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading models...');
  for (const file of files) {
    console.log(`Downloading ${file}...`);
    try {
      await downloadFile(file);
      console.log(`Success: ${file}`);
    } catch (e) {
      console.error(`Failed: ${file}`, e);
    }
  }
  console.log('Done!');
}

main();
