const core = require('@actions/core');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const owner = 'RickIsGone';
const repo = 'install-llvm-stripped';
const tag = 'v1.0.0';
const assetName = 'llvm-stripped.7z';

async function downloadFile(url, dest) {
   const file = fs.createWriteStream(dest);
   return new Promise((resolve, reject) => {
      https.get(url, (res) => {
         if (res.statusCode !== 200) {
            reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
            return;
         }
         res.pipe(file);
         file.on('finish', () => file.close(resolve));
      }).on('error', reject);
   });
}

async function run() {
   try {
      const outputDir = path.join(process.env['GITHUB_WORKSPACE'], 'llvm');
      if (!fs.existsSync(outputDir)) {
         fs.mkdirSync(outputDir, { recursive: true });
      }

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
      const headers = { 'User-Agent': 'github-action' };

      console.log(`Fetching release info from ${apiUrl}`);
      const release = await fetchJson(apiUrl, headers);

      const asset = release.assets.find(a => a.name === assetName);
      if (!asset) {
         throw new Error(`Asset '${assetName}' not found in release '${tag}'`);
      }

      const downloadUrl = asset.browser_download_url;
      const zipPath = path.join(process.env['RUNNER_TEMP'], assetName);
      console.log(`Downloading ${downloadUrl} to ${zipPath}`);
      await downloadFile(downloadUrl, zipPath);

      console.log(`Extracting ${zipPath} to ${outputDir}`);
      execSync(`7z x "${zipPath}" -o"${outputDir}" -y`, { stdio: 'inherit' });

      console.log('LLVM successfully extracted.');
   } catch (error) {
      core.setFailed(error.message);
   }
}

async function fetchJson(url, headers) {
   return new Promise((resolve, reject) => {
      https.get(url, { headers }, (res) => {
         let data = '';
         res.on('data', chunk => data += chunk);
         res.on('end', () => {
            if (res.statusCode === 200) {
               resolve(JSON.parse(data));
            } else {
               reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
         });
      }).on('error', reject);
   });
}

run();
