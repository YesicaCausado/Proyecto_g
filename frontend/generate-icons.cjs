const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">
  <rect width="192" height="192" rx="38" fill="#0B6E99"/>
  <text x="96" y="130" font-family="Arial,sans-serif" font-size="110" font-weight="bold" fill="white" text-anchor="middle">N</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="102" fill="#0B6E99"/>
  <text x="256" y="345" font-family="Arial,sans-serif" font-size="290" font-weight="bold" fill="white" text-anchor="middle">N</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svg192);
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svg512);
console.log('SVG icons created in /public');
