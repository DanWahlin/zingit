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

// Copy images folder
try {
  cpSync(join(rootDir, 'images'), join(deployDir, 'images'), { recursive: true });
  console.log('  ✓ images folder');
} catch (err) {
  console.log('  ⚠ images folder not found, skipping');
}

// Copy dist folder
try {
  cpSync(join(rootDir, 'dist'), join(deployDir, 'dist'), { recursive: true });
  console.log('  ✓ dist folder');
} catch (err) {
  console.log('  ⚠ dist folder not found, skipping');
}

// Copy public folder if it exists
try {
  cpSync(join(rootDir, 'public'), join(deployDir, 'public'), { recursive: true });
  console.log('  ✓ public folder');
} catch (err) {
  console.log('  (no public folder, skipping)');
}

// HTML files to process
const htmlFiles = ['index.html', 'demo.html', 'about.html', 'contact.html', 'test-cdn.html'];

// Pattern to find local script tag
const localScriptPattern = /<script type="module" src="\/src\/index\.ts" data-auto-init="true"><\/script>/g;

// Local dist script for GitHub Pages
const localScript = `<script src="./dist/zingit-client.js"></script>`;

console.log('Processing HTML files...');
htmlFiles.forEach(file => {
  try {
    const filePath = join(rootDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Replace local script with local dist script for GitHub Pages
    const updated = content.replace(localScriptPattern, localScript);

    // Write to deploy directory
    writeFileSync(join(deployDir, file), updated);
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.log(`  ⚠ ${file} (not found, skipping)`);
  }
});

console.log(`\nDeployment files ready in ./deploy`);
console.log(`Using local dist: ./dist/zingit-client.js`);
