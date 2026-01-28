#!/usr/bin/env node
// scripts/prepare-deploy.js
// Prepares files for GitHub Pages deployment by replacing local script tags with CDN

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const deployDir = join(rootDir, 'deploy');

// Get version from package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, '../package.json'), 'utf-8'));
const version = packageJson.version;

console.log(`Preparing deployment (version: ${version})...`);

// Clean and create deploy directory
rmSync(deployDir, { recursive: true, force: true });
mkdirSync(deployDir, { recursive: true });

// Copy static files
console.log('Copying static files...');
cpSync(join(rootDir, 'styles.css'), join(deployDir, 'styles.css'));

// Copy public folder if it exists
try {
  cpSync(join(rootDir, 'public'), join(deployDir, 'public'), { recursive: true });
} catch (err) {
  console.log('  (no public folder, skipping)');
}

// HTML files to process
const htmlFiles = ['index.html', 'demo.html', 'about.html', 'contact.html', 'test-cdn.html'];

// Pattern to find local script tag
const localScriptPattern = /<script type="module" src="\/src\/index\.ts" data-auto-init="true"><\/script>/g;

// CDN script replacement
const cdnScript = `<script src="https://cdn.jsdelivr.net/npm/@codewithdan/zingit@${version}/client/dist/zingit-client.js"></script>`;

console.log('Processing HTML files...');
htmlFiles.forEach(file => {
  try {
    const filePath = join(rootDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Replace local script with CDN script
    const updated = content.replace(localScriptPattern, cdnScript);

    // Write to deploy directory
    writeFileSync(join(deployDir, file), updated);
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.log(`  ⚠ ${file} (not found, skipping)`);
  }
});

console.log(`\nDeployment files ready in ./deploy`);
console.log(`Using CDN: https://cdn.jsdelivr.net/npm/@codewithdan/zingit@${version}/client/dist/zingit-client.js`);
