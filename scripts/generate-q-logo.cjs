#!/usr/bin/env node const fs = require('fs'); const path = require('path'); const sharp = require('sharp');

const input = path.join(__dirname, '..', 'public', 'q-logo.png'); const output = path.join(__dirname, '..', 'public', 'q-logo-white.png');

async function generate() { if (!fs.existsSync(input)) { console.error('Input logo not found:', input); process.exit(0); } try { await sharp(input) .tint('#ffffff') .png({ compressionLevel: 9, quality: 100 }) .toFile(output); console.log('Generated', output); } catch (err) { console.error('Error generating white logo:', err); process.exit(1); } }

generate();
